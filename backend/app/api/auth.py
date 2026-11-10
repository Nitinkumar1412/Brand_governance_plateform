"""Authentication and JWT token endpoints."""

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.api.deps import create_access_token, get_current_user, hash_password, verify_password
from app.db import get_db
from app.models import Organization, User

router = APIRouter(prefix="/auth", tags=["auth"])


class LoginRequest(BaseModel):
    email: str
    password: str


class DemoTokenRequest(BaseModel):
    role: str  # admin | creator | reviewer


@router.post("/login")
def login(payload: LoginRequest, db: Session = Depends(get_db)):
    """Standard email/password login returning signed JWT Bearer token."""
    user = db.query(User).filter_by(email=payload.email).first()
    if not user or not verify_password(payload.password, user.password_hash):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Incorrect email or password")
    token = create_access_token(user.id, user.org_id, user.role)
    return {"access_token": token, "token_type": "bearer", "user": {"id": str(user.id), "email": user.email, "full_name": user.full_name, "role": user.role, "org_id": str(user.org_id)}}





@router.post("/demo-token")
def demo_token(payload: DemoTokenRequest, db: Session = Depends(get_db)):
    """1-Click JWT token generator for hackathon judges & demo role toggling."""
    target_role = payload.role.lower()
    user = db.query(User).filter_by(role=target_role).first()
    if not user:
        raise HTTPException(status_code=404, detail=f"No seeded user found with role '{target_role}'")

    token = create_access_token(user.id, user.org_id, user.role)
    return {
        "access_token": token,
        "token_type": "bearer",
        "user": {
            "id": str(user.id),
            "email": user.email,
            "full_name": user.full_name,
            "role": user.role,
            "org_id": str(user.org_id),
        }
    }





@router.get("/me")
def me(current_user: User = Depends(get_current_user)):
    """Returns currently authenticated user extracted from the verified JWT token."""
    return {
        "id": str(current_user.id),
        "email": current_user.email,
        "full_name": current_user.full_name,
        "role": current_user.role,
        "org_id": str(current_user.org_id),
    }


class RegisterRequest(BaseModel):
    email: str
    password: str
    full_name: str
    role: str = "creator"


@router.post("/register")
def register(payload: RegisterRequest, db: Session = Depends(get_db)):
    """Create a new user and return a JWT."""
    allowed_roles = {"admin", "creator", "reviewer"}
    if payload.role not in allowed_roles:
        raise HTTPException(status_code=400, detail="Invalid role")
    if db.query(User).filter_by(email=payload.email).first():
        raise HTTPException(status_code=409, detail="Email already registered")
    org = db.query(Organization).first()
    if not org:
        raise HTTPException(status_code=500, detail="No organization found for registration")
    user = User(
        org_id=org.id,
        email=payload.email,
        full_name=payload.full_name,
        password_hash=hash_password(payload.password),
        role=payload.role,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    token = create_access_token(user.id, user.org_id, user.role)
    return {
        "access_token": token,
        "token_type": "bearer",
        "user": {
            "id": str(user.id),
            "email": user.email,
            "full_name": user.full_name,
            "role": user.role,
            "org_id": str(user.org_id),
        }
    }

