import json
from typing import Any
from pydantic import BaseModel, Field
from langchain_core.tools import tool
from config.db import get_db_connection

# ---------------------------------------------------------
# Tool 1: Insert Question
# ---------------------------------------------------------
class InsertQuestionInput(BaseModel):
    teacher_id: str = Field(...)
    assignment_id: int = Field(...)
    question_label: str = Field(..., description="E.g., '1a', 'Q2'")
    question_description: str = Field(..., description="The actual text of the question")

@tool("insert_question", args_schema=InsertQuestionInput)
def insert_question(teacher_id: str, assignment_id: int, question_label: str, question_description: str) -> str:
    """Saves a new question for an assignment into the database."""
    sql = """
        INSERT INTO public.questions (teacher_id, assignment_id, question_label, question_description) 
        VALUES (%s, %s, %s, %s) RETURNING id;
    """
    try:
        with get_db_connection() as conn:
            with conn.cursor() as cur:
                cur.execute(sql, (teacher_id, assignment_id, question_label, question_description))
                new_id = cur.fetchone()['id']
                conn.commit()
        print(f"[insert_question] Inserted {question_label} (id={new_id})")
        return f"Successfully inserted question '{question_label}'. ID: {new_id}"
    except Exception as e:
        print(f"[insert_question] Error: {e}")
        return f"Database error inserting question: {str(e)}"

# ---------------------------------------------------------
# Tool 2: Insert Rubric
# ---------------------------------------------------------
class InsertRubricInput(BaseModel):
    teacher_id: str = Field(...)
    assignment_id: int = Field(...)
    question_label: str = Field(...)
    rubric_description: Any = Field(..., description="JSON object containing the rubric breakdown")

@tool("insert_rubric", args_schema=InsertRubricInput)
def insert_rubric(teacher_id: str, assignment_id: int, question_label: str, rubric_description: Any) -> str:
    """Saves the JSON grading rubric for a specific question."""
    sql = """
        INSERT INTO public.rubrics (teacher_id, assignment_id, question_label, rubric_description) 
        VALUES (%s, %s, %s, %s::jsonb) RETURNING id;
    """
    try:
        with get_db_connection() as conn:
            with conn.cursor() as cur:
                cur.execute(sql, (teacher_id, assignment_id, question_label, json.dumps(rubric_description)))
                new_id = cur.fetchone()['id']
                conn.commit()
        print(f"[insert_rubric] Inserted {question_label} (id={new_id})")
        return f"Successfully inserted rubric for '{question_label}'. ID: {new_id}"
    except Exception as e:
        print(f"[insert_rubric] Error: {e}")
        return f"Database error inserting rubric: {str(e)}"


tools = [insert_question,insert_rubric]
tools_by_name = {tool_item.name: tool_item for tool_item in tools}