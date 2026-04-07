from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from quid_notebook.api.dependencies import get_db, get_current_user
from quid_notebook.core.user import User
from quid_notebook.schemas.user import UserCreate, UserLogin, TokenResponse, TokenRefreshRequest, MessageResponse
from quid_notebook.services.auth import AuthService, AuthServiceError

router = APIRouter(prefix="/auth", tags=["Authentication"])


@router.post("/register", response_model=TokenResponse)
def register(data: UserCreate, db: Session = Depends(get_db)):
    try:
        return AuthService(db).register(data)
    except AuthServiceError as e:
        raise HTTPException(e.status_code, e.message)


@router.post("/login", response_model=TokenResponse)
def login(data: UserLogin, db: Session = Depends(get_db)):
    try:
        return AuthService(db).login(data)
    except AuthServiceError as e:
        raise HTTPException(e.status_code, e.message)


@router.post("/refresh", response_model=TokenResponse)
def refresh(data: TokenRefreshRequest, db: Session = Depends(get_db)):
    try:
        return AuthService(db).refresh_tokens(data.refresh_token)
    except AuthServiceError as e:
        raise HTTPException(e.status_code, e.message)


@router.post("/logout", response_model=MessageResponse)
def logout(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    AuthService(db).logout(user)
    return MessageResponse(message="Logged out successfully")


@router.get("/verify", response_model=MessageResponse)
def verify(user: User = Depends(get_current_user)):
    return MessageResponse(message="Token is valid")
