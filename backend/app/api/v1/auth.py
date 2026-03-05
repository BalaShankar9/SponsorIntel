"""
Authentication API endpoints.
"""

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.security import create_access_token
from app.schemas.auth import Token, UserLogin, UserRegister, UserResponse
from app.services.auth import (
    authenticate_user,
    get_current_user_dependency,
    register_user,
)
from app.models.user import User

from fastapi import HTTPException, status

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/register", response_model=Token, status_code=status.HTTP_201_CREATED)
async def register(body: UserRegister, db: AsyncSession = Depends(get_db)):
    """Create a new user account and return a JWT token."""
    user = await register_user(db, body.email, body.password, body.name)
    token = create_access_token(data={"sub": str(user.id)})
    return Token(access_token=token)


@router.post("/login", response_model=Token)
async def login(body: UserLogin, db: AsyncSession = Depends(get_db)):
    """Authenticate and return a JWT token."""
    user = await authenticate_user(db, body.email, body.password)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    token = create_access_token(data={"sub": str(user.id)})
    return Token(access_token=token)


@router.get("/me", response_model=UserResponse)
async def me(current_user: User = Depends(get_current_user_dependency)):
    """Return the currently authenticated user's details."""
    return current_user
