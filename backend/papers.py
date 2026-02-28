# backend/routers/papers.py
import json
import httpx
import xml.etree.ElementTree as ET
from typing import List, Optional
from fastapi import APIRouter, HTTPException, Depends, Query
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from sqlalchemy.orm import Session

from database import get_db
from models import User, Paper, WorkspacePaper, PaperEmbedding
from utils.auth import get_current_user
from utils.vector_store import add_paper as vs_add_paper, delete_paper as vs_delete_paper
from utils.groq_client import client as groq_client, MODEL_CONFIG

router = APIRouter(prefix="/papers", tags=["Papers"])

ARXIV_API = "https://export.arxiv.org/api/query"
NS = {
    "atom":    "http://www.w3.org/2005/Atom",
    "arxiv":   "http://arxiv.org/schemas/atom",
    "opensearch": "http://a9.com/-/spec/opensearch/1.1/",
}


# ── Schemas ───────────────────────────────────────────────────────────────────

class PaperImport(BaseModel):
    external_id: Optional[str] = None
    title: str
    authors: Optional[List[str]] = []
    abstract: Optional[str] = None
    published: Optional[str] = None
    source: Optional[str] = "arxiv"
    url: Optional[str] = None
    pdf_url: Optional[str] = None
    workspace_id: Optional[int] = None   # if set, auto-add to workspace


class PaperChatMessage(BaseModel):
    role: str   # "user" | "assistant"
    content: str


class PaperChatRequest(BaseModel):
    title: str
    abstract: Optional[str] = None
    authors: Optional[List[str]] = []
    message: str
    history: Optional[List[PaperChatMessage]] = []


# ── arXiv helpers ─────────────────────────────────────────────────────────────

def _parse_arxiv_entry(entry) -> dict:
    """Parse a single arXiv Atom entry into a clean dict."""
    title = entry.findtext("atom:title", namespaces=NS) or ""
    abstract = entry.findtext("atom:summary", namespaces=NS) or ""
    published = entry.findtext("atom:published", namespaces=NS) or ""

    # arXiv ID lives in <id> tag as a URL
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
        "published": published[:10],  # YYYY-MM-DD
        "source": "arxiv",
        "url": html_url,
        "pdf_url": pdf_url,
    }


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.get("/search")
async def search_papers(
    query: str = Query(..., min_length=2),
    max_results: int = Query(default=10, le=30),
    source: str = Query(default="arxiv"),
    current_user: User = Depends(get_current_user),
):
    """Search arXiv for research papers matching the query."""
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


@router.post("/import")
def import_paper(
    payload: PaperImport,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Save a paper to the user's library (and optionally a workspace)."""
    # Avoid duplicate import by same user
    existing = db.query(Paper).filter(
        Paper.user_id == current_user.id,
        Paper.external_id == payload.external_id,
        Paper.title == payload.title,
    ).first()

    if existing:
        paper = existing
    else:
        paper = Paper(
            external_id=payload.external_id,
            title=payload.title,
            authors=payload.authors,
            abstract=payload.abstract,
            published=payload.published,
            source=payload.source,
            url=payload.url,
            pdf_url=payload.pdf_url,
            user_id=current_user.id,
        )
        db.add(paper)
        db.commit()
        db.refresh(paper)

        # Index paper into ChromaDB vector store
        try:
            vs_add_paper(paper.id, paper.title, paper.abstract)
        except Exception:
            pass  # embedding is best-effort; don't block import

    # Auto-add to workspace if provided
    if payload.workspace_id:
        link_exists = db.query(WorkspacePaper).filter_by(
            workspace_id=payload.workspace_id,
            paper_id=paper.id,
        ).first()
        if not link_exists:
            link = WorkspacePaper(workspace_id=payload.workspace_id, paper_id=paper.id)
            db.add(link)
            db.commit()

    return {
        "message": "Paper imported successfully",
        "paper": {
            "id": paper.id,
            "title": paper.title,
            "authors": paper.authors,
            "published": paper.published,
            "source": paper.source,
        },
    }


@router.get("/my")
def get_my_papers(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Get all papers imported by the current user."""
    papers = db.query(Paper).filter(Paper.user_id == current_user.id).all()
    return {
        "papers": [
            {
                "id": p.id,
                "title": p.title,
                "authors": p.authors,
                "abstract": p.abstract,
                "published": p.published,
                "source": p.source,
                "url": p.url,
                "pdf_url": p.pdf_url,
            }
            for p in papers
        ]
    }


@router.delete("/{paper_id}")
def delete_paper(
    paper_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    paper = db.query(Paper).filter(
        Paper.id == paper_id, Paper.user_id == current_user.id
    ).first()
    if not paper:
        raise HTTPException(status_code=404, detail="Paper not found")
    # Delete associated embeddings from legacy table and ChromaDB
    db.query(PaperEmbedding).filter(PaperEmbedding.paper_id == paper_id).delete()
    vs_delete_paper(paper_id)
    db.delete(paper)
    db.commit()
    return {"message": "Paper deleted"}


# ── Chat with Paper ───────────────────────────────────────────────────────────

PAPER_SYSTEM_PROMPT = """You are a research paper assistant. You are given the title, authors, and abstract of an academic paper. Answer the user's questions based ONLY on the information available in the paper's abstract. If the abstract does not contain enough information to fully answer, say so and provide what you can infer.

Be concise, accurate, and scholarly in tone. Use markdown formatting for readability."""


@router.post("/chat")
def chat_with_paper(
    payload: PaperChatRequest,
    current_user: User = Depends(get_current_user),
):
    """Chat with a research paper using SSE streaming."""

    # Build paper context
    authors_str = ", ".join(payload.authors) if payload.authors else "Unknown"
    paper_context = (
        f"**Paper Title:** {payload.title}\n"
        f"**Authors:** {authors_str}\n"
        f"**Abstract:** {payload.abstract or 'No abstract available.'}"
    )

    messages = [
        {"role": "system", "content": PAPER_SYSTEM_PROMPT},
        {"role": "user", "content": f"Here is the paper I want to discuss:\n\n{paper_context}"},
        {"role": "assistant", "content": "I've read the paper. What would you like to know about it?"},
    ]

    # Append conversation history
    for msg in (payload.history or []):
        messages.append({"role": msg.role, "content": msg.content})

    # Append current user message
    messages.append({"role": "user", "content": payload.message})

    def generate():
        try:
            stream = groq_client.chat.completions.create(
                messages=messages,
                stream=True,
                **MODEL_CONFIG,
            )
            for chunk in stream:
                delta = chunk.choices[0].delta
                if delta and delta.content:
                    yield f"data: {json.dumps({'token': delta.content})}\n\n"
            yield "data: [DONE]\n\n"
        except Exception as e:
            yield f"data: {json.dumps({'error': str(e)})}\n\n"

    return StreamingResponse(
        generate(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )