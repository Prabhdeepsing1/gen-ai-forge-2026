# backend/routers/ai_tools.py
import json
from typing import List, Optional
from fastapi import APIRouter, HTTPException, Depends, Query
from pydantic import BaseModel
from sqlalchemy.orm import Session

from database import get_db
from models import User, Workspace, AnalysisResult
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

def _get_papers_for_workspace(workspace_id: int, user_id: int, db: Session) -> tuple[list, list[int]]:
    """Return (papers_dicts, paper_ids) for the given workspace."""
    ws = db.query(Workspace).filter(
        Workspace.id == workspace_id,
        Workspace.user_id == user_id,
    ).first()
    if not ws:
        raise HTTPException(status_code=404, detail="Workspace not found")

    papers = []
    paper_ids = []
    for wp in ws.papers:
        papers.append({
            "title": wp.paper.title,
            "authors": wp.paper.authors,
            "abstract": wp.paper.abstract,
            "published": wp.paper.published,
        })
        paper_ids.append(wp.paper.id)
    return papers, paper_ids


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.post("/summarize")
def summarize_papers(
    payload: SummarizeRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """AI-generated summaries for all papers in a workspace."""
    papers, paper_ids = _get_papers_for_workspace(payload.workspace_id, current_user.id, db)
    if not papers:
        raise HTTPException(status_code=400, detail="No papers in workspace")

    summary = research_assistant.generate_summary(papers)

    # Persist analysis result
    ar = AnalysisResult(
        workspace_id=payload.workspace_id,
        analysis_type="summaries",
        paper_ids=paper_ids,
        result=summary,
    )
    db.add(ar)
    db.commit()

    return {"summary": summary, "paper_count": len(papers)}


@router.post("/insights")
def extract_insights(
    payload: InsightsRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Extract key insights and trends from workspace papers."""
    papers, paper_ids = _get_papers_for_workspace(payload.workspace_id, current_user.id, db)
    if not papers:
        raise HTTPException(status_code=400, detail="No papers in workspace")

    insights = research_assistant.extract_key_insights(papers)

    # Persist analysis result
    ar = AnalysisResult(
        workspace_id=payload.workspace_id,
        analysis_type="insights",
        paper_ids=paper_ids,
        result=insights,
    )
    db.add(ar)
    db.commit()

    return {"insights": insights, "paper_count": len(papers)}


@router.post("/literature-review")
def generate_lit_review(
    payload: LitReviewRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Generate a formal literature review from workspace papers."""
    papers, paper_ids = _get_papers_for_workspace(payload.workspace_id, current_user.id, db)
    if not papers:
        raise HTTPException(status_code=400, detail="No papers in workspace")

    review = research_assistant.generate_literature_review(papers)

    # Persist analysis result
    ar = AnalysisResult(
        workspace_id=payload.workspace_id,
        analysis_type="review",
        paper_ids=paper_ids,
        result=review,
    )
    db.add(ar)
    db.commit()

    return {"literature_review": review, "paper_count": len(papers)}


# ── Analysis History ──────────────────────────────────────────────────────────

@router.get("/analysis/{workspace_id}")
def get_analysis_results(
    workspace_id: int,
    analysis_type: Optional[str] = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Retrieve stored analysis results for a workspace.

    Optionally filter by analysis_type: summaries | insights | review
    """
    ws = db.query(Workspace).filter(
        Workspace.id == workspace_id,
        Workspace.user_id == current_user.id,
    ).first()
    if not ws:
        raise HTTPException(status_code=404, detail="Workspace not found")

    query = db.query(AnalysisResult).filter(AnalysisResult.workspace_id == workspace_id)
    if analysis_type:
        query = query.filter(AnalysisResult.analysis_type == analysis_type)

    results = query.order_by(AnalysisResult.created_at.desc()).all()

    return {
        "results": [
            {
                "id": r.id,
                "analysis_type": r.analysis_type,
                "paper_ids": r.paper_ids,
                "result": r.result,
                "created_at": r.created_at.isoformat(),
            }
            for r in results
        ]
    }
