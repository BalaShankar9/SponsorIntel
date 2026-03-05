"""
Authentication service: user registration, login, JWT dependency, plan gating.
"""

import uuid
from datetime import datetime
from typing import Optional

from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.security import (
    create_access_token,
    decode_access_token,
    hash_password,
    verify_password,
)
from app.models.enums import UserPlan
from app.models.user import User

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/v1/auth/login")

# Plan hierarchy for gating
_PLAN_ORDER = {UserPlan.FREE: 0, UserPlan.PRO: 1, UserPlan.ENTERPRISE: 2}


async def register_user(
    db: AsyncSession,
    email: str,
    password: str,
    name: str,
) -> User:
    """Register a new user. Raises 409 if email already taken."""
    existing = await db.execute(select(User).where(User.email == email))
    if existing.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Email already registered",
        )

    user = User(
        id=uuid.uuid4(),
        email=email,
        password_hash=hash_password(password),
        name=name,
        plan=UserPlan.FREE,
        created_at=datetime.utcnow(),
    )
    db.add(user)
    await db.flush()
    return user


async def authenticate_user(
    db: AsyncSession,
    email: str,
    password: str,
) -> Optional[User]:
    """Verify credentials and return User, or None if invalid."""
    result = await db.execute(select(User).where(User.email == email))
    user = result.scalar_one_or_none()
    if not user or not user.password_hash:
        return None
    if not verify_password(password, user.password_hash):
        return None

    # Update last login
    user.last_login = datetime.utcnow()
    return user


async def get_current_user(token: str, db: AsyncSession) -> User:
    """Decode JWT and return the authenticated User."""
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = decode_access_token(token)
        user_id: Optional[str] = payload.get("sub")
        if user_id is None:
            raise credentials_exception
    except JWTError:
        raise credentials_exception

    result = await db.execute(
        select(User).where(User.id == uuid.UUID(user_id))
    )
    user = result.scalar_one_or_none()
    if user is None:
        raise credentials_exception
    return user


async def get_current_user_dependency(
    token: str = Depends(oauth2_scheme),
    db: AsyncSession = Depends(get_db),
) -> User:
    """FastAPI dependency that extracts the current user from the JWT Bearer token."""
    return await get_current_user(token, db)


def require_plan(user: User, min_plan: UserPlan) -> None:
    """
    Raise 403 if the user's plan is below the required minimum.

    Plan hierarchy: FREE < PRO < ENTERPRISE
    """
    if _PLAN_ORDER.get(user.plan, 0) < _PLAN_ORDER.get(min_plan, 0):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"This feature requires the {min_plan.value} plan or higher",
        )
