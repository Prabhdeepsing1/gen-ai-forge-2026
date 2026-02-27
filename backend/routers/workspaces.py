# backend/routers/workspaces.py
from typing import List, Optional
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from sqlalchemy.orm import Session

from database import get_db
from models import User, Workspace, WorkspacePaper, Paper, PaperEmbedding, AnalysisResult, Conversation
from utils.auth import get_current_user

router = APIRouter(prefix="/workspaces", tags=["Workspaces"])


# ── Schemas ───────────────────────────────────────────────────────────────────

class WorkspaceCreate(BaseModel):
    name: str
    description: Optional[str] = None


class WorkspaceUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None


class AddPaperToWorkspace(BaseModel):
    paper_id: int


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.post("/", status_code=201)
def create_workspace(
    payload: WorkspaceCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    ws = Workspace(
        name=payload.name,
        description=payload.description,
        user_id=current_user.id,
    )
    db.add(ws)
    db.commit()
    db.refresh(ws)
    return {
        "id": ws.id,
        "name": ws.name,
        "description": ws.description,
        "created_at": ws.created_at.isoformat(),
    }


@router.get("/")
def list_workspaces(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    workspaces = (
        db.query(Workspace)
        .filter(Workspace.user_id == current_user.id)
        .order_by(Workspace.updated_at.desc())
        .all()
    )
    return {
        "workspaces": [
            {
                "id": ws.id,
                "name": ws.name,
                "description": ws.description,
                "paper_count": len(ws.papers),
                "created_at": ws.created_at.isoformat(),
                "updated_at": ws.updated_at.isoformat(),
            }
            for ws in workspaces
        ]
    }


@router.get("/{workspace_id}")
def get_workspace(
    workspace_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    ws = db.query(Workspace).filter(
        Workspace.id == workspace_id,
        Workspace.user_id == current_user.id,
    ).first()
    if not ws:
        raise HTTPException(status_code=404, detail="Workspace not found")

    papers = [
        {
            "id": wp.paper.id,
            "title": wp.paper.title,
            "authors": wp.paper.authors,
            "abstract": wp.paper.abstract,
            "published": wp.paper.published,
            "source": wp.paper.source,
            "url": wp.paper.url,
            "pdf_url": wp.paper.pdf_url,
            "added_at": wp.added_at.isoformat(),
        }
        for wp in ws.papers
    ]
    return {
        "id": ws.id,
        "name": ws.name,
        "description": ws.description,
        "papers": papers,
        "created_at": ws.created_at.isoformat(),
        "updated_at": ws.updated_at.isoformat(),
    }


@router.put("/{workspace_id}")
def update_workspace(
    workspace_id: int,
    payload: WorkspaceUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    ws = db.query(Workspace).filter(
        Workspace.id == workspace_id,
        Workspace.user_id == current_user.id,
    ).first()
    if not ws:
        raise HTTPException(status_code=404, detail="Workspace not found")

    if payload.name is not None:
        ws.name = payload.name
    if payload.description is not None:
        ws.description = payload.description

    db.commit()
    db.refresh(ws)
    return {"message": "Workspace updated", "id": ws.id, "name": ws.name}


@router.delete("/{workspace_id}")
def delete_workspace(
    workspace_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    ws = db.query(Workspace).filter(
        Workspace.id == workspace_id,
        Workspace.user_id == current_user.id,
    ).first()
    if not ws:
        raise HTTPException(status_code=404, detail="Workspace not found")

    # Clean up related data explicitly
    # 1. Delete conversations
    db.query(Conversation).filter(Conversation.workspace_id == workspace_id).delete()
    # 2. Delete analysis results
    db.query(AnalysisResult).filter(AnalysisResult.workspace_id == workspace_id).delete()
    # 3. Delete paper embeddings for papers in this workspace
    paper_ids = [
        wp.paper_id
        for wp in db.query(WorkspacePaper).filter(WorkspacePaper.workspace_id == workspace_id).all()
    ]
    if paper_ids:
        db.query(PaperEmbedding).filter(PaperEmbedding.paper_id.in_(paper_ids)).delete(synchronize_session=False)
    # 4. Delete workspace-paper links
    db.query(WorkspacePaper).filter(WorkspacePaper.workspace_id == workspace_id).delete()
    # 5. Delete workspace itself
    db.delete(ws)
    db.commit()
    return {"message": "Workspace deleted"}


@router.post("/{workspace_id}/papers")
def add_paper_to_workspace(
    workspace_id: int,
    payload: AddPaperToWorkspace,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    ws = db.query(Workspace).filter(
        Workspace.id == workspace_id,
        Workspace.user_id == current_user.id,
    ).first()
    if not ws:
        raise HTTPException(status_code=404, detail="Workspace not found")

    paper = db.query(Paper).filter(
        Paper.id == payload.paper_id,
        Paper.user_id == current_user.id,
    ).first()
    if not paper:
        raise HTTPException(status_code=404, detail="Paper not found")

    exists = db.query(WorkspacePaper).filter_by(
        workspace_id=workspace_id,
        paper_id=payload.paper_id,
    ).first()
    if exists:
        raise HTTPException(status_code=400, detail="Paper already in workspace")

    link = WorkspacePaper(workspace_id=workspace_id, paper_id=payload.paper_id)
    db.add(link)
    db.commit()
    return {"message": "Paper added to workspace"}


@router.delete("/{workspace_id}/papers/{paper_id}")
def remove_paper_from_workspace(
    workspace_id: int,
    paper_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    ws = db.query(Workspace).filter(
        Workspace.id == workspace_id,
        Workspace.user_id == current_user.id,
    ).first()
    if not ws:
        raise HTTPException(status_code=404, detail="Workspace not found")

    link = db.query(WorkspacePaper).filter_by(
        workspace_id=workspace_id,
        paper_id=paper_id,
    ).first()
    if not link:
        raise HTTPException(status_code=404, detail="Paper not in workspace")

    db.delete(link)
    db.commit()
    return {"message": "Paper removed from workspace"}
