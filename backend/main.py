# backend/main.py
import os
from datetime import datetime
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv

load_dotenv()

from database import engine, Base
import models  # ensure all models are registered before create_all
from routers import (
    auth_router,
    workspaces_router,
    papers_router,
    chat_router,
    ai_tools_router,
    upload_router,
    semantic_search_router,
)


# ── Lifespan ──────────────────────────────────────────────────────────────────
@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: create tables
    try:
        Base.metadata.create_all(bind=engine)
        print("✅ Database tables created / verified")
    except Exception as e:
        print(f"⚠️  Database connection failed (will retry on first request): {e}")
    yield
    # Shutdown: nothing needed


# ── App init ──────────────────────────────────────────────────────────────────
app = FastAPI(
    title="ResearchHub AI API",
    description="Intelligent Research Paper Management and Analysis System",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
    lifespan=lifespan,
)

# ── CORS ──────────────────────────────────────────────────────────────────────
FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:3000")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Routers ───────────────────────────────────────────────────────────────────
app.include_router(auth_router)
app.include_router(workspaces_router)
app.include_router(papers_router)
app.include_router(chat_router)
app.include_router(ai_tools_router)
app.include_router(upload_router)
app.include_router(semantic_search_router)


# ── Health check ──────────────────────────────────────────────────────────────
@app.get("/", tags=["Health"])
def root():
    return {
        "status": "ok",
        "message": "ResearchHub AI API is running 🚀",
        "version": "1.0.0",
        "docs": "/docs",
        "endpoints": {
            "auth": "/auth/login, /auth/register",
            "workspaces": "/workspaces",
            "papers": "/papers",
            "chat": "/chat",
            "analysis": "/ai/summarize, /ai/insights, /ai/literature-review",
            "semantic_search": "/semantic-search/workspace/{id}",
            "upload": "/upload/pdf",
        },
    }


@app.get("/health", tags=["Health"])
def health():
    return {
        "status": "healthy",
        "timestamp": datetime.utcnow().isoformat(),
        "version": "1.0.0",
    }