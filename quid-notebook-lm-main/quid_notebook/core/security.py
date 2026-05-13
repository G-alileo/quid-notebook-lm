from datetime import datetime, timedelta, timezone
from typing import Optional
from jose import JWTError, jwt
from passlib.context import CryptContext
from dataclasses import dataclass

from quid_notebook.core.config import settings


@dataclass
class TokenPayload:
    user_id: str
    username: str
    email: str
    token_type: str


class PasswordHasher:
    _context = CryptContext(schemes=["bcrypt"], deprecated="auto")

    @classmethod
    def hash(cls, password: str) -> str:
        return cls._context.hash(password)

    @classmethod
    def verify(cls, plain: str, hashed: str) -> bool:
        return cls._context.verify(plain, hashed)


class JWTManager:
    @staticmethod
    def _create_token(data: dict, expires_delta: timedelta, token_type: str) -> str:
        payload = {
            **data,
            "exp": datetime.now(timezone.utc) + expires_delta,
            "iat": datetime.now(timezone.utc),
            "type": token_type
        }
        return jwt.encode(payload, settings.JWT_SECRET_KEY, algorithm=settings.JWT_ALGORITHM)

    @classmethod
    def create_access_token(cls, user_id: str, username: str, email: str) -> str:
        return cls._create_token(
            {"sub": user_id, "username": username, "email": email},
            timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES),
            "access"
        )

    @classmethod
    def create_refresh_token(cls, user_id: str) -> tuple[str, datetime]:
        expires_at = datetime.now(timezone.utc) + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS)
        token = cls._create_token(
            {"sub": user_id},
            timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS),
            "refresh"
        )
        return token, expires_at

    @classmethod
    def decode_token(cls, token: str, expected_type: str = "access") -> Optional[TokenPayload]:
        try:
            payload = jwt.decode(token, settings.JWT_SECRET_KEY, algorithms=[settings.JWT_ALGORITHM])
            if payload.get("type") != expected_type:
                return None
            return TokenPayload(
                user_id=payload.get("sub"),
                username=payload.get("username", ""),
                email=payload.get("email", ""),
                token_type=expected_type
            )
        except JWTError:
            return None
