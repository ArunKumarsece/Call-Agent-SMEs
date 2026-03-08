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
from services.gemini_service import AVAILABLE_VOICES
import os

app = FastAPI(
    title="AI Voice Agent Platform",
    description="SaaS platform for creating AI-powered web call agents",
    version="2.0.0",
)

# ─── CORS ─────────────────────────────────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000", "http://localhost:4173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

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


# ─── Startup ──────────────────────────────────────────────
@app.on_event("startup")
async def startup_event():
    init_db()
    print("✅ Database initialized")
    print("🚀 AI Voice Agent Platform v2 running!")


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


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
