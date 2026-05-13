from sqlalchemy.orm import Session

from quid_notebook.core.user import User
from quid_notebook.schemas.user import UserUpdate, UserResponse
from quid_notebook.core.security import PasswordHasher
from quid_notebook.services.auth import AuthServiceError


class UserService:
    def __init__(self, db: Session):
        self.db = db

    def get_profile(self, user: User) -> UserResponse:
        return UserResponse.model_validate(user)

    def update_profile(self, user: User, data: UserUpdate) -> UserResponse:
        update_data = data.model_dump(exclude_unset=True)

        if "email" in update_data and update_data["email"]:
            self._check_email_available(update_data["email"], user.id)

        for key, value in update_data.items():
            setattr(user, key, value)

        self.db.commit()
        self.db.refresh(user)
        return UserResponse.model_validate(user)

    def change_password(self, user: User, current: str, new: str) -> None:
        if not PasswordHasher.verify(current, user.hashed_password):
            raise AuthServiceError("Current password is incorrect")

        user.hashed_password = PasswordHasher.hash(new)
        user.refresh_token = None
        user.refresh_token_expires_at = None
        self.db.commit()

    def deactivate(self, user: User) -> None:
        user.is_active = False
        user.refresh_token = None
        user.refresh_token_expires_at = None
        self.db.commit()

    def _check_email_available(self, email: str, exclude_user_id: str) -> None:
        existing = self.db.query(User).filter(
            User.email == email,
            User.id != exclude_user_id
        ).first()
        if existing:
            raise AuthServiceError("Email already in use")
