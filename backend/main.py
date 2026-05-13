import os
import shutil
import tempfile
from fastapi import FastAPI, UploadFile, File, Form
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional
import uvicorn

from llm import get_llm_response, get_vision_response, get_followup_response
from rag import add_pdf_to_vectordb, add_textfile_to_vectordb, add_text_to_vectordb

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── Request Models ──

class TextRequest(BaseModel):
    message: str


class ImageRequest(BaseModel):
    message: Optional[str] = ""
    image_base64: str
    mime_type: str = "image/jpeg"


class FollowupRequest(BaseModel):
    message: str
    image_base64: str
    mime_type: str = "image/jpeg"
    history: list = []


class TextTrainRequest(BaseModel):
    text: str
    source: Optional[str] = "user_text"


# ══════════════════════════════════════
#  CHAT ENDPOINTS
# ══════════════════════════════════════

@app.post("/chat")
async def chat(data: TextRequest):
    """Standard text chat — RAG-augmented automatically."""
    reply = get_llm_response(data.message)
    return {"response": reply}


@app.post("/chat-image")
async def chat_image(data: ImageRequest):
    """Analyze a medical image using Llama 4 Scout vision."""
    reply = get_vision_response(data.message, data.image_base64, data.mime_type)
    return {"response": reply}


@app.post("/chat-followup")
async def chat_followup(data: FollowupRequest):
    """Follow-up question about a previously uploaded image."""
    reply = get_followup_response(data.message, data.image_base64, data.mime_type, data.history)
    return {"response": reply}


# ══════════════════════════════════════
#  TRAINING ENDPOINTS
# ══════════════════════════════════════

@app.post("/train/file")
async def train_file(file: UploadFile = File(...)):
    """
    Upload a PDF or .txt file to add to the knowledge base.
    The content is chunked, embedded, and merged into the FAISS vectorDB.
    Supports: .pdf, .txt, .md
    """
    filename  = file.filename or "upload"
    extension = os.path.splitext(filename)[1].lower()

    allowed = {".pdf", ".txt", ".md"}
    if extension not in allowed:
        return {"success": False, "error": f"Unsupported file type '{extension}'. Use PDF, TXT, or MD."}

    # Save to a temp file so loaders can read it
    with tempfile.NamedTemporaryFile(delete=False, suffix=extension) as tmp:
        shutil.copyfileobj(file.file, tmp)
        tmp_path = tmp.name

    try:
        if extension == ".pdf":
            chunks_added = add_pdf_to_vectordb(tmp_path)
        else:
            chunks_added = add_textfile_to_vectordb(tmp_path)
    finally:
        os.unlink(tmp_path)   # always clean up

    return {
        "success":      True,
        "filename":     filename,
        "chunks_added": chunks_added,
        "message":      f"✅ '{filename}' added to knowledge base ({chunks_added} chunks)."
    }


@app.post("/train/text")
async def train_text(data: TextTrainRequest):
    """
    Send raw text directly to add to the knowledge base.
    Useful for pasting notes, guidelines, or custom medical info.
    """
    if not data.text.strip():
        return {"success": False, "error": "Text cannot be empty."}

    chunks_added = add_text_to_vectordb(data.text, source=data.source)
    return {
        "success":      True,
        "chunks_added": chunks_added,
        "message":      f"✅ Text added to knowledge base ({chunks_added} chunks)."
    }


@app.get("/train/status")
async def train_status():
    """Check if a vectorDB exists (i.e. model has been trained)."""
    exists = os.path.exists("vectordb")
    return {"vectordb_exists": exists}

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 8000))
    uvicorn.run(app, host="0.0.0.0", port=port)
