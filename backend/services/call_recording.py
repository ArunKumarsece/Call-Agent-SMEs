"""
Call Recording Service — Async recording of transcripts & audio without disrupting flow.
Handles: Text transcripts, audio streaming, metadata tracking
"""

import asyncio
import json
import logging
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional, List, Dict, Any
import uuid
from sqlalchemy.orm import Session

from models import CallSession, CallAudio
from database import SessionLocal

logger = logging.getLogger(__name__)

# ─── Configuration ───────────────────────────────────────────────────────────

RECORDINGS_DIR = Path(__file__).parent.parent / "recordings"
RECORDINGS_DIR.mkdir(exist_ok=True)


# ─── Call Recorder ────────────────────────────────────────────────────────────

class CallRecorder:
    """Manages call recording without blocking main call flow."""

    def __init__(self, session_id: str, agent_id: str, company_id: str):
        self.session_id = session_id
        self.agent_id = agent_id
        self.company_id = company_id
        
        self._transcript: List[Dict[str, Any]] = []
        self._audio_chunks: List[bytes] = []
        self._audio_sample_count = 0
        self._start_time = datetime.now(timezone.utc)
        self._recording_task = None
        self._stopped = False
        
        # File paths
        self.transcript_file = RECORDINGS_DIR / f"{session_id}_transcript.json"
        self.audio_file = RECORDINGS_DIR / f"{session_id}.wav"

    async def start_recording(self):
        """Start background recording task (non-blocking)."""
        logger.info(f"[CallRecorder] Recording started for session {self.session_id}")
        self._stopped = False

    async def add_transcript_chunk(self, role: str, text: str, timestamp_ms: float = None):
        """
        Add transcript chunk (non-blocking, async).
        
        Args:
            role: 'user' or 'agent'
            text: spoken/transcribed text
            timestamp_ms: milliseconds from call start
        """
        if self._stopped:
            return

        timestamp = timestamp_ms or (datetime.now(timezone.utc) - self._start_time).total_seconds() * 1000

        chunk = {
            "role": role,
            "text": text,
            "timestamp_ms": timestamp,
            "timestamp_iso": datetime.now(timezone.utc).isoformat()
        }
        self._transcript.append(chunk)

        # Fire-and-forget: write to disk async (doesn't block call)
        asyncio.create_task(self._write_transcript_async())

    async def _write_transcript_async(self):
        """Write transcript to disk (background task)."""
        try:
            with open(self.transcript_file, 'w', encoding='utf-8') as f:
                json.dump(self._transcript, f, indent=2, ensure_ascii=False)
            logger.debug(f"[CallRecorder] Transcript saved: {len(self._transcript)} lines")
        except Exception as e:
            logger.error(f"[CallRecorder] Error writing transcript: {e}")

    async def add_audio_chunk(self, pcm_i16_bytes: bytes, sample_rate: int = 16000):
        """
        Add raw PCM audio chunk (non-blocking, async).
        
        Args:
            pcm_i16_bytes: 16-bit PCM audio data
            sample_rate: samples per second (default 16000 Hz)
        """
        if self._stopped:
            return

        self._audio_chunks.append(pcm_i16_bytes)
        self._audio_sample_count += len(pcm_i16_bytes) // 2  # 16-bit = 2 bytes per sample

        # Fire-and-forget: write to disk async (every 100 chunks or 5 seconds)
        if len(self._audio_chunks) % 100 == 0:
            asyncio.create_task(self._write_audio_async(sample_rate))

    async def _write_audio_async(self, sample_rate: int = 16000):
        """Write audio to disk (background task)."""
        try:
            import wave
            
            if not self._audio_chunks:
                return

            # Accumulate all chunks
            audio_data = b''.join(self._audio_chunks)
            
            # Write as WAV
            with wave.open(str(self.audio_file), 'wb') as wav_file:
                wav_file.setnchannels(1)          # mono
                wav_file.setsampwidth(2)          # 16-bit
                wav_file.setframerate(sample_rate)
                wav_file.writeframes(audio_data)

            file_size = self.audio_file.stat().st_size if self.audio_file.exists() else 0
            logger.debug(f"[CallRecorder] Audio saved: {len(self._audio_chunks)} chunks, {file_size} bytes")
        except Exception as e:
            logger.error(f"[CallRecorder] Error writing audio: {e}")

    async def stop_recording(self) -> Dict[str, Any]:
        """
        Finalize recording and return metadata.
        
        Returns:
            {
                "session_id": str,
                "transcript_lines": int,
                "transcript_file": str,
                "audio_file": str,
                "audio_size_bytes": int,
                "duration_sec": float
            }
        """
        self._stopped = True

        # Final write
        await self._write_transcript_async()
        await self._write_audio_async()

        duration = (datetime.now(timezone.utc) - self._start_time).total_seconds()
        audio_size = self.audio_file.stat().st_size if self.audio_file.exists() else 0

        logger.info(f"[CallRecorder] Recording stopped: {len(self._transcript)} transcript lines, {audio_size} bytes audio")

        return {
            "session_id": self.session_id,
            "transcript_lines": len(self._transcript),
            "transcript_file": str(self.transcript_file),
            "audio_file": str(self.audio_file),
            "audio_size_bytes": audio_size,
            "duration_sec": duration,
            "transcript": self._transcript
        }

    def get_transcript(self) -> List[Dict]:
        """Get current transcript (for analysis)."""
        return self._transcript.copy()

    def get_transcript_text(self) -> str:
        """Get transcript as plain text."""
        lines = []
        for item in self._transcript:
            role = item["role"].upper()
            text = item["text"]
            lines.append(f"{role}: {text}")
        return "\n".join(lines)


# ─── Session Manager (stores to DB) ───────────────────────────────────────────

class CallSessionManager:
    """Manages CallSession database operations."""

    @staticmethod
    def create_session(
        agent_id: str,
        company_id: str,
        caller_id: Optional[str] = None,
        db: Optional[Session] = None
    ) -> str:
        """Create new call session. Returns session_id."""
        if not db:
            db = SessionLocal()
        
        session = CallSession(
            id=str(uuid.uuid4()),
            agent_id=agent_id,
            company_id=company_id,
            caller_id=caller_id,
            status="active",
            transcript=[]
        )
        db.add(session)
        db.commit()
        logger.info(f"[CallSessionManager] Created session {session.id}")
        return session.id

    @staticmethod
    def end_session(
        session_id: str,
        transcript: List[Dict],
        audio_file_path: Optional[str] = None,
        db: Optional[Session] = None
    ) -> bool:
        """Mark session as completed and store transcript/audio path."""
        if not db:
            db = SessionLocal()

        session = db.query(CallSession).filter(CallSession.id == session_id).first()
        if not session:
            logger.error(f"[CallSessionManager] Session {session_id} not found")
            return False

        session.status = "completed"
        session.ended_at = datetime.now(timezone.utc)
        session.transcript = transcript
        session.duration_sec = int((session.ended_at - session.started_at).total_seconds())

        # Store audio file reference
        if audio_file_path:
            from models import CallAudio
            audio = CallAudio(
                id=str(uuid.uuid4()),
                session_id=session_id,
                file_path=audio_file_path,
                file_format="wav",
                size_bytes=0  # Can update later
            )
            db.add(audio)

        db.commit()
        logger.info(f"[CallSessionManager] Ended session {session_id}")
        return True

    @staticmethod
    def get_session(session_id: str, db: Optional[Session] = None) -> Optional[CallSession]:
        """Get session by ID."""
        if not db:
            db = SessionLocal()
        return db.query(CallSession).filter(CallSession.id == session_id).first()

    @staticmethod
    def get_sessions_by_agent(
        agent_id: str,
        company_id: str,
        limit: int = 50,
        db: Optional[Session] = None
    ) -> List[CallSession]:
        """Get call history for an agent."""
        if not db:
            db = SessionLocal()
        return db.query(CallSession).filter(
            CallSession.agent_id == agent_id,
            CallSession.company_id == company_id
        ).order_by(CallSession.started_at.desc()).limit(limit).all()


# ─── Global Recorder Map (session_id → recorder) ────────────────────────────

_active_recorders: Dict[str, CallRecorder] = {}


def get_or_create_recorder(session_id: str, agent_id: str, company_id: str) -> CallRecorder:
    """Get active recorder or create new one."""
    if session_id not in _active_recorders:
        _active_recorders[session_id] = CallRecorder(session_id, agent_id, company_id)
    return _active_recorders[session_id]


def remove_recorder(session_id: str) -> Optional[CallRecorder]:
    """Remove recorder from active map."""
    return _active_recorders.pop(session_id, None)
