"""
Call Analysis Service — Uses Gemini to analyze emotion, sentiment, and info completion.
Processes transcripts and generates structured analysis.
"""

import logging
import json
from typing import Dict, List, Optional, Any
import uuid
from datetime import datetime, timezone
from sqlalchemy.orm import Session

import google.generativeai as genai

from models import CallSession, CallAnalysis
from database import SessionLocal

logger = logging.getLogger(__name__)


# ─── Gemini Analysis ─────────────────────────────────────────────────────────

class CallAnalyzer:
    """Analyzes call transcripts using Gemini API."""

    def __init__(self, api_key: str):
        genai.configure(api_key=api_key)
        self.model = genai.GenerativeModel('gemini-2.5-flash')

    async def analyze(self, session: CallSession) -> Dict[str, Any]:
        """
        Analyze call session for:
        - Emotion timeline (by turn)
        - Overall sentiment
        - User satisfaction (0-100)
        - Info completion (0-100: did user get answers?)
        - Key intents
        - Summary
        
        Returns:
            {
                "emotion_timeline": [{"turn": 0, "emotion": "positive", "confidence": 0.95}],
                "overall_emotion": "neutral",
                "user_satisfaction": 75,
                "info_completion": 80,
                "key_intents": ["booking", "support"],
                "summary": "User asked about..."
            }
        """
        if not session.transcript:
            logger.warning(f"[CallAnalyzer] No transcript for session {session.id}")
            return self._empty_analysis()

        transcript_text = self._format_transcript(session.transcript)
        
        # Prepare analysis prompt
        prompt = f"""Analyze this customer service call transcript and provide structured JSON output.

TRANSCRIPT:
{transcript_text}

Provide analysis in this exact JSON format (no markdown):
{{
    "emotion_timeline": [
        {{"turn_number": 0, "emotion": "positive/neutral/negative", "confidence": 0.0-1.0, "reason": "brief reason"}}
    ],
    "overall_emotion": "positive/neutral/negative",
    "user_satisfaction": 0-100,
    "info_completion": 0-100,
    "key_intents": ["intent1", "intent2"],
    "summary": "brief summary of the call"
}}

GUIDELINES:
- Emotion: Analyze sentiment in each user turn
- Satisfaction: Based on emotional tone, question resolution, agent helpfulness
- Info Completion: Did user get the information they asked for? (0=no, 100=yes)
- Intents: What did the user want? (e.g., "booking", "support", "complaint", "information")
- Summary: 2-3 sentences about the call

Respond with ONLY the JSON object, no other text."""

        try:
            response = await self._call_gemini_async(prompt)
            analysis = json.loads(response)
            logger.info(f"[CallAnalyzer] Analysis complete for {session.id}")
            return analysis
        except Exception as e:
            logger.error(f"[CallAnalyzer] Error analyzing session {session.id}: {e}")
            return self._empty_analysis()

    def _format_transcript(self, transcript: List[Dict]) -> str:
        """Format transcript for readability."""
        lines = []
        for i, item in enumerate(transcript):
            role = item["role"].upper()
            text = item["text"]
            timestamp = item.get("timestamp_ms", 0)
            sec = int(timestamp / 1000)
            lines.append(f"[{sec}s] {role}: {text}")
        return "\n".join(lines)

    async def _call_gemini_async(self, prompt: str) -> str:
        """Call Gemini API (sync wrapped in async)."""
        loop = __import__('asyncio').get_event_loop()
        return await loop.run_in_executor(
            None,
            lambda: self.model.generate_content(prompt).text
        )

    def _empty_analysis(self) -> Dict[str, Any]:
        """Return empty analysis structure."""
        return {
            "emotion_timeline": [],
            "overall_emotion": "neutral",
            "user_satisfaction": 0,
            "info_completion": 0,
            "key_intents": [],
            "summary": "No analysis available"
        }


# ─── Analysis Storage ─────────────────────────────────────────────────────────

class AnalysisManager:
    """Manages CallAnalysis database operations."""

    @staticmethod
    async def store_analysis(
        session_id: str,
        analysis_data: Dict[str, Any],
        db: Optional[Session] = None
    ) -> bool:
        """Store analysis results in database."""
        if not db:
            db = SessionLocal()

        try:
            analysis = CallAnalysis(
                id=str(uuid.uuid4()),
                session_id=session_id,
                emotion_timeline=analysis_data.get("emotion_timeline", []),
                overall_emotion=analysis_data.get("overall_emotion", "neutral"),
                user_satisfaction=analysis_data.get("user_satisfaction", 0),
                info_completion=analysis_data.get("info_completion", 0),
                key_intents=analysis_data.get("key_intents", []),
                summary=analysis_data.get("summary", ""),
                analyzed_at=datetime.now(timezone.utc)
            )
            db.add(analysis)
            db.commit()
            logger.info(f"[AnalysisManager] Analysis stored for session {session_id}")
            return True
        except Exception as e:
            logger.error(f"[AnalysisManager] Error storing analysis: {e}")
            return False

    @staticmethod
    def get_analysis(session_id: str, db: Optional[Session] = None) -> Optional[CallAnalysis]:
        """Get analysis for a session."""
        if not db:
            db = SessionLocal()
        return db.query(CallAnalysis).filter(CallAnalysis.session_id == session_id).first()

    @staticmethod
    def get_agent_analytics(
        agent_id: str,
        company_id: str,
        limit: int = 30,
        db: Optional[Session] = None
    ) -> Dict[str, Any]:
        """Get aggregate analytics for agent (avg sentiment, satisfaction, etc)."""
        if not db:
            db = SessionLocal()

        analyses = db.query(CallAnalysis).join(
            CallSession, CallAnalysis.session_id == CallSession.id
        ).filter(
            CallSession.agent_id == agent_id,
            CallSession.company_id == company_id
        ).order_by(CallSession.started_at.desc()).limit(limit).all()

        if not analyses:
            return {
                "total_calls": 0,
                "avg_satisfaction": 0,
                "avg_info_completion": 0,
                "avg_emotion": "neutral",
                "top_intents": []
            }

        total = len(analyses)
        avg_sat = sum(a.user_satisfaction or 0 for a in analyses) / total if total > 0 else 0
        avg_info = sum(a.info_completion or 0 for a in analyses) / total if total > 0 else 0

        # Aggregate emotions
        emotion_counts = {}
        all_intents = []
        for a in analyses:
            emotion = a.overall_emotion or "neutral"
            emotion_counts[emotion] = emotion_counts.get(emotion, 0) + 1
            all_intents.extend(a.key_intents or [])

        avg_emotion = max(emotion_counts, key=emotion_counts.get) if emotion_counts else "neutral"

        # Top intents
        intent_counts = {}
        for intent in all_intents:
            intent_counts[intent] = intent_counts.get(intent, 0) + 1
        top_intents = sorted(intent_counts.items(), key=lambda x: x[1], reverse=True)[:5]

        return {
            "total_calls": total,
            "avg_satisfaction": round(avg_sat, 2),
            "avg_info_completion": round(avg_info, 2),
            "avg_emotion": avg_emotion,
            "top_intents": [{"intent": i, "count": c} for i, c in top_intents]
        }
