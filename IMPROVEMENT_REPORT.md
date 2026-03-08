# VoiceForge AI - Comprehensive Improvement Report

**Date:** March 4, 2026
**Application:** VoiceForge AI - AI Voice Agent Platform
**Architecture:** FastAPI Backend + React Frontend + Gemini Live API
**Database:** SQLite with SQLAlchemy
**Primary AI:** Google Gemini (gemini-2.0-flash, gemini-2.5-flash-native-audio-preview)

---

## Executive Summary

VoiceForge AI is a SaaS platform for creating AI-powered voice call agents with RAG (Retrieval-Augmented Generation) capabilities. The application supports both static knowledge bases (file uploads) and dynamic knowledge bases (Google Sheets sync), real-time voice conversations via WebSocket, and an embeddable widget SDK.

**Current Status:** Functional MVP with significant production-readiness gaps
**Critical Areas Needing Improvement:** RAG performance, Security, Scalability, Error Handling, Monitoring

---

## Table of Contents

1. [Current Architecture Overview](#1-current-architecture-overview)
2. [Features Analysis](#2-features-analysis)
3. [RAG System Deep Dive](#3-rag-system-deep-dive)
4. [Retrieval Mechanisms](#4-retrieval-mechanisms)
5. [Agentic Decision Making](#5-agentic-decision-making)
6. [Data Handling Assessment](#6-data-handling-assessment)
7. [Production Readiness Analysis](#7-production-readiness-analysis)
8. [Security Audit](#8-security-audit)
9. [Performance Bottlenecks](#9-performance-bottlenecks)
10. [Detailed Improvement Recommendations](#10-detailed-improvement-recommendations)
11. [Migration Path to Production](#11-migration-path-to-production)
12. [Technology Stack Recommendations](#12-technology-stack-recommendations)

---

## 1. Current Architecture Overview

### 1.1 Backend Architecture (FastAPI)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          FastAPI Application                                 │
├─────────────────────────────────────────────────────────────────────────────┤
│  Routers                    Services                    Models              │
│  ┌─────────────┐           ┌──────────────────┐       ┌─────────────────┐   │
│  │ /api/agents │──────────▶│ gemini_service   │◄──────│ Agent           │   │
│  │ /api/kb     │           │   - Chat         │       │ KnowledgeBase   │   │
│  │ /ws/call    │◄─────────│   - STT/TTS      │       │ KBEntry         │   │
│  │ /api/voices │           │   - Embeddings   │       └─────────────────┘   │
│  └─────────────┘           ├──────────────────┤                           │
│                            │ file_processor   │                           │
│                            │   - PDF/CSV/XLS  │                           │
│                            ├──────────────────┤                           │
│                            │ embeddings       │                           │
│                            │   - RAG Search   │                           │
│                            ├──────────────────┤                           │
│                            │ sheets_sync      │                           │
│                            │   - Google API   │                           │
│                            ├──────────────────┤                           │
│                            │ audio_processor  │                           │
│                            │   - VAD/Noise    │                           │
│                            ├──────────────────┤                           │
│                            │ sdk_generator    │                           │
│                            └──────────────────┘                           │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
                            ┌───────────────────────┐
                            │    SQLite Database    │
│                            │    (agents.db)        │
│                            └───────────────────────┘
```

### 1.2 Frontend Architecture (React + Vite)

```
┌────────────────────────────────────────────────────────────────┐
│                     React SPA (Vite)                            │
├────────────────────────────────────────────────────────────────┤
│  Pages                      Components         Services         │
│  ┌─────────────┐           ┌────────────────┐  ┌────────────┐   │
│  │ Dashboard   │──────────▶│ VoiceCall      │──│ liveAudio  │   │
│  │ CreateAgent │           │ KnowledgeBase    │  │ Service    │   │
│  │ AgentDetail │           │ SDKCodeBlock     │  └────────────┘   │
│  │ EditAgent   │           └────────────────┘                   │
│  └─────────────┘                  │                              │
│                                   │                              │
│                            ┌──────────────┐                     │
│                            │    api.js    │                     │
│                            │  (REST API)  │                     │
│                            └──────────────┘                     │
└────────────────────────────────────────────────────────────────┘
```

### 1.3 Database Schema

```sql
-- Core Entities
agents (id, name, role, description, system_prompt, voice_id, language, created_at, updated_at)
knowledge_bases (id, agent_id, name, kb_type, source_url, sync_interval, created_at, updated_at)
kb_entries (id, kb_id, content, embedding(JSON), source_file, chunk_index, created_at)
```

---

## 2. Features Analysis

### 2.1 Current Features Matrix

| Feature Category | Feature | Status | Production Ready |
|-----------------|---------|--------|------------------|
| **Agent Management** | | | |
| | Create Agent | ✅ Implemented | ⚠️ Partial |
| | Edit Agent | ✅ Implemented | ⚠️ Partial |
| | Delete Agent (Cascade) | ✅ Implemented | ⚠️ Partial |
| | Role-based Configuration | ✅ Implemented | ✅ Yes |
| | Custom System Prompts | ✅ Implemented | ✅ Yes |
| | Voice Selection (5 voices) | ✅ Implemented | ✅ Yes |
| | Language Selection | ✅ Implemented | ✅ Yes |
| **Knowledge Base** | | | |
| | Static KB (File Upload) | ✅ Implemented | ⚠️ Partial |
| | Dynamic KB (Google Sheets) | ✅ Implemented | ⚠️ Partial |
| | Manual Text Entries | ✅ Implemented | ✅ Yes |
| | File Support (CSV, PDF, XLSX) | ✅ Implemented | ⚠️ Partial |
| | Chunking Strategy | ✅ Implemented | ⚠️ Basic |
| | Sync Scheduling | ❌ Missing | ❌ No |
| **Voice Calling** | | | |
| | Real-time Voice (WebSocket) | ✅ Implemented | ⚠️ Partial |
| | STT (Gemini Multimodal) | ✅ Implemented | ✅ Yes |
| | TTS (Browser Fallback) | ✅ Implemented | ⚠️ Partial |
| | Live API Integration | ✅ Implemented | ✅ Yes |
| | Call Mute/Unmute | ✅ Implemented | ✅ Yes |
| | Text Chat Fallback | ✅ Implemented | ✅ Yes |
| **RAG System** | | | |
| | Embedding Generation | ✅ Implemented | ✅ Yes |
| | Cosine Similarity Search | ✅ Implemented | ⚠️ Partial |
| | Context Injection | ✅ Implemented | ✅ Yes |
| | Re-ranking | ❌ Missing | ❌ No |
| | Hybrid Search | ❌ Missing | ❌ No |
| **SDK & Integration** | | | |
| | Embeddable Widget | ✅ Implemented | ⚠️ Partial |
| | SDK Code Generation | ✅ Implemented | ✅ Yes |
| | CDN-based SDK Loading | ✅ Implemented | ✅ Yes |
| | Widget Customization | ✅ Implemented | ✅ Yes |

### 2.2 Feature Gaps Identified

1. **No Authentication/Authorization** - All endpoints are public
2. **No Multi-tenancy** - Single tenant architecture
3. **No Rate Limiting** - API abuse possible
4. **No Audit Logging** - No tracking of user actions
5. **No Conversation History** - Voice calls not persisted
6. **No Analytics Dashboard** - No usage metrics
7. **No KB Sync Scheduling** - Dynamic KB requires manual sync
8. **No Vector Database** - Embeddings stored in JSON column
9. **No Caching Layer** - Repeated embeddings generated
10. **No Message Queue** - Synchronous processing only

---

## 3. RAG System Deep Dive

### 3.1 Current RAG Implementation

**File:** `backend/services/embeddings.py`

```python
# Current Flow
1. Query comes in → Generate query embedding via Gemini
2. Load ALL KB entries for agent into memory
3. Calculate cosine similarity for each entry
4. Sort and return top_k results
5. Inject context into system prompt
```

**Current Limitations:**

| Aspect | Current | Production Standard |
|--------|---------|---------------------|
| **Vector Store** | SQLite JSON column | Pinecone/Milvus/Weaviate |
| **Similarity Metric** | Cosine (numpy) | HNSW/ANN optimized |
| **Search Complexity** | O(n) per query | O(log n) with indexing |
| **Max Embeddings** | Limited by RAM | Scalable to millions |
| **Re-ranking** | None | Cross-encoder re-ranker |
| **Hybrid Search** | None | BM25 + Vector hybrid |
| **Query Caching** | None | Redis cached |
| **Batch Processing** | Sequential | Async batch |

### 3.2 RAG Performance Analysis

**Current Issues:**

1. **Full Table Scans:** Every query loads all entries for an agent
   ```python
   entries = db.query(KBEntry).filter(
       KBEntry.kb_id.in_(kb_ids),
       KBEntry.embedding.isnot(None)
   ).all()  # Loads ALL entries into memory
   ```

2. **Python-side Similarity:** No database-level vector operations
   ```python
   # Python loop - O(n)
   for entry in entries:
       sim = cosine_similarity(query_embedding, entry.embedding)
   ```

3. **No Embedding Cache:** Same queries re-embedded every time

4. **Context Truncation Risk:** No token counting before injection

### 3.3 RAG Improvement Recommendations

**Immediate (MVP → Alpha):**

```python
# Add SQLite-VEC extension for vector search
pip install sqlite-vec

# Create virtual table for vector index
CREATE VIRTUAL TABLE vec_kb_entries USING vec0(
    embedding FLOAT[768]  # Gemini embedding dimension
);
```

**Short-term (Alpha → Beta):**

```python
# Implement ChromaDB as vector store
from chromadb import Client

chroma_client = Client()
collection = chroma_client.create_collection("kb_entries")

# Store with metadata
collection.add(
    embeddings=[embedding],
    documents=[content],
    metadatas=[{"kb_id": kb_id, "source": source}],
    ids=[entry_id]
)

# Query with filters
results = collection.query(
    query_embeddings=[query_embedding],
    n_results=top_k,
    where={"kb_id": kb_id}  # Agent-level filtering
)
```

**Production-ready:**

```python
# Pinecone for scale
import pinecone

index = pinecone.Index("voiceforge-kb")

# Upsert with namespace isolation
index.upsert(
    vectors=[{"id": entry_id, "values": embedding, "metadata": {...}}],
    namespace=f"agent_{agent_id}"
)

# Query with namespace
results = index.query(
    vector=query_embedding,
    top_k=top_k,
    namespace=f"agent_{agent_id}"
)
```

---

## 4. Retrieval Mechanisms

### 4.1 Current Retrieval Pipeline

```
User Query
    │
    ▼
┌─────────────────┐
│  Query Embed    │───▶ Gemini text-embedding-004
│  (No Cache)     │
└─────────────────┘
    │
    ▼
┌─────────────────┐
│  Load All KB    │───▶ SQL: SELECT * FROM kb_entries WHERE kb_id IN (...)
│  Entries        │
└─────────────────┘
    │
    ▼
┌─────────────────┐
┌─────────────────┐
│  Cosine Sim     │───▶ Numpy: dot(a,b) / (norm(a) * norm(b))
│  (Python Loop)  │
└─────────────────┘
    │
    ▼
┌─────────────────┐
│  Sort & Top K   │───▶ O(n log n) in Python
│  (No Re-rank)   │
└─────────────────┘
    │
    ▼
Context Injection
```

### 4.2 Improved Retrieval Pipeline

```
User Query
    │
    ▼
┌─────────────────┐
│  Query Embed    │───▶ Check Redis Cache first
│  (Cached)       │     Then Gemini if miss
└─────────────────┘
    │
    ▼
┌─────────────────┐
│  Query          │───▶ Intent classification (optional)
│  Understanding  │
└─────────────────┘
    │
    ▼
┌─────────────────┐
│  Hybrid Search  │───▶ Vector DB + BM25
│  (Vector DB)    │     Metadata pre-filtering
└─────────────────┘
    │
    ▼
┌─────────────────┐
│  Initial Recall │───▶ top_k=20 from vector search
│  (top_k=20)     │
└─────────────────┘
    │
    ▼
┌─────────────────┐
│  Re-ranking     │───▶ Cross-encoder model (BGE-Reranker)
│  (ML Model)     │
└─────────────────┘
    │
    ▼
┌─────────────────┐
│  Final Top K    │───▶ top_k=5 after re-ranking
│  (top_k=5)      │
└─────────────────┘
    │
    ▼
Context + Source Attribution
```

### 4.3 Retrieval Enhancements

**1. Query Expansion:**
```python
# Generate query variations for better recall
def expand_query(query: str) -> list[str]:
    variations = [
        query,
        f"what is {query}",
        f"how to {query}",
        f"{query} explained"
    ]
    return variations
```

**2. HyDE (Hypothetical Document Embedding):**
```python
# Generate hypothetical answer first, then embed
hypothetical_answer = await generate_response(
    f"Answer this question: {query}",
    system_prompt="Provide a concise, factual answer."
)
query_embedding = await generate_embedding(hypothetical_answer)
```

**3. Multi-stage Retrieval:**
```python
# Stage 1: Coarse retrieval (high recall)
coarse_results = await coarse_search(query, top_k=50)

# Stage 2: Fine retrieval (high precision)
refined_results = await rerank(query, coarse_results, top_k=5)
```

---

## 5. Agentic Decision Making

### 5.1 Current Agent Behavior

**System Prompt Pattern:**
```python
get_tanglish_system_prompt(agent_system_prompt: str, role: str) -> str:
    return f"""You are a {role} AI assistant...

    Rules:
    1. Respond in Tanglish
    2. Be friendly and conversational
    3. Keep responses concise

    Agent-specific instructions:
    {agent_system_prompt}

    Context: {retrieved_context}
    """
```

### 5.2 Missing Agentic Capabilities

| Capability | Status | Impact |
|------------|--------|--------|
| **Tool Use** | ❌ Missing | Cannot call APIs/functions |
| **Multi-step Reasoning** | ❌ Missing | Single-turn responses only |
| **Memory Management** | ❌ Missing | No long-term memory |
| **Self-correction** | ❌ Missing | No feedback loop |
| **Planning** | ❌ Missing | Cannot break down complex tasks |
| **Confirmation Flows** | ❌ Missing | Direct execution without confirmation |

### 5.3 Agentic Architecture Recommendations

**ReAct Pattern Implementation:**

```python
class AgenticProcessor:
    def __init__(self):
        self.tools = {
            "search_kb": self.search_knowledge_base,
            "schedule_callback": self.schedule_callback,
            "create_ticket": self.create_support_ticket,
            "escalate": self.escalate_to_human
        }

    async def process(self, user_input: str, context: dict) -> dict:
        # Step 1: Analyze intent and decide action
        decision = await self.decide_action(user_input, context)

        if decision["action"] == "respond":
            return await self.generate_response(user_input, context)

        elif decision["action"] == "tool_use":
            # Execute tool and observe
            tool_result = await self.tools[decision["tool"]](decision["params"])
            # Re-act based on observation
            return await self.process_with_observation(
                user_input, tool_result, context
            )

        elif decision["action"] == "clarify":
            return {"response": decision["question"], "requires_clarification": True}
```

**Conversation State Machine:**

```python
class ConversationState(Enum):
    GREETING = "greeting"
    INFORMATION_GATHERING = "info_gathering"
    PROBLEM_SOLVING = "problem_solving"
    CONFIRMATION = "confirmation"
    RESOLUTION = "resolution"
    HANDOFF = "handoff"

class StateManager:
    def transition(self, current_state: ConversationState,
                   user_intent: str) -> ConversationState:
        # State transition logic
        if current_state == GREETING and user_intent == "ask_question":
            return INFORMATION_GATHERING
        elif current_state == INFORMATION_GATHERING and self.has_enough_info():
            return PROBLEM_SOLVING
        # ... etc
```

---

## 6. Data Handling Assessment

### 6.1 Current Data Flow

```
File Upload (CSV/PDF/XLSX)
    │
    ▼
File Processor → Chunks (500 words, 50 overlap)
    │
    ▼
Embedding Service → Gemini text-embedding-004
    │
    ▼
SQLite JSON Storage
    │
    ▼
Query Time → Full Scan + Python Similarity
```

### 6.2 Data Handling Issues

| Issue | Severity | Description |
|-------|----------|-------------|
| **No Data Validation** | High | File content not validated before processing |
| **Sync Processing** | Medium | Large files block the API |
| **No Retry Logic** | Medium | Failed embeddings not retried |
| **Duplicate Detection** | Low | No deduplication of entries |
| **Soft Deletes** | Low | Entries permanently deleted |
| **No Versioning** | Medium | KB updates not versioned |
| **Plain Text Storage** | Medium | No encryption at rest |

### 6.3 Data Handling Improvements

**Async Processing with Celery:**

```python
# celery_tasks.py
from celery import Celery

app = Celery('voiceforge')

@app.task(bind=True, max_retries=3)
def process_file_task(self, file_path: str, kb_id: str):
    try:
        chunks = process_file(file_path)
        for chunk in chunks:
            embed_and_store.delay(chunk, kb_id)
    except Exception as exc:
        raise self.retry(exc=exc, countdown=60)

@app.task
def embed_and_store(chunk: dict, kb_id: str):
    embedding = generate_embedding(chunk["content"])
    store_in_vector_db(embedding, chunk, kb_id)
```

**Data Validation:**

```python
from pydantic import BaseModel, validator

class KBEntryValidator(BaseModel):
    content: str
    source: str

    @validator('content')
    def validate_content(cls, v):
        if len(v) < 10:
            raise ValueError('Content too short')
        if len(v) > 10000:
            raise ValueError('Content too long')
        return v

    @validator('content')
    def check_pii(cls, v):
        # Basic PII detection
        if re.search(r'\b\d{16}\b', v):  # Credit card pattern
            raise ValueError('Potential PII detected')
        return v
```

**Chunking Strategy Improvements:**

```python
# Semantic chunking instead of fixed size
from langchain.text_splitter import RecursiveCharacterTextSplitter

text_splitter = RecursiveCharacterTextSplitter(
    chunk_size=500,
    chunk_overlap=50,
    length_function=len,
    separators=["\n\n", "\n", ". ", " ", ""]
)

# For structured data (CSV/Excel)
def process_structured_data(df: pd.DataFrame) -> list[dict]:
    # Group related rows, create contextual chunks
    chunks = []
    for group in group_related_rows(df):
        context = create_context_from_group(group)
        chunks.append(context)
    return chunks
```

---

## 7. Production Readiness Analysis

### 7.1 Current Production Gaps

| Category | Requirement | Current Status | Gap |
|----------|-------------|----------------|-----|
| **Infrastructure** | | | |
| | Containerization | ❌ Missing | No Docker |
| | Orchestration | ❌ Missing | No K8s |
| | Load Balancing | ❌ Missing | Single instance |
| | Auto-scaling | ❌ Missing | Manual scaling |
| | CDN | ❌ Missing | Direct file serving |
| **Observability** | | | |
| | Structured Logging | ❌ Missing | Print statements |
| | Metrics | ❌ Missing | No Prometheus |
| | Distributed Tracing | ❌ Missing | No Jaeger/Zipkin |
| | APM | ❌ Missing | No New Relic/Datadog |
| | Health Checks | ⚠️ Partial | Basic endpoint only |
| **Reliability** | | | |
| | Circuit Breaker | ❌ Missing | Direct calls |
| | Rate Limiting | ❌ Missing | No protection |
| | Request Timeout | ⚠️ Partial | WebSocket has timeout |
| | Retry Logic | ⚠️ Partial | Only Gemini calls |
| | Graceful Degradation | ❌ Missing | All-or-nothing |
| **Security** | | | |
| | Authentication | ❌ Missing | No auth |
| | Authorization | ❌ Missing | No RBAC |
| | API Keys | ⚠️ Partial | Hardcoded in widget |
| | HTTPS/TLS | ❌ Missing | HTTP only |
| | Input Sanitization | ⚠️ Partial | Basic Pydantic |
| | SQL Injection | ✅ Protected | SQLAlchemy ORM |
| **Data** | | | |
| | Backup Strategy | ❌ Missing | No backups |
| | Replication | ❌ Missing | Single SQLite |
| | Encryption at Rest | ❌ Missing | Plain SQLite |
| | Encryption in Transit | ❌ Missing | HTTP only |

### 7.2 Production Architecture Recommendation

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              Client Layer                                    │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐                          │
│  │   Web App   │  │   Widget    │  │ Mobile App  │                          │
│  │  (React)    │  │  (Vanilla)  │  │   (Future)  │                          │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘                          │
└─────────┼────────────────┼────────────────┼────────────────────────────────┘
          │                │                │
          ▼                ▼                ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                            CDN / CloudFront                                  │
│                    Static assets, widget.js caching                          │
└─────────────────────────────────────────────────────────────────────────────┘
          │
          ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                           Load Balancer (ALB/NGINX)                          │
│                    SSL termination, rate limiting                            │
└─────────────────────────────────────────────────────────────────────────────┘
          │
          ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                         Kubernetes Cluster                                   │
│  ┌─────────────────────────────────────────────────────────────────────────┐  │
│  │                      API Gateway (Kong/AWS API GW)                       │  │
│  │         Auth, Rate Limiting, Request Validation, Routing                │  │
│  └─────────────────────────────────────────────────────────────────────────┘  │
│                                   │                                          │
│         ┌─────────────────────────┼─────────────────────────┐                │
│         │                         │                         │                │
│         ▼                         ▼                         ▼                │
│  ┌─────────────┐          ┌─────────────┐          ┌─────────────┐           │
│  │  API Pod 1  │          │  API Pod 2  │          │  API Pod N  │           │
│  │  (FastAPI)  │          │  (FastAPI)  │          │  (FastAPI)  │           │
│  └──────┬──────┘          └──────┬──────┘          └──────┬──────┘           │
│         │                        │                        │                  │
└─────────┼────────────────────────┼────────────────────────┼──────────────────┘
          │                        │                        │
          ▼                        ▼                        ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                           Data Layer                                         │
│                                                                              │
│  ┌───────────────┐  ┌───────────────┐  ┌───────────────┐  ┌─────────────┐  │
│  │  PostgreSQL   │  │    Redis      │  │    Pinecone   │  │    S3       │  │
│  │   (Primary)   │  │   (Cache)     │  │  (Vector DB)  │  │  (Files)    │  │
│  └───────────────┘  └───────────────┘  └───────────────┘  └─────────────┘  │
│                                                                              │
│  ┌───────────────┐  ┌───────────────┐  ┌───────────────┐                   │
│  │  Celery Worker │  │ Celery Beat   │  │   RabbitMQ    │                   │
│  │  (Async Tasks) │  │ (Scheduler)   │  │  (Message Q)  │                   │
│  └───────────────┘  └───────────────┘  └───────────────┘                   │
└─────────────────────────────────────────────────────────────────────────────┘
          │
          ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                         External Services                                    │
│  ┌───────────────┐  ┌───────────────┐  ┌───────────────┐                   │
│  │    Gemini     │  │  Google Sheets │  │   Prometheus   │                   │
│  │      API      │  │      API      │  │    /Grafana    │                   │
│  └───────────────┘  └───────────────┘  └───────────────┘                   │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 8. Security Audit

### 8.1 Critical Vulnerabilities

| Severity | Issue | Location | Impact |
|----------|-------|----------|--------|
| 🔴 Critical | API Key Exposure | `main.py:76`, `liveAudioService.js:9` | API key exposed to frontend |
| 🔴 Critical | No Authentication | All routes | Unauthorized access |
| 🟡 High | CORS Wildcard | `main.py:22` | CSRF/XSS risk |
| 🟡 High | File Upload Validation | `knowledge_base.py:135` | Malicious file upload |
| 🟡 High | No Rate Limiting | All endpoints | DoS vulnerability |
| 🟢 Medium | SQL Injection | Models | Protected by ORM |
| 🟢 Medium | Secret Management | `.env` file | Secrets in version control risk |

### 8.2 Security Improvements

**1. API Key Management:**
```python
# Use proper secret management
import boto3  # or azure-keyvault, vault

def get_gemini_key():
    # Option 1: Environment (dev only)
    # Option 2: AWS Secrets Manager
    client = boto3.client('secretsmanager')
    response = client.get_secret_value(SecretId='gemini-api-key')
    return response['SecretString']
```

**2. Authentication with JWT:**
```python
from fastapi import Depends, HTTPException
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials

security = HTTPBearer()

async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    token = credentials.credentials
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=["HS256"])
        return payload["sub"]
    except jwt.JWTError:
        raise HTTPException(status_code=401, detail="Invalid token")

@app.get("/api/agents", dependencies=[Depends(get_current_user)])
async def list_agents(user_id: str = Depends(get_current_user)):
    # Filter by user_id
    return db.query(Agent).filter(Agent.user_id == user_id).all()
```

**3. Rate Limiting:**
```python
from slowapi import Limiter
from slowapi.util import get_remote_address

limiter = Limiter(key_func=get_remote_address)

@app.post("/api/agents/{agent_id}/chat")
@limiter.limit("10/minute")
async def chat_with_agent(request: Request, ...):
    ...
```

**4. File Upload Security:**
```python
import magic  # python-magic

ALLOWED_TYPES = ['application/pdf', 'text/csv',
                 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet']
MAX_FILE_SIZE = 10 * 1024 * 1024  # 10MB

async def validate_file(file: UploadFile):
    # Check MIME type
    content = await file.read(2048)
    mime = magic.from_buffer(content, mime=True)

    if mime not in ALLOWED_TYPES:
        raise HTTPException(400, "Invalid file type")

    # Check file size
    file.file.seek(0, 2)  # Seek to end
    size = file.file.tell()
    if size > MAX_FILE_SIZE:
        raise HTTPException(400, "File too large")

    file.file.seek(0)  # Reset
    return True
```

---

## 9. Performance Bottlenecks

### 9.1 Identified Bottlenecks

| Component | Issue | Current Impact | Scaling Limit |
|-----------|-------|----------------|---------------|
| **RAG Search** | Full table scan | O(n) complexity | ~10k entries |
| **Embedding Gen** | Synchronous | Blocks request | 1-2 req/sec |
| **File Processing** | In-memory | Memory bound | ~100MB files |
| **WebSocket** | No connection pooling | Per-connection overhead | ~1k concurrent |
| **Database** | SQLite (file-based) | Write locking | ~100 concurrent |
| **TTS** | Browser fallback | Client-dependent | N/A |

### 9.2 Performance Optimizations

**1. Vector Database Migration:**
```python
# Current: SQLite + Python
# Query time: ~500ms for 10k entries

# Optimized: Pinecone
# Query time: ~50ms for 1M entries (10x improvement)
```

**2. Connection Pooling:**
```python
# Database
engine = create_engine(
    DATABASE_URL,
    pool_size=20,
    max_overflow=30,
    pool_pre_ping=True,
    pool_recycle=3600
)

# HTTP Client for Gemini
from aiohttp import ClientSession, TCPConnector

connector = TCPConnector(
    limit=100,
    limit_per_host=10,
    enable_cleanup_closed=True,
    force_close=True,
)
session = ClientSession(connector=connector)
```

**3. Caching Strategy:**
```python
import aioredis
from functools import wraps

redis = aioredis.from_url("redis://localhost")

def cached(ttl: int = 3600):
    def decorator(func):
        @wraps(func)
        async def wrapper(*args, **kwargs):
            key = f"{func.__name__}:{hash(str(args))}"
            cached = await redis.get(key)
            if cached:
                return json.loads(cached)
            result = await func(*args, **kwargs)
            await redis.setex(key, ttl, json.dumps(result))
            return result
        return wrapper
    return decorator

@cached(ttl=3600)
async def get_agent_config(agent_id: str):
    return await db.get(Agent, agent_id)
```

---

## 10. Detailed Improvement Recommendations

### 10.1 Immediate Priority (1-2 weeks)

#### 1. Add Authentication
```python
# Implement JWT-based auth
# Protect all routes
# Add user_id to all models
```

#### 2. Migrate to PostgreSQL
```python
# Replace SQLite with PostgreSQL
# Add connection pooling
# Implement database migrations (Alembic)
```

#### 3. Add Vector Database
```python
# Integrate ChromaDB (local) or Pinecone (cloud)
# Migrate existing embeddings
# Update search logic
```

#### 4. Secure API Keys
```python
# Remove keys from frontend
# Implement backend proxy for Gemini calls
# Use environment variables / secret manager
```

### 10.2 Short-term Priority (1-2 months)

#### 1. Async Processing
```python
# Add Celery for background tasks
# Move file processing to workers
# Implement progress tracking
```

#### 2. Caching Layer
```python
# Add Redis
# Cache embeddings and responses
# Implement query deduplication
```

#### 3. Monitoring
```python
# Add structured logging (structlog)
# Integrate Sentry for error tracking
# Add Prometheus metrics
```

#### 4. Testing
```python
# Unit tests (pytest)
# Integration tests
# Load tests (locust/k6)
```

### 10.3 Long-term Priority (3-6 months)

#### 1. Multi-tenancy
```python
# Isolate tenant data
# Implement RBAC
# Add usage quotas
```

#### 2. Advanced RAG
```python
# Hybrid search (BM25 + Vector)
# Re-ranking model
# Query expansion
```

#### 3. Agentic Capabilities
```python
# Tool use framework
# Multi-step reasoning
# Memory management
```

#### 4. Infrastructure
```python
# Docker + Kubernetes
# CI/CD pipeline
# Blue-green deployments
```

---

## 11. Migration Path to Production

### Phase 1: Foundation (Weeks 1-2)
- [ ] Add PostgreSQL support
- [ ] Implement authentication (JWT)
- [ ] Add basic rate limiting
- [ ] Set up structured logging

### Phase 2: Performance (Weeks 3-4)
- [ ] Integrate ChromaDB vector store
- [ ] Add Redis caching
- [ ] Implement Celery for async processing
- [ ] Add database migrations

### Phase 3: Security (Weeks 5-6)
- [ ] Security audit fixes
- [ ] API key rotation mechanism
- [ ] HTTPS/TLS setup
- [ ] Input validation hardening

### Phase 4: Reliability (Weeks 7-8)
- [ ] Add health checks
- [ ] Implement circuit breakers
- [ ] Error handling improvements
- [ ] Add Sentry integration

### Phase 5: Scale (Weeks 9-10)
- [ ] Containerization (Docker)
- [ ] Kubernetes manifests
- [ ] Horizontal pod autoscaling
- [ ] Load testing and optimization

### Phase 6: Advanced Features (Weeks 11-12)
- [ ] Re-ranking model
- [ ] Conversation persistence
- [ ] Analytics dashboard
- [ ] Multi-tenancy support

---

## 12. Technology Stack Recommendations

### Current vs Recommended Stack

| Layer | Current | Production | Migration Effort |
|-------|---------|------------|------------------|
| **Frontend** | React + Vite | React + Next.js | Low |
| **Backend** | FastAPI | FastAPI + Gunicorn | Low |
| **Database** | SQLite | PostgreSQL | Medium |
| **Vector DB** | None | Pinecone/ChromaDB | Medium |
| **Cache** | None | Redis | Low |
| **Queue** | None | Celery + RabbitMQ | Medium |
| **Auth** | None | Auth0/Clerk + JWT | Medium |
| **Monitoring** | None | Prometheus + Grafana | Medium |
| **Logging** | Print | Loki + Grafana | Low |
| **Container** | None | Docker + K8s | High |
| **CI/CD** | None | GitHub Actions | Medium |
| **CDN** | None | CloudFront/CloudFlare | Low |

### Recommended Additions

```yaml
# docker-compose.yml for production
version: '3.8'
services:
  api:
    build: ./backend
    environment:
      - DATABASE_URL=postgresql://...
      - REDIS_URL=redis://redis:6379
      - PINECONE_API_KEY=${PINECONE_API_KEY}
    depends_on:
      - postgres
      - redis
    deploy:
      replicas: 3

  postgres:
    image: postgres:15
    volumes:
      - postgres_data:/var/lib/postgresql/data

  redis:
    image: redis:7-alpine

  celery_worker:
    build: ./backend
    command: celery -A tasks worker --loglevel=info
    depends_on:
      - redis
      - postgres

  nginx:
    image: nginx:alpine
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf

  prometheus:
    image: prom/prometheus

  grafana:
    image: grafana/grafana
```

---

## Summary of Critical Improvements

### Must Fix Before Production:
1. **Security:** Add authentication, secure API keys, HTTPS
2. **Database:** Migrate from SQLite to PostgreSQL
3. **RAG:** Implement proper vector database (Pinecone/ChromaDB)
4. **Performance:** Add caching (Redis), async processing (Celery)
5. **Monitoring:** Add structured logging, error tracking, metrics

### High Value Additions:
1. **Re-ranking model** for better RAG accuracy
2. **Conversation persistence** for context continuity
3. **Analytics dashboard** for usage insights
4. **Multi-tenancy** for SaaS scalability
5. **Agentic capabilities** for tool use and reasoning

### Estimated Effort:
- **MVP to Production-Ready:** 2-3 months with 2 engineers
- **Full Feature Set:** 4-6 months with 3 engineers

---

**Report Generated:** March 4, 2026
**Report Version:** 1.0
**Classification:** Internal - Improvement Recommendations
