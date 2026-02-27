# backend/routers/papers.py
import httpx
import xml.etree.ElementTree as ET
from typing import List, Optional
from fastapi import APIRouter, HTTPException, Depends, Query
from pydantic import BaseModel
from sqlalchemy.orm import Session

from database import get_db
from models import User, Paper, WorkspacePaper
from utils.auth import get_current_user

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
    db.delete(paper)
    db.commit()
    return {"message": "Paper deleted"}