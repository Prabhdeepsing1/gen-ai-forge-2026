import os
from langgraph.types import Command
from langchain_ollama import ChatOllama
from langchain_core.messages import HumanMessage, AIMessage
from agents.state import GraphState
from agents.prompts import PAPER_SEARCH_PROMPT

llm = ChatOllama(
    model="qwen3:8b",
    base_url=os.getenv("OLLAMA_BASE_URL", "http://localhost:11434"),
    temperature=0.3,
    extra_body={"enable_thinking": False}
)

async def paper_search_node(state: GraphState) -> Command:
    # Here we would normally bind tools and invoke, but since tools need async fetching,
    # we'll pass tools into the node compilation or fetch them dynamically.
    # For now, let's assume `state` or closure gives access to tools, but LangGraph passes tools 
    # to nodes during graph execution if we use ToolNode.
    # We'll just generate the draft for the critique agent.
    
    # In a full implementation, this node uses `llm.bind_tools(tools)`
    messages = [{"role": "system", "content": PAPER_SEARCH_PROMPT}] + state["messages"]
    
    # Mocking the LLM tool calling loop for now. In reality, we'd use a sub-graph or create_react_agent
    # Since Qwen3:8b supports tools, we can just invoke it.
    # We will wire the actual tools in the graph.py
    
    return Command(
        update={"current_draft": "I found some papers... [DRAFT]", "draft_metadata": {"type": "search"}},
        goto="critique"
    )
