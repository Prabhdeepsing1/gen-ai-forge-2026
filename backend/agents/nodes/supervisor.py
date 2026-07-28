import os
from langgraph.types import Command
from langgraph.graph import END
from langchain_ollama import ChatOllama
from agents.state import GraphState
from agents.prompts import SUPERVISOR_PROMPT

llm = ChatOllama(
    model="qwen3:8b",
    base_url=os.getenv("OLLAMA_BASE_URL", "http://localhost:11434"),
    temperature=0.1,
    extra_body={"enable_thinking": False}
)

def supervisor_node(state: GraphState) -> Command:
    messages = [{"role": "system", "content": SUPERVISOR_PROMPT}] + state["messages"]
    
    response = llm.invoke(messages)
    route = response.content.strip().lower()
    
    valid_routes = ["paper_search", "summarize_insight", "build_paper", "document_ingest", "direct_answer"]
    
    # Simple fallback heuristic if model outputs extra text
    for r in valid_routes:
        if r in route:
            route = r
            break
            
    if route not in valid_routes:
        route = "direct_answer" # Safe fallback
        
    if route == "direct_answer":
        return Command(
            update={"route": route},
            goto=END
        )
    else:
        return Command(
            update={"route": route, "active_specialist": route},
            goto=route
        )
