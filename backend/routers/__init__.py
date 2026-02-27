# backend/routers/__init__.py
from routers.auth import router as auth_router
from routers.workspaces import router as workspaces_router
from routers.papers import router as papers_router
from routers.chat import router as chat_router
from routers.ai_tools import router as ai_tools_router
from routers.upload import router as upload_router

__all__ = [
    "auth_router",
    "workspaces_router",
    "papers_router",
    "chat_router",
    "ai_tools_router",
    "upload_router",
]
