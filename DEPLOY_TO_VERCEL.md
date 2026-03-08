# 🚀 Deploy AI Voice Agent to Vercel

This app has **2 parts** — both need to be deployed:

| Part | Tech | What it does |
|------|------|-------------|
| **Backend (API)** | Python FastAPI | Serves agents, knowledge base, widget, API key |
| **Frontend (Dashboard)** | React + Vite | Admin dashboard to manage agents |

---

## Step 1: Prepare the Backend for Vercel

Vercel supports Python via **Serverless Functions**. You need to restructure slightly.

### 1.1 Create `vercel.json` in the **project root** (`anti_gravity_call/`)

```json
{
  "version": 2,
  "builds": [
    {
      "src": "backend/main.py",
      "use": "@vercel/python"
    },
    {
      "src": "frontend/dist/**",
      "use": "@vercel/static"
    },
    {
      "src": "backend/static/**",
      "use": "@vercel/static"
    }
  ],
  "routes": [
    { "src": "/api/(.*)", "dest": "backend/main.py" },
    { "src": "/test-widget", "dest": "backend/main.py" },
    { "src": "/static/(.*)", "dest": "backend/static/$1" },
    { "src": "/(.*)", "dest": "frontend/dist/$1" }
  ]
}
```

### 1.2 Create `backend/api/index.py` (Vercel serverless entry point)

Create a file at `backend/api/index.py`:

```python
"""Vercel serverless function entry point."""
import sys
import os

# Add backend dir to path so imports work
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from main import app

# Vercel expects a handler — FastAPI's ASGI app works directly
handler = app
```

### 1.3 Alternative: Simpler `vercel.json` (API-only approach)

If you want to deploy **backend only** (widget works standalone via `<script>` tag):

```json
{
  "version": 2,
  "builds": [
    {
      "src": "backend/api/index.py",
      "use": "@vercel/python",
      "config": {
        "maxLambdaSize": "50mb"
      }
    },
    {
      "src": "backend/static/**",
      "use": "@vercel/static"
    }
  ],
  "routes": [
    { "src": "/static/(.*)", "dest": "backend/static/$1" },
    { "src": "/(.*)", "dest": "backend/api/index.py" }
  ]
}
```

---

## Step 2: Handle the Database

> ⚠️ **Vercel serverless functions are stateless** — SQLite (`agents.db`) won't persist between requests.

### Options:

| Option | Effort | Recommendation |
|--------|--------|---------------|
| **Turso** (SQLite on the edge) | Low | ✅ Best drop-in replacement |
| **Supabase** (Postgres) | Medium | Great free tier |
| **PlanetScale** (MySQL) | Medium | Good for scaling |
| **Keep SQLite** (read-only) | Lowest | Only if agents don't change often |

### Quick fix — Use Turso (stays SQLite-compatible):

1. Go to [turso.tech](https://turso.tech) → Create a database
2. Get the URL and auth token
3. Add to Vercel env vars: `TURSO_DATABASE_URL`, `TURSO_AUTH_TOKEN`
4. Update `database.py` to use `libsql` instead of `sqlite`

**OR — Simplest approach**: Export your `agents.db` and commit it to the repo. It will be read-only but your existing agents will work.

---

## Step 3: Set Environment Variables on Vercel

Go to **Vercel Dashboard → Your Project → Settings → Environment Variables** and add:

```
GEMINI_API_KEY=your-actual-gemini-api-key
```

> ⚠️ **IMPORTANT**: The `/api/config/gemini-key` endpoint exposes your API key to the widget. For production, add rate limiting or restrict CORS origins.

---

## Step 4: Build the Frontend

Before deploying, build the React dashboard:

```bash
cd frontend
npm install
npm run build
```

This creates `frontend/dist/` with the production build.

---

## Step 5: Deploy to Vercel

### Option A: Via Vercel CLI (Recommended)

```bash
# Install Vercel CLI
npm i -g vercel

# From the project root (anti_gravity_call/)
cd anti_gravity_call
vercel

# Follow the prompts:
# - Link to existing project? → No
# - Project name? → ai-voice-agent (or whatever you want)
# - Root directory? → ./
# - Override settings? → No

# Deploy to production
vercel --prod
```

### Option B: Via GitHub (Auto-deploy)

1. Push your code to a **GitHub repo**
2. Go to [vercel.com](https://vercel.com) → **New Project**
3. Import your GitHub repo
4. Set **Root Directory** → `./` (the whole repo)
5. Set **Environment Variables** → `GEMINI_API_KEY`
6. Click **Deploy**

---

## Step 6: Update the Widget URL

After deployment, your backend will be at something like:
```
https://your-app.vercel.app
```

Update your `sample.html` (or any site using the widget):

```html
<script>
  window.AgentWidgetConfig = {
    agentId: "your-agent-id",
    serverUrl: "https://your-app.vercel.app",  // ← Change this
    theme: "dark",
    position: "bottom-right",
    title: "AI Assistant",
    primaryColor: "#6C63FF"
  };
</script>
<script src="https://your-app.vercel.app/static/widget/agent-widget.js"></script>
```

---

## File Structure for Deployment

```
anti_gravity_call/
├── vercel.json              ← NEW (routing config)
├── backend/
│   ├── api/
│   │   └── index.py         ← NEW (serverless entry)
│   ├── main.py
│   ├── requirements.txt
│   ├── database.py
│   ├── models.py
│   ├── schemas.py
│   ├── routers/
│   ├── services/
│   ├── static/
│   │   └── widget/
│   │       └── agent-widget.js
│   └── agents.db            ← Commit this for read-only data
├── frontend/
│   ├── dist/                ← Built React app (run npm run build)
│   ├── package.json
│   └── src/
└── widget/
    └── sample.html
```

---

## Quick Checklist

- [ ] Create `vercel.json` in project root
- [ ] Create `backend/api/index.py`
- [ ] Run `cd frontend && npm run build` to generate `dist/`
- [ ] Commit `agents.db` to repo (for existing agent data)
- [ ] Push to GitHub
- [ ] Import in Vercel → Set `GEMINI_API_KEY` env var
- [ ] Deploy → Update widget `serverUrl` to your Vercel URL
- [ ] Test: `https://your-app.vercel.app/api/health`

---

## ⚠️ Known Limitations on Vercel

1. **No WebSocket support** — Vercel serverless doesn't support persistent WebSocket connections. But your widget connects to **Google's WebSocket directly** (not your backend), so this is fine! ✅
2. **SQLite is read-only** — Use Turso/Supabase for persistent writes
3. **Cold starts** — First request may take 1-2s (serverless spin-up)
4. **File uploads** — `uploads/` directory won't persist. Use Vercel Blob or S3 for file storage
