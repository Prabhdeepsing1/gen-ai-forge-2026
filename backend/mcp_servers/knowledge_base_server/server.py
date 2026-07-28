import json
from pydantic import Field
from mcp.server.fastmcp import FastMCP
from sqlalchemy.orm import Session
from database import SessionLocal
from models import Workspace, WorkspacePaper, Paper
from utils.vector_store import search_papers as vs_search
from utils.vector_store import add_paper as vs_add_paper
from utils.vector_store import delete_paper as vs_delete_paper
import os

mcp_server = FastMCP("Knowledge Base Server")

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

@mcp_server.tool()
def get_workspace_papers(
    workspace_id: int = Field(description="The ID of the workspace")
) -> str:
    """Get the full text of all papers in a workspace."""
    db = SessionLocal()
    try:
        ws = db.query(Workspace).filter(Workspace.id == workspace_id).first()
        if not ws:
            return json.dumps({"error": "Workspace not found"})

        papers = []
        for wp in ws.papers:
            papers.append({
                "id": wp.paper.id,
                "title": wp.paper.title,
                "authors": wp.paper.authors,
                "abstract": wp.paper.abstract,
                "published": wp.paper.published,
            })
        
        return json.dumps({"papers": papers, "total": len(papers)})
    finally:
        db.close()

@mcp_server.tool()
def search_knowledge_base(
    query: str = Field(description="Search query string"),
    workspace_id: int = Field(description="Workspace ID to restrict the search to"),
    top_k: int = Field(default=5, description="Number of results to return")
) -> str:
    """Search FAISS vector store for papers relevant to the query."""
    db = SessionLocal()
    try:
        paper_ids = [
            row.paper_id
            for row in db.query(WorkspacePaper.paper_id)
            .filter(WorkspacePaper.workspace_id == workspace_id)
            .all()
        ]

        if not paper_ids:
            return json.dumps({"results": [], "query": query})

        vs_results = vs_search(query=query, paper_ids=paper_ids, top_k=top_k)
        return json.dumps({"results": vs_results, "query": query})
    finally:
        db.close()

@mcp_server.tool()
def semantic_search(
    query: str = Field(description="Search query string"),
    workspace_id: int = Field(description="Workspace ID"),
    top_k: int = Field(default=5, description="Number of results")
) -> str:
    """Enriched semantic search returning full paper metadata."""
    db = SessionLocal()
    try:
        paper_ids = [
            row.paper_id
            for row in db.query(WorkspacePaper.paper_id)
            .filter(WorkspacePaper.workspace_id == workspace_id)
            .all()
        ]

        if not paper_ids:
            return json.dumps({"results": [], "query": query})

        vs_results = vs_search(query=query, paper_ids=paper_ids, top_k=top_k)
        
        enriched = []
        for hit in vs_results:
            paper = db.query(Paper).filter(Paper.id == hit["paper_id"]).first()
            if paper:
                enriched.append({
                    "paper_id": paper.id,
                    "title": paper.title,
                    "abstract": paper.abstract,
                    "similarity": hit["similarity"],
                })
        return json.dumps({"results": enriched, "query": query})
    finally:
        db.close()

@mcp_server.tool()
def add_paper(
    title: str = Field(description="Paper title"),
    abstract: str = Field(description="Paper abstract"),
    user_id: int = Field(description="User ID uploading the paper"),
    source: str = Field(default="arxiv", description="Source of paper"),
    workspace_id: int = Field(default=None, description="Optional workspace to add to")
) -> str:
    """Add a new paper to the DB and FAISS index."""
    db = SessionLocal()
    try:
        paper = Paper(
            title=title,
            abstract=abstract,
            source=source,
            user_id=user_id,
        )
        db.add(paper)
        db.commit()
        db.refresh(paper)

        # Vector store embedding (best effort, handled inside vs_add_paper or by caller)
        try:
            vs_add_paper(paper.id, paper.title, paper.abstract)
        except Exception as e:
            pass
        
        if workspace_id:
            link_exists = db.query(WorkspacePaper).filter_by(
                workspace_id=workspace_id,
                paper_id=paper.id,
            ).first()
            if not link_exists:
                link = WorkspacePaper(workspace_id=workspace_id, paper_id=paper.id)
                db.add(link)
                db.commit()
                
        return json.dumps({"success": True, "paper_id": paper.id})
    except Exception as e:
        db.rollback()
        return json.dumps({"error": str(e)})
    finally:
        db.close()

@mcp_server.tool()
def remove_paper(
    paper_id: int = Field(description="Paper ID to remove")
) -> str:
    """Remove a paper from FAISS index and DB."""
    db = SessionLocal()
    try:
        paper = db.query(Paper).filter(Paper.id == paper_id).first()
        if not paper:
            return json.dumps({"error": "Paper not found"})
        
        vs_delete_paper(paper_id)
        db.delete(paper)
        db.commit()
        return json.dumps({"success": True})
    except Exception as e:
        db.rollback()
        return json.dumps({"error": str(e)})
    finally:
        db.close()

app = mcp_server.get_starlette_app()
