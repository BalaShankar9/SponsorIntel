"""
Shared API dependencies for authentication and plan gating.
"""

from typing import Optional

from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.models.enums import UserPlan
from app.models.user import User
from app.services.auth import get_current_user

# auto_error=False so that missing tokens return None instead of 401
oauth2_scheme_optional = OAuth2PasswordBearer(
    tokenUrl="/api/v1/auth/login", auto_error=False
)
oauth2_scheme_required = OAuth2PasswordBearer(tokenUrl="/api/v1/auth/login")

_PLAN_ORDER = {UserPlan.FREE: 0, UserPlan.PRO: 1, UserPlan.ENTERPRISE: 2}


async def optional_auth(
    token: Optional[str] = Depends(oauth2_scheme_optional),
    db: AsyncSession = Depends(get_db),
) -> Optional[User]:
    """Return User if a valid token is provided, otherwise None."""
    if token is None:
        return None
    try:
        return await get_current_user(token, db)
    except HTTPException:
        return None


async def require_auth(
    token: str = Depends(oauth2_scheme_required),
    db: AsyncSession = Depends(get_db),
) -> User:
    """Require a valid authenticated user."""
    return await get_current_user(token, db)


async def require_pro(
    user: User = Depends(require_auth),
) -> User:
    """Require PRO or ENTERPRISE plan."""
    if _PLAN_ORDER.get(user.plan, 0) < _PLAN_ORDER[UserPlan.PRO]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="This feature requires the pro plan or higher",
        )
    return user


async def require_enterprise(
    user: User = Depends(require_auth),
) -> User:
    """Require ENTERPRISE plan."""
    if _PLAN_ORDER.get(user.plan, 0) < _PLAN_ORDER[UserPlan.ENTERPRISE]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="This feature requires the enterprise plan",
        )
    return user


async def require_admin(
    user: User = Depends(require_auth),
) -> User:
    """Require admin privileges."""
    if not user.is_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin access required",
        )
    return user
