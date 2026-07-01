from typing import TypedDict, Annotated
from langchain_core.messages import BaseMessage
from langgraph.graph.message import add_messages # 👈 IMPORT THIS

class AgentState(TypedDict):
    files: list         # Updated to store your list of multiple files/images
    file_type: str     
    document_type: str  # "student_answer", "teacher_solve", or "rubric"
    teacher_id: str
    assignment_id: int
    final_output: str   # Where your JSON extraction is saved
    
    # 🚨 CRITICAL FIX: Swap operator.add for add_messages 🚨
    messages: Annotated[list[BaseMessage], add_messages]