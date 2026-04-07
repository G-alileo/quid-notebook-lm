from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session

from quid_notebook.core.database import database
from quid_notebook.core.security import JWTManager
from quid_notebook.core.user import User

security = HTTPBearer()


def get_db():
    yield from database.get_session()


def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: Session = Depends(get_db)
) -> User:
    payload = JWTManager.decode_token(credentials.credentials, "access")

    if not payload:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid token")

    user = db.query(User).filter(User.id == payload.user_id).first()

    if not user:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "User not found")

    if not user.is_active:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Account deactivated")

    return user
