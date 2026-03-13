# """Authentication router for user login, register, and token management."""

# from fastapi import APIRouter, Depends, HTTPException, status, Request
# from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
# from sqlalchemy.orm import Session
# from database import get_db
# from models import Company, User
# from schemas import (
#     UserRegister, UserLogin, TokenResponse, UserResponse,
#     CompanyCreate, CompanyResponse
# )
# from services.auth import create_access_token, decode_access_token, get_password_hash, verify_password
# from datetime import timedelta

# router = APIRouter(tags=["authentication"])

# security = HTTPBearer(auto_error=False)


# async def get_current_user(
#     request: Request,
#     credentials: HTTPAuthorizationCredentials = Depends(security),
#     db: Session = Depends(get_db)
# ) -> User:
#     """Get current authenticated user from JWT token."""
#     if not credentials:
#         raise HTTPException(
#             status_code=status.HTTP_401_UNAUTHORIZED,
#             detail="Not authenticated",
#             headers={"WWW-Authenticate": "Bearer"},
#         )

#     payload = decode_access_token(credentials.credentials)
#     if not payload:
#         raise HTTPException(
#             status_code=status.HTTP_401_UNAUTHORIZED,
#             detail="Invalid or expired token",
#             headers={"WWW-Authenticate": "Bearer"},
#         )

#     user_id = payload.get("sub")
#     if not user_id:
#         raise HTTPException(
#             status_code=status.HTTP_401_UNAUTHORIZED,
#             detail="Invalid token",
#             headers={"WWW-Authenticate": "Bearer"},
#         )

#     user = db.query(User).filter(User.id == user_id).first()
#     if not user:
#         raise HTTPException(
#             status_code=status.HTTP_401_UNAUTHORIZED,
#             detail="User not found",
#             headers={"WWW-Authenticate": "Bearer"},
#         )

#     return user


# @router.post("/register", response_model=TokenResponse)
# async def register(user_in: UserRegister, db: Session = Depends(get_db)):
#     """Register a new user.

#     If company_id is provided, join that company.
#     If company_name is provided (without company_id), create a new company.
#     """
#     # Check if user already exists
#     existing_user = db.query(User).filter(User.email == user_in.email).first()
#     if existing_user:
#         raise HTTPException(
#             status_code=status.HTTP_400_BAD_REQUEST,
#             detail="Email already registered"
#         )

#     company_id = user_in.company_id

#     # Create new company if company_name provided and no company_id
#     if not company_id and user_in.company_name:
#         new_company = Company(name=user_in.company_name)
#         db.add(new_company)
#         db.commit()
#         db.refresh(new_company)
#         company_id = new_company.id
#     elif not company_id:
#         raise HTTPException(
#             status_code=status.HTTP_400_BAD_REQUEST,
#             detail="Either company_id or company_name must be provided"
#         )

#     # Verify company exists if company_id provided
#     company = db.query(Company).filter(Company.id == company_id).first()
#     if not company:
#         raise HTTPException(
#             status_code=status.HTTP_404_NOT_FOUND,
#             detail="Company not found"
#         )

#     # Create user
#     user = User(
#         email=user_in.email,
#         password_hash=get_password_hash(user_in.password),
#         name=user_in.name,
#         company_id=company_id,
#         is_admin=True  # First user in company is admin
#     )
#     db.add(user)
#     db.commit()
#     db.refresh(user)

#     # Create access token
#     access_token = create_access_token(
#         data={"sub": user.id, "email": user.email, "company_id": user.company_id}
#     )

#     return TokenResponse(
#         access_token=access_token,
#         user={
#             "id": user.id,
#             "email": user.email,
#             "name": user.name,
#             "company_id": user.company_id,
#             "is_admin": user.is_admin
#         }
#     )


# @router.post("/login", response_model=TokenResponse)
# async def login(user_in: UserLogin, db: Session = Depends(get_db)):
#     """Login with email and password."""
#     user = db.query(User).filter(User.email == user_in.email).first()
#     if not user:
#         raise HTTPException(
#             status_code=status.HTTP_401_UNAUTHORIZED,
#             detail="Invalid email or password"
#         )

#     if not verify_password(user_in.password, user.password_hash):
#         raise HTTPException(
#             status_code=status.HTTP_401_UNAUTHORIZED,
#             detail="Invalid email or password"
#         )

#     # Create access token
#     access_token = create_access_token(
#         data={"sub": user.id, "email": user.email, "company_id": user.company_id}
#     )

#     return TokenResponse(
#         access_token=access_token,
#         user={
#             "id": user.id,
#             "email": user.email,
#             "name": user.name,
#             "company_id": user.company_id,
#             "is_admin": user.is_admin
#         }
#     )


# @router.get("/me", response_model=UserResponse)
# async def get_current_user_info(current_user: User = Depends(get_current_user)):
#     """Get current authenticated user information."""
#     return current_user


# @router.get("/company", response_model=CompanyResponse)
# async def get_company(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
#     """Get current user's company information."""
#     company = db.query(Company).filter(Company.id == current_user.company_id).first()
#     if not company:
#         raise HTTPException(
#             status_code=status.HTTP_404_NOT_FOUND,
#             detail="Company not found"
#         )
#     return company


# @router.post("/invite", response_model=dict)
# async def invite_user(
#     email: str,
#     name: str = None,
#     is_admin: bool = False,
#     current_user: User = Depends(get_current_user),
#     db: Session = Depends(get_db)
# ):
#     """Invite a user to the company (admin only)."""
#     if not current_user.is_admin:
#         raise HTTPException(
#             status_code=status.HTTP_403_FORBIDDEN,
#             detail="Only admins can invite users"
#         )

#     # Check if user exists
#     existing_user = db.query(User).filter(User.email == email).first()
#     if existing_user:
#         if existing_user.company_id == current_user.company_id:
#             raise HTTPException(
#                 status_code=status.HTTP_400_BAD_REQUEST,
#                 detail="User already in your company"
#             )
#         else:
#             raise HTTPException(
#                 status_code=status.HTTP_400_BAD_REQUEST,
#                 detail="User already belongs to another company"
#             )

#     # Generate temporary token for invite
#     invite_token = create_access_token(
#         data={"email": email, "company_id": current_user.company_id, "invite": True},
#         expires_delta=timedelta(days=7)
#     )

#     # Create user with temporary password (they need to reset)
#     import uuid
#     temp_password = str(uuid.uuid4())[:8]

#     user = User(
#         email=email,
#         password_hash=get_password_hash(temp_password),
#         name=name,
#         company_id=current_user.company_id,
#         is_admin=is_admin
#     )
#     db.add(user)
#     db.commit()

#     return {
#         "message": f"User {email} invited successfully",
#         "temporary_password": temp_password,
#         "note": "Share this password securely with the invited user"
#     }


"""
Authentication router
──────────────────────
POST /api/auth/register   — create company account
POST /api/auth/login      — returns access token + sets refresh cookie
POST /api/auth/refresh    — uses refresh cookie → new access token
POST /api/auth/logout     — revokes refresh token + clears cookie
GET  /api/auth/me         — current company profile
PUT  /api/auth/me         — update company profile (name, logo)
PUT  /api/auth/password   — change password
"""

from fastapi import APIRouter, Depends, HTTPException, Response, Request, status
from sqlalchemy.orm import Session
from database import get_db
from models import Company, User
from schemas import (
    CompanyRegister, CompanyLogin, CompanyResponse,
    TokenResponse, UpdateCompanyProfile, ChangePassword
)
from services.auth_service import (
    hash_password, verify_password,
    create_access_token, create_refresh_token,
    store_refresh_token, validate_refresh_token, revoke_refresh_token,
    get_current_company, REFRESH_COOKIE, REFRESH_EXPIRE_DAYS
)
from services.security_guard import login_limiter
from datetime import timedelta

router = APIRouter(prefix="/api/auth", tags=["auth"])


# ─── Register ─────────────────────────────────────────────────────────────────

@router.post("/register", response_model=TokenResponse, status_code=201)
async def register(body: CompanyRegister, response: Response, db: Session = Depends(get_db)):
    """Register a new company account."""
    # Check email uniqueness
    if db.query(Company).filter(Company.email == body.email.lower()).first():
        raise HTTPException(status_code=409, detail="Email already registered")

    company = Company(
        name=body.company_name,
        email=body.email.lower(),
        hashed_password=hash_password(body.password),
        plan="free",
    )
    db.add(company)
    db.commit()
    db.refresh(company)

    # Also create the owner User record
    owner = User(
        company_id=company.id,
        email=body.email.lower(),
        hashed_password=company.hashed_password,
        full_name=body.full_name or body.company_name,
        role="owner",
    )
    db.add(owner)
    db.commit()

    return _issue_tokens(company, response, db)


# ─── Login ────────────────────────────────────────────────────────────────────

@router.post("/login", response_model=TokenResponse)
async def login(body: CompanyLogin, request: Request, response: Response, db: Session = Depends(get_db)):
    """Login with company email + password."""
    # Rate limit by IP
    client_ip = request.client.host if request.client else "unknown"
    if not login_limiter.is_allowed(client_ip):
        raise HTTPException(status_code=429, detail="Too many login attempts. Please wait.")

    company = db.query(Company).filter(
        Company.email == body.email.lower(),
        Company.is_active == True
    ).first()

    if not company or not verify_password(body.password, company.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password"
        )

    return _issue_tokens(company, response, db)


# ─── Refresh ──────────────────────────────────────────────────────────────────

@router.post("/refresh", response_model=TokenResponse)
async def refresh(request: Request, response: Response, db: Session = Depends(get_db)):
    """Exchange refresh cookie for a new access token."""
    token = request.cookies.get(REFRESH_COOKIE)
    if not token:
        raise HTTPException(status_code=401, detail="No refresh token")

    company = validate_refresh_token(token, db)
    if not company:
        raise HTTPException(status_code=401, detail="Refresh token invalid or expired")

    # Rotate refresh token
    revoke_refresh_token(token, db)
    return _issue_tokens(company, response, db)


# ─── Logout ───────────────────────────────────────────────────────────────────

@router.post("/logout")
async def logout(request: Request, response: Response, db: Session = Depends(get_db)):
    """Revoke refresh token and clear cookie."""
    token = request.cookies.get(REFRESH_COOKIE)
    if token:
        revoke_refresh_token(token, db)

    response.delete_cookie(
        key=REFRESH_COOKIE,
        httponly=True,
        samesite="lax",
        secure=False,
    )
    return {"message": "Logged out successfully"}


# ─── Me ───────────────────────────────────────────────────────────────────────

@router.get("/me", response_model=CompanyResponse)
async def me(company: Company = Depends(get_current_company)):
    return _company_response(company)


@router.put("/me", response_model=CompanyResponse)
async def update_profile(
    body: UpdateCompanyProfile,
    company: Company = Depends(get_current_company),
    db: Session = Depends(get_db),
):
    if body.company_name is not None:
        company.name = body.company_name
    if body.logo_url is not None:
        company.logo_url = body.logo_url
    db.commit()
    db.refresh(company)
    return _company_response(company)


@router.put("/password")
async def change_password(
    body: ChangePassword,
    company: Company = Depends(get_current_company),
    db: Session = Depends(get_db),
):
    if not verify_password(body.current_password, company.hashed_password):
        raise HTTPException(status_code=400, detail="Current password is incorrect")
    if len(body.new_password) < 8:
        raise HTTPException(status_code=400, detail="New password must be at least 8 characters")

    company.hashed_password = hash_password(body.new_password)
    db.commit()

    # Also update owner user record
    from models import User
    owner = db.query(User).filter(
        User.company_id == company.id,
        User.role == "owner"
    ).first()
    if owner:
        owner.hashed_password = company.hashed_password
        db.commit()

    return {"message": "Password changed successfully"}


# ─── Helpers ──────────────────────────────────────────────────────────────────

def _issue_tokens(company: Company, response: Response, db: Session) -> dict:
    access_token  = create_access_token(company.id)
    refresh_token = create_refresh_token()
    store_refresh_token(company.id, refresh_token, db)

    # Set refresh token as httpOnly cookie
    response.set_cookie(
        key=REFRESH_COOKIE,
        value=refresh_token,
        httponly=True,
        samesite="lax",
        secure=False,   # set True in production with HTTPS
        max_age=int(timedelta(days=REFRESH_EXPIRE_DAYS).total_seconds()),
        path="/api/auth",
    )

    return TokenResponse(
        access_token=access_token,
        token_type="bearer",
        company=_company_response(company),
    )


def _company_response(company: Company) -> dict:
    return CompanyResponse(
        id=company.id,
        company_name=company.name,
        email=company.email,
        plan=company.plan,
        logo_url=company.logo_url,
        is_active=company.is_active,
        created_at=company.created_at,
    )
