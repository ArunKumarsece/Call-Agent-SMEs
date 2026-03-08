"""Embedding-based RAG search service."""

import numpy as np
from sqlalchemy.orm import Session
from models import KBEntry, KnowledgeBase
from services.gemini_service import generate_embedding, generate_query_embedding


def cosine_similarity(a: list, b: list) -> float:
    """Calculate cosine similarity between two vectors."""
    a = np.array(a, dtype=np.float32)
    b = np.array(b, dtype=np.float32)
    if np.linalg.norm(a) == 0 or np.linalg.norm(b) == 0:
        return 0.0
    return float(np.dot(a, b) / (np.linalg.norm(a) * np.linalg.norm(b)))


async def embed_and_store(content: str, kb_id: str, source: str,
                          chunk_index: int, db: Session) -> KBEntry:
    """Generate embedding for content and store in DB."""
    embedding = await generate_embedding(content)
    entry = KBEntry(
        kb_id=kb_id,
        content=content,
        embedding=embedding,
        source_file=source,
        chunk_index=chunk_index
    )
    db.add(entry)
    db.commit()
    db.refresh(entry)
    return entry


async def search_knowledge_base(query: str, agent_id: str, db: Session,
                                  top_k: int = 5) -> list:
    """Search across all knowledge bases for an agent using cosine similarity."""
    query_embedding = await generate_query_embedding(query)
    if not query_embedding:
        return []

    # Get all KB entries for this agent
    kb_ids = db.query(KnowledgeBase.id).filter(
        KnowledgeBase.agent_id == agent_id
    ).all()
    kb_ids = [k[0] for k in kb_ids]

    if not kb_ids:
        return []

    entries = db.query(KBEntry).filter(
        KBEntry.kb_id.in_(kb_ids),
        KBEntry.embedding.isnot(None)
    ).all()

    if not entries:
        return []

    # Calculate similarities
    scored = []
    for entry in entries:
        if entry.embedding:
            sim = cosine_similarity(query_embedding, entry.embedding)
            scored.append({"content": entry.content, "score": sim,
                          "source": entry.source_file})

    # Sort by score descending
    scored.sort(key=lambda x: x["score"], reverse=True)
    return scored[:top_k]
