# backend/routers/semantic_search.py
"""
Semantic (vector) search within workspace papers.
Uses ChromaDB for efficient approximate nearest-neighbour search.
"""

from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from sqlalchemy.orm import Session

from database import get_db
from models import User, Workspace, Paper, WorkspacePaper
from utils.auth import get_current_user
from utils.vector_store import search_papers as vs_search

router = APIRouter(prefix="/semantic-search", tags=["Semantic Search"])


# ── Schemas ───────────────────────────────────────────────────────────────────

class SemanticSearchRequest(BaseModel):
    query: str
    top_k: int = 5


class SemanticSearchResult(BaseModel):
    paper_id: int
    title: str
    abstract: str | None
    similarity: float


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.post("/workspace/{workspace_id}")
def semantic_search_in_workspace(
    workspace_id: int,
    payload: SemanticSearchRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Perform a semantic search over all papers in a workspace.
    Returns papers ranked by cosine similarity to the query.
    """
    # Verify workspace ownership
    ws = db.query(Workspace).filter(
        Workspace.id == workspace_id,
        Workspace.user_id == current_user.id,
    ).first()
    if not ws:
        raise HTTPException(status_code=404, detail="Workspace not found")

    # Get paper IDs that belong to this workspace
    paper_ids = [
        row.paper_id
        for row in db.query(WorkspacePaper.paper_id)
        .filter(WorkspacePaper.workspace_id == workspace_id)
        .all()
    ]

    if not paper_ids:
        return {"results": [], "query": payload.query}

    # Query ChromaDB for nearest neighbours
    vs_results = vs_search(
        query=payload.query,
        paper_ids=paper_ids,
        top_k=payload.top_k,
    )

    # Enrich results with full paper data from SQL
    enriched: list[dict] = []
    for hit in vs_results:
        paper = db.query(Paper).filter(Paper.id == hit["paper_id"]).first()
        if paper:
            enriched.append({
                "paper_id": paper.id,
                "title": paper.title,
                "abstract": paper.abstract,
                "similarity": hit["similarity"],
            })

    return {"results": enriched, "query": payload.query}
