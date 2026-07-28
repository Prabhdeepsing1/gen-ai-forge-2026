import os
from langgraph.graph import StateGraph, START, END
from agents.state import GraphState
from agents.nodes.supervisor import supervisor_node
from agents.nodes.paper_search import paper_search_node
from agents.nodes.summarize_insight import summarize_insight_node
from agents.nodes.paper_builder import paper_builder_node
from agents.nodes.document_ingest import document_ingest_node
from agents.nodes.critique import critique_node
from langgraph.checkpoint.postgres.aio import AsyncPostgresSaver

# Initialize Graph
builder = StateGraph(GraphState)

# Add Nodes
builder.add_node("supervisor", supervisor_node)
builder.add_node("paper_search", paper_search_node)
builder.add_node("summarize_insight", summarize_insight_node)
builder.add_node("build_paper", paper_builder_node)
builder.add_node("document_ingest", document_ingest_node)
builder.add_node("critique", critique_node)

# Add Edges
builder.add_edge(START, "supervisor")

# The supervisor dynamically routes to the respective nodes via Command(goto=...)
# No need to declare static edges from supervisor here if using Command.

# All specialist nodes go to critique
# Since specialist nodes also use Command(goto="critique") in our setup, we can omit static edges.

# Critique node routes to END or back to a specialist via Command

async def compile_graph():
    """Compiles the graph with the Postgres checkpointer."""
    db_uri = os.getenv("DATABASE_URL")
    if not db_uri:
        # Fallback for compilation testing without DB
        return builder.compile()
        
    # We must instantiate the saver and pass it to compile
    checkpointer = AsyncPostgresSaver.from_conn_string(db_uri)
    await checkpointer.setup()
    
    return builder.compile(checkpointer=checkpointer)

# Sync compilation for fast imports if needed, though async is preferred for PostgresSaver
graph = builder.compile()
