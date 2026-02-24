import os
from langchain_community.document_loaders import DirectoryLoader, PyPDFLoader
from langchain_community.document_loaders import TextLoader
from langchain_huggingface import HuggingFaceEmbeddings
from langchain_community.vectorstores import FAISS
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_classic.schema import Document

VECTORDB_PATH = "vectordb"

# Shared embedding model — loaded once
embed_model = HuggingFaceEmbeddings(
    model_name="sentence-transformers/all-MiniLM-L6-v2"
)


def _get_splitter():
    return RecursiveCharacterTextSplitter(chunk_size=300, chunk_overlap=40)


def build_vectordb(data_path: str):
    """
    Load all documents from a folder, embed them,
    and save/overwrite the local FAISS vectorstore.
    """
    loader = DirectoryLoader(data_path)
    docs   = loader.load()
    chunks = _get_splitter().split_documents(docs)
    vs     = FAISS.from_documents(chunks, embed_model)
    vs.save_local(VECTORDB_PATH)
    print(f"[RAG] Built vectorDB from {len(chunks)} chunks.")


def load_vectordb():
    if os.path.exists(VECTORDB_PATH):
        return FAISS.load_local(
            VECTORDB_PATH,
            embed_model,
            allow_dangerous_deserialization=True
        )
    return None


# ── Add new documents to existing vectorDB ──
def add_documents_to_vectordb(docs: list[Document]):
    """
    Merge new document chunks into the existing vectorstore.
    If none exists yet, creates a fresh one.
    """
    chunks = _get_splitter().split_documents(docs)
    vs     = load_vectordb()

    if vs is None:
        vs = FAISS.from_documents(chunks, embed_model)
    else:
        vs.add_documents(chunks)

    vs.save_local(VECTORDB_PATH)
    print(f"[RAG] Added {len(chunks)} new chunks to vectorDB.")
    return len(chunks)


# ── Add raw text string directly ──
def add_text_to_vectordb(text: str, source: str = "user_input"):
    doc = Document(page_content=text, metadata={"source": source})
    return add_documents_to_vectordb([doc])


# ── Add a PDF file by path ──
def add_pdf_to_vectordb(pdf_path: str):
    loader = PyPDFLoader(pdf_path)
    docs   = loader.load()
    return add_documents_to_vectordb(docs)


# ── Add a plain text file by path ──
def add_textfile_to_vectordb(file_path: str):
    loader = TextLoader(file_path, encoding="utf-8")
    docs   = loader.load()
    return add_documents_to_vectordb(docs)


# ── Query: retrieve relevant context for a user message ──
def query_vectordb(user_message: str, k: int = 4) -> str:
    """
    Search the vectorstore for the k most relevant chunks.
    Returns a single string of context, or empty string if no DB.
    """
    vs = load_vectordb()
    if vs is None:
        return ""

    results = vs.similarity_search(user_message, k=k)
    if not results:
        return ""

    context = "\n\n".join(
        f"[Source: {doc.metadata.get('source', 'unknown')}]\n{doc.page_content}"
        for doc in results
    )
    return context