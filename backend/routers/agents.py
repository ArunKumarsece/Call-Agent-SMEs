# # """CRUD API routes for Agents."""

# # from fastapi import APIRouter, Depends, HTTPException
# # from sqlalchemy.orm import Session
# # from database import get_db
# # from models import Agent, KnowledgeBase
# # from schemas import AgentCreate, AgentUpdate, AgentResponse, SDKResponse
# # from services.sdk_generator import generate_sdk_code
# # from datetime import datetime, timezone

# # router = APIRouter(prefix="/api/agents", tags=["agents"])


# # @router.post("/", response_model=AgentResponse)
# # async def create_agent(agent: AgentCreate, db: Session = Depends(get_db)):
# #     """Create a new AI agent."""
# #     db_agent = Agent(
# #         name=agent.name,
# #         role=agent.role,
# #         description=agent.description,
# #         system_prompt=agent.system_prompt,
# #         voice_id=agent.voice_id,
# #         language=agent.language
# #     )
# #     db.add(db_agent)
# #     db.commit()
# #     db.refresh(db_agent)

# #     return AgentResponse(
# #         id=db_agent.id,
# #         name=db_agent.name,
# #         role=db_agent.role,
# #         description=db_agent.description,
# #         system_prompt=db_agent.system_prompt,
# #         voice_id=db_agent.voice_id,
# #         language=db_agent.language,
# #         created_at=db_agent.created_at,
# #         updated_at=db_agent.updated_at,
# #         kb_count=0
# #     )


# # @router.get("/", response_model=list[AgentResponse])
# # async def list_agents(db: Session = Depends(get_db)):
# #     """List all agents."""
# #     agents = db.query(Agent).order_by(Agent.created_at.desc()).all()
# #     result = []
# #     for a in agents:
# #         kb_count = db.query(KnowledgeBase).filter(
# #             KnowledgeBase.agent_id == a.id
# #         ).count()
# #         result.append(AgentResponse(
# #             id=a.id, name=a.name, role=a.role,
# #             description=a.description, system_prompt=a.system_prompt,
# #             voice_id=a.voice_id, language=a.language,
# #             created_at=a.created_at, updated_at=a.updated_at,
# #             kb_count=kb_count
# #         ))
# #     return result


# # @router.get("/{agent_id}", response_model=AgentResponse)
# # async def get_agent(agent_id: str, db: Session = Depends(get_db)):
# #     """Get a single agent by ID."""
# #     agent = db.query(Agent).filter(Agent.id == agent_id).first()
# #     if not agent:
# #         raise HTTPException(status_code=404, detail="Agent not found")

# #     kb_count = db.query(KnowledgeBase).filter(
# #         KnowledgeBase.agent_id == agent.id
# #     ).count()
# #     return AgentResponse(
# #         id=agent.id, name=agent.name, role=agent.role,
# #         description=agent.description, system_prompt=agent.system_prompt,
# #         voice_id=agent.voice_id, language=agent.language,
# #         created_at=agent.created_at, updated_at=agent.updated_at,
# #         kb_count=kb_count
# #     )


# # @router.put("/{agent_id}", response_model=AgentResponse)
# # async def update_agent(agent_id: str, update: AgentUpdate,
# #                        db: Session = Depends(get_db)):
# #     """Update an existing agent."""
# #     agent = db.query(Agent).filter(Agent.id == agent_id).first()
# #     if not agent:
# #         raise HTTPException(status_code=404, detail="Agent not found")

# #     update_data = update.model_dump(exclude_unset=True)
# #     for key, value in update_data.items():
# #         setattr(agent, key, value)

# #     agent.updated_at = datetime.now(timezone.utc)
# #     db.commit()
# #     db.refresh(agent)

# #     kb_count = db.query(KnowledgeBase).filter(
# #         KnowledgeBase.agent_id == agent.id
# #     ).count()
# #     return AgentResponse(
# #         id=agent.id, name=agent.name, role=agent.role,
# #         description=agent.description, system_prompt=agent.system_prompt,
# #         voice_id=agent.voice_id, language=agent.language,
# #         created_at=agent.created_at, updated_at=agent.updated_at,
# #         kb_count=kb_count
# #     )


# # @router.delete("/{agent_id}")
# # async def delete_agent(agent_id: str, db: Session = Depends(get_db)):
# #     """Delete an agent and its knowledge bases."""
# #     agent = db.query(Agent).filter(Agent.id == agent_id).first()
# #     if not agent:
# #         raise HTTPException(status_code=404, detail="Agent not found")

# #     db.delete(agent)
# #     db.commit()
# #     return {"message": "Agent deleted successfully", "id": agent_id}


# # @router.get("/{agent_id}/sdk", response_model=SDKResponse)
# # async def get_agent_sdk(agent_id: str, db: Session = Depends(get_db)):
# #     """Get the SDK embed code for an agent."""
# #     agent = db.query(Agent).filter(Agent.id == agent_id).first()
# #     if not agent:
# #         raise HTTPException(status_code=404, detail="Agent not found")

# #     sdk = generate_sdk_code(agent.id, agent.name)
# #     return SDKResponse(
# #         agent_id=agent.id,
# #         agent_name=agent.name,
# #         html_snippet=sdk["html_snippet"],
# #         js_config=sdk["js_config"],
# #         instructions=sdk["instructions"]
# #     )


# # @router.post("/{agent_id}/chat")
# # async def chat_with_agent(agent_id: str, body: dict,
# #                           db: Session = Depends(get_db)):
# #     """Text chat with an agent (for testing)."""
# #     from services.gemini_service import generate_response, get_tanglish_system_prompt
# #     from services.embeddings import search_knowledge_base

# #     agent = db.query(Agent).filter(Agent.id == agent_id).first()
# #     if not agent:
# #         raise HTTPException(status_code=404, detail="Agent not found")

# #     message = body.get("message", "")
# #     if not message:
# #         raise HTTPException(status_code=400, detail="Message is required")

# #     # RAG search
# #     try:
# #         results = await search_knowledge_base(message, agent_id, db, top_k=3)
# #     except Exception as e:
# #         print(f"RAG search error (non-fatal): {e}")
# #         results = []
# #     context = "\n\n".join([r["content"] for r in results]) if results else ""

# #     system_prompt = get_tanglish_system_prompt(
# #         agent.system_prompt or "", agent.role
# #     )

# #     try:
# #         response = await generate_response(message, system_prompt, context)
# #     except Exception as e:
# #         print(f"❌ Chat error: {e}")
# #         raise HTTPException(
# #             status_code=500,
# #             detail=f"AI generation failed: {str(e)}"
# #         )

# #     return {
# #         "response": response,
# #         "sources": [{"content": r["content"][:100], "score": r["score"]}
# #                     for r in results]
# #     }


# """CRUD API routes for Agents — with Multi-Agent orchestration + Enhanced RAG."""

# from fastapi import APIRouter, Depends, HTTPException
# from sqlalchemy.orm import Session
# from database import get_db
# from models import Agent, KnowledgeBase
# from schemas import AgentCreate, AgentUpdate, AgentResponse, SDKResponse
# from services.sdk_generator import generate_sdk_code
# from datetime import datetime, timezone

# router = APIRouter(prefix="/api/agents", tags=["agents"])


# # ─── CRUD ─────────────────────────────────────────────────────────────────────

# @router.post("/", response_model=AgentResponse)
# async def create_agent(agent: AgentCreate, db: Session = Depends(get_db)):
#     db_agent = Agent(
#         name=agent.name, role=agent.role, description=agent.description,
#         system_prompt=agent.system_prompt, voice_id=agent.voice_id, language=agent.language,
#     )
#     db.add(db_agent); db.commit(); db.refresh(db_agent)
#     return _agent_response(db_agent, 0)


# @router.get("/", response_model=list[AgentResponse])
# async def list_agents(db: Session = Depends(get_db)):
#     agents = db.query(Agent).order_by(Agent.created_at.desc()).all()
#     return [_agent_response(a, db.query(KnowledgeBase).filter(KnowledgeBase.agent_id == a.id).count()) for a in agents]


# @router.get("/{agent_id}", response_model=AgentResponse)
# async def get_agent(agent_id: str, db: Session = Depends(get_db)):
#     agent = _get_or_404(agent_id, db)
#     return _agent_response(agent, db.query(KnowledgeBase).filter(KnowledgeBase.agent_id == agent.id).count())


# @router.put("/{agent_id}", response_model=AgentResponse)
# async def update_agent(agent_id: str, update: AgentUpdate, db: Session = Depends(get_db)):
#     agent = _get_or_404(agent_id, db)
#     for key, value in update.model_dump(exclude_unset=True).items():
#         setattr(agent, key, value)
#     agent.updated_at = datetime.now(timezone.utc)
#     db.commit(); db.refresh(agent)
#     return _agent_response(agent, db.query(KnowledgeBase).filter(KnowledgeBase.agent_id == agent.id).count())


# @router.delete("/{agent_id}")
# async def delete_agent(agent_id: str, db: Session = Depends(get_db)):
#     agent = _get_or_404(agent_id, db)
#     db.delete(agent); db.commit()
#     return {"message": "Agent deleted successfully", "id": agent_id}


# @router.get("/{agent_id}/sdk", response_model=SDKResponse)
# async def get_agent_sdk(agent_id: str, db: Session = Depends(get_db)):
#     agent = _get_or_404(agent_id, db)
#     sdk = generate_sdk_code(agent.id, agent.name)
#     return SDKResponse(agent_id=agent.id, agent_name=agent.name,
#                        html_snippet=sdk["html_snippet"], js_config=sdk["js_config"],
#                        instructions=sdk["instructions"])


# # ─── Multi-Agent Chat ─────────────────────────────────────────────────────────

# @router.post("/{agent_id}/chat")
# async def chat_with_agent(agent_id: str, body: dict, db: Session = Depends(get_db)):
#     """Text chat using full multi-agent pipeline + enhanced RAG."""
#     from services.multi_agent import orchestrator
#     from services.enhanced_rag import search_knowledge_base_enhanced, assemble_context

#     agent = _get_or_404(agent_id, db)
#     message = body.get("message", "").strip()
#     if not message:
#         raise HTTPException(status_code=400, detail="Message is required")

#     conversation_history = body.get("history", [])

#     # Enhanced RAG
#     try:
#         results = await search_knowledge_base_enhanced(message, agent_id, db, top_k=6)
#         context = assemble_context(results)
#     except Exception as e:
#         print(f"RAG error (non-fatal): {e}")
#         results, context = [], ""

#     # Multi-agent orchestration
#     try:
#         decision = await orchestrator.run(
#             user_message=message,
#             rag_context=context,
#             agent_system_prompt=agent.system_prompt or "",
#             agent_role=agent.role,
#             conversation_history=conversation_history,
#         )
#     except Exception as e:
#         import traceback; traceback.print_exc()
#         raise HTTPException(status_code=500, detail=f"Multi-agent pipeline failed: {e}")

#     return {
#         "response": decision.final_response,
#         "intent": decision.intent,
#         "sentiment": decision.sentiment,
#         "should_escalate": decision.should_escalate,
#         "language_hint": decision.language_hint,
#         "rag_used": decision.rag_used,
#         "agents_invoked": decision.agents_invoked,
#         "confidence": decision.confidence,
#         "sources": [{"content": r["content"][:120], "score": r["score"], "source": r.get("source", "")} for r in results],
#         "metadata": decision.metadata,
#     }


# # ─── Helpers ──────────────────────────────────────────────────────────────────

# def _get_or_404(agent_id: str, db: Session) -> Agent:
#     agent = db.query(Agent).filter(Agent.id == agent_id).first()
#     if not agent:
#         raise HTTPException(status_code=404, detail="Agent not found")
#     return agent


# def _agent_response(agent: Agent, kb_count: int) -> AgentResponse:
#     return AgentResponse(
#         id=agent.id, name=agent.name, role=agent.role,
#         description=agent.description, system_prompt=agent.system_prompt,
#         voice_id=agent.voice_id, language=agent.language,
#         created_at=agent.created_at, updated_at=agent.updated_at, kb_count=kb_count,
#     )


"""CRUD API routes for Agents — company-scoped with multi-agent + enhanced RAG."""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from database import get_db
from models import Agent, KnowledgeBase, KBEntry, Company
from schemas import AgentCreate, AgentUpdate, AgentResponse, SDKResponse
from services.sdk_generator import generate_sdk_code
from services.auth_service import get_current_company
from datetime import datetime, timezone

router = APIRouter(prefix="/api/agents", tags=["agents"])


# ─── CRUD ─────────────────────────────────────────────────────────────────────

@router.post("/", response_model=AgentResponse, status_code=201)
async def create_agent(
    agent: AgentCreate,
    db: Session = Depends(get_db),
    company: Company = Depends(get_current_company),
):
    db_agent = Agent(
        company_id=company.id,
        name=agent.name, role=agent.role, description=agent.description,
        system_prompt=agent.system_prompt, voice_id=agent.voice_id, language=agent.language,
    )
    db.add(db_agent); db.commit(); db.refresh(db_agent)
    return _agent_response(db_agent, 0)


@router.get("/", response_model=list[AgentResponse])
async def list_agents(
    db: Session = Depends(get_db),
    company: Company = Depends(get_current_company),
):
    agents = (
        db.query(Agent)
          .filter(Agent.company_id == company.id)
          .order_by(Agent.created_at.desc())
          .all()
    )
    return [
        _agent_response(a, db.query(KnowledgeBase).filter(KnowledgeBase.agent_id == a.id).count())
        for a in agents
    ]


@router.get("/{agent_id}", response_model=AgentResponse)
async def get_agent(
    agent_id: str,
    db: Session = Depends(get_db),
    company: Company = Depends(get_current_company),
):
    agent = _get_or_404(agent_id, company.id, db)
    return _agent_response(
        agent,
        db.query(KnowledgeBase).filter(KnowledgeBase.agent_id == agent.id).count()
    )


@router.put("/{agent_id}", response_model=AgentResponse)
async def update_agent(
    agent_id: str, update: AgentUpdate,
    db: Session = Depends(get_db),
    company: Company = Depends(get_current_company),
):
    agent = _get_or_404(agent_id, company.id, db)
    for key, value in update.model_dump(exclude_unset=True).items():
        setattr(agent, key, value)
    agent.updated_at = datetime.now(timezone.utc)
    db.commit(); db.refresh(agent)
    return _agent_response(
        agent,
        db.query(KnowledgeBase).filter(KnowledgeBase.agent_id == agent.id).count()
    )


@router.delete("/{agent_id}")
async def delete_agent(
    agent_id: str,
    db: Session = Depends(get_db),
    company: Company = Depends(get_current_company),
):
    agent = _get_or_404(agent_id, company.id, db)
    db.delete(agent); db.commit()
    return {"message": "Agent deleted successfully", "id": agent_id}


@router.get("/{agent_id}/sdk", response_model=SDKResponse)
async def get_agent_sdk(
    agent_id: str,
    db: Session = Depends(get_db),
    company: Company = Depends(get_current_company),
):
    agent = _get_or_404(agent_id, company.id, db)
    sdk = generate_sdk_code(agent.id, agent.name)
    return SDKResponse(
        agent_id=agent.id, agent_name=agent.name,
        html_snippet=sdk["html_snippet"], js_config=sdk["js_config"],
        instructions=sdk["instructions"],
    )


# ─── Multi-Agent Chat ─────────────────────────────────────────────────────────

@router.post("/{agent_id}/chat")
async def chat_with_agent(
    agent_id: str, body: dict,
    db: Session = Depends(get_db),
    company: Company = Depends(get_current_company),
):
    from services.multi_agent import orchestrator
    from services.enhanced_rag import search_knowledge_base_unified, assemble_context

    agent = _get_or_404(agent_id, company.id, db)
    message = body.get("message", "").strip()
    if not message:
        raise HTTPException(status_code=400, detail="Message is required")

    conversation_history = body.get("history", [])

    try:
        results = await search_knowledge_base_unified(message, agent_id, db)
        context = assemble_context(results)
        if not context.strip():
            context = "[NO RELEVANT KNOWLEDGE BASE ENTRIES FOUND]"
    except Exception as e:
        print(f"RAG error: {e}"); results, context = [], "[NO RELEVANT KNOWLEDGE BASE ENTRIES FOUND]"

    try:
        decision = await orchestrator.run(
            user_message=message, rag_context=context,
            agent_system_prompt=agent.system_prompt or "",
            agent_role=agent.role, conversation_history=conversation_history,
        )
    except Exception as e:
        import traceback; traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Multi-agent pipeline failed: {e}")

    return {
        "response": decision.final_response,
        "intent": decision.intent, "sentiment": decision.sentiment,
        "should_escalate": decision.should_escalate,
        "language_hint": decision.language_hint, "rag_used": decision.rag_used,
        "agents_invoked": decision.agents_invoked, "confidence": decision.confidence,
        "sources": [{"content": r["content"][:120], "score": r["score"], "source": r.get("source", "")} for r in results],
        "metadata": decision.metadata,
    }


@router.get("/{agent_id}/kb-context")
async def get_agent_kb_context(
    agent_id: str,
    db: Session = Depends(get_db),
    company: Company = Depends(get_current_company),
):
    """Return all KB entries for an agent as a single context string for Live Audio."""
    agent = _get_or_404(agent_id, company.id, db)
    from services.rag_config import MAX_CONTEXT_CHARS
    kb_ids = db.query(KnowledgeBase.id).filter(KnowledgeBase.agent_id == agent_id).all()
    kb_ids = [k[0] for k in kb_ids]
    if not kb_ids:
        return {"context": ""}
    entries = db.query(KBEntry.content).filter(KBEntry.kb_id.in_(kb_ids)).all()
    chunks = []
    total = 0
    for (content,) in entries:
        c = content.strip()
        if total + len(c) > MAX_CONTEXT_CHARS:
            remaining = MAX_CONTEXT_CHARS - total
            if remaining > 100:
                chunks.append(c[:remaining])
            break
        chunks.append(c)
        total += len(c)
    return {"context": "\n\n".join(chunks)}


# ─── Helpers ──────────────────────────────────────────────────────────────────

def _get_or_404(agent_id: str, company_id: str, db: Session) -> Agent:
    agent = db.query(Agent).filter(
        Agent.id == agent_id,
        Agent.company_id == company_id
    ).first()
    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found")
    return agent


def _agent_response(agent: Agent, kb_count: int) -> AgentResponse:
    return AgentResponse(
        id=agent.id, name=agent.name, role=agent.role,
        description=agent.description, system_prompt=agent.system_prompt,
        voice_id=agent.voice_id, language=agent.language,
        created_at=agent.created_at, updated_at=agent.updated_at, kb_count=kb_count,
    )
