# VoiceForge AI — Product Improvement & Differentiation Roadmap

> **Purpose:** What exists, what is weak, what to change, what to add — to make this product unique, reliable, and sellable at maximum value.

---

## TABLE OF CONTENTS

1. [What's Actually Built (Honest Audit)](#1-whats-actually-built-honest-audit)
2. [LLM & AI Architecture — Current State](#2-llm--ai-architecture--current-state)
3. [Critical Reliability Problems to Fix First](#3-critical-reliability-problems-to-fix-first)
4. [What to Change for Uniqueness](#4-what-to-change-for-uniqueness)
5. [High-Value Features to Add](#5-high-value-features-to-add)
6. [Monetisation & Pricing Strategy](#6-monetisation--pricing-strategy)
7. [Industries to Target](#7-industries-to-target)
8. [Competitive Differentiation Summary](#8-competitive-differentiation-summary)
9. [Priority Implementation Order](#9-priority-implementation-order)

---

## 1. What's Actually Built (Honest Audit)

### ✅ Working & Strong

| Feature | Location | Status |
|---------|----------|--------|
| Gemini Live API real-time voice (bidirectional) | `liveAudioService.js` | ✅ Working |
| Browser-side mic capture via AudioWorklet | `liveAudioService.js` | ✅ Working |
| PCM16 audio streaming to Gemini @ 16kHz | `liveAudioService.js` | ✅ Working |
| Gapless PCM24 playback from Gemini | `Player` class in service | ✅ Working |
| Voice lock / ambient noise calibration | `_processAudio()` | ✅ Working |
| Input + Output audio transcription in chat | `onTranscription` callbacks | ✅ Working |
| Multi-agent decision engine (parallel LLM calls) | `multi_agent.py` | ✅ Built |
| Intent, Sentiment, Escalation, Language agents | `multi_agent.py` | ✅ Built |
| RAG search with cosine similarity | `embeddings.py` | ✅ Working |
| PDF / Excel / CSV knowledge base upload | `file_processor.py` | ✅ Working |
| Google Sheets live sync | `sheets_sync.py` | ✅ Working |
| Embeddable widget with config API | `agent-widget.js` | ✅ Working |
| SDK code generation per agent | `sdk_generator.py` | ✅ Working |
| JWT auth (login / register / company) | `auth.py` | ✅ Built |
| Dashboard — create, edit, delete agents | Frontend pages | ✅ Working |
| Test Call tab with live voice | `VoiceCallWidget.jsx` | ✅ Working |
| Tanglish voice (Tamil+English mixed) | System prompt | ✅ Working |
| Agent speaks first on call connect | `_greet()` | ✅ Working |
| Interruption detection (client + server VAD) | `_processAudio()` | ✅ Working |

### ⚠️ Built But Commented Out / Broken

| Feature | Problem |
|---------|---------|
| Enhanced RAG (`enhanced_rag.py`) | Entire file commented out — hybrid search, MMR re-ranking, cross-encoder are NOT active. Current RAG is basic cosine-only. |
| WebSocket voice call backend (`voice_call.py`) | Old STT/TTS pipeline commented out. Voice now goes browser → Gemini directly which is correct, but the WS router is dead code. |
| Multi-agent system in voice calls | Multi-agent is only used for **text chat** (`/api/agents/{id}/chat`). Live voice does NOT use it. |
| Retry with backoff in `gemini_service.py` | The whole file except constants is commented out. |

### ❌ Missing Entirely

- Call recording / history / playback
- Real-time call analytics dashboard
- Webhook delivery when call ends
- Multiple language support beyond Tamil+English
- Agent handoff (AI → human escalation with live takeover)
- Call scheduling / callback booking
- Usage quotas per client company
- Billing / subscription management in the app
- Admin panel to manage all client companies

---

## 2. LLM & AI Architecture — Current State

### 2.1 Models in Use

| Model | Used For | Cost |
|-------|---------|------|
| `gemini-2.5-flash-native-audio-preview-12-2025` | Live voice call (real-time audio) | ~$0.30/hr audio |
| `gemini-2.0-flash` (CHAT_MODEL) | Text chat, multi-agent decisions | ~$0.10/1M tokens |
| `text-embedding-004` | Knowledge base embeddings | ~$0.00002/1K chars |

### 2.2 Multi-Agent Pipeline (Text Chat Only)

```
User text message
        │
        ▼
  ┌─────────────────────────────────────────────────────┐
  │            PARALLEL (asyncio.gather)                │
  │  IntentAgent   SentimentAgent   LanguageAgent       │
  │     ↓               ↓               ↓               │
  │  intent+entities  sentiment+emotion  language style  │
  └─────────────────────────────────────────────────────┘
        │ results fed to:
        ▼
  EscalationAgent (should we transfer to human?)
        │
        ▼
  RAG search (find relevant KB chunks)
        │
        ▼
  RAG Synthesis Agent (OrchestratorAgent) → final response
```

**Problem:** This 6-LLM-call pipeline adds ~2-4 seconds of latency for every text message. For voice calls, latency must be under 500ms. The pipeline is completely bypassed for voice, which means voice calls have no knowledge base access, no escalation detection, no intent tracking.

### 2.3 RAG Search — Current Implementation

**What's active (`embeddings.py`):**
```
Query → Gemini embedding → cosine similarity against all KB entries → top 5 chunks
```

**What's built but commented out (`enhanced_rag.py`):**
- Hybrid dense + sparse (TF-IDF BM25) search
- Maximal Marginal Relevance (MMR) deduplication  
- Cross-encoder Gemini re-ranking
- Sentence-aware chunking with overlap

**The enhanced RAG is completely inactive.** All that expensive work is commented out and the basic cosine search runs instead. This is a direct quality gap.

### 2.4 Embeddings Storage

Embeddings are stored as **JSON arrays in SQLite/PostgreSQL columns**. This means every search loads ALL embeddings for ALL entries into Python memory and does cosine similarity in a NumPy loop.

- At 100 KB entries: ~0.1s search (fine)
- At 10,000 KB entries: ~10s search (unacceptable)
- At 100,000 KB entries: out-of-memory crash

This is the single biggest scalability bottleneck in the codebase.

---

## 3. Critical Reliability Problems to Fix First

These must be fixed before selling to any client.

### 3.1 Voice has NO knowledge base access

**Problem:** During a live call, the agent speaks from its system prompt + training only. It cannot look up the client's uploaded PDF, price list, or Google Sheet. The RAG pipeline is only called for text chat.

**Impact:** Imagine a client uploads their product catalog and expects the agent to answer "What is the price of item X?" — the agent will hallucinate an answer.

**Fix:** Wire a fast synchronous RAG lookup into the Gemini system prompt at call connect time. Instead of calling RAG during the call (too slow), inject the top 10 most relevant KB chunks into the system instruction during `_sendSetup()`. The backend `/api/gemini-key` endpoint should return the key + a pre-built context string.

```
Client starts call
    → frontend calls /api/agents/{id}/context (new endpoint)
    → backend does RAG search with agent's KB on a "general knowledge" seed query
    → returns top 10 chunks as a context string
    → frontend injects this into systemInstruction in _sendSetup()
```

### 3.2 No call conversation saved anywhere

**Problem:** Every call is ephemeral. When it ends, the transcript is lost. There is no history, no analytics, no way for clients to review what their agent said.

**Fix needed:**
- Save `onTranscription` events to a `call_sessions` database table
- Each session: `{id, agent_id, company_id, started_at, ended_at, transcript: [{role, text, timestamp}]}`
- Add a "Call History" tab in the dashboard

### 3.3 Gemini API key exposed to any origin

**Problem:** `/api/gemini-key` returns the key to any browser that requests it. A competitor or bad actor could scrape the key and use your Gemini quota.

**Fix:** Rate-limit this endpoint + validate the `Origin` header matches a registered client domain. Already outlined in DEPLOYMENT_GUIDE.md.

### 3.4 Enhanced RAG not activated

As described in 2.3 — the better RAG code exists but is commented out. Activate it.

### 3.5 No fallback when Gemini Live API is unavailable

If the `wss://generativelanguage.googleapis.com` WebSocket fails (Gemini downtime, quota exceeded), the widget shows an error and dies. There is no fallback to text chat or a queued callback.

---

## 4. What to Change for Uniqueness

These changes make VoiceForge AI different from every other "AI chatbot widget" on the market.

### 4.1 Multi-Language Voice (Biggest Differentiator)

**Current:** Hardcoded Tanglish (Tamil + English) only.  
**Change:** Make the language configurable per agent.

Add a `language_mode` field to the Agent model:
```
tanglish      → Tamil + English mix (current)
hindi_mix     → Hindi + English (Hinglish)  
kannada_mix   → Kannada + English
telugu_mix    → Telugu + English
malayalam_mix → Malayalam + English
pure_english  → Standard English only
```

Update `_sendSetup()` to generate the system prompt from this field. This alone opens the market to every regional Indian business — e-commerce, banking, healthcare, telecoms across all states.

**Why it's unique:** No competitor offers regional Indian language voice AI as a plug-and-play widget. This is a massive untapped market.

### 4.2 Persona Builder (Character, Not Just Role)

**Current:** Agent has only `name`, `role`, `system_prompt`.  
**Change:** Add personality sliders and a character profile:

```json
{
  "personality": {
    "tone": "friendly",        // friendly / professional / casual / formal
    "pace": "normal",          // slow / normal / fast
    "empathy": 0.8,            // 0.0 to 1.0
    "humor": 0.3,              // 0.0 to 1.0
    "assertiveness": 0.6       // 0.0 to 1.0
  },
  "backstory": "I was created by ACME Corp to help customers since 2024...",
  "signature_phrases": ["Seri saar!", "Let me check that for you"],
  "avoid_topics": ["competitor names", "pricing of other brands"]
}
```

These are baked into the system prompt dynamically. Clients feel the agent is truly theirs, not a generic bot.

### 4.3 Voice Cloning Integration

**Current:** Limited to Gemini's built-in voices (Puck, Charon, Kore, etc.).  
**Change:** Integrate ElevenLabs or Cartesia for custom voice cloning.

A business could upload a 1-minute recording of their brand spokesperson and have the AI agent sound exactly like them. This is premium-tier differentiation.

The architecture: Gemini Live generates the text transcript → send to ElevenLabs TTS API → stream PCM to browser. This replaces Gemini's audio output while keeping its intelligence.

### 4.4 Call Flow Builder (No-Code Agent Logic)

**Current:** Agents respond freely based on system prompt only.  
**Change:** Add a drag-and-drop call flow builder.

Define structured conversation flows:
```
GREETING → IDENTIFY_CUSTOMER → CHECK_ORDER → 
  if order_found → GIVE_STATUS
  if not_found   → ASK_RETRY or ESCALATE
```

This turns the agent from a free-form chatbot into a structured IVR replacement — much more reliable for business-critical tasks like order tracking, appointment booking, complaint logging.

### 4.5 Real-Time RAG During Voice Calls

**Current:** RAG completely absent from voice calls.  
**Change:** Pre-inject context at call start (fast, no latency) + add a tool-call handler so Gemini can request KB lookups mid-call.

Gemini Live API supports **function calling** (tool calls). When the agent needs to look up something (order status, price, availability), it fires a tool call → your backend does the RAG search → sends the result back via `sendToolResponse` → agent speaks the answer.

This makes the agent genuinely knowledgeable, not just conversational.

### 4.6 Post-Call Intelligence

After every call ends, run the transcript through the multi-agent pipeline:
- Extract **action items** ("customer wants a callback", "order #1001 to be re-shipped")
- Extract **sentiment summary** ("customer was frustrated, resolved positively")
- Detect **escalation triggers** that were missed
- Auto-send a **webhook** to the client's CRM (Zoho, HubSpot, Salesforce)
- Auto-send a **follow-up email** summary to the customer

This is where real business value is created — not just the call, but what happens after.

### 4.7 Ambient Context Awareness

Detect what page the user is on when they open the widget:
```js
window.AgentWidgetConfig = {
    agentId: "...",
    contextSelector: ".product-title, .product-price",  // CSS selectors
    pageContext: true,
};
```

The widget reads these elements and injects them into the first message to Gemini:
```
"User is on product page: 'Sony WH-1000XM5, ₹28,990'"
```

The agent immediately knows what the user is looking at without them having to say it. This feels magical.

---

## 5. High-Value Features to Add

### 5.1 Call Analytics Dashboard

Build a dashboard tab showing:
- Total calls this month / week / day (chart)
- Average call duration
- Sentiment distribution (% positive/neutral/negative)
- Most common intents ("order tracking" 42%, "returns" 18%...)
- Escalation rate
- Drop-off points (where users ended calls)
- Knowledge base hit rate (how often RAG found relevant answers)

**Why it sells:** Clients can justify the subscription cost by showing ROI — "our AI handled 800 support calls this month, saving 400 hours of human time."

### 5.2 Human Handoff (Live Takeover)

When `should_escalate = true`, instead of just flagging it:
1. Send a WebSocket notification to a human agent's browser (operations dashboard)
2. Human can join the call as a silent listener first
3. Human can take over the call completely (agent audio stops, human speaks)
4. Seamless handoff with full transcript context provided to human

Architecture: add a second WebSocket channel per call session, authenticated with agent company credentials.

### 5.3 Outbound Calling Campaign

Beyond inbound (widget on website), add outbound:
- Client uploads a CSV of phone numbers + context
- Platform schedules Gemini Live calls to each number
- Agent introduces itself and delivers the message / collects info
- Results logged per number

This opens a completely new use case: sales outreach, appointment reminders, payment follow-ups, survey collection.

Requires WebRTC PSTN gateway (Twilio, Exotel, or Plivo). Exotel has the best India coverage.

### 5.4 Multi-Turn Memory

**Current:** Each call starts fresh. Agent has no memory of previous calls with the same user.  
**Add:** Store caller identity (phone number or cookie) + call summary in DB.

On new call: retrieve last 3 call summaries → inject into system prompt.

```
"Previous calls with this user:
- Jan 15: Asked about order #1001, was resolved.  
- Feb 3: Complained about delivery delay, escalated to human."
```

Agent says "Welcome back! Last time we spoke about your order..." — feels personal.

### 5.5 Scheduled Knowledge Base Sync

**Current:** Google Sheets sync exists but must be triggered manually.  
**Add:** Background task (APScheduler or Celery) that re-syncs each dynamic KB on its configured interval.

When price list or inventory changes, the agent automatically knows within minutes — no human intervention needed.

```python
from apscheduler.schedulers.asyncio import AsyncIOScheduler
scheduler = AsyncIOScheduler()
scheduler.add_job(sync_all_dynamic_kbs, 'interval', minutes=15)
```

### 5.6 Whisper Mode (Agent Coaching)

A mode where a human supervisor can type hints to the AI mid-call that the caller cannot hear:
```
Supervisor types: "This is a VIP customer, offer 20% discount"
Agent adjusts response: "As a valued customer, I'd like to offer you..."
```

Hidden WebSocket channel from supervisor dashboard → injected as system context update mid-call.

### 5.7 Multi-Agent Handoff (Agent Specialisation)

Instead of one agent handling everything, define a pipeline of specialists:
- **Front Desk Agent:** Greets, identifies intent
- **Order Agent:** Handles all order questions (has order DB access)
- **Technical Agent:** Handles product support
- **Billing Agent:** Handles payment issues

When Front Desk detects intent = "billing issue", it seamlessly transfers the call to the Billing Agent (different system prompt, different KB, possibly different voice).

The caller doesn't hear a gap — just a brief "Let me connect you to our billing specialist."

---

## 6. Monetisation & Pricing Strategy

### 6.1 Tiered SaaS Pricing

| Plan | Price | Limits | Features |
|------|-------|--------|---------|
| **Starter** | ₹999/mo | 1 agent, 100 calls/mo, 1 KB | Basic voice, widget embed |
| **Growth** | ₹2,999/mo | 5 agents, 500 calls/mo, 5 KB | Analytics, call history, multi-language |
| **Business** | ₹7,999/mo | 20 agents, 2,000 calls/mo, unlimited KB | Human handoff, webhooks, outbound |
| **Enterprise** | Custom | Unlimited | Voice cloning, custom domain, SLA, dedicated support |

### 6.2 Usage-Based Overage

Beyond the included calls:
- ₹4 per additional call minute (Gemini costs ~₹1.50/min, margin 2.5x)

### 6.3 One-Time Setup Fee

₹5,000–₹15,000 for agent configuration, knowledge base setup, and widget installation — especially for non-technical clients.

### 6.4 White-Label Reseller Program

Let agencies buy white-label access and resell to their clients under their own brand. Agency pays ₹9,999/mo, resells to 10 clients at ₹1,999/mo each = ₹10,000 profit.

### 6.5 Vertical-Specific Templates

Pre-built agent templates for:
- E-commerce order support
- Real estate lead qualification
- Healthcare appointment booking
- Restaurant reservations
- Bank account FAQs
- Ed-tech course enquiries

Charge ₹499 per template. Clients skip the system prompt writing — they just fill in their company name.

---

## 7. Industries to Target

### Tier 1 (Immediate Revenue, High Pain, Easy Sell)

| Industry | Pain Point | Use Case |
|----------|-----------|---------|
| **E-commerce** | 60% of support is "where is my order?" | Order tracking agent |
| **Restaurants** | Missed calls = missed bookings | Reservation + menu queries |
| **Real Estate** | Agents cannot answer every enquiry 24/7 | Lead qualification + property info |
| **Clinics / Hospitals** | Reception overloaded | Appointment booking + FAQ |

### Tier 2 (Medium Term)

| Industry | Use Case |
|----------|---------|
| **Ed-tech / Coaching** | Course enquiries, fee, schedule |
| **Insurance** | Policy FAQ, claim status |
| **Automobile** | Service center booking, parts availability |
| **Banking / NBFCs** | Loan status, EMI queries, balance |

### Tier 3 (Enterprise, High Value)

| Industry | Use Case |
|----------|---------|
| **Telecom** | Plan changes, data usage, bill disputes |
| **Retail chains** | Product availability across stores |
| **Logistics / Courier** | Shipment tracking at scale |

---

## 8. Competitive Differentiation Summary

| Feature | VoiceForge AI | Intercom | Drift | Tidio | Custom Dev |
|---------|-------------|---------|-------|-------|-----------|
| Real-time voice (no PTT) | ✅ | ❌ | ❌ | ❌ | Months |
| Regional Indian languages | ✅ (if built) | ❌ | ❌ | ❌ | Months |
| Agent speaks first | ✅ | ❌ | ❌ | ❌ | Custom |
| Knowledge base RAG | ✅ | ✅ (basic) | ✅ (basic) | ✅ | Custom |
| Multi-agent routing | ✅ | ❌ | ❌ | ❌ | Expensive |
| Embed on any website | ✅ | ✅ | ✅ | ✅ | Custom |
| Voice interruption | ✅ | ❌ | ❌ | ❌ | Hard |
| Price (India SMB) | ₹999/mo | $74/mo | $400/mo | $19/mo | ₹50L+ |
| Setup time | Minutes | Days | Weeks | Hours | Months |

**Your killer combination:** Real-time native voice + regional languages + knowledge base + easy embed + India pricing.

No tool in the Indian market does all of this. Intercom and Drift are priced out of SMB reach. Custom development is months away. You can own this space.

---

## 9. Priority Implementation Order

### Phase 1 — Fix & Stabilise (Do This Week)

1. **Activate Enhanced RAG** — uncomment `enhanced_rag.py` and route `embeddings.py` calls through it. Hybrid search + MMR dramatically improves answer quality.
2. **Pre-inject KB context into voice calls** — take top 10 KB chunks from RAG and add to system instruction at call start. This alone makes voice agents actually useful.
3. **Save call transcripts to DB** — add `call_sessions` table, insert rows from `onTranscription` events via an API endpoint called from the widget.
4. **Rate-limit `/api/gemini-key`** — add `slowapi` limiter + Origin check.

### Phase 2 — Core Product Value (This Month)

5. **Multi-language voice** — add `language_mode` field to Agent model + dynamic system prompt generation. Implementation: 1 day.
6. **Call history UI** — new dashboard tab showing transcript + metadata per call. 3 days.
7. **Basic call analytics** — call count chart, sentiment distribution, average duration. 2 days.
8. **Scheduled KB sync** — APScheduler for dynamic knowledge bases. 1 day.
9. **Activate multi-agent for voice** — run intent/sentiment/escalation detection on the transcript after each turn complete, emit results via websocket to dashboard.
10. **Persona builder UI** — tone/pace/empathy sliders that generate system prompt additions. 2 days.

### Phase 3 — Sell at Scale (Next Quarter)

11. **Human handoff WebSocket** — live call takeover from operations dashboard.
12. **Post-call intelligence** — auto-summarise transcript, extract action items, send webhooks.
13. **Billing integration** — Razorpay subscription + usage metering + quota enforcement.
14. **Outbound calling** — Exotel/Twilio + Gemini Live for proactive calls.
15. **Vector database** — migrate embeddings from PostgreSQL JSON columns to pgvector or Qdrant for 100x faster search at scale.
16. **Voice cloning** — ElevenLabs API integration as a premium tier feature.
17. **White-label** — custom branding, custom domain per company, remove VoiceForge branding.

### Phase 4 — Market Leadership

18. **Call flow builder** — visual no-code conversation flow editor.
19. **Multi-agent handoff** — specialist agents per intent.
20. **CRM integrations** — Zoho CRM, HubSpot, Salesforce, Freshdesk connectors.
21. **Mobile SDK** — React Native + Flutter widgets.
22. **Analytics API** — let clients pull call data into their own BI tools.
23. **Whisper mode** — live supervisor coaching during calls.

---

## Quick Reference — Technical Debt to Clear

| File | Issue | Fix |
|------|-------|-----|
| `enhanced_rag.py` | Entirely commented out | Uncomment + wire in |
| `embeddings.py` | Full table scan for search | Migrate to pgvector |
| `voice_call.py` | Old WS handler is dead code | Delete or repurpose |
| `gemini_service.py` | Most logic commented out | Clean up file, keep only active parts |
| `multi_agent.py` | Only used for text, not voice | Wire to post-turn analysis |
| `liveAudioService.js` | No KB context in voice | Fetch context before _sendSetup |
| `database.py` | SQLite in production | Environment-aware DB URL (done) |
| `main.py` | CORS allows localhost only | Environment-driven origins (done) |

---

*VoiceForge AI — Product Roadmap prepared March 2026*
