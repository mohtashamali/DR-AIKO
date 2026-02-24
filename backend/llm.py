import os
from groq import Groq
from dotenv import load_dotenv
from rag import query_vectordb

load_dotenv()

client = Groq(api_key=os.getenv("GROQ_API_KEY"))

SYSTEM_PROMPT = (
    "You are a professional medical AI assistant. "
    "Analyze symptoms, conditions, and medical images carefully. "
    "When relevant context from medical documents is provided, prioritize it in your answer. "
    "Always remind the user that your analysis is not a substitute for a professional medical diagnosis."
)


def _build_rag_system_prompt(user_message: str) -> str:
    """
    Query the vectorDB for relevant context.
    If found, inject it into the system prompt.
    If not found, fall back to the base system prompt.
    """
    context = query_vectordb(user_message)

    if context:
        return (
            f"{SYSTEM_PROMPT}\n\n"
            f"The following relevant medical information was found in your knowledge base. "
            f"Use it to answer the user's question:\n\n"
            f"--- KNOWLEDGE BASE CONTEXT ---\n{context}\n--- END CONTEXT ---"
        )

    return SYSTEM_PROMPT


# ── Text chat (RAG-augmented) ──
def get_llm_response(user_message: str) -> str:
    """
    Text-only chat using LLaMA 3.
    First checks vectorDB for relevant context, then calls the LLM.
    """
    system = _build_rag_system_prompt(user_message)

    completion = client.chat.completions.create(
        model="llama-3.1-8b-instant",
        messages=[
            {"role": "system", "content": system},
            {"role": "user",   "content": user_message}
        ],
        temperature=0.7,
        max_tokens=500
    )
    return completion.choices[0].message.content


# ── Vision: analyze image ──
def get_vision_response(user_message: str, image_base64: str, mime_type: str = "image/jpeg") -> str:
    """
    Vision chat using Llama 4 Scout.
    Also checks vectorDB for relevant context to help analyze the image.
    """
    context      = query_vectordb(user_message or "medical image analysis")
    context_text = f"\n\nRelevant knowledge base context:\n{context}" if context else ""

    completion = client.chat.completions.create(
        model="meta-llama/llama-4-scout-17b-16e-instruct",
        messages=[
            {
                "role": "user",
                "content": [
                    {
                        "type": "image_url",
                        "image_url": {"url": f"data:{mime_type};base64,{image_base64}"}
                    },
                    {
                        "type": "text",
                        "text": (
                            (user_message or "Please analyze this medical image and describe what you observe. Provide any relevant medical insights.")
                            + context_text
                        )
                    }
                ]
            }
        ],
        temperature=0.7,
        max_tokens=600
    )
    return completion.choices[0].message.content


# ── Vision: follow-up question about an image ──
def get_followup_response(user_message: str, image_base64: str, mime_type: str, history: list) -> str:
    """
    Follow-up question about a previously uploaded image.
    Sends the image again with full conversation history for context.
    Also checks vectorDB for relevant context.
    """
    context      = query_vectordb(user_message)
    context_note = f"\n\n[Relevant knowledge base context: {context}]" if context else ""

    messages = []

    # Re-attach image as first turn
    messages.append({
        "role": "user",
        "content": [
            {
                "type": "image_url",
                "image_url": {"url": f"data:{mime_type};base64,{image_base64}"}
            },
            {"type": "text", "text": "This is the medical image we are discussing."}
        ]
    })

    # Conversation history
    for turn in history:
        messages.append({"role": turn["role"], "content": turn["content"]})

    # Current question + RAG context
    messages.append({
        "role": "user",
        "content": user_message + context_note
    })

    completion = client.chat.completions.create(
        model="meta-llama/llama-4-scout-17b-16e-instruct",
        messages=messages,
        temperature=0.7,
        max_tokens=600
    )
    return completion.choices[0].message.content