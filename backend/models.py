# backend/models/models.py
from datetime import datetime
from sqlalchemy import (
    Column, Integer, String, Text, DateTime,
    ForeignKey, Boolean, Float, JSON, LargeBinary
)
from sqlalchemy.orm import relationship
from database import Base


class User(Base):
    __tablename__ = "users"

    id            = Column(Integer, primary_key=True, index=True)
    email         = Column(String(255), unique=True, index=True, nullable=False)
    username      = Column(String(100), unique=True, index=True, nullable=False)
    hashed_password = Column(String(255), nullable=False)
    is_active     = Column(Boolean, default=True)
    created_at    = Column(DateTime, default=datetime.utcnow)

    workspaces    = relationship("Workspace", back_populates="owner", cascade="all, delete-orphan")
    papers        = relationship("Paper", back_populates="owner", cascade="all, delete-orphan")


class Workspace(Base):
    __tablename__ = "workspaces"

    id          = Column(Integer, primary_key=True, index=True)
    name        = Column(String(200), nullable=False)
    description = Column(Text, nullable=True)
    user_id     = Column(Integer, ForeignKey("users.id"), nullable=False)
    created_at  = Column(DateTime, default=datetime.utcnow)
    updated_at  = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    owner         = relationship("User", back_populates="workspaces")
    papers        = relationship("WorkspacePaper", back_populates="workspace", cascade="all, delete-orphan")
    conversations = relationship("Conversation", back_populates="workspace", cascade="all, delete-orphan")


class Paper(Base):
    __tablename__ = "papers"

    id           = Column(Integer, primary_key=True, index=True)
    external_id  = Column(String(200), nullable=True)        # arXiv ID etc.
    title        = Column(Text, nullable=False)
    authors      = Column(JSON, nullable=True)               # list of strings
    abstract     = Column(Text, nullable=True)
    published    = Column(String(50), nullable=True)
    source       = Column(String(50), default="arxiv")       # arxiv | pubmed | pdf
    url          = Column(Text, nullable=True)
    pdf_url      = Column(Text, nullable=True)
    user_id      = Column(Integer, ForeignKey("users.id"), nullable=False)
    created_at   = Column(DateTime, default=datetime.utcnow)

    owner            = relationship("User", back_populates="papers")
    workspace_papers = relationship("WorkspacePaper", back_populates="paper", cascade="all, delete-orphan")


class WorkspacePaper(Base):
    """Junction table linking papers to workspaces."""
    __tablename__ = "workspace_papers"

    id           = Column(Integer, primary_key=True, index=True)
    workspace_id = Column(Integer, ForeignKey("workspaces.id"), nullable=False)
    paper_id     = Column(Integer, ForeignKey("papers.id"), nullable=False)
    added_at     = Column(DateTime, default=datetime.utcnow)

    workspace = relationship("Workspace", back_populates="papers")
    paper     = relationship("Paper", back_populates="workspace_papers")


class Conversation(Base):
    __tablename__ = "conversations"

    id           = Column(Integer, primary_key=True, index=True)
    workspace_id = Column(Integer, ForeignKey("workspaces.id"), nullable=False)
    role         = Column(String(20), nullable=False)         # "user" | "assistant"
    content      = Column(Text, nullable=False)
    created_at   = Column(DateTime, default=datetime.utcnow)

    workspace = relationship("Workspace", back_populates="conversations")


class UploadedDocument(Base):
    __tablename__ = "uploaded_documents"

    id          = Column(Integer, primary_key=True, index=True)
    user_id     = Column(Integer, ForeignKey("users.id"), nullable=False)
    filename    = Column(String(300), nullable=False)
    content     = Column(Text, nullable=True)       # extracted text
    summary     = Column(Text, nullable=True)       # AI-generated summary
    created_at  = Column(DateTime, default=datetime.utcnow)


class PaperEmbedding(Base):
    """Stores vector embeddings for papers (sentence-transformer)."""
    __tablename__ = "paper_embeddings"

    id        = Column(Integer, primary_key=True, index=True)
    paper_id  = Column(Integer, ForeignKey("papers.id", ondelete="CASCADE"), nullable=False, index=True)
    embedding = Column(LargeBinary, nullable=False)  # numpy float32 bytes

    paper = relationship("Paper", backref="embeddings")


class AnalysisResult(Base):
    """Persists AI analysis outputs for later retrieval."""
    __tablename__ = "analysis_results"

    id            = Column(Integer, primary_key=True, index=True)
    workspace_id  = Column(Integer, ForeignKey("workspaces.id", ondelete="CASCADE"), nullable=False, index=True)
    analysis_type = Column(String(50), nullable=False)   # summaries | insights | review
    paper_ids     = Column(JSON, nullable=True)           # list of paper IDs analysed
    result        = Column(Text, nullable=False)
    created_at    = Column(DateTime, default=datetime.utcnow)

    workspace = relationship("Workspace", backref="analysis_results")