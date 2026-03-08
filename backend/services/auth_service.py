"""
Authentication & Authorization service
───────────────────────────────────────
JWT access tokens  (15 min)  — sent in Authorization: Bearer header
JWT refresh tokens (7 days)  — sent as httpOnly cookie + stored hashed in DB
Password hashing   — bcrypt via passlib
"""

from __future__ import annotations
import hashlib
import os
import secrets
from datetime import datetime, timedelta, timezone
from typing import Optional

from jose import JWTError, jwt
from passlib.context import CryptContext
from fastapi import Depends, HTTPException, Request, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session

from database import get_db
from models import Company, RefreshToken

# ─── Config ──────────────────────────────────────────────────────────────────

SECRET_KEY       = os.getenv("JWT_SECRET_KEY", secrets.token_hex(32))
ALGORITHM        = "HS256"
ACCESS_EXPIRE_MIN  = 15          # 15 minutes
REFRESH_EXPIRE_DAYS = 7          # 7 days
REFRESH_COOKIE   = "refresh_token"

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
bearer      = HTTPBearer(auto_error=False)


# ─── Password helpers ─────────────────────────────────────────────────────────

def hash_password(plain: str) -> str:
    return pwd_context.hash(plain)


def verify_password(plain: str, hashed: str) -> bool:
    return pwd_context.verify(plain, hashed)


# ─── JWT helpers ─────────────────────────────────────────────────────────────

def create_access_token(company_id: str) -> str:
    expire = datetime.now(timezone.utc) + timedelta(minutes=ACCESS_EXPIRE_MIN)
    return jwt.encode(
        {"sub": company_id, "exp": expire, "type": "access"},
        SECRET_KEY, algorithm=ALGORITHM
    )


def create_refresh_token() -> str:
    """Generate a secure random refresh token (not JWT — stored hashed in DB)."""
    return secrets.token_urlsafe(64)


def _hash_token(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()


# ─── Refresh token DB operations ─────────────────────────────────────────────

def store_refresh_token(company_id: str, token: str, db: Session) -> None:
    # Revoke all existing tokens for this company (single-session per company)
    db.query(RefreshToken).filter(
        RefreshToken.company_id == company_id,
        RefreshToken.revoked == False
    ).update({"revoked": True})

    rt = RefreshToken(
        company_id=company_id,
        token_hash=_hash_token(token),
        expires_at=datetime.now(timezone.utc) + timedelta(days=REFRESH_EXPIRE_DAYS),
    )
    db.add(rt)
    db.commit()


def validate_refresh_token(token: str, db: Session) -> Optional[Company]:
    """Return Company if refresh token is valid, else None."""
    h = _hash_token(token)
    rt = db.query(RefreshToken).filter(
        RefreshToken.token_hash == h,
        RefreshToken.revoked == False,
    ).first()

    if not rt:
        return None
    if rt.expires_at.replace(tzinfo=timezone.utc) < datetime.now(timezone.utc):
        rt.revoked = True
        db.commit()
        return None

    return db.query(Company).filter(Company.id == rt.company_id).first()


def revoke_refresh_token(token: str, db: Session) -> None:
    h = _hash_token(token)
    db.query(RefreshToken).filter(RefreshToken.token_hash == h).update({"revoked": True})
    db.commit()


# ─── FastAPI dependency — get current company from access token ───────────────

def get_current_company(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(bearer),
    db: Session = Depends(get_db),
) -> Company:
    cred_error = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Not authenticated",
        headers={"WWW-Authenticate": "Bearer"},
    )

    if not credentials:
        raise cred_error

    try:
        payload = jwt.decode(credentials.credentials, SECRET_KEY, algorithms=[ALGORITHM])
        if payload.get("type") != "access":
            raise cred_error
        company_id: str = payload.get("sub")
        if not company_id:
            raise cred_error
    except JWTError:
        raise cred_error

    company = db.query(Company).filter(
        Company.id == company_id,
        Company.is_active == True
    ).first()
    if not company:
        raise cred_error

    return company


# ─── Optional auth (for public widget endpoints) ──────────────────────────────

def get_optional_company(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(bearer),
    db: Session = Depends(get_db),
) -> Optional[Company]:
    if not credentials:
        return None
    try:
        return get_current_company(credentials, db)
    except HTTPException:
        return None
