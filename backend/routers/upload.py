# backend/routers/upload.py
import os
from fastapi import APIRouter, HTTPException, Depends, UploadFile, File, Form
from sqlalchemy.orm import Session
from PyPDF2 import PdfReader
import io
from typing import Optional

from database import get_db
from models import User, UploadedDocument, Paper, WorkspacePaper, Workspace, PaperEmbedding
from utils.auth import get_current_user
from utils.research_assistant import research_assistant
from utils.embeddings import generate_embedding

router = APIRouter(prefix="/upload", tags=["Upload"])

MAX_FILE_SIZE = 10 * 1024 * 1024  # 10 MB


@router.post("/pdf")
async def upload_pdf(
    file: UploadFile = File(...),
    workspace_id: Optional[int] = Form(default=None),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Upload a PDF, extract text, generate an AI summary, and optionally import as a paper with embeddings."""
    if not file.filename or not file.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Only PDF files are accepted")

    contents = await file.read()
    if len(contents) > MAX_FILE_SIZE:
        raise HTTPException(status_code=400, detail="File too large (max 10 MB)")

    # Extract text from PDF
    try:
        reader = PdfReader(io.BytesIO(contents))
        text = "\n".join(
            page.extract_text() or "" for page in reader.pages
        )
    except Exception:
        raise HTTPException(status_code=400, detail="Could not parse PDF file")

    if not text.strip():
        raise HTTPException(status_code=400, detail="No extractable text in PDF")

    # Generate AI summary
    summary = research_assistant.summarize_pdf_text(text, file.filename)

    # Persist as UploadedDocument
    doc = UploadedDocument(
        user_id=current_user.id,
        filename=file.filename,
        content=text[:50000],  # cap stored text
        summary=summary,
    )
    db.add(doc)
    db.commit()
    db.refresh(doc)

    # If workspace_id provided, also import as a Paper with embedding
    paper_id = None
    if workspace_id:
        ws = db.query(Workspace).filter(
            Workspace.id == workspace_id,
            Workspace.user_id == current_user.id,
        ).first()
        if ws:
            # Use first non-empty line as title
            lines = [line.strip() for line in text.split("\n") if line.strip()]
            title = lines[0] if lines else file.filename

            paper = Paper(
                title=title,
                abstract=text[:2000],
                source="pdf",
                user_id=current_user.id,
            )
            db.add(paper)
            db.commit()
            db.refresh(paper)
            paper_id = paper.id

            # Link to workspace
            link = WorkspacePaper(workspace_id=workspace_id, paper_id=paper.id)
            db.add(link)
            db.commit()

            # Generate and store embedding
            try:
                emb_bytes = generate_embedding(text[:1000])
                pe = PaperEmbedding(paper_id=paper.id, embedding=emb_bytes)
                db.add(pe)
                db.commit()
            except Exception:
                pass  # best-effort

    return {
        "id": doc.id,
        "filename": doc.filename,
        "summary": summary,
        "page_count": len(reader.pages),
        "text_length": len(text),
        "paper_id": paper_id,
    }


@router.get("/documents")
def list_documents(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """List all uploaded documents for the current user."""
    docs = (
        db.query(UploadedDocument)
        .filter(UploadedDocument.user_id == current_user.id)
        .order_by(UploadedDocument.created_at.desc())
        .all()
    )
    return {
        "documents": [
            {
                "id": d.id,
                "filename": d.filename,
                "summary": d.summary,
                "created_at": d.created_at.isoformat(),
            }
            for d in docs
        ]
    }


@router.get("/documents/{doc_id}")
def get_document(
    doc_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    doc = (
        db.query(UploadedDocument)
        .filter(
            UploadedDocument.id == doc_id,
            UploadedDocument.user_id == current_user.id,
        )
        .first()
    )
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")

    return {
        "id": doc.id,
        "filename": doc.filename,
        "content": doc.content,
        "summary": doc.summary,
        "created_at": doc.created_at.isoformat(),
    }


@router.delete("/documents/{doc_id}")
def delete_document(
    doc_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    doc = (
        db.query(UploadedDocument)
        .filter(
            UploadedDocument.id == doc_id,
            UploadedDocument.user_id == current_user.id,
        )
        .first()
    )
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")

    db.delete(doc)
    db.commit()
    return {"message": "Document deleted"}
