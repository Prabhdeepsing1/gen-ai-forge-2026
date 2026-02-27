# backend/routers/chat.py
from typing import List, Optional
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from sqlalchemy.orm import Session

from database import get_db
from models import User, Workspace, WorkspacePaper, Conversation
from utils.auth import get_current_user
from utils.research_assistant import research_assistant

router = APIRouter(prefix="/chat", tags=["Chat"])


# ── Schemas ───────────────────────────────────────────────────────────────────

class ChatMessage(BaseModel):
    content: str
    workspace_id: int


class ConversationResponse(BaseModel):
    id: int
    role: str
    content: str
    created_at: str


# ── Helpers ───────────────────────────────────────────────────────────────────

def _get_workspace_papers(workspace_id: int, user_id: int, db: Session) -> List[dict]:
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


def _get_conversation_history(workspace_id: int, db: Session, limit: int = 10) -> List[dict]:
    rows = (
        db.query(Conversation)
        .filter(Conversation.workspace_id == workspace_id)
        .order_by(Conversation.created_at.desc())
        .limit(limit)
        .all()
    )
    # reverse to chronological order
    return [{"role": r.role, "content": r.content} for r in reversed(rows)]


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.post("/")
def chat_with_papers(
    message: ChatMessage,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    papers = _get_workspace_papers(message.workspace_id, current_user.id, db)
    history = _get_conversation_history(message.workspace_id, db)
    context = research_assistant.create_research_context(papers, message.content)
    ai_reply = research_assistant.generate_research_response(
        context, message.content, conversation_history=history
    )

    # Persist both turns
    db.add(Conversation(workspace_id=message.workspace_id, role="user",      content=message.content))
    db.add(Conversation(workspace_id=message.workspace_id, role="assistant", content=ai_reply))
    db.commit()

    return {"response": ai_reply, "workspace_id": message.workspace_id}


@router.get("/history/{workspace_id}", response_model=List[dict])
def get_chat_history(
    workspace_id: int,
    limit: int = 50,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    # Verify ownership
    ws = db.query(Workspace).filter(
        Workspace.id == workspace_id,
        Workspace.user_id == current_user.id,
    ).first()
    if not ws:
        raise HTTPException(status_code=404, detail="Workspace not found")

    rows = (
        db.query(Conversation)
        .filter(Conversation.workspace_id == workspace_id)
        .order_by(Conversation.created_at.asc())
        .limit(limit)
        .all()
    )
    return [
        {"id": r.id, "role": r.role, "content": r.content, "created_at": r.created_at.isoformat()}
        for r in rows
    ]


@router.delete("/history/{workspace_id}")
def clear_chat_history(
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

    db.query(Conversation).filter(Conversation.workspace_id == workspace_id).delete()
    db.commit()
    return {"message": "Chat history cleared"}