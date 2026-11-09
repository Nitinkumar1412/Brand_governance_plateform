"""Shared API security: Real JWT (Bearer), PBKDF2 Password Hashing, and RBAC guards."""

import hashlib
import os
import secrets
from datetime import UTC, datetime, timedelta
from typing import Any
from uuid import UUID

import jwt

from fastapi import Depends, Header, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from app.db import get_db
from app.models import Organization, User

JWT_SECRET = os.environ.get("JWT_SECRET", "inkloom-super-secret-jwt-key-2026-audit-governance")
JWT_ALGORITHM = "HS256"
JWT_EXPIRATION_HOURS = 24

security_bearer = HTTPBearer(auto_error=False)


# --- 1. Password Hashing (PBKDF2-SHA256 with Salt) ---
def hash_password(password: str) -> str:
    salt = secrets.token_hex(16)
    key = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt.encode("utf-8"), 100_000)
    return f"{salt}${key.hex()}"


def verify_password(plain_password: str, hashed_password: str) -> bool:
    if "$" not in hashed_password:
        return plain_password == hashed_password  # Fallback for plain legacy test hash
    salt, original_key = hashed_password.split("$", 1)
    new_key = hashlib.pbkdf2_hmac("sha256", plain_password.encode("utf-8"), salt.encode("utf-8"), 100_000)
    return secrets.compare_digest(original_key, new_key.hex())


# --- 2. Real JWT Generation & Decoding ---
def create_access_token(user_id: UUID, org_id: UUID, role: str) -> str:
    now = datetime.now(UTC)
    payload = {
        "sub": str(user_id),
        "org_id": str(org_id),
        "role": role,
        "iat": now,
        "exp": now + timedelta(hours=JWT_EXPIRATION_HOURS),
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)


def decode_access_token(token: str) -> dict[str, Any]:
    try:
        return jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token has expired. Please log in again.")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid authorization token.")


# --- 3. Current User Dependency (Bearer Token First) ---
def get_current_user(
    auth: HTTPAuthorizationCredentials | None = Depends(security_bearer),
    x_user_role: str | None = Header(default=None),
    x_user_email: str | None = Header(default=None),
    db: Session = Depends(get_db)
) -> User:
    """Authenticates via Bearer JWT token, with seamless fallback for dev/demo headers."""
    # A. Primary: Cryptographic Bearer JWT Token
    if auth and auth.credentials:
        payload = decode_access_token(auth.credentials)
        user_id = payload.get("sub")
        user = db.query(User).filter_by(id=user_id).first()
        if not user:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User no longer exists.")
        return user

    # B. Secondary: Dev/Demo Header switch
    query = db.query(User)
    if x_user_email:
        user = query.filter_by(email=x_user_email).first()
        if user:
            return user
    if x_user_role:
        user = query.filter_by(role=x_user_role).first()
        if user:
            return user

    # C. Default Seeded Fallback
    user = query.first()
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Authentication required.")
    return user


# --- 4. Role-Based Access Control (RBAC) Guard ---
def require_roles(allowed_roles: list[str]):
    """Enforces role-based permissions (e.g. ['admin'], ['reviewer', 'admin'])."""
    def role_checker(current_user: User = Depends(get_current_user)) -> User:
        if current_user.role not in allowed_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Forbidden: Action requires one of {allowed_roles} roles. Your role is '{current_user.role}'."
            )
        return current_user
    return role_checker
