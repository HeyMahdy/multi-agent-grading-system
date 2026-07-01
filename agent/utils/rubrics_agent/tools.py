

import json
import re
from typing import Any
from pydantic import BaseModel, Field
from langchain_core.tools import tool
from config.db import get_db_connection

class InsertRubricInput(BaseModel):
    teacher_id: str = Field(...)
    assignment_id: int = Field(...)
    question_label: str = Field(...)
    rubric_description: Any = Field(..., description="JSON object containing the rubric breakdown")

@tool("insert_rubric", args_schema=InsertRubricInput)
def insert_rubric(teacher_id: str, assignment_id: int, question_label: str, rubric_description: Any) -> str:
    """Saves the JSON grading rubric for a specific question."""
    existing_sql = """
        SELECT id, question_label
        FROM public.rubrics
        WHERE teacher_id = %s
          AND assignment_id = %s
          AND regexp_replace(lower(question_label), '\\s+', '', 'g') = %s
        LIMIT 1;
    """
    insert_sql = """
        INSERT INTO public.rubrics (teacher_id, assignment_id, question_label, rubric_description) 
        VALUES (%s, %s, %s, %s::jsonb) RETURNING id;
    """
    normalized_label = re.sub(r"\s+", "", str(question_label or "")).lower()

    try:
        with get_db_connection() as conn:
            with conn.cursor() as cur:
                cur.execute(existing_sql, (teacher_id, assignment_id, normalized_label))
                existing = cur.fetchone()

                if existing:
                    conn.commit()
                    existing_label = existing.get("question_label", question_label)
                    existing_id = existing.get("id")
                    print(f"[insert_rubric] Skipped duplicate {question_label} (existing id={existing_id}, label={existing_label})")
                    return f"Rubric for '{existing_label}' already exists. Skipped duplicate '{question_label}'. ID: {existing_id}"

                cur.execute(insert_sql, (teacher_id, assignment_id, question_label, json.dumps(rubric_description)))
                new_id = cur.fetchone()['id']
                conn.commit()
        print(f"[insert_rubric] Inserted {question_label} (id={new_id})")
        return f"Successfully inserted rubric for '{question_label}'. ID: {new_id}"
    except Exception as e:
        print(f"[insert_rubric] Error: {e}")
        return f"Database error inserting rubric: {str(e)}"


tools = [insert_rubric]
tools_by_name = {tool_item.name: tool_item for tool_item in tools}
