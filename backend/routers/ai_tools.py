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

async def _invoke_insight_agent(workspace_id: int, user_id: int, instruction: str) -> str:
    from agents.graph import compile_graph
    from langchain_core.messages import HumanMessage
    
    initial_state = {
        "session_id": f"ai_tools_{workspace_id}_{user_id}",
        "workspace_id": workspace_id,
        "user_id": user_id,
        "messages": [HumanMessage(content=instruction)],
        "conversation_history": [],
        "critique_iteration_count": 0,
        "tool_results": [],
    }
    
    graph = await compile_graph()
    config = {"configurable": {"thread_id": initial_state["session_id"]}}
    
    try:
        final_state = await graph.ainvoke(initial_state, config=config)
        return final_state.get("final_response", "Failed to generate analysis.")
    except Exception as e:
        return f"Agent encountered an error: {str(e)}"


@router.post("/summarize")
async def summarize_papers(
    payload: SummarizeRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """AI-generated summaries for all papers in a workspace."""
    papers, paper_ids = _get_papers_for_workspace(payload.workspace_id, current_user.id, db)
    if not papers:
        raise HTTPException(status_code=400, detail="No papers in workspace")

    summary = await _invoke_insight_agent(payload.workspace_id, current_user.id, "Generate summaries for all papers in the workspace.")

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
async def extract_insights(
    payload: InsightsRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Extract key insights and trends from workspace papers."""
    papers, paper_ids = _get_papers_for_workspace(payload.workspace_id, current_user.id, db)
    if not papers:
        raise HTTPException(status_code=400, detail="No papers in workspace")

    insights = await _invoke_insight_agent(payload.workspace_id, current_user.id, "Extract key insights and trends from the workspace papers.")

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
async def generate_lit_review(
    payload: LitReviewRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Generate a formal literature review from workspace papers."""
    papers, paper_ids = _get_papers_for_workspace(payload.workspace_id, current_user.id, db)
    if not papers:
        raise HTTPException(status_code=400, detail="No papers in workspace")

    review = await _invoke_insight_agent(payload.workspace_id, current_user.id, "Generate a formal literature review from the workspace papers.")

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
