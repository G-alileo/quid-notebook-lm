import requests
from dataclasses import dataclass
from typing import Optional
import streamlit as st
import os


@dataclass
class User:
    id: str
    username: str
    email: str
    full_name: Optional[str]
    is_active: bool
    is_verified: bool


@dataclass
class AuthTokens:
    access_token: str
    refresh_token: str
    expires_in: int
    user: User


class AuthClient:
    def __init__(self):
        self.base_url = os.getenv("AUTH_API_URL", "http://localhost:8000")

    def register(self, username: str, email: str, password: str, full_name: str = None) -> tuple[bool, str]:
        try:
            response = requests.post(
                f"{self.base_url}/auth/register",
                json={
                    "username": username,
                    "email": email,
                    "password": password,
                    "full_name": full_name
                },
                timeout=10
            )
            if response.status_code == 200:
                self._store_tokens(response.json())
                return True, "Registration successful"
            return False, response.json().get("detail", "Registration failed")
        except requests.RequestException as e:
            return False, f"Connection error: {str(e)}"

    def login(self, identifier: str, password: str) -> tuple[bool, str]:
        try:
            response = requests.post(
                f"{self.base_url}/auth/login",
                json={"identifier": identifier, "password": password},
                timeout=10
            )
            if response.status_code == 200:
                self._store_tokens(response.json())
                return True, "Login successful"
            return False, response.json().get("detail", "Invalid credentials")
        except requests.RequestException as e:
            return False, f"Connection error: {str(e)}"

    def logout(self) -> None:
        token = st.session_state.get("access_token")
        if token:
            try:
                requests.post(
                    f"{self.base_url}/auth/logout",
                    headers={"Authorization": f"Bearer {token}"},
                    timeout=5
                )
            except requests.RequestException:
                pass
        self._clear_tokens()

    def refresh_tokens(self) -> bool:
        refresh_token = st.session_state.get("refresh_token")
        if not refresh_token:
            return False
        try:
            response = requests.post(
                f"{self.base_url}/auth/refresh",
                json={"refresh_token": refresh_token},
                timeout=10
            )
            if response.status_code == 200:
                self._store_tokens(response.json())
                return True
            self._clear_tokens()
            return False
        except requests.RequestException:
            return False

    def is_authenticated(self) -> bool:
        token = st.session_state.get("access_token")
        if not token:
            return False
        try:
            response = requests.get(
                f"{self.base_url}/auth/verify",
                headers={"Authorization": f"Bearer {token}"},
                timeout=5
            )
            if response.status_code == 200:
                return True
            if response.status_code == 401:
                return self.refresh_tokens()
            return False
        except requests.RequestException:
            return False

    def get_current_user(self) -> Optional[User]:
        return st.session_state.get("current_user")

    def _store_tokens(self, data: dict) -> None:
        st.session_state.access_token = data["access_token"]
        st.session_state.refresh_token = data["refresh_token"]
        user_data = data["user"]
        st.session_state.current_user = User(
            id=user_data["id"],
            username=user_data["username"],
            email=user_data["email"],
            full_name=user_data.get("full_name"),
            is_active=user_data["is_active"],
            is_verified=user_data["is_verified"]
        )

    def _clear_tokens(self) -> None:
        for key in ["access_token", "refresh_token", "current_user"]:
            if key in st.session_state:
                del st.session_state[key]


auth_client = AuthClient()
