from datetime import datetime, timezone
from typing import Optional
from sqlalchemy.orm import Session
from sqlalchemy import or_

from quid_notebook.core.user import User
from quid_notebook.schemas.user import UserCreate, UserLogin, TokenResponse, UserResponse
from quid_notebook.core.security import PasswordHasher, JWTManager
from quid_notebook.core.config import settings


class AuthServiceError(Exception):
    def __init__(self, message: str, status_code: int = 400):
        self.message = message
        self.status_code = status_code
        super().__init__(self.message)


class AuthService:
    def __init__(self, db: Session):
        self.db = db

    def register(self, data: UserCreate) -> TokenResponse:
        self._check_user_exists(data.username, data.email)

        user = User(
            username=data.username,
            email=data.email,
            hashed_password=PasswordHasher.hash(data.password),
            full_name=data.full_name
        )
        self.db.add(user)
        self.db.commit()
        self.db.refresh(user)

        return self._generate_tokens(user)

    def login(self, data: UserLogin) -> TokenResponse:
        user = self._get_user_by_identifier(data.identifier)

        if not user or not PasswordHasher.verify(data.password, user.hashed_password):
            raise AuthServiceError("Invalid credentials", 401)

        if not user.is_active:
            raise AuthServiceError("Account is deactivated", 403)

        user.last_login = datetime.now(timezone.utc)
        self.db.commit()

        return self._generate_tokens(user)

    def refresh_tokens(self, refresh_token: str) -> TokenResponse:
        payload = JWTManager.decode_token(refresh_token, "refresh")
        if not payload:
            raise AuthServiceError("Invalid refresh token", 401)

        user = self.db.query(User).filter(User.id == payload.user_id).first()
        if not user or not user.is_active:
            raise AuthServiceError("User not found or inactive", 401)

        if user.refresh_token != refresh_token:
            raise AuthServiceError("Token has been revoked", 401)

        if user.refresh_token_expires_at and user.refresh_token_expires_at < datetime.now(timezone.utc):
            raise AuthServiceError("Refresh token expired", 401)

        return self._generate_tokens(user)

    def logout(self, user: User) -> None:
        user.refresh_token = None
        user.refresh_token_expires_at = None
        self.db.commit()

    def verify_token(self, token: str) -> Optional[User]:
        payload = JWTManager.decode_token(token, "access")
        if not payload:
            return None
        return self.db.query(User).filter(User.id == payload.user_id).first()

    def _check_user_exists(self, username: str, email: str) -> None:
        exists = self.db.query(User).filter(
            or_(User.username == username, User.email == email)
        ).first()
        if exists:
            field = "Username" if exists.username == username else "Email"
            raise AuthServiceError(f"{field} already registered")

    def _get_user_by_identifier(self, identifier: str) -> Optional[User]:
        return self.db.query(User).filter(
            or_(User.username == identifier.lower(), User.email == identifier.lower())
        ).first()

    def _generate_tokens(self, user: User) -> TokenResponse:
        access_token = JWTManager.create_access_token(user.id, user.username, user.email)
        refresh_token, expires_at = JWTManager.create_refresh_token(user.id)

        user.refresh_token = refresh_token
        user.refresh_token_expires_at = expires_at
        self.db.commit()

        return TokenResponse(
            access_token=access_token,
            refresh_token=refresh_token,
            expires_in=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
            user=UserResponse.model_validate(user)
        )
