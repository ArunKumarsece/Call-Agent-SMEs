"""
RAG Configuration & Feature Flags
───────────────────────────────────
Controls which retrieval backend is active.
Change RAG_BACKEND at any time — no code changes, just restart the server.

  RAG_BACKEND=legacy    → Original: embeddings.py, JSON in SQLite, NumPy cosine loop
  RAG_BACKEND=enhanced  → v2: enhanced_rag.py, BM25 + MMR, still in SQLite
  RAG_BACKEND=chroma    → v3 (recommended): ChromaDB HNSW ANN + BM25 + MMR
"""

import os

# ─── Backend selector ─────────────────────────────────────────────────────────
# Set RAG_BACKEND env var to switch between implementations:
#   "legacy"   — embeddings.py (NumPy cosine loop over all SQL embeddings)
#   "enhanced" — enhanced_rag.py (BM25 + MMR, still loads all SQL embeddings)
#   "chroma"   — vector_store.py + enhanced_rag_v3.py (ChromaDB ANN, recommended)
RAG_BACKEND: str = os.getenv("RAG_BACKEND", "chroma").lower()

# ─── Retrieval tuning ─────────────────────────────────────────────────────────
TOP_K: int = int(os.getenv("RAG_TOP_K", "6"))                   # chunks returned to LLM
RERANK_ENABLED: bool = os.getenv("RAG_RERANK", "false").lower() == "true"  # LLM re-ranker (adds ~800ms)
ALPHA: float = float(os.getenv("RAG_ALPHA", "0.65"))            # dense weight in hybrid score
MMR_LAMBDA: float = float(os.getenv("RAG_MMR_LAMBDA", "0.65"))  # diversity vs relevance in MMR
MAX_CONTEXT_CHARS: int = int(os.getenv("RAG_MAX_CONTEXT_CHARS", "3000"))
MIN_SCORE_THRESHOLD: float = float(os.getenv("RAG_MIN_SCORE", "0.25"))  # discard results below this

# ─── Chunking ─────────────────────────────────────────────────────────────────
CHUNK_SIZE: int = int(os.getenv("RAG_CHUNK_SIZE", "400"))
CHUNK_OVERLAP: int = int(os.getenv("RAG_CHUNK_OVERLAP", "80"))

# ─── ChromaDB ─────────────────────────────────────────────────────────────────
CHROMA_PERSIST_DIR: str = os.getenv("CHROMA_PERSIST_DIR", "./chroma_db")


def print_config() -> None:
    print(
        f"🔍 RAG Config → backend={RAG_BACKEND}, top_k={TOP_K}, "
        f"alpha={ALPHA}, mmr_lambda={MMR_LAMBDA}, "
        f"rerank={RERANK_ENABLED}, chunk_size={CHUNK_SIZE}"
    )
