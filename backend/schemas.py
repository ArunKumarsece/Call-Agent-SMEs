# """Pydantic schemas for request/response validation."""

# from pydantic import BaseModel
# from typing import Optional, List
# from datetime import datetime


# # ─── Agent Schemas ────────────────────────────────────────

# class AgentCreate(BaseModel):
#     name: str
#     role: str
#     description: Optional[str] = ""
#     system_prompt: Optional[str] = ""
#     voice_id: Optional[str] = "Puck"
#     language: Optional[str] = "tanglish"


# class AgentUpdate(BaseModel):
#     name: Optional[str] = None
#     role: Optional[str] = None
#     description: Optional[str] = None
#     system_prompt: Optional[str] = None
#     voice_id: Optional[str] = None
#     language: Optional[str] = None


# class AgentResponse(BaseModel):
#     id: str
#     name: str
#     role: str
#     description: Optional[str]
#     system_prompt: Optional[str]
#     voice_id: str
#     language: str
#     created_at: datetime
#     updated_at: datetime
#     kb_count: Optional[int] = 0

#     class Config:
#         from_attributes = True


# # ─── Knowledge Base Schemas ───────────────────────────────

# class KBCreate(BaseModel):
#     name: str
#     kb_type: str  # 'static' or 'dynamic'
#     source_url: Optional[str] = None
#     sync_interval: Optional[int] = 300


# class KBUpdate(BaseModel):
#     name: Optional[str] = None
#     source_url: Optional[str] = None
#     sync_interval: Optional[int] = None


# class KBResponse(BaseModel):
#     id: str
#     agent_id: str
#     name: str
#     kb_type: str
#     source_url: Optional[str]
#     sync_interval: int
#     created_at: datetime
#     updated_at: datetime
#     entry_count: Optional[int] = 0

#     class Config:
#         from_attributes = True


# # ─── KB Entry Schemas ─────────────────────────────────────

# class KBEntryCreate(BaseModel):
#     content: str
#     source_file: Optional[str] = "manual"


# class KBEntryResponse(BaseModel):
#     id: str
#     kb_id: str
#     content: str
#     source_file: Optional[str]
#     chunk_index: int
#     created_at: datetime

#     class Config:
#         from_attributes = True


# # ─── SDK Schema ───────────────────────────────────────────

# class SDKResponse(BaseModel):
#     agent_id: str
#     agent_name: str
#     html_snippet: str
#     js_config: str
#     instructions: str


# # ─── Chat Schema (for testing) ───────────────────────────

# class ChatMessage(BaseModel):
#     message: str
#     agent_id: str


"""Pydantic schemas for request/response validation."""

from pydantic import BaseModel, Field, field_validator
from typing import Optional, List
from datetime import datetime
import re


# ─── Agent Schemas ────────────────────────────────────────

class AgentCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    role: str = Field(..., min_length=1, max_length=100)
    description: Optional[str] = Field("", max_length=1000)
    system_prompt: Optional[str] = Field("", max_length=5000)
    voice_id: Optional[str] = Field("Puck", max_length=50)
    language: Optional[str] = Field("tanglish", max_length=30)


class AgentUpdate(BaseModel):
    name: Optional[str] = Field(None, max_length=100)
    role: Optional[str] = Field(None, max_length=100)
    description: Optional[str] = Field(None, max_length=1000)
    system_prompt: Optional[str] = Field(None, max_length=5000)
    voice_id: Optional[str] = Field(None, max_length=50)
    language: Optional[str] = Field(None, max_length=30)


class AgentResponse(BaseModel):
    id: str
    name: str
    role: str
    description: Optional[str]
    system_prompt: Optional[str]
    voice_id: str
    language: str
    created_at: datetime
    updated_at: datetime
    kb_count: Optional[int] = 0

    class Config:
        from_attributes = True


# ─── Knowledge Base Schemas ───────────────────────────────

class KBCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=200)
    kb_type: str = Field(..., max_length=20)  # 'static' or 'dynamic'
    source_url: Optional[str] = Field(None, max_length=2000)
    sync_interval: Optional[int] = Field(300, ge=60, le=86400)


class KBUpdate(BaseModel):
    name: Optional[str] = None
    source_url: Optional[str] = None
    sync_interval: Optional[int] = None


class KBResponse(BaseModel):
    id: str
    agent_id: str
    name: str
    kb_type: str
    source_url: Optional[str]
    sync_interval: int
    created_at: datetime
    updated_at: datetime
    entry_count: Optional[int] = 0

    class Config:
        from_attributes = True


# ─── KB Entry Schemas ─────────────────────────────────────

class KBEntryCreate(BaseModel):
    content: str = Field(..., min_length=1, max_length=50000)
    source_file: Optional[str] = Field("manual", max_length=500)


class KBEntryResponse(BaseModel):
    id: str
    kb_id: str
    content: str
    source_file: Optional[str]
    chunk_index: int
    created_at: datetime

    class Config:
        from_attributes = True


# ─── SDK Schema ───────────────────────────────────────────

class SDKResponse(BaseModel):
    agent_id: str
    agent_name: str
    html_snippet: str
    js_config: str
    instructions: str


# ─── Chat Schema (for testing) ───────────────────────────

class ChatMessage(BaseModel):
    message: str = Field(..., min_length=1, max_length=2000)
    agent_id: str = Field(..., max_length=100)


# ─── Auth / Company Schemas ───────────────────────────────

class CompanyRegister(BaseModel):
    company_name: str = Field(..., min_length=1, max_length=200)
    full_name: Optional[str] = Field(None, max_length=200)
    email: str = Field(..., max_length=320)
    password: str = Field(..., min_length=8, max_length=128)

    @field_validator('email')
    @classmethod
    def validate_email(cls, v: str) -> str:
        if not re.match(r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$', v):
            raise ValueError('Invalid email format')
        return v.lower()

    class Config:
        from_attributes = True


class CompanyLogin(BaseModel):
    email: str = Field(..., max_length=320)
    password: str = Field(..., max_length=128)


class CompanyResponse(BaseModel):
    id: str
    company_name: str
    email: str
    plan: str
    logo_url: Optional[str] = None
    is_active: bool
    created_at: datetime

    class Config:
        from_attributes = True


class TokenResponse(BaseModel):
    access_token: str
    token_type: str
    company: CompanyResponse


class UpdateCompanyProfile(BaseModel):
    company_name: Optional[str] = None
    logo_url: Optional[str] = None


class ChangePassword(BaseModel):
    current_password: str = Field(..., max_length=128)
    new_password: str = Field(..., min_length=8, max_length=128)

# ─── Call Session Schemas ─────────────────────────────────

class CallSessionCreate(BaseModel):
    agent_id: str
    caller_id: Optional[str] = None
    transcript: Optional[List[dict]] = None
    duration_sec: Optional[int] = 0
    sentiment: Optional[str] = None
    intent: Optional[str] = None
    summary: Optional[str] = None
    status: Optional[str] = "completed"


class CallSessionResponse(BaseModel):
    id: str
    agent_id: str
    company_id: str
    caller_id: Optional[str]
    status: str
    sentiment: Optional[str]
    intent: Optional[str]
    duration_sec: int
    transcript: Optional[List[dict]]
    summary: Optional[str]
    started_at: datetime
    ended_at: Optional[datetime]
    agent_name: Optional[str] = None

    class Config:
        from_attributes = True


class AnalyticsResponse(BaseModel):
    total_calls: int
    total_duration_min: float
    avg_duration_sec: float
    sentiment_distribution: dict
    intent_distribution: dict
    status_distribution: dict
    calls_by_day: List[dict]
    calls_by_agent: List[dict]