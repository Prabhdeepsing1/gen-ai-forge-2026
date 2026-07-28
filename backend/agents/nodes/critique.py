import os
import json
from langgraph.types import Command
from langgraph.graph import END
from langchain_ollama import ChatOllama
from agents.state import GraphState, CritiqueFeedback
from agents.prompts import CRITIQUE_PROMPT

llm = ChatOllama(
    model="qwen3:8b",
    base_url=os.getenv("OLLAMA_BASE_URL", "http://localhost:11434"),
    temperature=0.1,
    extra_body={"enable_thinking": False},
    format="json"
)

def critique_node(state: GraphState) -> Command:
    iteration = state.get("critique_iteration_count", 0)
    
    # Cap iterations
    if iteration >= 2:
        return Command(
            update={"final_response": state["current_draft"]},
            goto=END
        )
        
    messages = [
        {"role": "system", "content": CRITIQUE_PROMPT},
        {"role": "user", "content": f"User query: {state['messages'][0].content}\\n\\nSpecialist Draft:\\n{state['current_draft']}\\n\\nTool Results:\\n{state.get('tool_results', [])}"}
    ]
    
    response = llm.invoke(messages)
    
    try:
        feedback_dict = json.loads(response.content)
        feedback = CritiqueFeedback(**feedback_dict)
    except Exception:
        # Fallback if JSON parsing fails
        feedback = CritiqueFeedback(decision="approve", reasoning="Failed to parse JSON")
        
    update_dict = {
        "critique_feedback": feedback,
        "critique_iteration_count": iteration + 1
    }
    
    if feedback.decision == "approve":
        update_dict["final_response"] = state["current_draft"]
        return Command(update=update_dict, goto=END)
    else:
        # Route back to the active specialist
        specialist = state["active_specialist"]
        return Command(update=update_dict, goto=specialist)
