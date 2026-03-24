# """
# Enhanced RAG (Retrieval-Augmented Generation) Service
# ──────────────────────────────────────────────────────
# Improvements over the original:
#   1. Hybrid search  — dense (cosine) + sparse (BM25-style TF-IDF keyword) combined
#   2. MMR            — Maximal Marginal Relevance to avoid redundant chunks
#   3. Cross-encoder re-ranking via a dedicated Gemini prompt
#   4. Smart chunking — sentence-aware overlap chunking
#   5. Context window management — deduplicated, token-budget-aware assembly
# """

# from __future__ import annotations

# import math
# import re
# from collections import Counter
# from typing import Any

# import numpy as np
# from sqlalchemy.orm import Session

# from models import KBEntry, KnowledgeBase
# from services.gemini_service import generate_embedding, generate_query_embedding, CHAT_MODEL

# import google.generativeai as genai
# from services.gemini_service import GEMINI_API_KEY
# genai.configure(api_key=GEMINI_API_KEY)


# # ─── Constants ────────────────────────────────────────────────────────────────

# CHUNK_SIZE      = 400    # target tokens per chunk (approx 4 chars/token)
# CHUNK_OVERLAP   = 80     # overlap tokens between adjacent chunks
# ALPHA           = 0.65   # weight for dense score in hybrid (1-ALPHA for sparse)
# MMR_LAMBDA      = 0.6    # diversity vs relevance trade-off in MMR
# MAX_CONTEXT_CHARS = 3000 # hard cap on total context sent to the LLM


# # ─── Smart Chunking ───────────────────────────────────────────────────────────

# def smart_chunk(text: str, chunk_size: int = CHUNK_SIZE, overlap: int = CHUNK_OVERLAP) -> list[str]:
#     """
#     Sentence-aware sliding-window chunker.
#     Splits on sentence boundaries then groups into windows of ~chunk_size tokens,
#     with an overlap of ~overlap tokens to preserve cross-boundary context.
#     """
#     # Normalise whitespace
#     text = re.sub(r"\s+", " ", text).strip()
#     if not text:
#         return []

#     # Split into sentences (handles Tamil/English mixed text)
#     sentences = re.split(r"(?<=[.!?।])\s+|(?<=\n)\s*", text)
#     sentences = [s.strip() for s in sentences if s.strip()]

#     chunks: list[str] = []
#     current_tokens = 0
#     current: list[str] = []

#     for sentence in sentences:
#         token_count = len(sentence) // 4  # rough char→token
#         if current_tokens + token_count > chunk_size and current:
#             chunks.append(" ".join(current))
#             # keep tail for overlap
#             overlap_buf: list[str] = []
#             overlap_tokens = 0
#             for s in reversed(current):
#                 s_tokens = len(s) // 4
#                 if overlap_tokens + s_tokens <= overlap:
#                     overlap_buf.insert(0, s)
#                     overlap_tokens += s_tokens
#                 else:
#                     break
#             current = overlap_buf
#             current_tokens = overlap_tokens

#         current.append(sentence)
#         current_tokens += token_count

#     if current:
#         chunks.append(" ".join(current))

#     return chunks or [text]


# # ─── Sparse / keyword scoring (BM25-lite) ────────────────────────────────────

# def _tokenise(text: str) -> list[str]:
#     return re.findall(r"\b\w+\b", text.lower())


# def _idf(term: str, corpus: list[str]) -> float:
#     n_docs_with_term = sum(1 for doc in corpus if term in doc.lower())
#     if n_docs_with_term == 0:
#         return 0.0
#     return math.log((len(corpus) + 1) / (n_docs_with_term + 0.5))


# def bm25_score(query: str, document: str, corpus: list[str],
#                k1: float = 1.5, b: float = 0.75) -> float:
#     query_terms = _tokenise(query)
#     doc_tokens = _tokenise(document)
#     avg_dl = sum(len(_tokenise(d)) for d in corpus) / max(len(corpus), 1)
#     dl = len(doc_tokens)
#     tf_counter = Counter(doc_tokens)

#     score = 0.0
#     for term in set(query_terms):
#         tf = tf_counter.get(term, 0)
#         idf = _idf(term, corpus)
#         numerator = tf * (k1 + 1)
#         denominator = tf + k1 * (1 - b + b * dl / max(avg_dl, 1))
#         score += idf * numerator / max(denominator, 1e-9)
#     return score


# # ─── Dense similarity ─────────────────────────────────────────────────────────

# def cosine_similarity(a: list, b: list) -> float:
#     va = np.array(a, dtype=np.float32)
#     vb = np.array(b, dtype=np.float32)
#     na, nb = np.linalg.norm(va), np.linalg.norm(vb)
#     if na == 0 or nb == 0:
#         return 0.0
#     return float(np.dot(va, vb) / (na * nb))


# # ─── MMR re-ranking ───────────────────────────────────────────────────────────

# def mmr_rerank(
#     query_embedding: list,
#     candidates: list[dict],
#     top_k: int,
#     lambda_val: float = MMR_LAMBDA,
# ) -> list[dict]:
#     """
#     Maximal Marginal Relevance: balances relevance to query
#     with diversity among selected chunks.
#     """
#     if not candidates:
#         return []

#     selected: list[dict] = []
#     remaining = candidates[:]

#     while remaining and len(selected) < top_k:
#         mmr_scores = []
#         for cand in remaining:
#             relevance = cand["dense_score"]
#             if selected:
#                 max_sim = max(
#                     cosine_similarity(
#                         cand.get("embedding", []),
#                         sel.get("embedding", [])
#                     )
#                     for sel in selected
#                 )
#             else:
#                 max_sim = 0.0
#             mmr = lambda_val * relevance - (1 - lambda_val) * max_sim
#             mmr_scores.append(mmr)

#         best_idx = int(np.argmax(mmr_scores))
#         selected.append(remaining.pop(best_idx))

#     return selected


# # ─── LLM-based cross-encoder re-ranker ───────────────────────────────────────

# async def rerank_with_llm(query: str, chunks: list[dict], top_k: int = 5) -> list[dict]:
#     """
#     Ask Gemini to score each chunk for relevance to the query.
#     Returns re-ranked list.  Falls back to original order on failure.
#     """
#     if len(chunks) <= top_k:
#         return chunks

#     try:
#         import json
#         chunk_texts = "\n\n".join([
#             f"[{i}] {c['content'][:300]}" for i, c in enumerate(chunks)
#         ])
#         prompt = (
#             f"You are a relevance scorer. Score each passage 0-10 for how well it answers the query.\n\n"
#             f"Query: {query}\n\nPassages:\n{chunk_texts}\n\n"
#             f"Return ONLY a JSON array of scores, one per passage, in order. "
#             f"Example for 3 passages: [7, 3, 9]. No prose."
#         )
#         model = genai.GenerativeModel(CHAT_MODEL)
#         resp = model.generate_content(prompt)
#         text = resp.text.strip()
#         text = re.sub(r"```(?:json)?", "", text).strip().rstrip("`").strip()
#         scores = json.loads(text)

#         if isinstance(scores, list) and len(scores) == len(chunks):
#             for i, chunk in enumerate(chunks):
#                 chunk["llm_score"] = float(scores[i])
#             chunks.sort(key=lambda x: x.get("llm_score", 0), reverse=True)
#     except Exception as e:
#         print(f"⚠️  LLM re-rank failed (using original order): {e}")

#     return chunks[:top_k]


# # ─── Main hybrid search ───────────────────────────────────────────────────────

# async def search_knowledge_base_enhanced(
#     query: str,
#     agent_id: str,
#     db: Session,
#     top_k: int = 6,
#     use_rerank: bool = True,
# ) -> list[dict[str, Any]]:
#     """
#     Full pipeline:
#       1. Dense embedding similarity
#       2. Sparse BM25 scoring
#       3. Hybrid score fusion
#       4. MMR diversity filtering
#       5. Optional LLM cross-encoder re-ranking
#     """
#     query_embedding = await generate_query_embedding(query)
#     if not query_embedding:
#         return []

#     # Fetch all KB entries for this agent
#     kb_ids = [
#         k[0] for k in
#         db.query(KnowledgeBase.id)
#           .filter(KnowledgeBase.agent_id == agent_id)
#           .all()
#     ]
#     if not kb_ids:
#         return []

#     entries = (
#         db.query(KBEntry)
#           .filter(KBEntry.kb_id.in_(kb_ids), KBEntry.embedding.isnot(None))
#           .all()
#     )
#     if not entries:
#         return []

#     corpus = [e.content for e in entries]

#     # Score each entry
#     candidates: list[dict] = []
#     for entry in entries:
#         if not entry.embedding:
#             continue
#         dense = cosine_similarity(query_embedding, entry.embedding)
#         sparse = bm25_score(query, entry.content, corpus)

#         # Normalise sparse to 0-1 (approximate)
#         sparse_norm = min(sparse / 20.0, 1.0)

#         hybrid = ALPHA * dense + (1 - ALPHA) * sparse_norm

#         candidates.append({
#             "content": entry.content,
#             "source": entry.source_file or "",
#             "chunk_index": entry.chunk_index,
#             "dense_score": dense,
#             "sparse_score": sparse_norm,
#             "score": hybrid,
#             "embedding": entry.embedding,
#         })

#     # Sort by hybrid score
#     candidates.sort(key=lambda x: x["score"], reverse=True)

#     # Keep top candidates for MMR (2× top_k pool)
#     pool = candidates[: top_k * 2]

#     # MMR diversity filtering
#     diverse = mmr_rerank(query_embedding, pool, top_k=top_k)

#     # LLM re-ranking (optional, adds latency)
#     if use_rerank and len(diverse) > 3:
#         diverse = await rerank_with_llm(query, diverse, top_k=top_k)

#     # Strip embeddings from output (heavy, not needed downstream)
#     for c in diverse:
#         c.pop("embedding", None)

#     return diverse


# # ─── Context assembly ─────────────────────────────────────────────────────────

# def assemble_context(results: list[dict], max_chars: int = MAX_CONTEXT_CHARS) -> str:
#     """
#     Build a compact context string from RAG results,
#     deduplicating near-identical chunks and respecting token budget.
#     """
#     seen: set[str] = set()
#     parts: list[str] = []
#     total = 0

#     for r in results:
#         content = r["content"].strip()
#         # Simple dedup: skip if >80% of first 100 chars matches a seen chunk
#         key = re.sub(r"\s+", " ", content[:100]).lower()
#         if key in seen:
#             continue
#         seen.add(key)

#         source = r.get("source", "")
#         score = r.get("score", 0)
#         header = f"[Source: {source} | relevance: {score:.2f}]\n" if source else ""
#         block = header + content

#         if total + len(block) > max_chars:
#             # Try to fit a truncated version
#             remaining = max_chars - total - len(header) - 10
#             if remaining > 100:
#                 block = header + content[:remaining] + "…"
#                 parts.append(block)
#             break

#         parts.append(block)
#         total += len(block)

#     return "\n\n---\n\n".join(parts)


# # ─── Chunked ingestion helper ─────────────────────────────────────────────────

# async def embed_and_store_chunked(
#     text: str,
#     kb_id: str,
#     source: str,
#     db: Session,
# ) -> list[KBEntry]:
#     """
#     Split text into smart chunks, embed each, and persist to DB.
#     Returns list of stored KBEntry objects.
#     """
#     from services.gemini_service import generate_embedding

#     chunks = smart_chunk(text)
#     stored: list[KBEntry] = []

#     for idx, chunk in enumerate(chunks):
#         if not chunk.strip():
#             continue
#         embedding = await generate_embedding(chunk)
#         entry = KBEntry(
#             kb_id=kb_id,
#             content=chunk,
#             embedding=embedding,
#             source_file=source,
#             chunk_index=idx,
#         )
#         db.add(entry)
#         stored.append(entry)

#     db.commit()
#     for e in stored:
#         db.refresh(e)

#     print(f"📚 Stored {len(stored)} enhanced chunks from '{source}'")
#     return stored



"""
Enhanced RAG — optimised for low latency
──────────────────────────────────────────
Pipeline (all in-process, no extra LLM call):
  1. Dense cosine similarity (pre-computed embeddings)
  2. BM25 sparse keyword scoring
  3. Hybrid fusion  (ALPHA * dense + (1-ALPHA) * sparse)
  4. MMR diversity filter
  
LLM cross-encoder re-ranking has been REMOVED — it added 800ms-1.2s of latency
for marginal quality gain. Hybrid + MMR is fast enough (<50ms) and accurate.
"""

from __future__ import annotations

import math
import re
from collections import Counter
from typing import Any

import numpy as np
from sqlalchemy.orm import Session

from models import KBEntry, KnowledgeBase
from services.gemini_service import generate_embedding, generate_query_embedding

# ─── Constants ────────────────────────────────────────────────────────────────

CHUNK_SIZE        = 400
CHUNK_OVERLAP     = 80
ALPHA             = 0.65      # dense weight in hybrid
MMR_LAMBDA        = 0.65      # relevance vs diversity
MAX_CONTEXT_CHARS = 3000


# ─── Smart chunking ───────────────────────────────────────────────────────────

def smart_chunk(text: str, chunk_size: int = CHUNK_SIZE, overlap: int = CHUNK_OVERLAP) -> list[str]:
    text = re.sub(r"\s+", " ", text).strip()
    if not text:
        return []

    sentences = re.split(r"(?<=[.!?।])\s+|(?<=\n)\s*", text)
    sentences = [s.strip() for s in sentences if s.strip()]

    chunks: list[str] = []
    current_tokens = 0
    current: list[str] = []

    for sentence in sentences:
        token_count = len(sentence) // 4
        if current_tokens + token_count > chunk_size and current:
            chunks.append(" ".join(current))
            overlap_buf: list[str] = []
            overlap_tokens = 0
            for s in reversed(current):
                s_tokens = len(s) // 4
                if overlap_tokens + s_tokens <= overlap:
                    overlap_buf.insert(0, s)
                    overlap_tokens += s_tokens
                else:
                    break
            current = overlap_buf
            current_tokens = overlap_tokens

        current.append(sentence)
        current_tokens += token_count

    if current:
        chunks.append(" ".join(current))

    return chunks if chunks else [text]


# ─── Scoring helpers ──────────────────────────────────────────────────────────

def cosine_similarity(a: list[float], b: list[float]) -> float:
    if not a or not b:
        return 0.0
    va, vb = np.array(a, dtype=np.float32), np.array(b, dtype=np.float32)
    na, nb = np.linalg.norm(va), np.linalg.norm(vb)
    if na == 0 or nb == 0:
        return 0.0
    return float(np.dot(va, vb) / (na * nb))


def bm25_score(query: str, document: str, corpus: list[str],
               k1: float = 1.5, b: float = 0.75) -> float:
    tokens      = re.findall(r'\w+', query.lower())
    doc_tokens  = re.findall(r'\w+', document.lower())
    doc_len     = len(doc_tokens)
    avg_dl      = sum(len(re.findall(r'\w+', d)) for d in corpus) / max(len(corpus), 1)
    doc_freq    = Counter(doc_tokens)
    N           = len(corpus)

    score = 0.0
    for term in set(tokens):
        tf  = doc_freq.get(term, 0)
        df  = sum(1 for d in corpus if term in re.findall(r'\w+', d.lower()))
        idf = math.log((N - df + 0.5) / (df + 0.5) + 1)
        tf_norm = (tf * (k1 + 1)) / (tf + k1 * (1 - b + b * doc_len / max(avg_dl, 1)))
        score += idf * tf_norm

    return score


def mmr_rerank(query_embedding: list[float], candidates: list[dict],
               top_k: int = 6, lambda_: float = MMR_LAMBDA) -> list[dict]:
    if not candidates:
        return []

    selected: list[dict] = []
    remaining = candidates[:]

    while len(selected) < top_k and remaining:
        if not selected:
            # Pick highest relevance first
            best = max(remaining, key=lambda c: c["score"])
        else:
            # MMR: relevance - diversity penalty
            sel_embeddings = [s["embedding"] for s in selected if s.get("embedding")]

            def mmr_score(c):
                rel = c["score"]
                if sel_embeddings and c.get("embedding"):
                    sim_to_sel = max(cosine_similarity(c["embedding"], se) for se in sel_embeddings)
                else:
                    sim_to_sel = 0.0
                return lambda_ * rel - (1 - lambda_) * sim_to_sel

            best = max(remaining, key=mmr_score)

        selected.append(best)
        remaining.remove(best)

    return selected


# ─── Main search — no LLM call, pure in-process ───────────────────────────────

# ─── Embedding Cache (saves ~150ms per redundant query) ──────────────────────

_embedding_cache: dict[str, list[float]] = {}
_CACHE_MAX_SIZE = 500

def _cache_embedding(query_text: str, embedding: list[float]) -> None:
    """Cache a query embedding."""
    import hashlib
    key = hashlib.md5(query_text.lower().strip().encode()).hexdigest()
    if len(_embedding_cache) >= _CACHE_MAX_SIZE:
        # Simple FIFO eviction
        _embedding_cache.pop(next(iter(_embedding_cache)))
    _embedding_cache[key] = embedding

def _get_cached_embedding(query_text: str) -> list[float] | None:
    """Get cached embedding if available."""
    import hashlib
    key = hashlib.md5(query_text.lower().strip().encode()).hexdigest()
    return _embedding_cache.get(key)


async def search_knowledge_base_enhanced(
    query: str,
    agent_id: str,
    db: Session,
    top_k: int = 5,
    use_rerank: bool = False,   # kept for API compatibility, ignored
    fast_mode: bool = True,     # NEW: skip MMR for voice (saves ~100ms)
) -> list[dict[str, Any]]:
    """
    Fast hybrid search: dense + BM25 + MMR (or skip MMR for voice).
    Target latency: <80ms (embedding generation dominates, not retrieval).
    
    Args:
        fast_mode: If True, skip MMR re-ranking for voice calls (saves ~100ms)
    """
    # Check cache first
    query_embedding = _get_cached_embedding(query)
    if not query_embedding:
        query_embedding = await generate_query_embedding(query)
        if query_embedding:
            _cache_embedding(query, query_embedding)  # Cache for next time
    
    if not query_embedding:
        return []

    kb_ids = [
        k[0] for k in
        db.query(KnowledgeBase.id)
          .filter(KnowledgeBase.agent_id == agent_id)
          .all()
    ]
    if not kb_ids:
        return []

    entries = (
        db.query(KBEntry)
          .filter(KBEntry.kb_id.in_(kb_ids), KBEntry.embedding.isnot(None))
          .all()
    )
    if not entries:
        return []

    corpus = [e.content for e in entries]

    candidates: list[dict] = []
    for entry in entries:
        if not entry.embedding:
            continue
        dense       = cosine_similarity(query_embedding, entry.embedding)
        sparse      = bm25_score(query, entry.content, corpus)
        sparse_norm = min(sparse / 20.0, 1.0)
        hybrid      = ALPHA * dense + (1 - ALPHA) * sparse_norm

        candidates.append({
            "content":     entry.content,
            "source":      entry.source_file or "",
            "chunk_index": entry.chunk_index,
            "dense_score": dense,
            "sparse_score": sparse_norm,
            "score":       hybrid,
            "embedding":   entry.embedding,
        })

    candidates.sort(key=lambda x: x["score"], reverse=True)
    
    # FAST MODE: Skip expensive MMR re-ranking for voice calls
    if fast_mode:
        # Just return top-k without re-ranking
        diverse = candidates[:top_k]
    else:
        # Full quality mode with MMR
        pool    = candidates[: top_k * 2]
        diverse = mmr_rerank(query_embedding, pool, top_k=top_k)

    for c in diverse:
        c.pop("embedding", None)

    return diverse


# ─── Context assembly ─────────────────────────────────────────────────────────

def assemble_context(
    results: list[dict],
    max_chars: int = MAX_CONTEXT_CHARS,
    total_kb_entries: int | None = None,
) -> str:
    if not results:
        return ""

    seen: set[str] = set()
    parts: list[str] = []
    total = 0

    for r in results:
        content = r["content"].strip()
        key     = content[:80]
        if key in seen:
            continue
        seen.add(key)

        if total + len(content) > max_chars:
            remaining = max_chars - total
            if remaining > 100:
                parts.append(content[:remaining])
            break

        parts.append(content)
        total += len(content)

    context_body = "\n\n---\n\n".join(parts)

    # Prepend metadata so the LLM knows it's seeing a subset
    shown = len(parts)
    if total_kb_entries and total_kb_entries > shown:
        header = (
            f"[KB INFO: Showing top {shown} relevant results out of "
            f"{total_kb_entries} total entries in the knowledge base. "
            f"If the user needs more specific results, ask them to narrow their query.]"
        )
        return f"{header}\n\n{context_body}"

    return context_body


# ─── Ingestion ────────────────────────────────────────────────────────────────

async def embed_and_store_chunked(
    text: str,
    kb_id: str,
    source: str,
    db: Session,
    agent_id: str | None = None,
) -> list[KBEntry]:
    """
    Smart-chunk text, embed each chunk, persist to SQLite/PostgreSQL,
    and — when ChromaDB backend is active — also upsert into vector store.
    """
    from services.rag_config import RAG_BACKEND

    chunks = smart_chunk(text)
    stored: list[KBEntry] = []

    for i, chunk in enumerate(chunks):
        if not chunk.strip():
            continue
        embedding = await generate_embedding(chunk)
        entry = KBEntry(
            kb_id=kb_id,
            content=chunk,
            embedding=embedding,
            source_file=source,
            chunk_index=i,
        )
        db.add(entry)
        db.flush()   # populate entry.id before upsert
        stored.append(entry)

        # Mirror to ChromaDB when active
        if RAG_BACKEND == "chroma" and agent_id and entry.id:
            try:
                from services.vector_store import upsert_entry
                await upsert_entry(
                    entry_id=entry.id,
                    content=chunk,
                    agent_id=agent_id,
                    kb_id=kb_id,
                    source=source,
                    chunk_index=i,
                )
            except Exception as e:
                print(f"⚠️  ChromaDB upsert warning ({source}[{i}]): {e}")

    db.commit()
    return stored


# ─── Broad query detection ────────────────────────────────────────────────────

_BROAD_QUERY_PATTERNS = re.compile(
    r"\b(all|list|show|every|everything|catalog|catalogue|available|"
    r"what do you have|what(?:'s| is) available|full list|complete list|"
    r"tell me about your|what products|what items|what services|"
    r"ellam|muzhusa|total|enna enna|enna irukku|enna vagai"
    r")\b",
    re.IGNORECASE,
)

def _is_broad_query(query: str) -> bool:
    """Detect if user is asking a broad/listing question vs a specific one."""
    return bool(_BROAD_QUERY_PATTERNS.search(query))


# ─── Unified search dispatcher ────────────────────────────────────────────────

async def search_knowledge_base_unified(
    query: str,
    agent_id: str,
    db: Session,
    top_k: int | None = None,
) -> list[dict]:
    """
    Single entry-point for RAG search.  Selects backend based on RAG_BACKEND:
      "chroma"   → ChromaDB ANN search  (fast, scalable) + BM25 hybrid + MMR
      "enhanced" → SQL embeddings + BM25 + MMR  (medium scale)
      "legacy"   → SQL embeddings + pure cosine sort  (backward compat)

    All paths return the same list[dict] schema:
      [{content, score, source, chunk_index, ...}, ...]
    """
    from services.rag_config import RAG_BACKEND, TOP_K
    import logging
    logger = logging.getLogger(__name__)
    
    k = top_k or TOP_K

    # Boost retrieval count for broad/listing queries to get more diverse results
    if _is_broad_query(query):
        k = max(k, 12)
        logger.info(f"📋 Broad query detected — boosted top_k to {k}")

    logger.info(f"🔍 RAG search: backend={RAG_BACKEND}, agent={agent_id}, query='{query[:50]}...', top_k={k}")

    if RAG_BACKEND == "chroma":
        results = await _search_chroma(query, agent_id, db, k)
    elif RAG_BACKEND == "enhanced":
        results = await search_knowledge_base_enhanced(query, agent_id, db, k)
    else:
        # legacy — use original embeddings.py
        from services.embeddings import search_knowledge_base as legacy_search
        results = await legacy_search(query, agent_id, db, k)

    logger.info(f"📊 RAG search result: {len(results)} chunks returned")
    if not results:
        logger.warning(f"⚠️  RAG returned NO results for agent {agent_id} — agent may hallucinate!")

    return results


async def _search_chroma(
    query: str,
    agent_id: str,
    db: Session,
    top_k: int,
) -> list[dict]:
    """
    ChromaDB ANN search → BM25 sparse re-score → MMR diversity filter.
    No SQL embeddings loaded — O(log n) ANN via HNSW.
    """
    from services.vector_store import search_vector
    from services.rag_config import ALPHA, TOP_K

    # Step 1: ANN vector search — returns top_k * 2 candidates fast
    candidates = await search_vector(query, agent_id, top_k=top_k * 2)
    if not candidates:
        return []

    corpus = [c["content"] for c in candidates]

    # Step 2: Add BM25 sparse score and compute hybrid
    for c in candidates:
        sparse = bm25_score(query, c["content"], corpus)
        sparse_norm = min(sparse / 20.0, 1.0)
        c["sparse_score"] = sparse_norm
        c["dense_score"]  = c["score"]
        c["score"]        = ALPHA * c["dense_score"] + (1 - ALPHA) * sparse_norm

    candidates.sort(key=lambda x: x["score"], reverse=True)
    pool = candidates[: top_k * 2]

    # Step 3: MMR diversity filter
    query_embedding = None
    if pool and pool[0].get("embedding"):
        query_embedding = pool[0]["embedding"]  # reuse first result's embedding as proxy
    diverse = mmr_rerank(query_embedding or [], pool, top_k=top_k)

    # Filter out low-relevance results
    from services.rag_config import MIN_SCORE_THRESHOLD
    diverse = [c for c in diverse if c["score"] >= MIN_SCORE_THRESHOLD]

    # Strip heavyweight fields before returning
    for c in diverse:
        c.pop("embedding", None)

    return diverse