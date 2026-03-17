# 🧪 RAG Upgrade — Testing & Validation Guide

## Pre-Deployment Checklist

### ✅ Code Review
- [x] New files created: `vector_store.py`, `rag_config.py`
- [x] Modified files: `enhanced_rag.py`, `agents.py`, `knowledge_base.py`, `main.py`
- [x] Dependencies updated: `requirements.txt` includes `chromadb==0.5.23`
- [x] No syntax errors or import issues
- [x] Backward compatibility maintained (SQL embeddings preserved)

### ✅ Configuration
- [ ] Copy `.env.example` to `.env`
- [ ] Set `GEMINI_API_KEY`
- [ ] Set `RAG_BACKEND=chroma` (or start with `legacy` for safe rollout)
- [ ] Review RAG tuning parameters (ALPHA, MMR_LAMBDA, TOP_K)

---

## Installation Steps

### 1. Install Dependencies
```bash
cd backend
pip install -r requirements.txt
```

**Expected output:**
```
Successfully installed chromadb-0.5.23 ...
```

**Verify:**
```bash
python -c "import chromadb; print(chromadb.__version__)"
# Should print: 0.5.23
```

### 2. Configure Environment
```bash
# Copy example config
cp .env.example .env

# Edit .env
nano .env
```

**Required settings:**
```bash
GEMINI_API_KEY=your_actual_key_here
RAG_BACKEND=chroma
CHROMA_PERSIST_DIR=./chroma_db
```

### 3. Start Server (First Time)
```bash
uvicorn main:app --reload
```

**Expected startup logs:**
```
INFO:     Uvicorn running on http://0.0.0.0:8000
✅ Database initialized
🔍 RAG Config → backend=chroma, top_k=6, alpha=0.65, mmr_lambda=0.65, rerank=False, chunk_size=400
✅ ChromaDB client initialised at './chroma_db'
🚀 AI Voice Agent Platform v2 running!
```

**✅ Success indicators:**
- No import errors
- ChromaDB client initialized
- RAG config printed with correct backend

**❌ Troubleshooting:**
```bash
# If chromadb import fails:
pip uninstall chromadb
pip install chromadb==0.5.23 --no-cache-dir

# If "module not found" errors:
export PYTHONPATH="${PYTHONPATH}:$(pwd)/backend"
```

---

## Testing Scenarios

### Test 1: Legacy Backend (Baseline)
**Purpose:** Verify old path still works, measure baseline performance

```bash
# Set in .env
RAG_BACKEND=legacy

# Restart server
uvicorn main:app --reload
```

**Test API:**
```bash
# Create agent
curl -X POST http://localhost:8000/api/agents \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test Agent",
    "role": "customer support",
    "system_prompt": "You are helpful",
    "voice_id": "Puck",
    "language": "tanglish"
  }'
# Save returned agent_id

# Create knowledge base
curl -X POST "http://localhost:8000/api/kb?agent_id=<agent_id>" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test KB",
    "kb_type": "static"
  }'
# Save returned kb_id

# Upload file (create test.txt with some content)
echo "This is test content about our return policy. Customers can return within 30 days." > test.txt
curl -X POST "http://localhost:8000/api/kb/<kb_id>/upload" \
  -F "file=@test.txt"

# Chat (test RAG)
curl -X POST "http://localhost:8000/api/agents/<agent_id>/chat" \
  -H "Content-Type: application/json" \
  -d '{"message": "what is the return policy?"}'
```

**Expected result:**
- Response includes "30 days" (from KB)
- `"rag_used": true`
- **Baseline latency:** ~100-500ms for small KB

---

### Test 2: ChromaDB Backend (New Path)
**Purpose:** Verify ChromaDB search works, measure improved performance

```bash
# Switch backend
# Edit .env:
RAG_BACKEND=chroma

# Restart server
uvicorn main:app --reload
```

**Verify ChromaDB initialization:**
```bash
# Check logs for:
✅ ChromaDB client initialised at './chroma_db'
```

**Re-index existing data:**
```bash
curl -X POST "http://localhost:8000/api/kb/agent/<agent_id>/reindex"
```

**Expected response:**
```json
{
  "message": "Re-indexed 3 entries into ChromaDB for agent ...",
  "indexed": 3
}
```

**Test search:**
```bash
curl -X POST "http://localhost:8000/api/agents/<agent_id>/chat" \
  -H "Content-Type: application/json" \
  -d '{"message": "what is the return policy?"}'
```

**Expected result:**
- Same response content as legacy test (proves correctness)
- **Improved latency:** <50ms for RAG search (check server logs)
- `"rag_used": true`
- `sources` array includes relevant chunks

---

### Test 3: Bulk Upload & Search (Scale Test)
**Purpose:** Test performance with larger KB

```bash
# Create large test file (10KB+ content)
python -c "
content = 'Product FAQ: ' + ('Q: Common question? A: Standard answer. ' * 500)
with open('large_test.txt', 'w') as f:
    f.write(content)
"

# Upload
curl -X POST "http://localhost:8000/api/kb/<kb_id>/upload" \
  -F "file=@large_test.txt"

# Wait for processing (check server logs)
# Should see: "Processed X smart chunks from large_test.txt"

# Test search
time curl -X POST "http://localhost:8000/api/agents/<agent_id>/chat" \
  -H "Content-Type: application/json" \
  -d '{"message": "product FAQ question"}'
```

**Expected results:**
- **Legacy backend:** Latency increases with KB size (linear O(n))
- **ChromaDB backend:** Latency stays <20ms even with 1000+ chunks (O(log n))

**Verify in logs:**
```
⏱️  RAG search: 12.34ms  # Should be <20ms
```

---

### Test 4: Hybrid Search (Dense + Sparse)
**Purpose:** Verify BM25 keyword boost works

**Setup:**
```bash
# Add two KB entries with different characteristics
curl -X POST "http://localhost:8000/api/kb/<kb_id>/entries" \
  -H "Content-Type: application/json" \
  -d '{
    "content": "Our return policy allows returns within 30 days of purchase.",
    "source_file": "semantic_match.txt"
  }'

curl -X POST "http://localhost:8000/api/kb/<kb_id>/entries" \
  -H "Content-Type: application/json" \
  -d '{
    "content": "Refund timeframe: thirty day window for product returns.",
    "source_file": "keyword_match.txt"
  }'
```

**Test semantic query:**
```bash
curl -X POST "http://localhost:8000/api/agents/<agent_id>/chat" \
  -H "Content-Type: application/json" \
  -d '{"message": "how long do I have to send it back?"}'
```

**Test keyword query:**
```bash
curl -X POST "http://localhost:8000/api/agents/<agent_id>/chat" \
  -H "Content-Type: application/json" \
  -d '{"message": "30 days return"}'
```

**Expected:**
- Both queries should return relevant chunks
- Keyword query should prefer exact "30 days" match (BM25 boost)
- Check `sources` array to verify correct ranking

---

### Test 5: MMR Diversity Filter
**Purpose:** Verify MMR prevents redundant chunks

**Setup:**
```bash
# Add 3 similar entries
for i in {1..3}; do
  curl -X POST "http://localhost:8000/api/kb/<kb_id>/entries" \
    -H "Content-Type: application/json" \
    -d "{\"content\": \"Our return policy allows returns within 30 days. Variation $i.\", \"source_file\": \"duplicate_$i.txt\"}"
done

# Add 1 diverse entry
curl -X POST "http://localhost:8000/api/kb/<kb_id>/entries" \
  -H "Content-Type: application/json" \
  -d '{"content": "Shipping is free on orders over $50.", "source_file": "shipping.txt"}'
```

**Test:**
```bash
curl -X POST "http://localhost:8000/api/agents/<agent_id>/chat" \
  -H "Content-Type: application/json" \
  -d '{"message": "return policy and shipping"}'
```

**Expected:**
- Response should include BOTH return policy AND shipping info
- `sources` array should have diverse entries (not 3 duplicate return policy chunks)
- Proves MMR diversity filter is working

---

### Test 6: Rollback Safety
**Purpose:** Verify instant rollback to legacy path

```bash
# 1. While server is running with RAG_BACKEND=chroma
# 2. Test a query (save response)
# 3. Stop server
# 4. Edit .env: RAG_BACKEND=legacy
# 5. Restart server
# 6. Test same query
```

**Expected:**
- Query works in both modes
- Response content is the same (proves SQL embeddings intact)
- No data loss
- Legacy mode uses SQL embeddings (check logs for NumPy loop references)

---

## Performance Benchmarking

### Benchmark Script
```python
# benchmark_rag.py
import asyncio
import time
from database import SessionLocal
from services.enhanced_rag import search_knowledge_base_unified

async def benchmark(agent_id: str, query: str, iterations: int = 10):
    db = SessionLocal()
    latencies = []

    for i in range(iterations):
        start = time.time()
        results = await search_knowledge_base_unified(query, agent_id, db)
        elapsed = (time.time() - start) * 1000
        latencies.append(elapsed)
        print(f"Run {i+1}/{iterations}: {elapsed:.2f}ms")

    print(f"\n📊 Results ({iterations} runs):")
    print(f"   Mean: {sum(latencies)/len(latencies):.2f}ms")
    print(f"   Min:  {min(latencies):.2f}ms")
    print(f"   Max:  {max(latencies):.2f}ms")
    print(f"   p95:  {sorted(latencies)[int(len(latencies)*0.95)]:.2f}ms")
    
    db.close()

if __name__ == "__main__":
    import sys
    agent_id = sys.argv[1] if len(sys.argv) > 1 else "test-agent-id"
    asyncio.run(benchmark(agent_id, "test query"))
```

**Run:**
```bash
# Legacy
RAG_BACKEND=legacy python benchmark_rag.py <agent_id>

# ChromaDB
RAG_BACKEND=chroma python benchmark_rag.py <agent_id>

# Compare results
```

---

## Load Testing

### Using wrk (HTTP load testing)
```bash
# Install wrk
sudo apt install wrk  # Ubuntu
brew install wrk      # macOS

# Create request body
cat > body.json <<EOF
{"message": "test query", "history": []}
EOF

# Run load test (100 concurrent connections, 30 seconds)
wrk -t4 -c100 -d30s -s post.lua \
  http://localhost:8000/api/agents/<agent_id>/chat

# post.lua script:
cat > post.lua <<'EOF'
wrk.method = "POST"
wrk.headers["Content-Type"] = "application/json"
wrk.body = '{"message": "test query"}'
EOF
```

**Compare:**
- Legacy backend: watch for increasing latency under load
- ChromaDB backend: consistent low latency even under load

---

## Validation Checklist

### ✅ Functional Tests
- [ ] Legacy backend works (no regressions)
- [ ] ChromaDB backend works (search returns results)
- [ ] Re-index endpoint works (populates ChromaDB)
- [ ] File upload works (auto-indexes to ChromaDB)
- [ ] Manual entry works (auto-indexes to ChromaDB)
- [ ] Multi-agent chat uses RAG context correctly
- [ ] Rollback to legacy works (no data loss)

### ✅ Performance Tests
- [ ] ChromaDB search <20ms (10K+ entries)
- [ ] Hybrid search (dense + BM25) working
- [ ] MMR diversity filter working (no redundant chunks)
- [ ] Scalability: 100K entries no OOM crash
- [ ] Load test: consistent latency under 100 concurrent users

### ✅ Edge Cases
- [ ] Empty KB (no entries): returns empty results gracefully
- [ ] New agent (no ChromaDB collection): auto-creates on first upsert
- [ ] Agent deletion: ChromaDB collection cleanup (TBD in delete endpoint)
- [ ] Invalid RAG_BACKEND value: falls back to legacy with warning

---

## Monitoring in Production

### Key Metrics
```python
# Add to enhanced_rag.py
import time
from prometheus_client import Histogram

rag_latency = Histogram(
    'rag_search_latency_seconds',
    'RAG search latency by backend',
    ['backend']
)

@rag_latency.labels(backend=RAG_BACKEND).time()
async def search_knowledge_base_unified(...):
    # ...
```

### Logging
```python
# Add detailed logs in vector_store.py
print(f"🔍 ChromaDB query: {query[:50]}... | agent={agent_id} | top_k={top_k}")
print(f"⏱️  ChromaDB search: {elapsed_ms:.2f}ms | results={len(results)}")
```

### Alerts
- RAG latency p95 > 100ms (investigate)
- ChromaDB errors > 1% (investigate)
- Disk usage > 80% (scale storage)

---

## Troubleshooting

### Issue: "No module named 'chromadb'"
```bash
pip install chromadb==0.5.23
# If still fails:
pip install --upgrade pip
pip install chromadb==0.5.23 --no-cache-dir
```

### Issue: "Collection not found"
ChromaDB collections are created on first upsert. Trigger by:
```bash
curl -X POST "http://localhost:8000/api/kb/<kb_id>/entries" ...
```

### Issue: Search returns empty results
```bash
# Check if data is in ChromaDB
python -c "
from services.vector_store import get_collection_stats
print(get_collection_stats('<agent_id>'))
"

# If count=0, re-index:
curl -X POST "http://localhost:8000/api/kb/agent/<agent_id>/reindex"
```

### Issue: Slow performance with ChromaDB
- Check `RAG_BACKEND` is actually set to "chroma"
- Verify ChromaDB is using HNSW index (default)
- Check disk I/O (ChromaDB uses disk for persistent storage)

---

## Success Criteria

✅ **All tests pass** (functional + performance)  
✅ **No regressions** (legacy path still works)  
✅ **< 20ms RAG latency** at 10K+ entries  
✅ **Instant rollback works** (no data loss)  
✅ **Load test passes** (100 concurrent users, consistent latency)  
✅ **Documentation complete** (architecture, deployment, testing)  

---

## Sign-Off

**Testing completed by:** _______________  
**Date:** _______________  
**Production deployment approved:** [ ] Yes [ ] No  
**Rollback plan verified:** [ ] Yes [ ] No  
**Monitoring configured:** [ ] Yes [ ] No  

---

## Next Steps After Testing

1. **Staging Deployment:**
   - Deploy to staging with `RAG_BACKEND=chroma`
   - Run full regression tests
   - Load test with realistic traffic patterns

2. **Production Deployment:**
   - Follow [CHROMA_DEPLOYMENT.md](./CHROMA_DEPLOYMENT.md)
   - Deploy with `RAG_BACKEND=legacy` first (safe rollout)
   - Re-index in background
   - Switch to `RAG_BACKEND=chroma`

3. **Post-Deployment:**
   - Monitor RAG latency metrics
   - Track ChromaDB disk usage
   - Gather user feedback
   - Tune RAG_ALPHA / MMR_LAMBDA based on query patterns

Good luck! 🚀
