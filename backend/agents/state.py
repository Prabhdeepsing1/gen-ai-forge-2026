from typing import TypedDict, Literal, Optional, List, Annotated
from pydantic import BaseModel
from langgraph.graph.message import add_messages
from langchain_core.messages import BaseMessage

class ToolResult(BaseModel):
    """A single tool call result preserved for critique evaluation."""
    tool_name: str
    arguments: dict
    result: str
    timestamp: str

class CritiqueFeedback(BaseModel):
    """Structured feedback from the critique agent."""
    decision: Literal["approve", "revise", "reject_requery"]
    reasoning: str
    specific_feedback: Optional[str] = None
    reformulated_query: Optional[str] = None

class GraphState(TypedDict):
    # Identity & routing
    session_id: str
    workspace_id: Optional[int]
    user_id: int

    # Conversation
    messages: Annotated[List[BaseMessage], add_messages]
    conversation_history: List[dict]

    # Routing
    route: str
    active_specialist: Optional[str]

    # Tool evidence
    tool_results: List[ToolResult]

    # Working draft
    current_draft: str
    draft_metadata: dict

    # Critique loop
    critique_feedback: Optional[CritiqueFeedback]
    critique_iteration_count: int

    # Paper builder pipeline state
    paper_builder_phase: Optional[str]
    paper_builder_plan: Optional[str]
    paper_builder_reasoning: Optional[str]
    paper_builder_sections: dict

    # Final output
    final_response: str
    response_metadata: dict
