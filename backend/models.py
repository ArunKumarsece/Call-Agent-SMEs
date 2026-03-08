# """SQLAlchemy ORM models."""

# from sqlalchemy import Column, String, Text, DateTime, ForeignKey, Integer, JSON
# from sqlalchemy.orm import relationship
# from database import Base
# from datetime import datetime, timezone
# import uuid


# def generate_uuid():
#     return str(uuid.uuid4())


# class Agent(Base):
#     __tablename__ = "agents"

#     id = Column(String, primary_key=True, default=generate_uuid)
#     name = Column(String(255), nullable=False)
#     role = Column(String(255), nullable=False)
#     description = Column(Text, nullable=True)
#     system_prompt = Column(Text, nullable=True)
#     voice_id = Column(String(100), default="Puck")
#     language = Column(String(50), default="tanglish")
#     created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
#     updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc),
#                         onupdate=lambda: datetime.now(timezone.utc))

#     knowledge_bases = relationship("KnowledgeBase", back_populates="agent",
#                                    cascade="all, delete-orphan")


# class KnowledgeBase(Base):
#     __tablename__ = "knowledge_bases"

#     id = Column(String, primary_key=True, default=generate_uuid)
#     agent_id = Column(String, ForeignKey("agents.id", ondelete="CASCADE"), nullable=False)
#     name = Column(String(255), nullable=False)
#     kb_type = Column(String(50), nullable=False)  # 'static' or 'dynamic'
#     source_url = Column(Text, nullable=True)  # Google Sheets URL for dynamic
#     sync_interval = Column(Integer, default=300)  # seconds, for dynamic KB
#     created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
#     updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc),
#                         onupdate=lambda: datetime.now(timezone.utc))

#     agent = relationship("Agent", back_populates="knowledge_bases")
#     entries = relationship("KBEntry", back_populates="knowledge_base",
#                           cascade="all, delete-orphan")


# class KBEntry(Base):
#     __tablename__ = "kb_entries"

#     id = Column(String, primary_key=True, default=generate_uuid)
#     kb_id = Column(String, ForeignKey("knowledge_bases.id", ondelete="CASCADE"), nullable=False)
#     content = Column(Text, nullable=False)
#     embedding = Column(JSON, nullable=True)  # stored as JSON array of floats
#     source_file = Column(String(255), nullable=True)
#     chunk_index = Column(Integer, default=0)
#     created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

#     knowledge_base = relationship("KnowledgeBase", back_populates="entries")



"""SQLAlchemy ORM models — with Company-scoped multi-tenancy."""

from sqlalchemy import Column, String, Text, DateTime, ForeignKey, Integer, JSON, Boolean
from sqlalchemy.orm import relationship
from database import Base
from datetime import datetime, timezone
import uuid


def generate_uuid():
    return str(uuid.uuid4())


# ─── Company (tenant) ─────────────────────────────────────────────────────────

class Company(Base):
    __tablename__ = "companies"

    id           = Column(String, primary_key=True, default=generate_uuid)
    name         = Column(String(255), nullable=False)
    email        = Column(String(255), nullable=False, unique=True)  # login email (owner)
    hashed_password = Column(String(255), nullable=False)
    plan         = Column(String(50), default="free")   # free | pro | enterprise
    logo_url     = Column(Text, nullable=True)
    is_active    = Column(Boolean, default=True)
    created_at   = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at   = Column(DateTime, default=lambda: datetime.now(timezone.utc),
                          onupdate=lambda: datetime.now(timezone.utc))

    # Relationships
    users        = relationship("User",          back_populates="company", cascade="all, delete-orphan")
    agents       = relationship("Agent",         back_populates="company", cascade="all, delete-orphan")
    refresh_tokens = relationship("RefreshToken", back_populates="company", cascade="all, delete-orphan")


# ─── User (members of a company) ─────────────────────────────────────────────

class User(Base):
    __tablename__ = "users"

    id           = Column(String, primary_key=True, default=generate_uuid)
    company_id   = Column(String, ForeignKey("companies.id", ondelete="CASCADE"), nullable=False)
    email        = Column(String(255), nullable=False, unique=True)
    hashed_password = Column(String(255), nullable=False)
    full_name    = Column(String(255), nullable=True)
    role         = Column(String(50), default="member")  # owner | admin | member
    is_active    = Column(Boolean, default=True)
    created_at   = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at   = Column(DateTime, default=lambda: datetime.now(timezone.utc),
                          onupdate=lambda: datetime.now(timezone.utc))

    company      = relationship("Company", back_populates="users")


# ─── Refresh Token store ───────────────────────────────────────────────────────

class RefreshToken(Base):
    __tablename__ = "refresh_tokens"

    id           = Column(String, primary_key=True, default=generate_uuid)
    company_id   = Column(String, ForeignKey("companies.id", ondelete="CASCADE"), nullable=False)
    token_hash   = Column(String(255), nullable=False, unique=True)
    expires_at   = Column(DateTime, nullable=False)
    revoked      = Column(Boolean, default=False)
    created_at   = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    company      = relationship("Company", back_populates="refresh_tokens")


# ─── Agent (scoped to company) ────────────────────────────────────────────────

class Agent(Base):
    __tablename__ = "agents"

    id           = Column(String, primary_key=True, default=generate_uuid)
    company_id   = Column(String, ForeignKey("companies.id", ondelete="CASCADE"), nullable=False)
    name         = Column(String(255), nullable=False)
    role         = Column(String(255), nullable=False)
    description  = Column(Text, nullable=True)
    system_prompt = Column(Text, nullable=True)
    voice_id     = Column(String(100), default="Puck")
    language     = Column(String(50), default="tanglish")
    created_at   = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at   = Column(DateTime, default=lambda: datetime.now(timezone.utc),
                          onupdate=lambda: datetime.now(timezone.utc))

    company      = relationship("Company", back_populates="agents")
    knowledge_bases = relationship("KnowledgeBase", back_populates="agent",
                                   cascade="all, delete-orphan")


# ─── KnowledgeBase ────────────────────────────────────────────────────────────

class KnowledgeBase(Base):
    __tablename__ = "knowledge_bases"

    id           = Column(String, primary_key=True, default=generate_uuid)
    agent_id     = Column(String, ForeignKey("agents.id", ondelete="CASCADE"), nullable=False)
    name         = Column(String(255), nullable=False)
    kb_type      = Column(String(50), nullable=False)
    source_url   = Column(Text, nullable=True)
    sync_interval = Column(Integer, default=300)
    created_at   = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at   = Column(DateTime, default=lambda: datetime.now(timezone.utc),
                          onupdate=lambda: datetime.now(timezone.utc))

    agent        = relationship("Agent", back_populates="knowledge_bases")
    entries      = relationship("KBEntry", back_populates="knowledge_base",
                               cascade="all, delete-orphan")


# ─── KBEntry ──────────────────────────────────────────────────────────────────

class KBEntry(Base):
    __tablename__ = "kb_entries"

    id           = Column(String, primary_key=True, default=generate_uuid)
    kb_id        = Column(String, ForeignKey("knowledge_bases.id", ondelete="CASCADE"), nullable=False)
    content      = Column(Text, nullable=False)
    embedding    = Column(JSON, nullable=True)
    source_file  = Column(String(255), nullable=True)
    chunk_index  = Column(Integer, default=0)
    created_at   = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    knowledge_base = relationship("KnowledgeBase", back_populates="entries")
