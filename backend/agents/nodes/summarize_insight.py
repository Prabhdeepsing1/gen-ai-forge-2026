import os
from langgraph.types import Command
from langchain_ollama import ChatOllama
from agents.state import GraphState
from agents.prompts import SUMMARIZE_INSIGHT_PROMPT

llm = ChatOllama(
    model="qwen3:8b",
    base_url=os.getenv("OLLAMA_BASE_URL", "http://localhost:11434"),
    temperature=0.3,
    extra_body={"enable_thinking": False}
)

async def summarize_insight_node(state: GraphState) -> Command:
    messages = [{"role": "system", "content": SUMMARIZE_INSIGHT_PROMPT}] + state["messages"]
    
    # Mocking execution, actual tool calls wired via react agent
    return Command(
        update={"current_draft": "Here are the insights... [DRAFT]", "draft_metadata": {"type": "insight"}},
        goto="critique"
    )
