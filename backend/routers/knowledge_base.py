# # """CRUD API routes for Knowledge Bases."""

# # from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
# # from sqlalchemy.orm import Session
# # from database import get_db
# # from models import KnowledgeBase, KBEntry, Agent
# # from schemas import KBCreate, KBUpdate, KBResponse, KBEntryCreate, KBEntryResponse
# # from services.file_processor import process_file
# # from services.embeddings import embed_and_store
# # from services.sheets_sync import sync_dynamic_kb
# # from datetime import datetime, timezone

# # router = APIRouter(prefix="/api/kb", tags=["knowledge_base"])


# # @router.post("/", response_model=KBResponse)
# # async def create_knowledge_base(kb: KBCreate, agent_id: str,
# #                                  db: Session = Depends(get_db)):
# #     """Create a new knowledge base for an agent."""
# #     agent = db.query(Agent).filter(Agent.id == agent_id).first()
# #     if not agent:
# #         raise HTTPException(status_code=404, detail="Agent not found")

# #     db_kb = KnowledgeBase(
# #         agent_id=agent_id,
# #         name=kb.name,
# #         kb_type=kb.kb_type,
# #         source_url=kb.source_url,
# #         sync_interval=kb.sync_interval
# #     )
# #     db.add(db_kb)
# #     db.commit()
# #     db.refresh(db_kb)

# #     # If dynamic, trigger initial sync
# #     if kb.kb_type == "dynamic" and kb.source_url:
# #         try:
# #             await sync_dynamic_kb(db_kb.id, kb.source_url, db)
# #         except Exception as e:
# #             print(f"Initial sync error: {e}")

# #     entry_count = db.query(KBEntry).filter(KBEntry.kb_id == db_kb.id).count()
# #     return KBResponse(
# #         id=db_kb.id, agent_id=db_kb.agent_id, name=db_kb.name,
# #         kb_type=db_kb.kb_type, source_url=db_kb.source_url,
# #         sync_interval=db_kb.sync_interval,
# #         created_at=db_kb.created_at, updated_at=db_kb.updated_at,
# #         entry_count=entry_count
# #     )


# # @router.get("/agent/{agent_id}", response_model=list[KBResponse])
# # async def list_knowledge_bases(agent_id: str, db: Session = Depends(get_db)):
# #     """List all knowledge bases for an agent."""
# #     kbs = db.query(KnowledgeBase).filter(
# #         KnowledgeBase.agent_id == agent_id
# #     ).order_by(KnowledgeBase.created_at.desc()).all()

# #     result = []
# #     for kb in kbs:
# #         entry_count = db.query(KBEntry).filter(KBEntry.kb_id == kb.id).count()
# #         result.append(KBResponse(
# #             id=kb.id, agent_id=kb.agent_id, name=kb.name,
# #             kb_type=kb.kb_type, source_url=kb.source_url,
# #             sync_interval=kb.sync_interval,
# #             created_at=kb.created_at, updated_at=kb.updated_at,
# #             entry_count=entry_count
# #         ))
# #     return result


# # @router.get("/{kb_id}", response_model=KBResponse)
# # async def get_knowledge_base(kb_id: str, db: Session = Depends(get_db)):
# #     """Get a single knowledge base."""
# #     kb = db.query(KnowledgeBase).filter(KnowledgeBase.id == kb_id).first()
# #     if not kb:
# #         raise HTTPException(status_code=404, detail="Knowledge base not found")

# #     entry_count = db.query(KBEntry).filter(KBEntry.kb_id == kb.id).count()
# #     return KBResponse(
# #         id=kb.id, agent_id=kb.agent_id, name=kb.name,
# #         kb_type=kb.kb_type, source_url=kb.source_url,
# #         sync_interval=kb.sync_interval,
# #         created_at=kb.created_at, updated_at=kb.updated_at,
# #         entry_count=entry_count
# #     )


# # @router.put("/{kb_id}", response_model=KBResponse)
# # async def update_knowledge_base(kb_id: str, update: KBUpdate,
# #                                  db: Session = Depends(get_db)):
# #     """Update a knowledge base."""
# #     kb = db.query(KnowledgeBase).filter(KnowledgeBase.id == kb_id).first()
# #     if not kb:
# #         raise HTTPException(status_code=404, detail="Knowledge base not found")

# #     update_data = update.model_dump(exclude_unset=True)
# #     for key, value in update_data.items():
# #         setattr(kb, key, value)

# #     kb.updated_at = datetime.now(timezone.utc)
# #     db.commit()
# #     db.refresh(kb)

# #     entry_count = db.query(KBEntry).filter(KBEntry.kb_id == kb.id).count()
# #     return KBResponse(
# #         id=kb.id, agent_id=kb.agent_id, name=kb.name,
# #         kb_type=kb.kb_type, source_url=kb.source_url,
# #         sync_interval=kb.sync_interval,
# #         created_at=kb.created_at, updated_at=kb.updated_at,
# #         entry_count=entry_count
# #     )


# # @router.delete("/{kb_id}")
# # async def delete_knowledge_base(kb_id: str, db: Session = Depends(get_db)):
# #     """Delete a knowledge base and its entries."""
# #     kb = db.query(KnowledgeBase).filter(KnowledgeBase.id == kb_id).first()
# #     if not kb:
# #         raise HTTPException(status_code=404, detail="Knowledge base not found")

# #     db.delete(kb)
# #     db.commit()
# #     return {"message": "Knowledge base deleted", "id": kb_id}


# # @router.post("/{kb_id}/upload")
# # async def upload_file(kb_id: str, file: UploadFile = File(...),
# #                       db: Session = Depends(get_db)):
# #     """Upload a file (CSV, PDF, Excel) to a knowledge base."""
# #     kb = db.query(KnowledgeBase).filter(KnowledgeBase.id == kb_id).first()
# #     if not kb:
# #         raise HTTPException(status_code=404, detail="Knowledge base not found")

# #     contents = await file.read()
# #     chunks = process_file(contents, file.filename)

# #     if not chunks:
# #         raise HTTPException(status_code=400,
# #                           detail="Could not extract content from file")

# #     entries_created = 0
# #     for chunk in chunks:
# #         await embed_and_store(
# #             content=chunk["content"],
# #             kb_id=kb_id,
# #             source=chunk["source"],
# #             chunk_index=chunk["index"],
# #             db=db
# #         )
# #         entries_created += 1

# #     return {
# #         "message": f"Processed {entries_created} chunks from {file.filename}",
# #         "entries_created": entries_created
# #     }


# # @router.post("/{kb_id}/entries", response_model=KBEntryResponse)
# # async def add_manual_entry(kb_id: str, entry: KBEntryCreate,
# #                            db: Session = Depends(get_db)):
# #     """Add a manual text entry to a knowledge base."""
# #     kb = db.query(KnowledgeBase).filter(KnowledgeBase.id == kb_id).first()
# #     if not kb:
# #         raise HTTPException(status_code=404, detail="Knowledge base not found")

# #     db_entry = await embed_and_store(
# #         content=entry.content,
# #         kb_id=kb_id,
# #         source=entry.source_file or "manual",
# #         chunk_index=0,
# #         db=db
# #     )

# #     return KBEntryResponse(
# #         id=db_entry.id, kb_id=db_entry.kb_id,
# #         content=db_entry.content, source_file=db_entry.source_file,
# #         chunk_index=db_entry.chunk_index, created_at=db_entry.created_at
# #     )


# # @router.get("/{kb_id}/entries", response_model=list[KBEntryResponse])
# # async def list_entries(kb_id: str, db: Session = Depends(get_db)):
# #     """List all entries in a knowledge base."""
# #     entries = db.query(KBEntry).filter(
# #         KBEntry.kb_id == kb_id
# #     ).order_by(KBEntry.chunk_index).all()

# #     return [KBEntryResponse(
# #         id=e.id, kb_id=e.kb_id, content=e.content,
# #         source_file=e.source_file, chunk_index=e.chunk_index,
# #         created_at=e.created_at
# #     ) for e in entries]


# # @router.delete("/{kb_id}/entries/{entry_id}")
# # async def delete_entry(kb_id: str, entry_id: str,
# #                        db: Session = Depends(get_db)):
# #     """Delete a single KB entry."""
# #     entry = db.query(KBEntry).filter(
# #         KBEntry.id == entry_id, KBEntry.kb_id == kb_id
# #     ).first()
# #     if not entry:
# #         raise HTTPException(status_code=404, detail="Entry not found")

# #     db.delete(entry)
# #     db.commit()
# #     return {"message": "Entry deleted", "id": entry_id}


# # @router.post("/{kb_id}/sync")
# # async def sync_sheets(kb_id: str, db: Session = Depends(get_db)):
# #     """Manually trigger a sync for a dynamic knowledge base."""
# #     kb = db.query(KnowledgeBase).filter(KnowledgeBase.id == kb_id).first()
# #     if not kb:
# #         raise HTTPException(status_code=404, detail="Knowledge base not found")
# #     if kb.kb_type != "dynamic" or not kb.source_url:
# #         raise HTTPException(status_code=400,
# #                           detail="Not a dynamic knowledge base")

# #     count = await sync_dynamic_kb(kb.id, kb.source_url, db)
# #     return {"message": f"Synced {count} entries from Google Sheets", "entries": count}


# """CRUD API routes for Knowledge Bases."""

# from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
# from sqlalchemy.orm import Session
# from database import get_db
# from models import KnowledgeBase, KBEntry, Agent
# from schemas import KBCreate, KBUpdate, KBResponse, KBEntryCreate, KBEntryResponse
# from services.file_processor import process_file
# from services.embeddings import embed_and_store
# from services.enhanced_rag import embed_and_store_chunked
# from services.sheets_sync import sync_dynamic_kb
# from datetime import datetime, timezone

# router = APIRouter(prefix="/api/kb", tags=["knowledge_base"])


# @router.post("/", response_model=KBResponse)
# async def create_knowledge_base(kb: KBCreate, agent_id: str,
#                                  db: Session = Depends(get_db)):
#     """Create a new knowledge base for an agent."""
#     agent = db.query(Agent).filter(Agent.id == agent_id).first()
#     if not agent:
#         raise HTTPException(status_code=404, detail="Agent not found")

#     db_kb = KnowledgeBase(
#         agent_id=agent_id,
#         name=kb.name,
#         kb_type=kb.kb_type,
#         source_url=kb.source_url,
#         sync_interval=kb.sync_interval
#     )
#     db.add(db_kb)
#     db.commit()
#     db.refresh(db_kb)

#     # If dynamic, trigger initial sync
#     if kb.kb_type == "dynamic" and kb.source_url:
#         try:
#             await sync_dynamic_kb(db_kb.id, kb.source_url, db)
#         except Exception as e:
#             print(f"Initial sync error: {e}")

#     entry_count = db.query(KBEntry).filter(KBEntry.kb_id == db_kb.id).count()
#     return KBResponse(
#         id=db_kb.id, agent_id=db_kb.agent_id, name=db_kb.name,
#         kb_type=db_kb.kb_type, source_url=db_kb.source_url,
#         sync_interval=db_kb.sync_interval,
#         created_at=db_kb.created_at, updated_at=db_kb.updated_at,
#         entry_count=entry_count
#     )


# @router.get("/agent/{agent_id}", response_model=list[KBResponse])
# async def list_knowledge_bases(agent_id: str, db: Session = Depends(get_db)):
#     """List all knowledge bases for an agent."""
#     kbs = db.query(KnowledgeBase).filter(
#         KnowledgeBase.agent_id == agent_id
#     ).order_by(KnowledgeBase.created_at.desc()).all()

#     result = []
#     for kb in kbs:
#         entry_count = db.query(KBEntry).filter(KBEntry.kb_id == kb.id).count()
#         result.append(KBResponse(
#             id=kb.id, agent_id=kb.agent_id, name=kb.name,
#             kb_type=kb.kb_type, source_url=kb.source_url,
#             sync_interval=kb.sync_interval,
#             created_at=kb.created_at, updated_at=kb.updated_at,
#             entry_count=entry_count
#         ))
#     return result


# @router.get("/{kb_id}", response_model=KBResponse)
# async def get_knowledge_base(kb_id: str, db: Session = Depends(get_db)):
#     """Get a single knowledge base."""
#     kb = db.query(KnowledgeBase).filter(KnowledgeBase.id == kb_id).first()
#     if not kb:
#         raise HTTPException(status_code=404, detail="Knowledge base not found")

#     entry_count = db.query(KBEntry).filter(KBEntry.kb_id == kb.id).count()
#     return KBResponse(
#         id=kb.id, agent_id=kb.agent_id, name=kb.name,
#         kb_type=kb.kb_type, source_url=kb.source_url,
#         sync_interval=kb.sync_interval,
#         created_at=kb.created_at, updated_at=kb.updated_at,
#         entry_count=entry_count
#     )


# @router.put("/{kb_id}", response_model=KBResponse)
# async def update_knowledge_base(kb_id: str, update: KBUpdate,
#                                  db: Session = Depends(get_db)):
#     """Update a knowledge base."""
#     kb = db.query(KnowledgeBase).filter(KnowledgeBase.id == kb_id).first()
#     if not kb:
#         raise HTTPException(status_code=404, detail="Knowledge base not found")

#     update_data = update.model_dump(exclude_unset=True)
#     for key, value in update_data.items():
#         setattr(kb, key, value)

#     kb.updated_at = datetime.now(timezone.utc)
#     db.commit()
#     db.refresh(kb)

#     entry_count = db.query(KBEntry).filter(KBEntry.kb_id == kb.id).count()
#     return KBResponse(
#         id=kb.id, agent_id=kb.agent_id, name=kb.name,
#         kb_type=kb.kb_type, source_url=kb.source_url,
#         sync_interval=kb.sync_interval,
#         created_at=kb.created_at, updated_at=kb.updated_at,
#         entry_count=entry_count
#     )


# @router.delete("/{kb_id}")
# async def delete_knowledge_base(kb_id: str, db: Session = Depends(get_db)):
#     """Delete a knowledge base and its entries."""
#     kb = db.query(KnowledgeBase).filter(KnowledgeBase.id == kb_id).first()
#     if not kb:
#         raise HTTPException(status_code=404, detail="Knowledge base not found")

#     db.delete(kb)
#     db.commit()
#     return {"message": "Knowledge base deleted", "id": kb_id}


# @router.post("/{kb_id}/upload")
# async def upload_file(kb_id: str, file: UploadFile = File(...),
#                       db: Session = Depends(get_db)):
#     """Upload a file (CSV, PDF, Excel) to a knowledge base."""
#     kb = db.query(KnowledgeBase).filter(KnowledgeBase.id == kb_id).first()
#     if not kb:
#         raise HTTPException(status_code=404, detail="Knowledge base not found")

#     contents = await file.read()
#     chunks = process_file(contents, file.filename)

#     if not chunks:
#         raise HTTPException(status_code=400,
#                           detail="Could not extract content from file")

#     # Use enhanced smart-chunked ingestion for better RAG quality
#     all_text = "".join([c["content"] for c in chunks])
#     stored = await embed_and_store_chunked(
#         text=all_text,
#         kb_id=kb_id,
#         source=file.filename,
#         db=db,
#     )
#     return {
#         "message": f"Processed {len(stored)} smart chunks from {file.filename}",
#         "entries_created": len(stored)
#     }


# @router.post("/{kb_id}/entries", response_model=KBEntryResponse)
# async def add_manual_entry(kb_id: str, entry: KBEntryCreate,
#                            db: Session = Depends(get_db)):
#     """Add a manual text entry to a knowledge base."""
#     kb = db.query(KnowledgeBase).filter(KnowledgeBase.id == kb_id).first()
#     if not kb:
#         raise HTTPException(status_code=404, detail="Knowledge base not found")

#     db_entry = await embed_and_store(
#         content=entry.content,
#         kb_id=kb_id,
#         source=entry.source_file or "manual",
#         chunk_index=0,
#         db=db
#     )

#     return KBEntryResponse(
#         id=db_entry.id, kb_id=db_entry.kb_id,
#         content=db_entry.content, source_file=db_entry.source_file,
#         chunk_index=db_entry.chunk_index, created_at=db_entry.created_at
#     )


# @router.get("/{kb_id}/entries", response_model=list[KBEntryResponse])
# async def list_entries(kb_id: str, db: Session = Depends(get_db)):
#     """List all entries in a knowledge base."""
#     entries = db.query(KBEntry).filter(
#         KBEntry.kb_id == kb_id
#     ).order_by(KBEntry.chunk_index).all()

#     return [KBEntryResponse(
#         id=e.id, kb_id=e.kb_id, content=e.content,
#         source_file=e.source_file, chunk_index=e.chunk_index,
#         created_at=e.created_at
#     ) for e in entries]


# @router.delete("/{kb_id}/entries/{entry_id}")
# async def delete_entry(kb_id: str, entry_id: str,
#                        db: Session = Depends(get_db)):
#     """Delete a single KB entry."""
#     entry = db.query(KBEntry).filter(
#         KBEntry.id == entry_id, KBEntry.kb_id == kb_id
#     ).first()
#     if not entry:
#         raise HTTPException(status_code=404, detail="Entry not found")

#     db.delete(entry)
#     db.commit()
#     return {"message": "Entry deleted", "id": entry_id}


# @router.post("/{kb_id}/sync")
# async def sync_sheets(kb_id: str, db: Session = Depends(get_db)):
#     """Manually trigger a sync for a dynamic knowledge base."""
#     kb = db.query(KnowledgeBase).filter(KnowledgeBase.id == kb_id).first()
#     if not kb:
#         raise HTTPException(status_code=404, detail="Knowledge base not found")
#     if kb.kb_type != "dynamic" or not kb.source_url:
#         raise HTTPException(status_code=400,
#                           detail="Not a dynamic knowledge base")

#     count = await sync_dynamic_kb(kb.id, kb.source_url, db)
#     return {"message": f"Synced {count} entries from Google Sheets", "entries": count}


"""CRUD API routes for Knowledge Bases — company-scoped."""

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from sqlalchemy.orm import Session
from database import get_db
from models import KnowledgeBase, KBEntry, Agent, Company
from schemas import KBCreate, KBUpdate, KBResponse, KBEntryCreate, KBEntryResponse
from services.file_processor import process_file
from services.embeddings import embed_and_store
from services.enhanced_rag import embed_and_store_chunked
from services.sheets_sync import sync_dynamic_kb
from services.auth_service import get_current_company
from datetime import datetime, timezone

router = APIRouter(prefix="/api/kb", tags=["knowledge_base"])


def _assert_agent_owned(agent_id: str, company_id: str, db: Session) -> Agent:
    """Ensure the agent belongs to this company."""
    agent = db.query(Agent).filter(
        Agent.id == agent_id,
        Agent.company_id == company_id
    ).first()
    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found")
    return agent


def _assert_kb_owned(kb_id: str, company_id: str, db: Session) -> KnowledgeBase:
    """Ensure the KB's agent belongs to this company."""
    kb = db.query(KnowledgeBase).join(Agent).filter(
        KnowledgeBase.id == kb_id,
        Agent.company_id == company_id
    ).first()
    if not kb:
        raise HTTPException(status_code=404, detail="Knowledge base not found")
    return kb


def _kb_response(kb: KnowledgeBase, db: Session) -> KBResponse:
    count = db.query(KBEntry).filter(KBEntry.kb_id == kb.id).count()
    return KBResponse(
        id=kb.id, agent_id=kb.agent_id, name=kb.name,
        kb_type=kb.kb_type, source_url=kb.source_url,
        sync_interval=kb.sync_interval,
        created_at=kb.created_at, updated_at=kb.updated_at,
        entry_count=count,
    )


@router.post("/", response_model=KBResponse, status_code=201)
async def create_knowledge_base(
    kb: KBCreate, agent_id: str,
    db: Session = Depends(get_db),
    company: Company = Depends(get_current_company),
):
    _assert_agent_owned(agent_id, company.id, db)
    db_kb = KnowledgeBase(
        agent_id=agent_id, name=kb.name, kb_type=kb.kb_type,
        source_url=kb.source_url, sync_interval=kb.sync_interval,
    )
    db.add(db_kb); db.commit(); db.refresh(db_kb)

    if kb.kb_type == "dynamic" and kb.source_url:
        try:
            await sync_dynamic_kb(db_kb.id, kb.source_url, db)
        except Exception as e:
            print(f"Initial sync error: {e}")

    return _kb_response(db_kb, db)


@router.get("/agent/{agent_id}", response_model=list[KBResponse])
async def list_knowledge_bases(
    agent_id: str,
    db: Session = Depends(get_db),
    company: Company = Depends(get_current_company),
):
    _assert_agent_owned(agent_id, company.id, db)
    kbs = db.query(KnowledgeBase).filter(
        KnowledgeBase.agent_id == agent_id
    ).order_by(KnowledgeBase.created_at.desc()).all()
    return [_kb_response(kb, db) for kb in kbs]


@router.get("/{kb_id}", response_model=KBResponse)
async def get_knowledge_base(
    kb_id: str,
    db: Session = Depends(get_db),
    company: Company = Depends(get_current_company),
):
    kb = _assert_kb_owned(kb_id, company.id, db)
    return _kb_response(kb, db)


@router.put("/{kb_id}", response_model=KBResponse)
async def update_knowledge_base(
    kb_id: str, update: KBUpdate,
    db: Session = Depends(get_db),
    company: Company = Depends(get_current_company),
):
    kb = _assert_kb_owned(kb_id, company.id, db)
    for key, value in update.model_dump(exclude_unset=True).items():
        setattr(kb, key, value)
    kb.updated_at = datetime.now(timezone.utc)
    db.commit(); db.refresh(kb)
    return _kb_response(kb, db)


@router.delete("/{kb_id}")
async def delete_knowledge_base(
    kb_id: str,
    db: Session = Depends(get_db),
    company: Company = Depends(get_current_company),
):
    kb = _assert_kb_owned(kb_id, company.id, db)
    db.delete(kb); db.commit()
    return {"message": "Knowledge base deleted", "id": kb_id}


@router.post("/{kb_id}/upload")
async def upload_file(
    kb_id: str, file: UploadFile = File(...),
    db: Session = Depends(get_db),
    company: Company = Depends(get_current_company),
):
    from services.security_guard import validate_upload, scan_kb_content, sanitize_kb_content, upload_limiter

    kb = _assert_kb_owned(kb_id, company.id, db)

    # Rate limit uploads per company
    if not upload_limiter.is_allowed(company.id):
        raise HTTPException(status_code=429, detail="Upload rate limit exceeded. Please wait.")

    contents = await file.read()

    # Validate file size and extension
    is_valid, err = validate_upload(file.filename or "unknown", contents)
    if not is_valid:
        raise HTTPException(status_code=400, detail=err)

    chunks = process_file(contents, file.filename)
    if not chunks:
        raise HTTPException(status_code=400, detail="Could not extract content from file")

    all_text = "\n\n".join([c["content"] for c in chunks])

    # Scan for data poisoning
    is_poisoned, _ = scan_kb_content(all_text)
    if is_poisoned:
        raise HTTPException(status_code=400, detail="File content blocked by security filter")

    # Sanitize injection markers
    all_text = sanitize_kb_content(all_text)

    stored = await embed_and_store_chunked(
        text=all_text, kb_id=kb_id, source=file.filename, db=db, agent_id=kb.agent_id,
    )
    return {"message": f"Processed {len(stored)} smart chunks from {file.filename}", "entries_created": len(stored)}


@router.post("/{kb_id}/entries", response_model=KBEntryResponse)
async def add_manual_entry(
    kb_id: str, entry: KBEntryCreate,
    db: Session = Depends(get_db),
    company: Company = Depends(get_current_company),
):
    from services.security_guard import scan_kb_content, sanitize_kb_content

    kb = _assert_kb_owned(kb_id, company.id, db)

    # Scan for data poisoning
    is_poisoned, _ = scan_kb_content(entry.content)
    if is_poisoned:
        raise HTTPException(status_code=400, detail="Content blocked by security filter")

    clean_content = sanitize_kb_content(entry.content)

    db_entry = await embed_and_store(
        content=clean_content, kb_id=kb_id,
        source=entry.source_file or "manual", chunk_index=0, db=db
    )
    # Mirror to ChromaDB when active
    from services.rag_config import RAG_BACKEND
    if RAG_BACKEND == "chroma" and db_entry.id:
        try:
            from services.vector_store import upsert_entry
            await upsert_entry(
                entry_id=db_entry.id, content=entry.content,
                agent_id=kb.agent_id, kb_id=kb_id,
                source=entry.source_file or "manual", chunk_index=0,
            )
        except Exception as e:
            print(f"ChromaDB manual entry upsert warning: {e}")
    return KBEntryResponse(
        id=db_entry.id, kb_id=db_entry.kb_id, content=db_entry.content,
        source_file=db_entry.source_file, chunk_index=db_entry.chunk_index,
        created_at=db_entry.created_at,
    )


@router.get("/{kb_id}/entries", response_model=list[KBEntryResponse])
async def list_entries(
    kb_id: str,
    db: Session = Depends(get_db),
    company: Company = Depends(get_current_company),
):
    _assert_kb_owned(kb_id, company.id, db)
    entries = db.query(KBEntry).filter(KBEntry.kb_id == kb_id).order_by(KBEntry.chunk_index).all()
    return [KBEntryResponse(
        id=e.id, kb_id=e.kb_id, content=e.content,
        source_file=e.source_file, chunk_index=e.chunk_index, created_at=e.created_at
    ) for e in entries]


@router.delete("/{kb_id}/entries/{entry_id}")
async def delete_entry(
    kb_id: str, entry_id: str,
    db: Session = Depends(get_db),
    company: Company = Depends(get_current_company),
):
    _assert_kb_owned(kb_id, company.id, db)
    entry = db.query(KBEntry).filter(KBEntry.id == entry_id, KBEntry.kb_id == kb_id).first()
    if not entry:
        raise HTTPException(status_code=404, detail="Entry not found")
    db.delete(entry); db.commit()
    return {"message": "Entry deleted", "id": entry_id}


@router.post("/{kb_id}/sync")
async def sync_sheets(
    kb_id: str,
    db: Session = Depends(get_db),
    company: Company = Depends(get_current_company),
):
    kb = _assert_kb_owned(kb_id, company.id, db)
    if kb.kb_type != "dynamic" or not kb.source_url:
        raise HTTPException(status_code=400, detail="Not a dynamic knowledge base")
    count = await sync_dynamic_kb(kb.id, kb.source_url, db)
    return {"message": f"Synced {count} entries from Google Sheets", "entries": count}


@router.post("/agent/{agent_id}/reindex")
async def reindex_agent_kb(
    agent_id: str,
    db: Session = Depends(get_db),
    company: Company = Depends(get_current_company),
):
    """
    Re-index all KB entries for an agent into ChromaDB.
    Only effective when RAG_BACKEND=chroma.
    Fetches all entries from SQL, then bulk-upserts to vector store.
    """
    from services.rag_config import RAG_BACKEND
    _assert_agent_owned(agent_id, company.id, db)

    if RAG_BACKEND != "chroma":
        raise HTTPException(
            status_code=400,
            detail=f"Reindex only supported for RAG_BACKEND=chroma (current: {RAG_BACKEND})",
        )

    # Fetch all KB entries for this agent
    kb_ids = db.query(KnowledgeBase.id).filter(KnowledgeBase.agent_id == agent_id).all()
    kb_ids = [k[0] for k in kb_ids]

    if not kb_ids:
        return {"message": "No knowledge bases found for this agent", "indexed": 0}

    entries = db.query(KBEntry).filter(KBEntry.kb_id.in_(kb_ids)).all()
    if not entries:
        return {"message": "No entries to index", "indexed": 0}

    # Build list for reindex
    entry_dicts = [
        {
            "id": e.id,
            "content": e.content,
            "kb_id": e.kb_id,
            "source": e.source_file or "",
            "chunk_index": e.chunk_index,
            "embedding": e.embedding,
        }
        for e in entries
    ]

    from services.vector_store import reindex_agent
    count = await reindex_agent(agent_id, entry_dicts)
    return {
        "message": f"Re-indexed {count} entries into ChromaDB for agent {agent_id}",
        "indexed": count,
    }


@router.get("/agent/{agent_id}/debug")
async def debug_agent_kb(
    agent_id: str,
    query: str = "test",
    db: Session = Depends(get_db),
    company: Company = Depends(get_current_company),
):
    """
    DEBUG endpoint — check KB entries and RAG search results.
    Useful for diagnosing hallucination issues.
    """
    _assert_agent_owned(agent_id, company.id, db)

    # Get KB stats from SQL
    kb_ids = db.query(KnowledgeBase.id).filter(KnowledgeBase.agent_id == agent_id).all()
    kb_ids = [k[0] for k in kb_ids]
    entry_count = 0
    if kb_ids:
        entry_count = db.query(KBEntry).filter(KBEntry.kb_id.in_(kb_ids)).count()

    # Get ChromaDB stats
    from services.vector_store import get_collection_stats
    chroma_stats = get_collection_stats(agent_id)

    # Test search
    from services.enhanced_rag import search_knowledge_base_unified
    search_results = await search_knowledge_base_unified(query, agent_id, db, top_k=3)

    return {
        "agent_id": agent_id,
        "sql_stats": {
            "kb_count": len(kb_ids),
            "entry_count": entry_count,
        },
        "chroma_stats": chroma_stats,
        "test_search": {
            "query": query,
            "results_count": len(search_results),
            "results": [
                {"content": r["content"][:100], "score": r["score"], "source": r["source"]}
                for r in search_results
            ]
        }
    }
