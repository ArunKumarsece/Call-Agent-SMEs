# 🚀 Complete Deployment Guide - All-in-One

Your AI Voice Agent Platform is ready to deploy on **FREE tier infrastructure** ($0/month forever).

**Total time: 35-60 minutes depending on detail needed**

---

## 📍 Quick Navigation

| Need | Jump To |
|------|---------|
| **Deploy in 30 min** | [⚡ Fast Deployment](#-fast-deployment-30-minutes) |
| **Detailed walkthrough** | [📖 Complete Setup](#-complete-setup-60-minutes) |
| **Embed widget** | [🎯 Widget Integration](#-widget-integration) |
| **Optimize vector DB** | [📊 Vector Database](#-vector-database-rag) |
| **Troubleshoot issues** | [🔧 Troubleshooting](#-troubleshooting) |

---

# ⚡ Fast Deployment (30 Minutes)

**For people who want to deploy RIGHT NOW.**

## Step 1: Get API Key (2 min)

1. Go to [Google AI Studio](https://aistudio.google.com/app/apikeys)
2. Click "Create API Key"
3. Copy the key
4. Save it safely

## Step 2: Prepare GitHub (2 min)

Push your code to GitHub if not already there, including the built widget:

```bash
# Build the widget for production (IMPORTANT!)
cd frontend
npm run build:widget

# Then commit everything
cd ..
git add .
git commit -m "Production deployment ready - widget built"
git push origin main
```

**Why build the widget first?** The backend serves it from `static/widget/agent-widget.js`. If you don't build it, the widget won't be available on deployed sites.

## Step 3: Deploy Backend on Render (10 min)

1. **Create account** at [render.com](https://render.com) (free)
2. **Click "New"** → **"Web Service"**
3. **Connect GitHub**:
   - Authorize Render
   - Select your repository
   - Branch: `main`
4. **Configure service**:
   - Name: `anti-gravity-api`
   - Runtime: `Docker`
   - Plan: **Free** ✅
5. **Set Environment Variables**:
   ```
   GEMINI_API_KEY=<your-key-from-step-1>
   DATABASE_PATH=/var/data/agents.db
   CHROMA_PERSIST_DIR=/var/data/chroma_db
   ALLOWED_ORIGINS=https://<your-vercel-url>.vercel.app
   ```
6. **Click "Create Web Service"**
7. **Wait 5-10 min** for deployment

Once deployed, copy the URL (e.g., `https://anti-gravity-api.onrender.com`)

## Step 4: Deploy Frontend on Vercel (10 min)

1. **Create account** at [vercel.com](https://vercel.com) (free)
2. **Click "New Project"**
3. **Import GitHub repo**
4. **Select `frontend` folder as root**
5. **Set Environment Variables**:
   ```
   VITE_API_BASE_URL=https://anti-gravity-api.onrender.com
   ```
6. **Click "Deploy"**
7. **Wait 2-3 min** for deployment

You'll get a URL like `https://xxx.vercel.app`

## Step 5: Connect Them (2 min)

1. Go back to **Render dashboard**
2. Update `ALLOWED_ORIGINS` with your Vercel URL:
   ```
   https://xxx.vercel.app
   ```
3. **Redeploy** Render backend (click the menu → "Redeploy")

## Step 6: Test (5 min)

1. **Open your Vercel URL**
2. **Sign Up** with email/password
3. **Create an Agent**
4. **Test voice call** (click the 🎤 icon)
5. **Success!** 🎉

---

# 📖 Complete Setup (60 Minutes)

**For people who want to understand what they're doing.**

## Architecture Overview

```
┌─────────────────────────────────────────────┐
│ Your Website (WordPress, Shopify, etc)      │
│ ┌──────────────────────────────────────┐    │
│ │ Agent Widget (JavaScript IIFE)       │    │
│ │ - Zero dependencies                  │    │
│ │ - 30KB minified                      │    │
│ └──────────────────────────────────────┘    │
└─────────────────────────────────────────────┘
                        ↓
           ┌────────────────────────┐
           │ Agent Web App (Vercel) │
           │ - React + Vite         │
           │ - Global CDN           │
           │ - Auto-deploying       │
           └────────────────────────┘
                        ↓
           ┌────────────────────────┐
           │ Backend API (Render)   │
           │ - FastAPI              │
           │ - 0.5 CPU, 512MB RAM   │
           │ - Persistent Disk 1GB  │
           └────────────────────────┘
                        ↓
          ┌──────────────┴──────────────┐
          ↓                             ↓
    ┌────────────┐            ┌─────────────────┐
    │ SQLite DB  │            │ ChromaDB Vector │
    │ (Agents)   │            │ Store (RAG)     │
    └────────────┘            └─────────────────┘
```

## Why This Stack?

| Component | Why | Cost |
|-----------|-----|------|
| **Render** | Easiest Docker deployment, persistent disk | $0/mo |
| **Vercel** | Global CDN, static files, auto-deploy | $0/mo |
| **Gemini API** | Best voice API, free tier includes Live API | $0/mo |
| **SQLite** | Zero setup, works with persistent disk | $0/mo |
| **ChromaDB** | Fast vector search (HNSW indexing), O(log n) | $0/mo |

**Total: $0/month forever!**

## What Gets Deployed

### Backend Code (`/backend`)
- `main.py` - FastAPI server with all routes
- `models.py` - SQLAlchemy models (Agent, Call, etc)
- `database.py` - Database initialization
- `routers/` - API endpoints
- `services/` - Business logic (RAG, audio, auth)

### Frontend Code (`/frontend`)
- React components
- Vite bundler
- Connects to backend API

### Widget Code (`/frontend/src/widget-entry.js`)
- Standalone JavaScript module
- Builds to `/backend/static/widget/agent-widget.js`
- Embeds on any website
- Auto-exported from backend

### Database
- SQLite file on persistent disk: `/var/data/agents.db`
- ChromaDB vector store: `/var/data/chroma_db`

## Detailed Deployment Steps

### 1. Create Accounts (5 min)

**Render.com**
- Go to https://render.com
- Sign up (free tier)
- Verify email

**Vercel.com**
- Go to https://vercel.com
- Sign up (free tier)
- Authorize with GitHub

**Google AI Studio**
- Go to https://aistudio.google.com/app/apikeys
- Create API key
- Copy and save safely

### 2. Deploy Backend (15 min)

**On Render:**

1. Dashboard → **"New"** → **"Web Service"**
2. **Connect GitHub**:
   - Click "Connect GitHub"
   - Authorize Render
   - Find your repo
   - Select it
3. **Configure**:
   - **Name**: `anti-gravity-api`
   - **Region**: Your region
   - **Branch**: `main`
   - **Build Command**: (leave blank - Docker)
   - **Start Command**: (leave blank - Docker)
   - **Instance Type**: **Free** ✅
4. **Environment Variables**:
   
   Click "Add Secret File" and add:
   ```
   GEMINI_API_KEY=sk-xxx...
   DATABASE_PATH=/var/data/agents.db
   CHROMA_PERSIST_DIR=/var/data/chroma_db
   RAG_BACKEND=chroma
   ALLOWED_ORIGINS=*
   ```

5. **Advanced Settings**:
   - Keep health check enabled
   - Keep auto-deploy on git push enabled

6. **Click "Create Web Service"**

7. **Wait for deployment** (5-10 min)
   - You'll see logs streaming
   - Wait for "Build Succeeded"
   - Service should be "Live" (green)

8. **Copy the URL**:
   - Example: `https://anti-gravity-api.onrender.com`

### 3. Deploy Frontend (10 min)

**On Vercel:**

1. Dashboard → **"Add New..."** → **"Project"**
2. **Import Git Repository**:
   - Select your repo
   - Click "Import"
3. **Configure Project**:
   - **Root Directory**: `frontend`
   - **Framework**: `Vite`
4. **Environment Variables**:
   
   Add:
   ```
   VITE_API_BASE_URL=https://anti-gravity-api.onrender.com
   ```

5. **Click "Deploy"**
6. **Wait for deployment** (2-5 min)
   - Check the "Deployments" tab
   - Wait for "Completed"
7. **Copy the URL**:
   - Example: `https://anti-gravity-...-xxx.vercel.app`

### 4. Update Allowed Origins (2 min)

Go back to **Render Dashboard**:

1. Click your service
2. Click **"Environment"** (or **"Settings"** → **"Environment"**)
3. Update `ALLOWED_ORIGINS`:
   ```
   https://anti-gravity-...-xxx.vercel.app
   ```
4. Click **"Save"**
5. Service will auto-redeploy (takes 1-2 min)

### 5. Test Deployment (5 min)

1. **Open Vercel URL** in browser
2. **Sign up** with email
3. **Create an Agent** (give it a name)
4. **Click the 🎤 button** to test voice call
5. **Should hear Gemini AI respond!** ✅

If something's broken, see [🔧 Troubleshooting](#-troubleshooting).

---

# 🎯 Widget Integration

**This is your CORE business offering.** The widget is what you sell/embed on client websites.

### What is the Widget?

A **standalone JavaScript module** you can embed on ANY website:
- Zero dependencies (~30KB minified after production build)
- Self-contained IIFE format (Immediately Invoked Function Expression)
- Works on WordPress, Shopify, static sites, React apps, Angular, anywhere
- Auto-generated from your `/frontend/src/widget-entry.js` source

### Widget Features (Production-Ready)

✅ **Live Voice Calls**
- Real-time bidirectional audio via Google Gemini Live API
- WebSocket connection to backend
- Automatic speech recognition (hears user)
- Text-to-speech responses (agent speaks back)
- Live transcription (chat shows both sides in real-time)

✅ **Text Chat Fallback**
- Type messages if microphone unavailable  
- Automatic fallback to REST API if WebSocket fails
- Graceful degradation (always works somehow)

✅ **Knowledge Base Integration**
- Agent automatically uses your uploaded KB
- RAG (Retrieval-Augmented Generation) answers come from YOUR data
- Prevents hallucination about your business

✅ **Security**
- **Zero API keys exposed** in widget code (all server-side)
- **CORS-enabled** for any cross-origin embed
- **Rate limiting** prevents abuse
- **Prompt injection detection** built-in
- **Company-scoped** — each company sees only their agents

### Where is the Widget Built?

**Source**: `/frontend/src/widget-entry.js`
**Build Config**: `/frontend/vite.widget.config.js`
**Output**: `/backend/static/widget/agent-widget.js` (auto-served by backend)

### Widget Build Process (Production-Optimized)

When you deploy, the widget is:
1. ✅ **Minified** (terser) — removes all console logs, comments
2. ✅ **Inlined** — all assets bundled into one file
3. ✅ **Optimized** — IIFE format, no dependencies
4. ✅ **Sourcemapped** — hidden source maps for debugging (not in final bundle)

**Result**: One tiny `agent-widget.js` file that loads fast everywhere.

### How to Build Widget for Production

```bash
# In /frontend directory
npm run build:widget
```

This outputs: `/backend/static/widget/agent-widget.js` (production-ready)

### Where is the Widget Served?

After backend deployment, widget is automatically available at:
```
https://your-api.onrender.com/static/widget/agent-widget.js
```

### How Do Clients Use It?

Clients add **3 lines of code** to their website:

```html
<script>
  window.AgentWidgetConfig = {
    agentId: "their-agent-id",
    serverUrl: "https://your-api.onrender.com"
  };
</script>
<script src="https://your-api.onrender.com/static/widget/agent-widget.js" async></script>
```

**That's it.** Floating 🎤 button appears on their site. They can embed on unlimited sites.

### How Do You Generate SDK Code?

There's an API endpoint that auto-generates embedment code:

**Endpoint**: `GET /api/agents/{agent_id}/sdk`

**Response**:
```json
{
  "agent_id": "uuid",
  "agent_name": "My Agent",
  "html_snippet": "<script>window.AgentWidgetConfig={...}</script>...",
  "js_config": "window.AgentWidgetConfig = {...};",
  "instructions": "# Integration Guide\n..."
}
```

**Used by**: Dashboard → Agent detail page → Copy/paste embed code

### Example Embedding Scenarios

**WordPress Blog**
```html
<!-- Paste in theme footer before </body> -->
<script>
  window.AgentWidgetConfig = {
    agentId: "abc-123",
    serverUrl: "https://api.example.com"
  };
</script>
<script src="https://api.example.com/static/widget/agent-widget.js" async></script>
```

**Shopify Store**
```html
<!-- Add to product page custom code -->
<script>
  window.AgentWidgetConfig = {
    agentId: "xyz-456",
    serverUrl: "https://api.example.com",
    theme: "light"
  };
</script>
<script src="https://api.example.com/static/widget/agent-widget.js" async></script>
```

**React App**
```jsx
useEffect(() => {
  window.AgentWidgetConfig = {
    agentId: "agent-id",
    serverUrl: "https://api.example.com"
  };
  
  const script = document.createElement('script');
  script.src = "https://api.example.com/static/widget/agent-widget.js";
  script.async = true;
  document.body.appendChild(script);
}, []);
```

### Widget Configuration Options

All optional except `agentId` and `serverUrl`:

```javascript
window.AgentWidgetConfig = {
  // REQUIRED
  agentId: "your-agent-id",
  serverUrl: "https://api.onrender.com",
  
  // OPTIONAL: Visual
  theme: "dark",                    // "dark" or "light"
  position: "bottom-right",         // "bottom-right" or "bottom-left"
  primaryColor: "#6366f1",          // Custom accent (hex)
  secondaryColor: "#ffffff",
  
  // OPTIONAL: Text & Behavior
  title: "My Assistant",            // Widget header
  subtitle: "Ask me anything",      // Subtitle text
  showLabel: true,                  // Show floating label
  autoExpand: false,                // Auto-open on load
  allowChatFallback: true           // Enable text chat fallback
};
```

### Testing Widget Locally

1. Start backend locally: `python main.py` in `/backend`
2. Create `test-widget.html`:

```html
<!DOCTYPE html>
<html>
<head>
    <title>Widget Test</title>
</head>
<body>
    <h1>Test Page</h1>
    
    <script>
        window.AgentWidgetConfig = {
            agentId: "your-agent-id",
            serverUrl: "http://localhost:8000"
        };
    </script>
    <script src="http://localhost:8000/static/widget/agent-widget.js"></script>
</body>
</html>
```

3. Open in browser
4. Should see floating 🎤 button in bottom-right
5. Click to test voice/chat

### Widget CORS & Security (It's Handled)

The backend automatically sets these headers for widget routes:
```
Access-Control-Allow-Origin: *
Access-Control-Allow-Methods: GET, POST, OPTIONS
Access-Control-Allow-Headers: *
```

**Why?** Because widgets need to work on ANY external website.

**Security?** ✅ No API keys exposed, rate limiting enabled, auth all server-side.

---

# 📊 Vector Database (RAG)

### What is RAG?

**RAG = Retrieval-Augmented Generation**

Instead of just using Gemini's training data, RAG:
1. **Store** your knowledge base as vectors (embeddings)
2. **Search** for relevant context from KB
3. **Feed** that context to Gemini
4. **Get answers** based on YOUR knowledge

### Example

```
User: "How do I reset my password?"

Without KB:
- Gemini: "Typically you click 'Forgot Password'..." (generic)

With KB (RAG):
- Search KB for "password reset"
- Find: "Click Settings → Security → Reset Password"
- Feed to Gemini with context
- Gemini: "Click Settings → Security → Reset Password" (specific to you!)
```

### Vector Database Details

**ChromaDB Configuration:**
- **Storage**: `/var/data/chroma_db` (persistent disk)
- **Indexing**: HNSW (Hierarchical Navigable Small World)
- **Search Speed**: O(log n) = fast!
- **Max Capacity**: 1M+ vectors

**Performance:**
- 2.5K vectors: <5ms search
- 250K vectors: <20ms search
- 2.5M vectors: <100ms search

### How to Use KB with Agents

1. **Deploy** (follow fast or complete setup above)
2. **In dashboard**:
   - Click agent
   - Go to "Knowledge Base" tab
   - Upload documents (PDF, TXT, DOCX)
   - Or paste website URLs
   - Or YouTube URLs
3. **System automatically**:
   - Splits into chunks
   - Creates embeddings
   - Stores in ChromaDB
4. **When user calls**:
   - Agent searches KB for context
   - Sends context + user question to Gemini
   - Gemini responds with KB knowledge

### Tuning RAG Performance

**In Render Environment Variables:**

```
RAG_BACKEND=chroma              # Use ChromaDB (best)
RAG_TOP_K=5                     # Return top 5 results
RAG_SIMILARITY_THRESHOLD=0.5    # Only relevance > 0.5
CHUNK_SIZE=1000                 # Split KB into 1000-char chunks
CHUNK_OVERLAP=200               # Overlap chunks for context
```

**To tune**:
- Fewer results but more accurate: `RAG_TOP_K=3`
- More results but less accurate: `RAG_TOP_K=10`
- Only very relevant: `RAG_SIMILARITY_THRESHOLD=0.7`
- Smaller chunks, more precise: `CHUNK_SIZE=500`

### Monitoring Vector DB

**Check logs in Render**:
```
Click service → "Logs" tab
Search for "ChromaDB" or "embedding" to see indexing
```

**Check storage** (if you have access):
```bash
# Would show ChromaDB size
du -sh /var/data/chroma_db
```

---

# 🔧 Troubleshooting

## Frontend Won't Load

**Symptom**: Vercel URL shows error or blank page

**Fix**:
1. Check Vercel build logs:
   - Dashboard → "Deployments"
   - Click latest
   - See if build succeeded
2. Check environment variable:
   - `VITE_API_BASE_URL` set to Render URL?
   - Try redeploy: Dashboard → "Redeploy"

## Backend Returns 503 Error

**Symptom**: API calls fail with 503

**Fix**:
1. Check Render service status:
   - Dashboard → Your service
   - Is it "Live" (green)?
2. If not live, check logs:
   - Click "Logs"
   - See error message
3. Common issues:
   - API key missing → Add `GEMINI_API_KEY`
   - Memory exceeded → Restart service
   - Need to rebuild → Click "Manual Deploy"

## Widget Not Appearing

**Symptom**: No floating 🎤 button on website

**Fix**:
1. Check browser console (F12 → Console)
2. Look for errors
3. Common issues:
   - `agentId` wrong → Copy from dashboard
   - `serverUrl` wrong → Use full URL (https://...)
   - CORS issue → Update `ALLOWED_ORIGINS` in Render

## Voice Call Not Working

**Symptom**: Click 🎤 but no audio

**Fix**:
1. Check microphone permissions (browser should ask)
2. Check browser console for errors
3. Test with text chat first (should work)
4. If text works but voice doesn't:
   - Check `GEMINI_API_KEY` is valid
   - Check Render logs for errors
   - Try restarting Render service

## Knowledge Base Not Finding Answers

**Symptom**: Create KB but agent doesn't use it

**Fix**:
1. Check KB uploaded successfully:
   - Dashboard → Agent → "Knowledge Base" tab
   - See files listed?
2. Wait for indexing (should be <1 min)
3. Check RAG settings:
   - In Render env vars
   - `RAG_BACKEND=chroma`?
4. Test manually:
   - Dashboard → "Test RAG" button
   - Enter question
   - Should show results

---

# ✅ Final Checklist

Before you're done:

- [ ] **Widget built** for production: `npm run build:widget`
- [ ] **Code committed** to GitHub (including built widget)
- [ ] **Render Account** created and verified
- [ ] **Vercel Account** created and GitHub authorized
- [ ] **Gemini API Key** created and copied
- [ ] **Backend deployed** to Render (URL copied)
- [ ] **Frontend deployed** to Vercel (URL copied)
- [ ] **ALLOWED_ORIGINS** updated in Render (Vercel URL)
- [ ] **Frontend loads** without errors
- [ ] **Can sign up** on frontend
- [ ] **Can create agent** in dashboard
- [ ] **Can test voice call** (🎤 button works)
- [ ] **Widget SDK endpoint** works: `GET /api/agents/{id}/sdk`
- [ ] **Widget embeds** on test HTML page
- [ ] **Widget performs voice** on external page
- [ ] **Can copy/paste embed code** from dashboard
- [ ] **Can upload KB** documents
- [ ] **RAG search works** (test in dashboard)

**All checked?** You're live! 🎉 Your widget is ready to embed on client websites.

---

# 💰 Cost Breakdown

| Service | Free Tier | Cost |
|---------|-----------|------|
| Render (Backend) | 0.5 CPU, 512MB RAM, 1GB disk | **$0/month** |
| Vercel (Frontend) | Global CDN, auto-deploy | **$0/month** |
| Gemini API | 300M tokens free/month | **$0/month** |
| Database | SQLite on persistent disk | **$0/month** |
| Vector DB | ChromaDB on persistent disk | **$0/month** |
| **TOTAL** | | **$0/month** |

**You can run the entire platform for FREE forever!**

Even at scale:
- 1 million database records: Still free (no tier limits)
- 1GB vector store: Still free (within disk limit)
- 10K API calls/month: Still free

---

# 🚀 Next Steps

1. **If deploying**: Follow [⚡ Fast Deployment](#-fast-deployment-30-minutes)
2. **If learning first**: Read sections above
3. **If embedding widget**: Jump to [🎯 Widget Integration](#-widget-integration)
4. **If optimizing KB**: Jump to [📊 Vector Database](#-vector-database-rag)

---

# 📞 Quick Reference

**Backend URL**: https://anti-gravity-api.onrender.com (example)

**Frontend URL**: https://anti-gravity-xxx.vercel.app (example)

**Widget URL**: `{backend-url}/static/widget/agent-widget.js`

**API Docs**: `{backend-url}/docs` (auto-generated by FastAPI)

**Admin Dashboard**: `{frontend-url}` (sign up to access)

---

**Done! 🎉 Your app is live and deployable.** Go to [⚡ Fast Deployment](#-fast-deployment-30-minutes) to start!
