# backend/main.py
import os
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
    allow_origins=[
        FRONTEND_URL,
        "http://localhost:3000",
        "http://localhost:5173",
        "http://127.0.0.1:3000",
    ],
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


# ── Health check ──────────────────────────────────────────────────────────────
@app.get("/", tags=["Health"])
def root():
    return {
        "status": "ok",
        "message": "ResearchHub AI API is running 🚀",
        "docs": "/docs",
    }


@app.get("/health", tags=["Health"])
def health():
    return {"status": "healthy"}