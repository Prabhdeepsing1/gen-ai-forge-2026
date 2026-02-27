# backend/routers/semantic_search.py
"""
Semantic (vector) search within workspace papers.
Uses sentence-transformer embeddings + cosine similarity.
"""

from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from sqlalchemy.orm import Session

from database import get_db
from models import User, Workspace, PaperEmbedding, Paper, WorkspacePaper
from utils.auth import get_current_user
from utils.embeddings import generate_embedding, embedding_from_bytes, cosine_similarity

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

    # Fetch papers with embeddings in this workspace
    rows = (
        db.query(Paper, PaperEmbedding)
        .join(WorkspacePaper, WorkspacePaper.paper_id == Paper.id)
        .join(PaperEmbedding, PaperEmbedding.paper_id == Paper.id)
        .filter(WorkspacePaper.workspace_id == workspace_id)
        .all()
    )

    if not rows:
        return {"results": [], "query": payload.query}

    # Generate query embedding
    query_emb = embedding_from_bytes(generate_embedding(payload.query))

    # Calculate similarity for each paper
    scored: list[dict] = []
    for paper, pe in rows:
        paper_emb = embedding_from_bytes(pe.embedding)
        sim = cosine_similarity(query_emb, paper_emb)
        scored.append({
            "paper_id": paper.id,
            "title": paper.title,
            "abstract": paper.abstract,
            "similarity": round(sim, 4),
        })

    # Sort descending and take top_k
    scored.sort(key=lambda x: x["similarity"], reverse=True)
    results = scored[: payload.top_k]

    return {"results": results, "query": payload.query}
