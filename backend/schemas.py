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

from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime


# ─── Agent Schemas ────────────────────────────────────────

class AgentCreate(BaseModel):
    name: str
    role: str
    description: Optional[str] = ""
    system_prompt: Optional[str] = ""
    voice_id: Optional[str] = "Puck"
    language: Optional[str] = "tanglish"


class AgentUpdate(BaseModel):
    name: Optional[str] = None
    role: Optional[str] = None
    description: Optional[str] = None
    system_prompt: Optional[str] = None
    voice_id: Optional[str] = None
    language: Optional[str] = None


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
    name: str
    kb_type: str  # 'static' or 'dynamic'
    source_url: Optional[str] = None
    sync_interval: Optional[int] = 300


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
    content: str
    source_file: Optional[str] = "manual"


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
    message: str
    agent_id: str


# ─── Auth / Company Schemas ───────────────────────────────

class CompanyRegister(BaseModel):
    company_name: str
    full_name: Optional[str] = None
    email: str
    password: str

    class Config:
        from_attributes = True


class CompanyLogin(BaseModel):
    email: str
    password: str


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
    current_password: str
    new_password: str
