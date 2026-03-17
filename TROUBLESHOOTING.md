# 🐛 Troubleshooting Guide — RAG Hallucination & ChromaDB Errors

## Issue 1: ChromaDB Telemetry Error

**Symptom:**
```
Failed to send telemetry event ClientCreateCollectionEvent: capture() takes 1 positional argument but 3 were given
```

**Root Cause:**
ChromaDB v0.5.23 has a bug in the telemetry system. The `capture()` function signature changed but wasn't updated properly.

**Solution:**
✅ **Fixed in requirements.txt** — Downgraded to `chromadb==0.4.24` (stable version)

**Action:**
```bash
# Reinstall ChromaDB
pip install --upgrade chromadb==0.4.24 --no-cache-dir --force-reinstall

# Verify telemetry is disabled
export ANONYMIZED_TELEMETRY=False
```

**Verify the fix:**
```bash
# Restart server — should NOT see telemetry errors
uvicorn main:app --reload

# Look for clean logs:
✅ ChromaDB client initialised at './chroma_db'
🔍 RAG Config → backend=chroma, ...
```

---

## Issue 2: Agent Hallucination (Inventing Details Not in KB)

**Symptom:**
```
You: "What is the return policy?"
Agent: "You can return items within 60 days with full refund!" 
        (but your KB says 30 days)
```

**Root Cause:**
RAG search is returning **empty results** because:
1. KB entries not indexed into ChromaDB
2. Query embedding failed
3. ChromaDB collection is empty
4. Agent is falling back to general knowledge

**Diagnosis:**

### Step 1: Use Debug Endpoint to Check KB Status
```bash
curl "http://localhost:8000/api/kb/agent/{agent_id}/debug?query=return%20policy" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

**Response Example:**
```json
{
  "agent_id": "abc-123",
  "sql_stats": {
    "kb_count": 1,
    "entry_count": 3
  },
  "chroma_stats": {
    "count": 0,    ⚠️  PROBLEM: ChromaDB has 0 entries but SQL has 3!
    "backend": "chromadb"
  },
  "test_search": {
    "query": "return policy",
    "results_count": 0,  ⚠️  RAG returned nothing!
    "results": []
  }
}
```

**Interpretation:**
- ✅ `sql_count > 0` → Entries in database
- ❌ `chroma_count == 0` → NOT indexed to vector store
- ❌ `results_count == 0` → RAG search failed

### Step 2: Re-index the Agent
If ChromaDB count is 0 but SQL count > 0:

```bash
curl -X POST "http://localhost:8000/api/kb/agent/{agent_id}/reindex" \
  -H "Authorization: Bearer YOUR_TOKEN"

# Expected response:
{
  "message": "Re-indexed 3 entries into ChromaDB for agent abc-123",
  "indexed": 3
}
```

### Step 3: Verify Re-indexing Worked
```bash
curl "http://localhost:8000/api/kb/agent/{agent_id}/debug?query=return%20policy" \
  -H "Authorization: Bearer YOUR_TOKEN"

# Now should see:
{
  "sql_stats": { "entry_count": 3 },
  "chroma_stats": { "count": 3 },  ✅ COUNT MATCHES!
  "test_search": {
    "results_count": 3,            ✅ SEARCH WORKS!
    "results": [...]
  }
}
```

---

## Issue 3: KB Upload Not Indexed to ChromaDB

**Symptom:**
You upload a file → shows "Processed 3 chunks" → but debug shows ChromaDB count=0

**Root Cause:**
File upload was created in SQL, but `agent_id` not passed to embedding function.

**Solution:**
✅ **Fixed in knowledge_base.py** — Now passes `agent_id` to `embed_and_store_chunked()`

**Action:**
```bash
# If you uploaded before the fix, re-index:
curl -X POST "http://localhost:8000/api/kb/agent/{agent_id}/reindex" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

---

## Issue 4: RAG_BACKEND Not Set to "chroma"

**Symptom:**
Debug endpoint shows ChromaDB count=0 even after re-index

**Root Cause:**
`RAG_BACKEND` is still set to `"legacy"` or `"enhanced"`

**Verify:**
```bash
# Check .env file
grep RAG_BACKEND .env
# Should output: RAG_BACKEND=chroma

# Or check env variable:
echo $RAG_BACKEND
# Should output: chroma
```

**Fix:**
```bash
# Edit .env
nano .env
# Set: RAG_BACKEND=chroma

# Restart server
uvicorn main:app --reload

# Verify in logs:
🔍 RAG Config → backend=chroma, top_k=6, ...
```

---

## Complete Diagnostic Steps

### If Agent Hallucinating:

```bash
# 1. Check KB status
curl "http://localhost:8000/api/kb/agent/{agent_id}/debug" | jq .

# 2. If chroma.count == 0:
curl -X POST "http://localhost:8000/api/kb/agent/{agent_id}/reindex"

# 3. Wait 10-30 seconds (embedding generation takes time)

# 4. Check again
curl "http://localhost:8000/api/kb/agent/{agent_id}/debug" | jq .

# 5. Test chat
curl -X POST "http://localhost:8000/api/agents/{agent_id}/chat" \
  -H "Content-Type: application/json" \
  -d '{"message": "what is the return policy?"}'
```

---

## Check Logs for RAG Activity

### Server Logs Should Show:
```
[services.vector_store] INFO: 🔍 RAG search: backend=chroma, agent=abc-123, query='what is...', top_k=6
[services.vector_store] INFO: ✅ RAG search returned 3 results (top_k=6)
[services.vector_store] INFO:    Top result: score=0.8234, source=faq.txt
[services.enhanced_rag] INFO: 📊 RAG search result: 3 chunks returned
```

### If RAG Fails:
```
[services.vector_store] WARNING: ⚠️  ChromaDB collection empty for agent abc-123 — no KB entries indexed
[services.vector_store] INFO: ✅ RAG search returned 0 results (top_k=6)
[services.enhanced_rag] WARNING: ⚠️  RAG returned NO results for agent abc-123 — agent may hallucinate!
```

---

## Prevent Hallucination (Best Practices)

### 1. Always Upload KB Before Testing Chat
```bash
# 1. Create KB
curl -X POST "http://localhost:8000/api/kb?agent_id=..." \
  -d '{"name": "FAQ", "kb_type": "static"}'

# 2. Upload file
curl -X POST "http://localhost:8000/api/kb/{kb_id}/upload" \
  -F "file=@faq.txt"

# 3. Re-index (to be safe)
curl -X POST "http://localhost:8000/api/kb/agent/{agent_id}/reindex"

# 4. Verify
curl "http://localhost:8000/api/kb/agent/{agent_id}/debug"

# 5. NOW test chat
curl -X POST "http://localhost:8000/api/agents/{agent_id}/chat" \
  -d '{"message": "your question here"}'
```

### 2. Check RAG Context in Response
```bash
curl -X POST "http://localhost:8000/api/agents/{agent_id}/chat" \
  -d '{"message": "test query"}'
```

**Look for:**
```json
{
  "response": "...",
  "rag_used": true,          ✅ RAG was used
  "sources": [               ✅ Sources listed
    {"content": "...", "score": 0.85, "source": "faq.txt"}
  ]
}
```

If `sources` is empty list or `rag_used` is false → **hallucination likely**

### 3. Monitor Backend Logs
```bash
# Start with verbose logging
RUST_LOG=info uvicorn main:app --reload

# Or redirect logs to file
uvicorn main:app --reload > logs.txt 2>&1
tail -f logs.txt
```

---

## Quick Fix Checklist

- [ ] Downgrade ChromaDB: `pip install chromadb==0.4.24 --force-reinstall`
- [ ] Set `RAG_BACKEND=chroma` in `.env`
- [ ] Restart server: `uvicorn main:app --reload`
- [ ] Check KB status: `curl .../api/kb/agent/{id}/debug`
- [ ] If `chroma_count=0`: Run `/reindex` endpoint
- [ ] Verify RAG works: Check `rag_used=true` in chat response
- [ ] Monitor logs for `RAG search returned X results`

---

## Still Hallucinating?

### Check These:

1. **Is the KB actually uploaded?**
   ```bash
   curl "http://localhost:8000/api/kb/{kb_id}/entries"
   # Should list >0 entries
   ```

2. **Is ChromaDB persisted?**
   ```bash
   ls -lh ./chroma_db/
   # Should have subdirectories and files
   ```

3. **Is embedding working?**
   Check logs for embedding generation errors

4. **Is the agent system prompt causing hallucination?**
   Test with `RAG_ALPHA=1.0` (100% semantic, no BM25)

---

## Support

If issues persist:
1. Check [RAG_ARCHITECTURE.md](./RAG_ARCHITECTURE.md) for design details
2. Review [CHROMA_DEPLOYMENT.md](./CHROMA_DEPLOYMENT.md) for deployment issues
3. Enable debug logging: Check backend logs for detailed error messages
4. Share:
   - Response from `/debug` endpoint
   - Server logs during chat
   - Agent config (name, role, system_prompt)
   - KB entry count and content samples

---

## Recap

| Problem | Diagnosis | Fix |
|---------|-----------|-----|
| Telemetry error | ChromaDB v0.5.23 bug | Update to v0.4.24 |
| Hallucination | Empty RAG results | Run `/reindex` endpoint |
| No KB entries in ChromaDB | Not indexed on upload | Re-upload + re-index |
| `rag_used=false` | RAG_BACKEND not set | Set `RAG_BACKEND=chroma` |
| ChromaDB count mismatch | Data not synced | Run `/reindex` |

Happy debugging! 🐛
