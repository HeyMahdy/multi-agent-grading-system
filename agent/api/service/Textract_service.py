import base64
import io
import os
import boto3

import pypdf
import uvicorn
from dotenv import load_dotenv
from fastapi import FastAPI, File, UploadFile, Form, HTTPException


load_dotenv()



try:
    textract_client = boto3.client(
        'textract', 
        region_name='us-east-1',
        # Explicitly pulling the keys from your .env file
        aws_access_key_id=os.getenv("AWS_ACCESS_KEY_ID"),
        aws_secret_access_key=os.getenv("AWS_SECRET_ACCESS_KEY")
    )
except Exception as e:
    print(f"Warning: Could not initialize AWS Textract. {e}")
    textract_client = None
app = FastAPI(title="AI Grading Engine API")


# ==========================================
# HELPER: STANDARD FILE PARSER
# ==========================================
import base64
import pypdf
import io
from fastapi import HTTPException
from pdf2image import convert_from_bytes


def _image_data_url(contents: bytes, content_type: str) -> str:
    encoded_image = base64.b64encode(contents).decode("utf-8")
    return f"data:{content_type};base64,{encoded_image}"


def _extract_pdf_text(contents: bytes) -> str:
    pdf_reader = pypdf.PdfReader(io.BytesIO(contents))
    page_texts = []

    for page in pdf_reader.pages:
        page_text = page.extract_text() or ""
        if page_text.strip():
            page_texts.append(page_text)

    return "\n".join(page_texts)


def _pdf_pages_as_images(contents: bytes) -> list[dict]:
    try:
        pages = convert_from_bytes(contents)
    except Exception as exc:
        raise HTTPException(
            status_code=400,
            detail=(
                "Could not extract text from PDF, and converting scanned PDF "
                f"pages to images failed: {exc}"
            ),
        ) from exc

    processed_pages = []
    for page in pages:
        buffer = io.BytesIO()
        page.save(buffer, format="PNG")
        processed_pages.append({
            "content": _image_data_url(buffer.getvalue(), "image/png"),
            "type": "image",
        })

    return processed_pages

async def parse_standard_file(contents_list: list[bytes], content_types_list: list[str]) -> dict:
    """
    Helper function to parse a batch of PDFs or encode images for the LLM.
    Returns a unified initial state payload for LangGraph.
    """
    # A list to store multiple image data URLs or text segments from all files
    processed_items = []
    
    # We use zip() to iterate through both lists side-by-side matching each file with its type
    for contents, content_type in zip(contents_list, content_types_list):
        content_type = content_type or ""
        
        if content_type.startswith("image/"):
            processed_items.append({"content": _image_data_url(contents, content_type), "type": "image"})
            
        elif content_type == "application/pdf" or contents.startswith(b"%PDF"):
            extracted_text = _extract_pdf_text(contents)

            if extracted_text.strip():
                processed_items.append({"content": extracted_text, "type": "pdf"})
            else:
                processed_items.extend(_pdf_pages_as_images(contents))
        
        else:
            raise HTTPException(status_code=400, detail=f"Unsupported file type: {content_type}")
            
    # Return a single structure holding all parsed items
    return {"files": processed_items, "file_type": "batch_mix"}
