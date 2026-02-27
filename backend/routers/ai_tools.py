# backend/routers/ai_tools.py
from typing import List, Optional
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from sqlalchemy.orm import Session

from database import get_db
from models import User, Workspace
from utils.auth import get_current_user
from utils.research_assistant import research_assistant

router = APIRouter(prefix="/ai", tags=["AI Tools"])


# ── Schemas ───────────────────────────────────────────────────────────────────

class SummarizeRequest(BaseModel):
    workspace_id: int


class InsightsRequest(BaseModel):
    workspace_id: int


class LitReviewRequest(BaseModel):
    workspace_id: int


# ── Helpers ───────────────────────────────────────────────────────────────────

def _get_papers_for_workspace(workspace_id: int, user_id: int, db: Session) -> list:
    ws = db.query(Workspace).filter(
        Workspace.id == workspace_id,
        Workspace.user_id == user_id,
    ).first()
    if not ws:
        raise HTTPException(status_code=404, detail="Workspace not found")

    return [
        {
            "title": wp.paper.title,
            "authors": wp.paper.authors,
            "abstract": wp.paper.abstract,
            "published": wp.paper.published,
        }
        for wp in ws.papers
    ]


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.post("/summarize")
def summarize_papers(
    payload: SummarizeRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """AI-generated summaries for all papers in a workspace."""
    papers = _get_papers_for_workspace(payload.workspace_id, current_user.id, db)
    if not papers:
        raise HTTPException(status_code=400, detail="No papers in workspace")

    summary = research_assistant.generate_summary(papers)
    return {"summary": summary, "paper_count": len(papers)}


@router.post("/insights")
def extract_insights(
    payload: InsightsRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Extract key insights and trends from workspace papers."""
    papers = _get_papers_for_workspace(payload.workspace_id, current_user.id, db)
    if not papers:
        raise HTTPException(status_code=400, detail="No papers in workspace")

    insights = research_assistant.extract_key_insights(papers)
    return {"insights": insights, "paper_count": len(papers)}


@router.post("/literature-review")
def generate_lit_review(
    payload: LitReviewRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Generate a formal literature review from workspace papers."""
    papers = _get_papers_for_workspace(payload.workspace_id, current_user.id, db)
    if not papers:
        raise HTTPException(status_code=400, detail="No papers in workspace")

    review = research_assistant.generate_literature_review(papers)
    return {"literature_review": review, "paper_count": len(papers)}
