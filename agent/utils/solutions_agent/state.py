from typing import TypedDict, Annotated
from langchain_core.messages import BaseMessage
from langgraph.graph.message import add_messages

class AgentState(TypedDict):
    files: list
    file_type: str
    document_type: str
    teacher_id: str
    assignment_id: int
    final_output: str
    messages: Annotated[list[BaseMessage], add_messages]
