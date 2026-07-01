import base64
import io
import traceback

import pypdf
import uvicorn
from dotenv import load_dotenv
from fastapi import BackgroundTasks, FastAPI, File, Form, HTTPException, UploadFile

from api.service.Textract_service import parse_standard_file , textract_client
from config.db import get_db_connection
from utils.answer_agent.graph import build_graph as build_answer_graph
from utils.question_agent.graph import build_graph as build_question_graph
from utils.reviewer_agent.graph import build_graph as grading_app
from utils.rubrics_agent.graph import build_rubric_graph as rubric_graph
from utils.solutions_agent.graph import build_solutions_graph as solutions_graph
from utils.student_answer_agent.graph import build_student_answer_graph as student_answer_graph
from pydantic import BaseModel, Field
app_graph = build_answer_graph()
app_graph_01 = build_question_graph()
app_graph_02=grading_app()
app_graph_03 = rubric_graph()
app_graph_04 = solutions_graph()
app_graph_05 = student_answer_graph()

load_dotenv()



# ==========================================
# 2. DEFINE THE FASTAPI ENDPOINT
# ==========================================

app = FastAPI(title="LangGraph PDF & Image Analyzer")







@app.get("/api/rubrics")
async def get_rubrics():
    teacher_id = "22222222-2222-2222-2222-222222222222"
    assignment_id = 3

    sql_rubrics = """
        SELECT question_label, rubric_description
        FROM public.rubrics
        WHERE teacher_id = %s AND assignment_id = %s
        ORDER BY question_label;
    """

    try:
        with get_db_connection() as conn:
            with conn.cursor() as cur:
                cur.execute(sql_rubrics, (teacher_id, assignment_id))
                rubrics = cur.fetchall()

        return {
            "teacher_id": teacher_id,
            "assignment_id": assignment_id,
            "rubrics": rubrics,
        }
    except Exception as e:
        print(traceback.format_exc())
        raise HTTPException(status_code=500, detail=f"{e.__class__.__name__}: {e}")

@app.post("/answer")
async def analyze_file_endpoint(
    file: UploadFile = File(...),
    teacher_id: str = Form(...),
    student_id: str = Form(...),
    assignment_id: int = Form(...),
):
    """
    Endpoint that accepts a PDF or an Image, processes it, 
    runs it through LangGraph, and returns the LLM's analysis.
    """
    # Read the file bytes into memory
    contents = await file.read()
    content_type = file.content_type

    try:
        # --- HANDLE IMAGES ---
        if content_type.startswith("image/"):
            # Encode image to base64 so GPT-4o can read it
            encoded_image = base64.b64encode(contents).decode("utf-8")
            image_data_url = f"data:{content_type};base64,{encoded_image}"
            
            initial_state = {
                "file_content": image_data_url,
                "file_type": "image",
                "teacher_id": teacher_id,
                "student_id": student_id,
                "assignment_id": assignment_id,
            }

        # --- HANDLE PDFs ---
        elif content_type == "application/pdf":
            # Extract text from the PDF
            pdf_reader = pypdf.PdfReader(io.BytesIO(contents))
            extracted_text = ""
            for page in pdf_reader.pages:
                extracted_text += page.extract_text() + "\n"
                
            if not extracted_text.strip():
                raise HTTPException(status_code=400, detail="Could not extract text from the PDF. It might be a scanned image without OCR.")

            initial_state = {
                "file_content": extracted_text,
                "file_type": "pdf",
                "teacher_id": teacher_id,
                "student_id": student_id,
                "assignment_id": assignment_id,
            }

        # --- REJECT UNSUPPORTED FILES ---
        else:
            raise HTTPException(status_code=400, detail="Unsupported file type. Please upload a PDF or an Image.")

        # Execute the LangGraph workflow
        result = app_graph.invoke(initial_state)

        # Return the output to the user
        analysis = result.get("final_output")
        if analysis is None:
            analysis = result.get("extracted_data", result)

        return {
            "filename": file.filename,
            "type": initial_state["file_type"],
            "analysis": analysis,
        }

    except Exception as e:
        print(traceback.format_exc())
        raise HTTPException(status_code=500, detail=f"{e.__class__.__name__}: {e}")
    




# ==========================================
# ENDPOINT 1: THE ANSWER EXTRACTOR
# ==========================================
@app.post("/internal/agent/rubrics/process")
async def process_rubric_endpoint(
    files: list[UploadFile] = File(...),
    is_handwritten: bool = Form(...),  # Kept in signature so Node.js controller won't break if it sends it
    teacher_id: str = Form(...),
    assignment_id: int = Form(...),
):
    """
    Internal endpoint for processing multiple rubric uploads at once.
    All incoming files go directly to the vision agent via parse_standard_file.
    """
    try:
        # Containers to collect data from ALL files
        all_file_contents = []
        all_content_types = []
        
        # 1. LOOP ONLY TO READ AND GATHER FILE DATA
        for file in files:
            contents = await file.read()
            all_file_contents.append(contents)
            all_content_types.append(file.content_type)

        # 2. PARSE ALL FILES DIRECTLY FOR THE LLM/AGENT LAYER
        # This converts all files into a structured dictionary (e.g., base64 images)
        initial_state = await parse_standard_file(all_file_contents, all_content_types)
        
        # Inject metadata into the compiled graph state
        initial_state["document_type"] = "rubric"
        initial_state["teacher_id"] = teacher_id
        initial_state["assignment_id"] = assignment_id
        
        # 3. FIRE THE RUBRIC AGENT EXACTLY ONCE WITH ALL COMPILED FILE CONTEXTS
        # Make sure 'rubric_graph' is your compiled langgraph object for rubrics!
        # (e.g., rubric_graph = build_rubric_graph() from your rubrics_agent file)
        result = app_graph_03.invoke(initial_state)

        # 4. RETURN ONE SINGLE BATCHED RESPONSE
        return {
            "method_used": "agent_direct_process",
            "files_processed": [f.filename for f in files],
            "analysis": result["final_output"]
        }

    except Exception as e:
        print(traceback.format_exc())
        raise HTTPException(status_code=500, detail=f"{e.__class__.__name__}: {e}")


@app.post("/internal/agent/questions/process")
async def process_question_endpoint(
    files: list[UploadFile] = File(...),
    is_handwritten: bool = Form(...),  # Kept in signature so Node.js controller won't break if it sends it
    teacher_id: str = Form(...),
    assignment_id: int = Form(...),
):
    """
    Internal endpoint for processing multiple question uploads at once.
    All incoming files go directly to the agent via parse_standard_file.
    """
    try:
        # Containers to collect data from ALL files
        all_file_contents = []
        all_content_types = []
        
        # 1. LOOP ONLY TO READ AND GATHER FILE DATA
        for file in files:
            contents = await file.read()
            all_file_contents.append(contents)
            all_content_types.append(file.content_type)

        # 2. PARSE ALL FILES DIRECTLY FOR THE LLM/AGENT LAYER
        # This converts all files into a structured dictionary (e.g., base64 images or doc contexts)
        initial_state = await parse_standard_file(all_file_contents, all_content_types)
        
        # Inject metadata into the compiled graph state
        initial_state["document_type"] = "question"
        initial_state["teacher_id"] = teacher_id
        initial_state["assignment_id"] = assignment_id
        
        # 3. FIRE THE AGENT EXACTLY ONCE WITH ALL COMPILED FILE CONTEXTS
        result = app_graph_01.invoke(initial_state)

        # 4. RETURN ONE SINGLE BATCHED RESPONSE
        return {
            "method_used": "agent_direct_process",
            "files_processed": [f.filename for f in files],
            "analysis": result["final_output"]
        }

    except Exception as e:
        print(traceback.format_exc())
        raise HTTPException(status_code=500, detail=f"{e.__class__.__name__}: {e}")






class GradeRequest(BaseModel):
    teacher_id: str
    student_id: str
    assignment_id: int

@app.post("/internal/agent/grade/process")
async def process_grading_endpoint(request: GradeRequest):
    """
    Internal endpoint for grading a student's assignment.
    Called by the Node.js backend controller.
    """
    try:
        initial_state = {
            "teacher_id": request.teacher_id,
            "student_id": request.student_id,
            "assignment_id": request.assignment_id,
            "all_results": []
        }

        final_state = app_graph_02.invoke(initial_state)

        return {
            "status": "success",
            "student_id": request.student_id,
            "assignment_id": request.assignment_id,
            "results": final_state.get("all_results", [])
        }

    except Exception as e:
        print(traceback.format_exc())
        raise HTTPException(status_code=500, detail=f"{e.__class__.__name__}: {e}")


@app.post("/internal/agent/solutions/process")
async def process_solution_endpoint(
    files: list[UploadFile] = File(...),
    is_handwritten: bool = Form(...),
    teacher_id: str = Form(...),
    assignment_id: int = Form(...),
):
    """
    Internal endpoint for processing multiple solution uploads at once.
    """
    try:
        all_file_contents = []
        all_content_types = []
        
        for file in files:
            contents = await file.read()
            all_file_contents.append(contents)
            all_content_types.append(file.content_type)

        initial_state = await parse_standard_file(all_file_contents, all_content_types)
        
        initial_state["document_type"] = "solution"
        initial_state["teacher_id"] = teacher_id
        initial_state["assignment_id"] = assignment_id
        
        result = app_graph_04.invoke(initial_state)

        return {
            "method_used": "agent_direct_process",
            "files_processed": [f.filename for f in files],
            "analysis": result["final_output"]
        }

    except Exception as e:
        print(traceback.format_exc())
        raise HTTPException(status_code=500, detail=f"{e.__class__.__name__}: {e}")


@app.post("/internal/agent/student-answers/process")
async def process_student_answer_endpoint(
    files: list[UploadFile] = File(...),
    is_handwritten: bool = Form(...),
    teacher_id: str = Form(...),
    student_id: str = Form(...),
    assignment_id: int = Form(...),
):
    """
    Internal endpoint for processing student answer uploads.
    Extracts student answers from images/PDFs and saves to database.
    """
    try:
        all_file_contents = []
        all_content_types = []
        
        for file in files:
            contents = await file.read()
            all_file_contents.append(contents)
            all_content_types.append(file.content_type)

        initial_state = await parse_standard_file(all_file_contents, all_content_types)
        
        initial_state["document_type"] = "student_answer"
        initial_state["teacher_id"] = teacher_id
        initial_state["student_id"] = student_id
        initial_state["assignment_id"] = assignment_id
        
        result = app_graph_05.invoke(initial_state)

        return {
            "method_used": "agent_direct_process",
            "files_processed": [f.filename for f in files],
            "analysis": result["final_output"]
        }

    except Exception as e:
        print(traceback.format_exc())
        raise HTTPException(status_code=500, detail=f"{e.__class__.__name__}: {e}")


# ==========================================
# GRAPHRAG ENDPOINTS
# ==========================================
from utils.graphrag_agent.pipeline import extract_text_from_file, run_ingestion_pipeline
from utils.graphrag_agent.query import query_graphrag, get_full_graph, get_prerequisite_chain
from utils.ta_agent.agent import chat_with_ta


class TAChatRequest(BaseModel):
    message: str
    history: list = []

@app.post("/internal/agent/ta/chat")
async def ta_chat_endpoint(
    request: TAChatRequest,
    teacher_id: str = Form(None),
):
    """TA Chatbot endpoint — teacher sends a message, gets a study plan response."""
    try:
        # teacher_id can come from form or JSON body
        tid = teacher_id or request.dict().get("teacher_id", "")
        if not tid:
            raise HTTPException(status_code=400, detail="teacher_id is required")

        response = await chat_with_ta(tid, request.message, request.history)
        return {"response": response}
    except Exception as e:
        print(traceback.format_exc())
        raise HTTPException(status_code=500, detail=f"{e.__class__.__name__}: {e}")


@app.post("/internal/agent/ta/chat/json")
async def ta_chat_json_endpoint(request: dict):
    """TA Chatbot endpoint (JSON body version)."""
    try:
        teacher_id = request.get("teacher_id", "")
        access_token = request.get("access_token", "")
        message = request.get("message", "")
        history = request.get("history", [])

        if not teacher_id:
            raise HTTPException(status_code=400, detail="teacher_id is required")
        if not message:
            raise HTTPException(status_code=400, detail="message is required")

        response = await chat_with_ta(teacher_id, message, history, access_token)
        return {"response": response}
    except Exception as e:
        print(traceback.format_exc())
        raise HTTPException(status_code=500, detail=f"{e.__class__.__name__}: {e}")


@app.post("/internal/agent/syllabus/upload", status_code=202)
async def upload_syllabus(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    teacher_id: str = Form(...),
    assignment_id: int = Form(...),
):
    """Upload a syllabus and run the GraphRAG ingestion pipeline."""
    try:
        contents = await file.read()
        content_type = file.content_type

        # Extract text
        raw_text = extract_text_from_file(contents, content_type)

        if not raw_text.strip():
            raise HTTPException(status_code=400, detail="Could not extract text from file.")

        # Create syllabus record (scoped to assignment)
        with get_db_connection() as conn:
            with conn.cursor() as cur:
                # Delete existing syllabus for this assignment (replace on re-upload)
                cur.execute(
                    "DELETE FROM public.syllabi WHERE assignment_id = %s",
                    (assignment_id,)
                )
                cur.execute(
                    "INSERT INTO public.syllabi (teacher_id, assignment_id, filename, raw_text, status) VALUES (%s, %s, %s, %s, 'processing') RETURNING id",
                    (teacher_id, assignment_id, file.filename, raw_text)
                )
                syllabus_id = cur.fetchone()["id"]
                conn.commit()

        # Run ingestion after returning so upload latency is not tied to LLM/DB work.
        background_tasks.add_task(process_syllabus_ingestion, syllabus_id, raw_text)

        return {
            "syllabus_id": syllabus_id,
            "status": "processing",
            "entity_count": 0,
            "relationship_count": 0,
        }

    except Exception as e:
        print(traceback.format_exc())
        raise HTTPException(status_code=500, detail=f"{e.__class__.__name__}: {e}")


async def process_syllabus_ingestion(syllabus_id: int, raw_text: str):
    try:
        await run_ingestion_pipeline(syllabus_id, raw_text)
    except Exception:
        print(traceback.format_exc())
        with get_db_connection() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    "UPDATE public.syllabi SET status = 'failed' WHERE id = %s",
                    (syllabus_id,)
                )
                conn.commit()


@app.get("/internal/agent/syllabus/{syllabus_id}/status")
async def get_syllabus_status(syllabus_id: int):
    """Return ingestion status for a syllabus."""
    try:
        with get_db_connection() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    SELECT id, status, entity_count, relationship_count
                    FROM public.syllabi
                    WHERE id = %s
                    """,
                    (syllabus_id,)
                )
                row = cur.fetchone()

        if not row:
            raise HTTPException(status_code=404, detail="Syllabus not found.")

        return row
    except HTTPException:
        raise
    except Exception as e:
        print(traceback.format_exc())
        raise HTTPException(status_code=500, detail=f"{e.__class__.__name__}: {e}")


@app.get("/internal/agent/syllabus/{syllabus_id}/graph")
async def get_syllabus_graph(syllabus_id: int):
    """Get the full entity-relationship graph for a syllabus."""
    try:
        result = await get_full_graph(syllabus_id)
        return result
    except Exception as e:
        print(traceback.format_exc())
        raise HTTPException(status_code=500, detail=f"{e.__class__.__name__}: {e}")


@app.get("/internal/agent/syllabus/by-assignment/{assignment_id}")
async def get_syllabus_by_assignment(assignment_id: int):
    """Resolve syllabus_id from assignment_id."""
    try:
        with get_db_connection() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    "SELECT id FROM public.syllabi WHERE assignment_id = %s",
                    (assignment_id,)
                )
                row = cur.fetchone()
                if not row:
                    raise HTTPException(status_code=404, detail="No syllabus found for this assignment")
                return {"syllabus_id": row["id"]}
    except HTTPException:
        raise
    except Exception as e:
        print(traceback.format_exc())
        raise HTTPException(status_code=500, detail=f"{e.__class__.__name__}: {e}")


class QueryRequest(BaseModel):
    query: str
    syllabus_id: int = None
    assignment_id: int = None

@app.post("/internal/agent/syllabus/query")
async def query_syllabus(request: QueryRequest):
    """Query the GraphRAG system. Accepts either syllabus_id or assignment_id."""
    try:
        syllabus_id = request.syllabus_id

        # Resolve syllabus_id from assignment_id if not provided directly
        if not syllabus_id and request.assignment_id:
            with get_db_connection() as conn:
                with conn.cursor() as cur:
                    cur.execute(
                        "SELECT id FROM public.syllabi WHERE assignment_id = %s AND status = 'completed'",
                        (request.assignment_id,)
                    )
                    row = cur.fetchone()
                    if not row:
                        raise HTTPException(status_code=404, detail="No completed syllabus found for this assignment")
                    syllabus_id = row["id"]

        if not syllabus_id:
            raise HTTPException(status_code=400, detail="Either syllabus_id or assignment_id is required")

        result = await query_graphrag(syllabus_id, request.query)
        return result
    except HTTPException:
        raise
    except Exception as e:
        print(traceback.format_exc())
        raise HTTPException(status_code=500, detail=f"{e.__class__.__name__}: {e}")


@app.get("/internal/agent/syllabus/{syllabus_id}/prerequisites/{topic}")
async def get_topic_prerequisites(syllabus_id: int, topic: str):
    """Get the full prerequisite chain for a topic."""
    try:
        chain = await get_prerequisite_chain(syllabus_id, topic)
        return {"topic": topic, "prerequisite_chain": chain}
    except Exception as e:
        print(traceback.format_exc())
        raise HTTPException(status_code=500, detail=f"{e.__class__.__name__}: {e}")


if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)
