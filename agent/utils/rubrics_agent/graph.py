
import json
from typing import TypedDict
from dotenv import load_dotenv

from langgraph.graph import StateGraph, START, END
from langchain_openai import ChatOpenAI
from langchain_core.messages import SystemMessage, HumanMessage
from langgraph.prebuilt import ToolNode

# Assuming your state, tools, and prompts are accessible
from .prompt import RUBRIC_PROMPT, system_prompt
from .state import AgentState
from .tools import tools
from .node import dynamic_extract_node,tool_node,save_with_agent
def should_continue(state: AgentState):
    """Evaluates the last message to decide the next step."""
    messages = state.get("messages")
    if messages:
        last_message = messages[-1]
        if hasattr(last_message, "tool_calls") and last_message.tool_calls:
            print(f" -> Agent calling {len(last_message.tool_calls)} tools...")
            return "tools"
    print(" -> Agent finished processing.")
    return "END"
    

def build_rubric_graph():
    """Builds and compiles the Rubrics StateGraph."""
    workflow = StateGraph(AgentState)
    
    workflow.add_node("extract_node", dynamic_extract_node)
    workflow.add_node("tool_node", tool_node)
    workflow.add_node("save_agent", save_with_agent)
    
    # Sequence
    workflow.add_edge(START, "extract_node")
    workflow.add_edge("extract_node", "save_agent") 
    
    # Conditional Routing
    workflow.add_conditional_edges(
        "save_agent",
        should_continue,
        {
            "tools": "tool_node",
            "END": END            
        }
    )
    
    # The Loop Back
    workflow.add_edge("tool_node", "save_agent")
    
    return workflow.compile()