# Dr Ai— Retrieval-Augmented Medical Assistant

Dr Aiko is an AI-powered medical assistant built using Retrieval-Augmented Generation (RAG) and Large Language Models (LLMs).

The system provides structured, safety-aware medical responses by combining vector-based document retrieval with controlled LLM reasoning.

---

## Overview

Dr AI follows a Retrieval-Augmented Generation (RAG) architecture:

1. User submits a medical query.
2. Relevant medical documents are retrieved using FAISS vector search.
3. Retrieved context is injected into a structured prompt.
4. LLM generates a medically formatted response.
5. API returns a structured response to the client.

If retrieval does not provide sufficient context, the system safely falls back to general medical reasoning.

---

## Key Features

- Retrieval-Augmented Generation (RAG)
- FAISS vector database
- Sentence-transformer embeddings
- Groq-powered LLaMA model
- Structured medical response formatting
- Safe fallback mechanism
- REST API architecture
- Modular backend design

---

## System Architecture

User Query  
→ Flask API (/chat)  
→ FAISS Retrieval  
→ Context Injection  
→ LLM Inference  
→ Structured Medical Response  
→ JSON Response  

---

## Project Structure

MEDICAL-CHATBOT  
│  
├── backend  
│   ├── main.py  
│   ├── rag.py  
│   ├── llm.py  
│   ├── vector_db/  
│  
├── frontend  
│   ├── index.html  
│   ├── style.css  
│   ├── script.js  
│  
├── .env  
├── README.md  

---

## Technology Stack

Backend:
- Python
- Flask
- LangChain
- FAISS
- HuggingFace Embeddings
- Groq API (LLaMA)

Frontend:
- HTML5
- CSS3
- Vanilla JavaScript

---

## Environment Setup

Create a `.env` file in the project root:

GROQ_API_KEY=your_groq_api_key_here

---

## Installation

pip install flask flask-cors python-dotenv  
pip install langchain langchain-community langchain-huggingface  
pip install faiss-cpu sentence-transformers  
pip install groq  

---

## Build Vector Store

from rag import build_vector_store  
build_vector_store("path_to_medical_documents")

---

## Run Backend

cd backend  
python main.py  

Server runs at:  
http://127.0.0.1:5000  

---

## API Endpoint

POST /chat  

Form Data:  
message: string  

Response:
{
  "reply": "Structured medical response"
}

---

## Safety Considerations

- Structured medical formatting  
- Avoids fabricated citations  
- Encourages professional consultation  
- No unsafe prescription instructions  
- Controlled fallback behavior  

- Use environment variables for API security  
This demonstrates production-level system thinking.

