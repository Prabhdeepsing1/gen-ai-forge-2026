import os
from langgraph.types import Command
from langchain_ollama import ChatOllama
from agents.state import GraphState
from agents.prompts import PAPER_BUILDER_PROMPT

llm = ChatOllama(
    model="qwen3:8b",
    base_url=os.getenv("OLLAMA_BASE_URL", "http://localhost:11434"),
    temperature=0.3,
    extra_body={"enable_thinking": False}
)

async def paper_builder_node(state: GraphState) -> Command:
    messages = [{"role": "system", "content": PAPER_BUILDER_PROMPT}] + state["messages"]
    
    # Mocking execution
    return Command(
        update={"current_draft": "<h1>Generated Paper Section</h1>... [DRAFT]", "draft_metadata": {"type": "paper_section"}},
        goto="critique"
    )
