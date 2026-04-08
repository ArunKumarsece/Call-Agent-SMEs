# # """FastAPI application entry point."""

# # from fastapi import FastAPI
# # from fastapi.middleware.cors import CORSMiddleware
# # from fastapi.staticfiles import StaticFiles
# # from database import init_db
# # from routers import agents, knowledge_base, voice_call
# # from services.gemini_service import AVAILABLE_VOICES
# # import os
# # import asyncio

# # app = FastAPI(
# #     title="AI Voice Agent Platform",
# #     description="SaaS platform for creating AI-powered web call agents",
# #     version="1.0.0"
# # )

# # # ─── CORS ─────────────────────────────────────────────────
# # app.add_middleware(
# #     CORSMiddleware,
# #     allow_origins=["*"],
# #     allow_credentials=True,
# #     allow_methods=["*"],
# #     allow_headers=["*"],
# # )

# # # ─── Static Files (for widget) ───────────────────────────
# # STATIC_DIR = os.path.join(os.path.dirname(__file__), "static")
# # os.makedirs(os.path.join(STATIC_DIR, "widget"), exist_ok=True)
# # app.mount("/static", StaticFiles(directory=STATIC_DIR), name="static")

# # # ─── Uploads Directory ───────────────────────────────────
# # UPLOAD_DIR = os.path.join(os.path.dirname(__file__), "uploads")
# # os.makedirs(UPLOAD_DIR, exist_ok=True)

# # # ─── Include Routers ─────────────────────────────────────
# # app.include_router(agents.router)
# # app.include_router(knowledge_base.router)
# # app.include_router(voice_call.router)


# # # ─── Startup ─────────────────────────────────────────────
# # @app.on_event("startup")
# # async def startup_event():
# #     """Initialize database tables on startup."""
# #     init_db()
# #     print("✅ Database initialized")
# #     print("🚀 AI Voice Agent Platform is running!")


# # # ─── Root ─────────────────────────────────────────────────
# # @app.get("/")
# # async def root():
# #     return {
# #         "name": "AI Voice Agent Platform",
# #         "version": "1.0.0",
# #         "status": "running",
# #         "docs": "/docs"
# #     }


# # # ─── Available Voices ────────────────────────────────────
# # @app.get("/api/voices")
# # async def get_voices():
# #     """Get available Gemini TTS voices."""
# #     return {"voices": AVAILABLE_VOICES}


# # # ─── Health Check ────────────────────────────────────────
# # @app.get("/api/health")
# # async def health_check():
# #     return {"status": "healthy"}


# # if __name__ == "__main__":
# #     import uvicorn
# #     uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)


# """FastAPI application entry point."""

# from fastapi import FastAPI
# from fastapi.middleware.cors import CORSMiddleware
# from fastapi.staticfiles import StaticFiles
# from database import init_db
# from routers import agents, knowledge_base, voice_call
# from services.gemini_service import AVAILABLE_VOICES
# import os
# import asyncio

# app = FastAPI(
#     title="AI Voice Agent Platform",
#     description="SaaS platform for creating AI-powered web call agents",
#     version="1.0.0"
# )

# # ─── CORS ─────────────────────────────────────────────────
# app.add_middleware(
#     CORSMiddleware,
#     allow_origins=["*"],
#     allow_credentials=True,
#     allow_methods=["*"],
#     allow_headers=["*"],
# )

# # ─── Static Files (for widget) ───────────────────────────
# STATIC_DIR = os.path.join(os.path.dirname(__file__), "static")
# os.makedirs(os.path.join(STATIC_DIR, "widget"), exist_ok=True)
# app.mount("/static", StaticFiles(directory=STATIC_DIR), name="static")

# # ─── Uploads Directory ───────────────────────────────────
# UPLOAD_DIR = os.path.join(os.path.dirname(__file__), "uploads")
# os.makedirs(UPLOAD_DIR, exist_ok=True)

# # ─── Include Routers ─────────────────────────────────────
# app.include_router(agents.router)
# app.include_router(knowledge_base.router)
# app.include_router(voice_call.router)


# # ─── Startup ─────────────────────────────────────────────
# @app.on_event("startup")
# async def startup_event():
#     """Initialize database tables on startup."""
#     init_db()
#     print("✅ Database initialized")
#     print("🚀 AI Voice Agent Platform is running!")


# # ─── Root ─────────────────────────────────────────────────
# @app.get("/")
# async def root():
#     return {
#         "name": "AI Voice Agent Platform",
#         "version": "1.0.0",
#         "status": "running",
#         "docs": "/docs"
#     }


# # ─── Available Voices ────────────────────────────────────
# @app.get("/api/voices")
# async def get_voices():
#     """Get available Gemini TTS voices."""
#     return {"voices": AVAILABLE_VOICES}


# # ─── Health Check ────────────────────────────────────────
# @app.get("/api/health")
# async def health_check():
#     return {"status": "healthy"}


# # ─── Gemini Key (for browser Live API) ───────────────────
# @app.get("/api/gemini-key")
# async def get_gemini_key():
#     """Expose Gemini API key to the frontend for Live API WebSocket connection."""
#     return {"key": os.getenv("GEMINI_API_KEY", "")}


# if __name__ == "__main__":
#     import uvicorn
#     uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)

"""FastAPI application entry point."""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from database import init_db
from routers import agents, knowledge_base, voice_call
from routers.auth import router as auth_router
from routers.widget import router as widget_router
from routers.analytics import router as analytics_router
from routers.call_history import router as call_history_router
from routers.hospital import router as hospital_router
from services.gemini_service import AVAILABLE_VOICES
import os
import logging

# ─── Logging ──────────────────────────────────────────
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s [%(name)s] %(levelname)s: %(message)s',
)
logger = logging.getLogger(__name__)

app = FastAPI(
    title="AI Voice Agent Platform",
    description="SaaS platform for creating AI-powered web call agents",
    version="2.0.0",
)

# ─── CORS ─────────────────────────────────────────────────
# Get allowed origins from environment variable
# Default: localhost for development + Vercel production
# For production: set ALLOWED_ORIGINS env var (comma-separated)
DEFAULT_ORIGINS = [
    "http://localhost:5173",
    "http://localhost:3000",
    "http://localhost:4173",
    "https://call-agent-sm-l9au4nss7-phoneix496-8660s-projects.vercel.app",
]
allowed_origins_str = os.getenv("ALLOWED_ORIGINS", ",".join(DEFAULT_ORIGINS))
allowed_origins = [origin.strip() for origin in allowed_origins_str.split(",") if origin.strip()]

logger.info(f"CORS allowed origins: {allowed_origins}")

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Widget routes need Access-Control-Allow-Origin: * for external embeds.
# CORSMiddleware doesn't support per-route rules, so we add headers manually.
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request as StarletteRequest


class WidgetCORSMiddleware(BaseHTTPMiddleware):
    """Add permissive CORS headers for widget-specific PUBLIC endpoints only.
    
    Wildcard CORS (*) is only used for endpoints that don't require credentials.
    Protected endpoints with auth need specific origin CORS.
    """

    async def dispatch(self, request: StarletteRequest, call_next):
        path = request.url.path
        
        # WIDGET PUBLIC endpoints — these don't require auth, use wildcard CORS
        is_widget_public = (
            path.startswith("/api/widget/") or 
            path.startswith("/static/widget/") or
            path.startswith("/api/agents/public/") or  # PUBLIC agent endpoints only
            path == "/api/gemini-key" or
            path == "/api/sarvam-key" or
            path == "/api/deepgram-key"
        )

        if is_widget_public and request.method == "OPTIONS":
            from starlette.responses import Response
            return Response(status_code=200, headers={
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
                "Access-Control-Allow-Headers": "*",
                "Access-Control-Max-Age": "86400",
            })

        response = await call_next(request)

        if is_widget_public:
            response.headers["Access-Control-Allow-Origin"] = "*"
            response.headers["Access-Control-Allow-Methods"] = "GET, POST, OPTIONS"
            response.headers["Access-Control-Allow-Headers"] = "*"

        return response



app.add_middleware(WidgetCORSMiddleware)

# ─── Static & Uploads ─────────────────────────────────────
STATIC_DIR = os.path.join(os.path.dirname(__file__), "static")
os.makedirs(os.path.join(STATIC_DIR, "widget"), exist_ok=True)
app.mount("/static", StaticFiles(directory=STATIC_DIR), name="static")

UPLOAD_DIR = os.path.join(os.path.dirname(__file__), "uploads")
os.makedirs(UPLOAD_DIR, exist_ok=True)

# ─── Routers ──────────────────────────────────────────────
app.include_router(auth_router)
app.include_router(agents.router)
app.include_router(knowledge_base.router)
app.include_router(voice_call.router)
app.include_router(widget_router)
app.include_router(analytics_router)
app.include_router(call_history_router)
app.include_router(hospital_router)


# ─── Startup ──────────────────────────────────────────────
@app.on_event("startup")
async def startup_event():
    init_db()
    logger.info("✅ Database initialized")

    # Initialize ChromaDB client (if RAG_BACKEND=chroma)
    from services.rag_config import RAG_BACKEND, print_config
    print_config()
    if RAG_BACKEND == "chroma":
        try:
            from services.vector_store import get_chroma_client
            get_chroma_client()
        except Exception as e:
            logger.error(f"❌ ChromaDB init failed: {e}")
            raise

    logger.info("🚀 AI Voice Agent Platform v2 running!")


# ─── Public endpoints ─────────────────────────────────────

@app.get("/")
async def root():
    return {"name": "AI Voice Agent Platform", "version": "2.0.0", "status": "running"}


@app.get("/api/voices")
async def get_voices():
    return {"voices": AVAILABLE_VOICES}


@app.get("/api/health")
async def health_check():
    return {"status": "healthy"}


@app.get("/api/gemini-key")
async def get_gemini_key():
    """Expose Gemini API key to frontend for Live API WebSocket."""
    return {"key": os.getenv("GEMINI_API_KEY", "")}


@app.get("/api/sarvam-key")
async def get_sarvam_key():
    """Expose Sarvam API key to frontend for STT WebSocket."""
    key = os.getenv("SARVAM_API_KEY", "")
    if not key:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="Sarvam API key not configured")
    return {"key": key}


@app.get("/api/deepgram-key")
async def get_deepgram_key():
    """Expose Deepgram API key to frontend for STT WebSocket."""
    key = os.getenv("DEEPGRAM_API_KEY", "")
    if not key:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="Deepgram API key not configured")
    return {"key": key}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
