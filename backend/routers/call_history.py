"""
API Routes for Call Recording & Analytics
- POST /api/calls/session/start
- POST /api/calls/{sessionId}/transcript
- POST /api/calls/{sessionId}/audio
- POST /api/calls/{sessionId}/end
- GET /api/calls/history
- GET /api/calls/{sessionId}/analysis
"""

import logging
from fastapi import APIRouter, HTTPException, Depends, BackgroundTasks
from pydantic import BaseModel
from typing import Optional, List
import os
from sqlalchemy.orm import Session
from sqlalchemy import update

from database import SessionLocal, get_db
from models import CallSession, CallAudio, CallAnalysis, Company
from services.call_recording import (
    CallSessionManager,
    get_or_create_recorder, 
    remove_recorder
)
from services.call_analysis import CallAnalyzer, AnalysisManager
from services.auth_service import get_current_company

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/calls", tags=["calls"])


# ─── Schemas ──────────────────────────────────────────────────────────────────

class StartSessionRequest(BaseModel):
    agent_id: str
    caller_id: Optional[str] = None


class EndSessionRequest(BaseModel):
    session_id: str


class TranscriptChunkRequest(BaseModel):
    session_id: str
    role: str  # 'user' or 'agent'
    text: str
    timestamp_ms: Optional[float] = None


class AudioChunkRequest(BaseModel):
    session_id: str
    pcm_data_b64: str  # base64-encoded PCM data


class SessionResponse(BaseModel):
    session_id: str
    agent_id: str
    status: str
    started_at: str


class AnalysisResponse(BaseModel):
    session_id: str
    overall_emotion: str
    user_satisfaction: int
    info_completion: int
    key_intents: List[str]
    emotion_timeline: List[dict]
    summary: str


# ─── Endpoints ────────────────────────────────────────────────────────────────

@router.post("/session/start", response_model=SessionResponse)
async def start_call_session(
    req: StartSessionRequest,
    company: Company = Depends(get_current_company),
    db: Session = Depends(get_db)
):
    """
    Start a new call session for recording.
    
    Returns: {
        "session_id": "uuid",
        "agent_id": "agent-uuid",
        "status": "active",
        "started_at": "2026-03-25T10:30:00Z"
    }
    """
    try:
        # Create session in DB
        session_id = CallSessionManager.create_session(
            agent_id=req.agent_id,
            company_id=company.id,
            caller_id=req.caller_id,
            db=db
        )

        # Create recorder (in-memory)
        get_or_create_recorder(session_id, req.agent_id, company.id)

        session = CallSessionManager.get_session(session_id, db)
        return SessionResponse(
            session_id=session_id,
            agent_id=req.agent_id,
            status="active",
            started_at=session.started_at.isoformat()
        )
    except Exception as e:
        logger.error(f"[API] Error starting session: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/{session_id}/transcript")
async def add_transcript(
    session_id: str,
    req: TranscriptChunkRequest,
    company: Company = Depends(get_current_company),
    db: Session = Depends(get_db)
):
    """Add transcription chunk to call (async, non-blocking)."""
    try:
        session = CallSessionManager.get_session(session_id, db)
        if not session:
            raise HTTPException(status_code=404, detail="Session not found")

        recorder = get_or_create_recorder(session_id, session.agent_id, session.company_id)
        await recorder.add_transcript_chunk(req.role, req.text, req.timestamp_ms)

        return {"status": "recorded"}
    except Exception as e:
        logger.error(f"[API] Error adding transcript: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/{session_id}/audio")
async def add_audio(
    session_id: str,
    req: AudioChunkRequest,
    company: Company = Depends(get_current_company),
    db: Session = Depends(get_db)
):
    """Add audio chunk to call (async, non-blocking)."""
    try:
        import base64
        session = CallSessionManager.get_session(session_id, db)
        if not session:
            raise HTTPException(status_code=404, detail="Session not found")

        recorder = get_or_create_recorder(session_id, session.agent_id, session.company_id)
        audio_bytes = base64.b64decode(req.pcm_data_b64)
        await recorder.add_audio_chunk(audio_bytes)

        return {"status": "recorded"}
    except Exception as e:
        logger.error(f"[API] Error adding audio: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/{session_id}/end")
async def end_call_session(
    session_id: str,
    req: EndSessionRequest,
    background_tasks: BackgroundTasks,
    company: Company = Depends(get_current_company),
    db: Session = Depends(get_db)
):
    """
    End call session and trigger analysis (analysis runs in background).
    """
    try:
        session = CallSessionManager.get_session(session_id, db)
        if not session:
            raise HTTPException(status_code=404, detail="Session not found")

        # Get recorder and finalize
        recorder = remove_recorder(session_id)
        if not recorder:
            raise HTTPException(status_code=400, detail="No active recording for this session")

        recording_data = await recorder.stop_recording()

        # End session in DB
        CallSessionManager.end_session(
            session_id,
            recording_data["transcript"],
            recording_data.get("audio_file"),
            db
        )

        # Trigger analysis in background (doesn't block response)
        gemini_key = os.getenv("GEMINI_API_KEY")
        if gemini_key:
            background_tasks.add_task(
                _analyze_call_background,
                session_id=session_id,
                gemini_key=gemini_key
            )

        return {
            "status": "ended",
            "session_id": session_id,
            "transcript_lines": recording_data["transcript_lines"],
            "duration_sec": recording_data["duration_sec"],
            "audio_file": recording_data["audio_file"]
        }
    except Exception as e:
        logger.error(f"[API] Error ending session: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/history")
async def get_call_history(
    agent_id: Optional[str] = None,
    limit: int = 50,
    company: Company = Depends(get_current_company),
    db: Session = Depends(get_db)
):
    """Get call history for company's agents."""
    try:
        if agent_id:
            sessions = CallSessionManager.get_sessions_by_agent(
                agent_id, company.id, limit, db
            )
        else:
            # Get all sessions for company
            sessions = db.query(CallSession).filter(
                CallSession.company_id == company.id
            ).order_by(CallSession.started_at.desc()).limit(limit).all()

        return [
            {
                "session_id": s.id,
                "agent_id": s.agent_id,
                "status": s.status,
                "duration_sec": s.duration_sec,
                "started_at": s.started_at.isoformat(),
                "ended_at": s.ended_at.isoformat() if s.ended_at else None,
                "sentiment": s.sentiment,
                "transcript_lines": len(s.transcript) if s.transcript else 0
            }
            for s in sessions
        ]
    except Exception as e:
        logger.error(f"[API] Error fetching history: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{session_id}/analysis", response_model=AnalysisResponse)
async def get_call_analysis(
    session_id: str,
    company: Company = Depends(get_current_company),
    db: Session = Depends(get_db)
):
    """Get call analysis (emotion, satisfaction, etc)."""
    try:
        session = CallSessionManager.get_session(session_id, db)
        if not session:
            raise HTTPException(status_code=404, detail="Session not found")

        analysis = AnalysisManager.get_analysis(session_id, db)
        if not analysis:
            # Not analyzed yet
            return AnalysisResponse(
                session_id=session_id,
                overall_emotion="neutral",
                user_satisfaction=0,
                info_completion=0,
                key_intents=[],
                emotion_timeline=[],
                summary="Analysis pending"
            )

        return AnalysisResponse(
            session_id=session_id,
            overall_emotion=analysis.overall_emotion or "neutral",
            user_satisfaction=analysis.user_satisfaction or 0,
            info_completion=analysis.info_completion or 0,
            key_intents=analysis.key_intents or [],
            emotion_timeline=analysis.emotion_timeline or [],
            summary=analysis.summary or ""
        )
    except Exception as e:
        logger.error(f"[API] Error fetching analysis: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/agent/{agent_id}/analytics")
async def get_agent_analytics(
    agent_id: str,
    company: Company = Depends(get_current_company),
    db: Session = Depends(get_db)
):
    """Get aggregate analytics for an agent."""
    try:
        analytics = AnalysisManager.get_agent_analytics(agent_id, company.id, db=db)
        return analytics
    except Exception as e:
        logger.error(f"[API] Error fetching analytics: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ─── Background Task ──────────────────────────────────────────────────────────

async def _analyze_call_background(session_id: str, gemini_key: str):
    """Background task to analyze call (doesn't block API response)."""
    try:
        db = SessionLocal()
        session = CallSessionManager.get_session(session_id, db)
        if not session:
            logger.error(f"[Background] Session {session_id} not found")
            return

        # Analyze with Gemini
        analyzer = CallAnalyzer(gemini_key)
        analysis = await analyzer.analyze(session)

        # Store analysis
        await AnalysisManager.store_analysis(session_id, analysis, db)

        # Update session with sentiment
        db.execute(
            update(CallSession).where(CallSession.id == session_id).values(
                sentiment=analysis.get("overall_emotion", "neutral")
            )
        )
        db.commit()

        logger.info(f"[Background] Analysis complete for {session_id}")
    except Exception as e:
        logger.error(f"[Background] Error analyzing: {e}")
    finally:
        db.close()
