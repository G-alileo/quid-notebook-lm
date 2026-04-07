from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from quid_notebook.api.dependencies import get_db, get_current_user
from quid_notebook.core.user import User
from quid_notebook.schemas.user import UserResponse, UserUpdate, PasswordChangeRequest, MessageResponse
from quid_notebook.services.user import UserService
from quid_notebook.services.auth import AuthServiceError

router = APIRouter(prefix="/users", tags=["Users"])


@router.get("/me", response_model=UserResponse)
def get_profile(user: User = Depends(get_current_user)):
    return UserResponse.model_validate(user)


@router.patch("/me", response_model=UserResponse)
def update_profile(
    data: UserUpdate,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    try:
        return UserService(db).update_profile(user, data)
    except AuthServiceError as e:
        raise HTTPException(e.status_code, e.message)


@router.post("/me/password", response_model=MessageResponse)
def change_password(
    data: PasswordChangeRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    try:
        UserService(db).change_password(user, data.current_password, data.new_password)
        return MessageResponse(message="Password changed")
    except AuthServiceError as e:
        raise HTTPException(e.status_code, e.message)


@router.delete("/me", response_model=MessageResponse)
def deactivate_account(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    UserService(db).deactivate(user)
    return MessageResponse(message="Account deactivated")
