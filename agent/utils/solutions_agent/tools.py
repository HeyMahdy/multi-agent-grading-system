import json
from typing import Any
from pydantic import BaseModel, Field
from langchain_core.tools import tool
from config.db import get_db_connection

class InsertSolutionInput(BaseModel):
    teacher_id: str = Field(...)
    assignment_id: int = Field(...)
    question_label: str = Field(..., description="E.g., '1a', 'Q2'")
    solution_text: str = Field(..., description="The solution text for this question")

@tool("insert_solution", args_schema=InsertSolutionInput)
def insert_solution(teacher_id: str, assignment_id: int, question_label: str, solution_text: str) -> str:
    """Saves a new solution for an assignment into the database."""
    sql = """
        INSERT INTO public.teacher_solutions (teacher_id, assignment_id, question_label, solution_text)
        VALUES (%s, %s, %s, %s) RETURNING id;
    """
    try:
        with get_db_connection() as conn:
            with conn.cursor() as cur:
                cur.execute(sql, (teacher_id, assignment_id, question_label, solution_text))
                new_id = cur.fetchone()['id']
                conn.commit()
        print(f"[insert_solution] Inserted {question_label} (id={new_id})")
        return f"Successfully inserted solution '{question_label}'. ID: {new_id}"
    except Exception as e:
        print(f"[insert_solution] Error: {e}")
        return f"Database error inserting solution: {str(e)}"

tools = [insert_solution]
tools_by_name = {tool_item.name: tool_item for tool_item in tools}
