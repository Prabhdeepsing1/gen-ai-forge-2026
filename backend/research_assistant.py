# backend/utils/research_assistant.py
from typing import List, Dict, Any
from utils.groq_client import client, MODEL_CONFIG


class ResearchAssistant:
    """Builds context from papers and generates AI responses using Groq."""

    # ── Context builders ──────────────────────────────────────────────────────

    def create_research_context(self, papers: List[Dict[str, Any]], query: str) -> str:
        """Aggregate paper metadata into a structured LLM prompt context."""
        if not papers:
            return f"No papers available in this workspace.\n\nUser Query: {query}"

        parts = []
        for i, paper in enumerate(papers, 1):
            authors = paper.get("authors") or []
            if isinstance(authors, list):
                authors_str = ", ".join(authors[:5])  # cap at 5
            else:
                authors_str = str(authors)

            parts.append(
                f"[Paper {i}]\n"
                f"Title: {paper.get('title', 'Unknown')}\n"
                f"Authors: {authors_str}\n"
                f"Published: {paper.get('published', 'Unknown')}\n"
                f"Abstract: {paper.get('abstract', 'No abstract available')[:800]}"
            )

        full_context = "\n\n---\n\n".join(parts)
        return (
            f"Research Papers Context ({len(papers)} paper(s)):\n\n"
            f"{full_context}\n\n"
            f"User Query: {query}"
        )

    # ── Response generators ───────────────────────────────────────────────────

    def generate_research_response(
        self,
        context: str,
        query: str,
        conversation_history: List[Dict[str, str]] | None = None,
    ) -> str:
        """Send context + query to Groq and return the assistant reply."""
        system_prompt = (
            "You are an expert AI research assistant helping academics analyze and "
            "understand scientific literature. You have access to a curated set of "
            "research papers. Provide accurate, insightful, and well-structured answers "
            "based on the paper content. When comparing papers, be specific. "
            "When summarizing, be concise yet comprehensive. Always cite paper titles "
            "when referencing specific findings."
        )

        messages = [{"role": "system", "content": system_prompt}]

        # Include prior conversation turns for multi-turn context
        if conversation_history:
            messages.extend(conversation_history[-10:])  # last 10 turns

        messages.append({"role": "user", "content": f"Context:\n{context}\n\nQuestion: {query}"})

        response = client.chat.completions.create(messages=messages, **MODEL_CONFIG)
        return response.choices[0].message.content

    def generate_summary(self, papers: List[Dict[str, Any]]) -> str:
        """Generate AI summaries for a list of papers."""
        if not papers:
            return "No papers provided for summarization."

        context = self.create_research_context(papers, "Summarize each paper.")
        prompt = (
            "Generate a concise, structured summary for each research paper listed above. "
            "For each paper include: (1) Main objective, (2) Key methodology, "
            "(3) Primary findings, (4) Significance. Format clearly with paper titles as headers."
        )
        messages = [
            {"role": "system", "content": "You are an expert academic summarizer."},
            {"role": "user", "content": f"{context}\n\nTask: {prompt}"},
        ]
        response = client.chat.completions.create(messages=messages, **MODEL_CONFIG)
        return response.choices[0].message.content

    def extract_key_insights(self, papers: List[Dict[str, Any]]) -> str:
        """Extract trends and key insights across papers."""
        if not papers:
            return "No papers provided."

        context = self.create_research_context(papers, "Extract key insights.")
        prompt = (
            "Analyze all the research papers above and extract: "
            "1. **Key Insights** — major findings and breakthroughs. "
            "2. **Trends** — recurring themes and research directions. "
            "3. **Research Gaps** — areas needing further investigation. "
            "4. **Practical Implications** — real-world applications. "
            "Be specific and cite paper titles."
        )
        messages = [
            {"role": "system", "content": "You are an expert research analyst."},
            {"role": "user", "content": f"{context}\n\nTask: {prompt}"},
        ]
        response = client.chat.completions.create(messages=messages, **MODEL_CONFIG)
        return response.choices[0].message.content

    def generate_literature_review(self, papers: List[Dict[str, Any]]) -> str:
        """Generate a formal literature review."""
        if not papers:
            return "No papers provided."

        context = self.create_research_context(papers, "Generate a literature review.")
        prompt = (
            "Write a comprehensive academic literature review based on the papers above. "
            "Structure it as: 1. Overview, 2. Key Findings, 3. Methodological Approaches, "
            "4. Agreements & Contradictions, 5. Future Directions. "
            "Use academic writing style. Cite paper titles throughout."
        )
        messages = [
            {"role": "system", "content": "You are an expert academic writer."},
            {"role": "user", "content": f"{context}\n\nTask: {prompt}"},
        ]
        response = client.chat.completions.create(messages=messages, **MODEL_CONFIG)
        return response.choices[0].message.content

    def summarize_pdf_text(self, text: str, filename: str) -> str:
        """Summarize raw extracted PDF text."""
        truncated = text[:6000]  # stay within token budget
        messages = [
            {
                "role": "system",
                "content": "You are an expert academic summarizer. Provide clear, structured summaries.",
            },
            {
                "role": "user",
                "content": (
                    f"Summarize the following research paper '{filename}' in 7 bullet points. "
                    f"Cover: main topic, research question, methodology, key findings, "
                    f"conclusions, limitations, and significance.\n\nText:\n{truncated}"
                ),
            },
        ]
        response = client.chat.completions.create(messages=messages, **MODEL_CONFIG)
        return response.choices[0].message.content


# Singleton instance
research_assistant = ResearchAssistant()