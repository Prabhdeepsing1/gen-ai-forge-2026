# backend/routers/build_paper.py
"""
Build Paper — autonomous research paper generation pipeline.

Flow:
  1. User provides a research topic/title idea.
  2. LLM refines it into an optimal arXiv search query.
  3. Relevant papers are fetched from arXiv (15-20 results).
  4. User selects papers of interest.
  5. Agent generates a full research paper section-by-section (SSE stream
     with progress updates so the frontend can show a progress bar).
"""

import json
import httpx
import xml.etree.ElementTree as ET
from typing import List, Optional
from fastapi import APIRouter, HTTPException, Depends, Query
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from models import User
from utils.auth import get_current_user
from utils.groq_client import client as groq_client, MODEL_CONFIG

router = APIRouter(prefix="/build-paper", tags=["Build Paper"])

ARXIV_API = "https://export.arxiv.org/api/query"
NS = {
    "atom":    "http://www.w3.org/2005/Atom",
    "arxiv":   "http://arxiv.org/schemas/atom",
    "opensearch": "http://a9.com/-/spec/opensearch/1.1/",
}


# ── Schemas ───────────────────────────────────────────────────────────────────

class RefineQueryRequest(BaseModel):
    user_topic: str


class SelectedPaper(BaseModel):
    title: str
    authors: Optional[List[str]] = []
    abstract: Optional[str] = None
    published: Optional[str] = None
    url: Optional[str] = None


class GeneratePaperRequest(BaseModel):
    topic: str
    papers: List[SelectedPaper]


# ── arXiv helper (reused from papers.py) ──────────────────────────────────────

def _parse_arxiv_entry(entry) -> dict:
    title = entry.findtext("atom:title", namespaces=NS) or ""
    abstract = entry.findtext("atom:summary", namespaces=NS) or ""
    published = entry.findtext("atom:published", namespaces=NS) or ""

    id_tag = entry.findtext("atom:id", namespaces=NS) or ""
    arxiv_id = id_tag.split("/abs/")[-1] if "/abs/" in id_tag else id_tag

    authors = [
        a.findtext("atom:name", namespaces=NS) or ""
        for a in entry.findall("atom:author", namespaces=NS)
    ]

    links = entry.findall("atom:link", namespaces=NS)
    pdf_url = next(
        (l.get("href") for l in links if l.get("type") == "application/pdf"),
        None,
    )
    html_url = next(
        (l.get("href") for l in links if l.get("type") == "text/html"),
        id_tag,
    )

    return {
        "external_id": arxiv_id,
        "title": title.strip().replace("\n", " "),
        "authors": authors,
        "abstract": abstract.strip().replace("\n", " "),
        "published": published[:10],
        "source": "arxiv",
        "url": html_url,
        "pdf_url": pdf_url,
    }


# ── 1. Refine user topic into arXiv search query ─────────────────────────────

REFINE_SYSTEM = (
    "You are a research query optimizer. The user will give you a rough research "
    "topic or idea. Your job is to produce a concise, effective search query "
    "suitable for the arXiv API (max 10 words). Return ONLY the query string, "
    "nothing else — no quotes, no explanation."
)


@router.post("/refine-query")
def refine_query(
    payload: RefineQueryRequest,
    current_user: User = Depends(get_current_user),
):
    """Use LLM to turn a rough topic into an optimized arXiv search query."""
    try:
        resp = groq_client.chat.completions.create(
            messages=[
                {"role": "system", "content": REFINE_SYSTEM},
                {"role": "user", "content": payload.user_topic},
            ],
            model=MODEL_CONFIG["model"],
            temperature=0.3,
            max_tokens=60,
            top_p=1,
        )
        refined = resp.choices[0].message.content.strip().strip('"').strip("'")
        return {"original": payload.user_topic, "refined_query": refined}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"LLM query refinement failed: {e}")


# ── 2. Search arXiv with refined query ───────────────────────────────────────

@router.get("/search")
async def search_arxiv(
    query: str = Query(..., min_length=2),
    max_results: int = Query(default=20, le=30),
    current_user: User = Depends(get_current_user),
):
    """Search arXiv, returning up to 20 papers for the Build Paper flow."""
    params = {
        "search_query": f"all:{query}",
        "start": 0,
        "max_results": max_results,
        "sortBy": "relevance",
        "sortOrder": "descending",
    }

    async with httpx.AsyncClient(timeout=30.0) as http:
        resp = await http.get(ARXIV_API, params=params)

    if resp.status_code != 200:
        raise HTTPException(status_code=502, detail="Failed to reach arXiv API")

    root = ET.fromstring(resp.text)
    entries = root.findall("atom:entry", namespaces=NS)
    papers = [_parse_arxiv_entry(e) for e in entries]

    return {"papers": papers, "total": len(papers), "query": query}


# ── 3. Generate full research paper (multi-phase pipeline) ───────────────────

PAPER_SECTIONS = [
    "Planning",
    "Reasoning & Analysis",
    "Title & Abstract",
    "Introduction",
    "Related Work",
    "Methodology",
    "Results & Discussion",
    "Conclusion",
    "References",
]


def _build_papers_context(papers: List[SelectedPaper]) -> str:
    """Build a formatted block of all papers for prompts."""
    block = ""
    for i, p in enumerate(papers, 1):
        authors_str = ", ".join(p.authors) if p.authors else "Unknown"
        block += (
            f"\n--- Paper {i} ---\n"
            f"Title: {p.title}\n"
            f"Authors: {authors_str}\n"
            f"Published: {p.published or 'N/A'}\n"
            f"Abstract: {p.abstract or 'No abstract'}\n"
            f"URL: {p.url or 'N/A'}\n"
        )
    return block


# ── Phase prompts ────────────────────────────────────────────────────────────

PLANNING_SYSTEM = (
    "You are a senior academic research planner. Given a research topic and a set of "
    "reference papers (titles, authors, abstracts), create a DETAILED outline for a "
    "comprehensive research paper.\n\n"
    "Your outline must include:\n"
    "1. A proposed paper title\n"
    "2. 3-4 research questions or objectives to address\n"
    "3. For EACH section below, list 4-6 specific sub-points to cover:\n"
    "   - Abstract (key claims, scope, contributions)\n"
    "   - Introduction (background themes, motivation, problem statement, research gap, objectives)\n"
    "   - Related Work (group papers thematically, identify 3-4 sub-categories, note which papers go where)\n"
    "   - Methodology (analytical framework, comparison criteria, evaluation dimensions)\n"
    "   - Results & Discussion (key findings per theme, comparisons, tables to include, conflicting evidence)\n"
    "   - Conclusion (summary points, implications, 3+ future research directions)\n"
    "   - References (list all papers with proper citation format)\n"
    "4. Identify key connections, agreements, and conflicts between papers\n"
    "5. Propose 1-2 tables or comparative frameworks\n\n"
    "Be thorough and scholarly. This outline will drive a 8-10 page paper."
)

REASONING_SYSTEM = (
    "You are an expert research analyst. Given a research topic, reference papers, and "
    "a paper outline, perform deep analytical reasoning:\n\n"
    "1. **Thematic Analysis**: Identify 4-5 major themes that connect the papers. "
    "For each theme, explain which papers contribute and how.\n"
    "2. **Critical Gaps**: Identify 3-4 gaps, contradictions, or under-explored areas "
    "across the papers.\n"
    "3. **Methodological Comparison**: Compare the approaches/methods used across papers — "
    "strengths, weaknesses, trade-offs.\n"
    "4. **Key Contributions Mapping**: For each paper, distill its unique contribution "
    "in 2-3 sentences.\n"
    "5. **Synthesis Strategy**: Explain how to weave these papers together into a "
    "coherent narrative rather than paper-by-paper summaries.\n"
    "6. **Comparative Framework**: Design a comparison table structure "
    "(columns = criteria, rows = papers/approaches).\n\n"
    "Be analytical, not descriptive. Focus on connections and critical evaluation."
)

SECTION_PROMPTS = {
    "Title & Abstract": (
        "Write the paper TITLE (as <h1>) and ABSTRACT section.\n\n"
        "The abstract must be 250-350 words and include:\n"
        "- Context and background (2-3 sentences)\n"
        "- Problem statement and research gap (2 sentences)\n"
        "- Purpose and scope of this paper (2 sentences)\n"
        "- Methodology overview (1-2 sentences)\n"
        "- Key findings and contributions (3-4 sentences)\n"
        "- Implications and significance (1-2 sentences)\n\n"
        "Use <h2>Abstract</h2> for the section heading. Use <p> for paragraphs. "
        "Include a <strong>Keywords:</strong> line with 5-6 relevant keywords."
    ),
    "Introduction": (
        "Write a COMPREHENSIVE Introduction section (800-1000 words).\n\n"
        "Structure it with the following subsections (use <h3> for subsections):\n"
        "  <h3>Background</h3> — Broad context and importance of the research area (2-3 paragraphs)\n"
        "  <h3>Problem Statement</h3> — The specific problem or gap being addressed (1-2 paragraphs)\n"
        "  <h3>Research Objectives</h3> — Clear objectives or research questions as a numbered list\n"
        "  <h3>Scope and Contributions</h3> — What this paper covers and its key contributions (1-2 paragraphs)\n"
        "  <h3>Paper Organization</h3> — Brief overview of how the rest of the paper is structured (1 paragraph)\n\n"
        "Use <h2>1. Introduction</h2> for the main heading. Cite relevant papers inline "
        "using (Author et al., Year) format. Be detailed, scholarly, and thorough."
    ),
    "Related Work": (
        "Write a VERY DETAILED Related Work section (1200-1500 words).\n\n"
        "DO NOT write paper-by-paper summaries. Instead, organize thematically:\n"
        "  - Identify 3-5 major themes or categories from the papers\n"
        "  - Use <h3> for each thematic subsection\n"
        "  - Under each theme, discuss multiple papers together, comparing approaches\n"
        "  - Highlight agreements, conflicts, and evolution of ideas\n"
        "  - Include a comparative <table> with at least 4-5 columns comparing papers "
        "    across criteria like method, dataset, key result, limitations\n"
        "  - End with a paragraph identifying the gap this paper addresses\n\n"
        "Use <h2>2. Related Work</h2> for the main heading. "
        "Cite every paper at least once. Be critical and analytical, not just descriptive."
    ),
    "Methodology": (
        "Write a DETAILED Methodology section (800-1000 words).\n\n"
        "This should describe the analytical/synthesis framework used in this paper:\n"
        "  <h3>Research Design</h3> — Type of study (systematic review, meta-analysis, comparative study, etc.)\n"
        "  <h3>Paper Selection Criteria</h3> — How and why these specific papers were chosen\n"
        "  <h3>Analytical Framework</h3> — The framework or criteria used to analyze and compare the papers. "
        "Include a visual/structured representation if possible (e.g., a framework table or categorization)\n"
        "  <h3>Evaluation Criteria</h3> — Specific dimensions along which papers are evaluated "
        "(e.g., accuracy, scalability, novelty, applicability)\n"
        "  <h3>Synthesis Approach</h3> — How findings are synthesized across papers (thematic analysis, statistical comparison, etc.)\n\n"
        "Use <h2>3. Methodology</h2> for the main heading. Be precise and scholarly."
    ),
    "Results & Discussion": (
        "Write a VERY COMPREHENSIVE Results & Discussion section (1200-1500 words).\n\n"
        "Structure with the following:\n"
        "  <h3>Overview of Findings</h3> — Summarize the landscape of results across all papers (1-2 paragraphs)\n"
        "  <h3>[Thematic Finding 1]</h3> — Deep analysis of one major finding theme (2-3 paragraphs) with citations\n"
        "  <h3>[Thematic Finding 2]</h3> — Another finding theme (2-3 paragraphs)\n"
        "  <h3>[Thematic Finding 3]</h3> — Another finding theme (2-3 paragraphs)\n"
        "  <h3>Comparative Analysis</h3> — Include a detailed <table> comparing key results across papers\n"
        "  <h3>Agreements & Contradictions</h3> — Where papers agree, where they conflict, and why (2 paragraphs)\n"
        "  <h3>Implications</h3> — What these combined findings mean for the field (2 paragraphs)\n\n"
        "Use <h2>4. Results & Discussion</h2> for the main heading. Use <strong> for emphasis on key findings. "
        "Be analytical — don't just list results, INTERPRET them. Include at least one <blockquote> for a critical insight."
    ),
    "Conclusion": (
        "Write a thorough Conclusion section (600-800 words).\n\n"
        "Include:\n"
        "  <h3>Summary of Key Findings</h3> — Recap the most important findings (3-4 paragraphs)\n"
        "  <h3>Contributions</h3> — What this paper contributes to the field (1-2 paragraphs)\n"
        "  <h3>Limitations</h3> — Limitations of this study and the reviewed papers (1 paragraph)\n"
        "  <h3>Future Research Directions</h3> — At least 4-5 specific, actionable research directions "
        "as a numbered/bulleted list with 2-3 sentence descriptions each\n"
        "  <h3>Closing Remarks</h3> — Final impactful statement about the field's trajectory (1 paragraph)\n\n"
        "Use <h2>5. Conclusion</h2> for the main heading."
    ),
    "References": (
        "Write the References section.\n\n"
        "List ALL papers referenced in the text in a consistent academic citation format:\n"
        "  Author(s) (Year). Title. Source/Journal. URL.\n\n"
        "Use <h2>References</h2> for the heading. Format as a numbered <ol> list. "
        "Include every paper that was provided as a reference. Ensure names, years, and titles are accurate."
    ),
}


def _stream_llm(messages: list, max_tokens: int = 4096):
    """Helper: stream Groq completion, yielding content tokens."""
    stream = groq_client.chat.completions.create(
        messages=messages,
        model=MODEL_CONFIG["model"],
        temperature=0.7,
        max_tokens=max_tokens,
        top_p=1,
        stream=True,
    )
    for chunk in stream:
        delta = chunk.choices[0].delta
        if delta and delta.content:
            yield delta.content


def _collect_llm(messages: list, max_tokens: int = 4096) -> str:
    """Helper: get a full completion (non-streaming) from Groq."""
    resp = groq_client.chat.completions.create(
        messages=messages,
        model=MODEL_CONFIG["model"],
        temperature=0.7,
        max_tokens=max_tokens,
        top_p=1,
    )
    return resp.choices[0].message.content or ""


@router.post("/generate")
def generate_paper(
    payload: GeneratePaperRequest,
    current_user: User = Depends(get_current_user),
):
    """Generate a full research paper via a multi-phase pipeline (SSE).

    Phases:
      1. Planning  — LLM creates a detailed paper outline
      2. Reasoning — LLM analyzes papers, finds themes & gaps
      3-9. Section-by-section generation — each section individually

    SSE events:
      - {"type": "section", "section": "Planning"}      — phase/section start
      - {"type": "content", "html": "<p>..."}            — HTML chunk
      - {"type": "plan", "text": "..."}                  — planning output (not shown in paper)
      - {"type": "reasoning", "text": "..."}             — reasoning output (not shown in paper)
      - {"type": "done"}                                 — all complete
      - {"type": "error", "message": "..."}              — error
    """
    if not payload.papers:
        raise HTTPException(status_code=400, detail="No papers selected")

    papers_context = _build_papers_context(payload.papers)

    def generate():
        try:
            # ── Phase 1: Planning ────────────────────────────────────────
            yield f"data: {json.dumps({'type': 'section', 'section': 'Planning'})}\n\n"

            plan_messages = [
                {"role": "system", "content": PLANNING_SYSTEM},
                {"role": "user", "content": (
                    f"Research Topic: {payload.topic}\n\n"
                    f"Reference Papers ({len(payload.papers)} papers):\n{papers_context}\n\n"
                    "Create a detailed paper outline."
                )},
            ]
            plan_text = ""
            for token in _stream_llm(plan_messages, max_tokens=3000):
                plan_text += token
                yield f"data: {json.dumps({'type': 'plan', 'text': token})}\n\n"

            # ── Phase 2: Reasoning & Analysis ────────────────────────────
            yield f"data: {json.dumps({'type': 'section', 'section': 'Reasoning & Analysis'})}\n\n"

            reasoning_messages = [
                {"role": "system", "content": REASONING_SYSTEM},
                {"role": "user", "content": (
                    f"Research Topic: {payload.topic}\n\n"
                    f"Reference Papers:\n{papers_context}\n\n"
                    f"Paper Outline:\n{plan_text}\n\n"
                    "Now perform deep analysis."
                )},
            ]
            reasoning_text = ""
            for token in _stream_llm(reasoning_messages, max_tokens=3000):
                reasoning_text += token
                yield f"data: {json.dumps({'type': 'reasoning', 'text': token})}\n\n"

            # ── Phases 3-9: Section-by-section generation ────────────────
            section_base_system = (
                "You are an expert academic paper writer. You are writing ONE SECTION "
                "of a comprehensive research paper. You have access to:\n"
                "- The research topic\n"
                "- Reference papers (titles, authors, abstracts)\n"
                "- A detailed paper outline (created by a planning agent)\n"
                "- Deep analytical reasoning (created by a reasoning agent)\n\n"
                "FORMATTING RULES:\n"
                "- Write in well-formatted HTML for a rich-text editor.\n"
                "- Use <h2> for section headings, <h3> for subsections.\n"
                "- Use <p>, <ul>, <ol>, <strong>, <em>, <blockquote>, <table> as needed.\n"
                "- Cite papers using (Author et al., Year) format.\n"
                "- Be DETAILED, thorough, analytical, and scholarly.\n"
                "- Follow the word count guidance strictly — write FULL content, not summaries.\n"
                "- Output ONLY the HTML for this section. No commentary or explanation.\n"
            )

            generated_sections = {}  # section_name -> html

            for section_name, section_instruction in SECTION_PROMPTS.items():
                yield f"data: {json.dumps({'type': 'section', 'section': section_name})}\n\n"

                # Build context from previously generated sections
                prev_sections_html = ""
                for prev_name, prev_html in generated_sections.items():
                    prev_sections_html += f"\n[Previously written — {prev_name}]:\n{prev_html[:1500]}...\n"

                section_messages = [
                    {"role": "system", "content": section_base_system},
                    {"role": "user", "content": (
                        f"Research Topic: {payload.topic}\n\n"
                        f"Reference Papers:\n{papers_context}\n\n"
                        f"=== PAPER OUTLINE ===\n{plan_text}\n\n"
                        f"=== ANALYTICAL REASONING ===\n{reasoning_text}\n\n"
                        f"=== PREVIOUSLY WRITTEN SECTIONS ===\n{prev_sections_html}\n\n"
                        f"=== YOUR TASK ===\n"
                        f"Write the following section now:\n\n{section_instruction}\n\n"
                        f"Write ONLY this section. Output HTML directly."
                    )},
                ]

                # Determine token budget per section
                token_budget = {
                    "Title & Abstract": 2000,
                    "Introduction": 3500,
                    "Related Work": 5000,
                    "Methodology": 3500,
                    "Results & Discussion": 5000,
                    "Conclusion": 3000,
                    "References": 2000,
                }.get(section_name, 3000)

                section_html = ""
                for token in _stream_llm(section_messages, max_tokens=token_budget):
                    section_html += token
                    yield f"data: {json.dumps({'type': 'content', 'html': token})}\n\n"

                generated_sections[section_name] = section_html

                # Small separator between sections
                yield f"data: {json.dumps({'type': 'content', 'html': chr(10)})}\n\n"

            yield f"data: {json.dumps({'type': 'done'})}\n\n"

        except Exception as e:
            yield f"data: {json.dumps({'type': 'error', 'message': str(e)})}\n\n"

    return StreamingResponse(
        generate(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )
