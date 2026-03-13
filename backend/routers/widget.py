"""Public widget API — no authentication required.

These endpoints serve the embeddable voice agent widget on external websites.
Access is scoped by agent_id (UUID).
"""

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session
from database import get_db
from models import Agent, KnowledgeBase, KBEntry
import os

router = APIRouter(prefix="/api/widget", tags=["widget"])


@router.get("/{agent_id}/boot")
async def widget_boot(agent_id: str, db: Session = Depends(get_db)):
    """Return everything the widget needs: agent config, KB context, Gemini key."""
    agent = db.query(Agent).filter(Agent.id == agent_id).first()
    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found")

    # ── Build KB context (same logic as /kb-context) ──────────────────────
    from services.rag_config import MAX_CONTEXT_CHARS

    kb_context = ""
    kb_ids = (
        db.query(KnowledgeBase.id)
        .filter(KnowledgeBase.agent_id == agent_id)
        .all()
    )
    kb_ids = [k[0] for k in kb_ids]

    if kb_ids:
        total_entries = (
            db.query(KBEntry).filter(KBEntry.kb_id.in_(kb_ids)).count()
        )
        entries = (
            db.query(KBEntry.content)
            .filter(KBEntry.kb_id.in_(kb_ids))
            .all()
        )
        chunks = []
        total_chars = 0
        for (content,) in entries:
            c = content.strip()
            if total_chars + len(c) > MAX_CONTEXT_CHARS:
                remaining = MAX_CONTEXT_CHARS - total_chars
                if remaining > 100:
                    chunks.append(c[:remaining])
                break
            chunks.append(c)
            total_chars += len(c)

        kb_context = "\n\n".join(chunks)
        shown = len(chunks)
        if total_entries > shown:
            header = (
                f"[KB INFO: Showing {shown} entries out of {total_entries} total. "
                f"This is a subset — for broad questions, mention highlights and "
                f"ask the user to be more specific.]"
            )
            kb_context = f"{header}\n\n{kb_context}"

    return {
        "agent": {
            "id": agent.id,
            "name": agent.name,
            "role": agent.role,
            "system_prompt": agent.system_prompt or "",
            "voice_id": agent.voice_id or "Puck",
            "language": agent.language or "ta-IN",
        },
        "kb_context": kb_context,
        "gemini_key": os.getenv("GEMINI_API_KEY", ""),
    }


@router.post("/{agent_id}/chat")
async def widget_chat(
    agent_id: str,
    body: dict,
    db: Session = Depends(get_db),
):
    """Public text chat for the widget — multi-agent orchestrator."""
    agent = db.query(Agent).filter(Agent.id == agent_id).first()
    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found")

    raw_message = (body.get("message") or "").strip()
    if not raw_message:
        raise HTTPException(status_code=400, detail="Message is required")

    from services.security_guard import (
        sanitize_user_message,
        detect_prompt_injection,
    )

    message = sanitize_user_message(raw_message, max_length=2000)
    is_injection, _ = detect_prompt_injection(raw_message)
    if is_injection:
        raise HTTPException(status_code=400, detail="Message blocked by security filter")

    try:
        from services.multi_agent import orchestrator
        from services.enhanced_rag import search_knowledge_base_unified, assemble_context

        kb_results = search_knowledge_base_unified(agent_id, message, db, top_k=6)
        context = assemble_context(kb_results) if kb_results else ""

        history = body.get("history", [])[-10:]
        response = await orchestrator(agent, message, context, history)
        return {"response": response}
    except Exception as e:
        raise HTTPException(status_code=500, detail="Chat processing failed")
