"""Analytics & Call History API routes."""

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import func, cast, Date
from database import get_db
from models import Company, Agent, CallSession
from schemas import CallSessionCreate, CallSessionResponse, AnalyticsResponse
from services.auth_service import get_current_company
from datetime import datetime, timezone, timedelta
from typing import Optional

router = APIRouter(prefix="/api/analytics", tags=["analytics"])


# ─── Save a call session ──────────────────────────────────

@router.post("/calls", response_model=CallSessionResponse)
async def save_call_session(
    payload: CallSessionCreate,
    company: Company = Depends(get_current_company),
    db: Session = Depends(get_db),
):
    agent = db.query(Agent).filter(
        Agent.id == payload.agent_id, Agent.company_id == company.id
    ).first()
    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found")

    session = CallSession(
        agent_id=payload.agent_id,
        company_id=company.id,
        caller_id=payload.caller_id,
        transcript=payload.transcript,
        duration_sec=payload.duration_sec or 0,
        sentiment=payload.sentiment,
        intent=payload.intent,
        summary=payload.summary,
        status=payload.status or "completed",
        ended_at=datetime.now(timezone.utc),
    )
    db.add(session)
    db.commit()
    db.refresh(session)

    return CallSessionResponse(
        **{c.name: getattr(session, c.name) for c in session.__table__.columns},
        agent_name=agent.name,
    )


# ─── List call history ────────────────────────────────────

@router.get("/calls", response_model=list[CallSessionResponse])
async def list_calls(
    agent_id: Optional[str] = None,
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    company: Company = Depends(get_current_company),
    db: Session = Depends(get_db),
):
    q = db.query(CallSession).filter(CallSession.company_id == company.id)
    if agent_id:
        q = q.filter(CallSession.agent_id == agent_id)
    sessions = q.order_by(CallSession.started_at.desc()).offset(offset).limit(limit).all()

    result = []
    for s in sessions:
        agent = db.query(Agent).filter(Agent.id == s.agent_id).first()
        result.append(CallSessionResponse(
            **{c.name: getattr(s, c.name) for c in s.__table__.columns},
            agent_name=agent.name if agent else "Deleted Agent",
        ))
    return result


# ─── Get single call ──────────────────────────────────────

@router.get("/calls/{call_id}", response_model=CallSessionResponse)
async def get_call(
    call_id: str,
    company: Company = Depends(get_current_company),
    db: Session = Depends(get_db),
):
    session = db.query(CallSession).filter(
        CallSession.id == call_id, CallSession.company_id == company.id
    ).first()
    if not session:
        raise HTTPException(status_code=404, detail="Call not found")
    agent = db.query(Agent).filter(Agent.id == session.agent_id).first()
    return CallSessionResponse(
        **{c.name: getattr(session, c.name) for c in session.__table__.columns},
        agent_name=agent.name if agent else "Deleted Agent",
    )


# ─── Dashboard analytics ─────────────────────────────────

@router.get("/dashboard", response_model=AnalyticsResponse)
async def get_dashboard_analytics(
    days: int = Query(30, ge=1, le=365),
    agent_id: Optional[str] = None,
    company: Company = Depends(get_current_company),
    db: Session = Depends(get_db),
):
    since = datetime.now(timezone.utc) - timedelta(days=days)
    q = db.query(CallSession).filter(
        CallSession.company_id == company.id,
        CallSession.started_at >= since,
    )
    if agent_id:
        q = q.filter(CallSession.agent_id == agent_id)

    sessions = q.all()
    total = len(sessions)
    total_dur = sum(s.duration_sec or 0 for s in sessions)
    avg_dur = (total_dur / total) if total else 0

    # Sentiment distribution
    sentiments = {}
    for s in sessions:
        key = s.sentiment or "unknown"
        sentiments[key] = sentiments.get(key, 0) + 1

    # Intent distribution
    intents = {}
    for s in sessions:
        key = s.intent or "unknown"
        intents[key] = intents.get(key, 0) + 1

    # Status distribution
    statuses = {}
    for s in sessions:
        key = s.status or "completed"
        statuses[key] = statuses.get(key, 0) + 1

    # Calls by day
    day_map = {}
    for s in sessions:
        day_key = s.started_at.strftime("%Y-%m-%d") if s.started_at else "unknown"
        day_map[day_key] = day_map.get(day_key, 0) + 1
    calls_by_day = [{"date": k, "count": v} for k, v in sorted(day_map.items())]

    # Calls by agent
    agent_map = {}
    for s in sessions:
        agent_map[s.agent_id] = agent_map.get(s.agent_id, 0) + 1
    calls_by_agent = []
    for aid, count in agent_map.items():
        agent = db.query(Agent).filter(Agent.id == aid).first()
        calls_by_agent.append({
            "agent_id": aid,
            "agent_name": agent.name if agent else "Deleted",
            "count": count,
        })

    return AnalyticsResponse(
        total_calls=total,
        total_duration_min=round(total_dur / 60, 1),
        avg_duration_sec=round(avg_dur, 1),
        sentiment_distribution=sentiments,
        intent_distribution=intents,
        status_distribution=statuses,
        calls_by_day=calls_by_day,
        calls_by_agent=calls_by_agent,
    )


# ─── Seed demo data (dev only) ───────────────────────────

@router.post("/seed-demo")
async def seed_demo_data(
    company: Company = Depends(get_current_company),
    db: Session = Depends(get_db),
):
    """Generate demo analytics data for the dashboard."""
    import random

    agents = db.query(Agent).filter(Agent.company_id == company.id).all()
    if not agents:
        raise HTTPException(status_code=400, detail="Create at least one agent first")

    sentiments = ["positive", "neutral", "negative"]
    intents_pool = [
        "order_tracking", "returns", "pricing", "general_inquiry",
        "complaint", "appointment", "billing", "technical_support",
    ]
    statuses = ["completed", "completed", "completed", "dropped", "escalated"]
    summaries = [
        "Customer asked about order status, resolved successfully.",
        "Inquiry about return policy, customer was satisfied.",
        "Pricing question for premium plan, sent to sales.",
        "Technical issue with login, guided through reset.",
        "Complaint about delivery delay, escalated to manager.",
        "Appointment booking for next week confirmed.",
        "Billing dispute resolved with partial refund offer.",
        "General product inquiry, provided detailed information.",
    ]

    now = datetime.now(timezone.utc)
    created = 0

    for i in range(60):
        agent = random.choice(agents)
        day_offset = random.randint(0, 29)
        hour = random.randint(8, 20)
        minute = random.randint(0, 59)
        started = now - timedelta(days=day_offset, hours=random.randint(0, 3), minutes=minute)
        dur = random.randint(30, 600)

        session = CallSession(
            agent_id=agent.id,
            company_id=company.id,
            caller_id=f"user_{random.randint(1000,9999)}",
            status=random.choice(statuses),
            sentiment=random.choice(sentiments),
            intent=random.choice(intents_pool),
            duration_sec=dur,
            transcript=[
                {"role": "agent", "text": f"Hello! I'm {agent.name}, how can I help?", "timestamp": 0},
                {"role": "user", "text": "I have a question about my order.", "timestamp": 3},
                {"role": "agent", "text": "Sure, let me look that up for you.", "timestamp": 6},
                {"role": "user", "text": "Thanks for the help!", "timestamp": dur - 5},
            ],
            summary=random.choice(summaries),
            started_at=started,
            ended_at=started + timedelta(seconds=dur),
        )
        db.add(session)
        created += 1

    db.commit()
    return {"message": f"Created {created} demo call sessions"}
