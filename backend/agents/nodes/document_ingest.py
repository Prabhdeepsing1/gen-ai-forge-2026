import os
from langgraph.types import Command
from langchain_ollama import ChatOllama
from agents.state import GraphState
from agents.prompts import DOCUMENT_INGEST_PROMPT

llm = ChatOllama(
    model="qwen3:8b",
    base_url=os.getenv("OLLAMA_BASE_URL", "http://localhost:11434"),
    temperature=0.3,
    extra_body={"enable_thinking": False}
)

async def document_ingest_node(state: GraphState) -> Command:
    messages = [{"role": "system", "content": DOCUMENT_INGEST_PROMPT}] + state["messages"]
    
    # Mocking execution
    return Command(
        update={"current_draft": "Document summarized... [DRAFT]", "draft_metadata": {"type": "document"}},
        goto="critique"
    )
