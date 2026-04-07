import streamlit as st
from quid_notebook.services.auth_client import auth_client


def render_auth_page() -> bool:
    st.markdown(
        """
        <style>
        .auth-container { max-width: 400px; margin: 0 auto; padding-top: 50px; }
        .auth-header { text-align: center; margin-bottom: 30px; }
        .auth-header h1 { font-size: 2.5rem; margin-bottom: 10px; }
        </style>
        """,
        unsafe_allow_html=True
    )

    col1, col2, col3 = st.columns([1, 2, 1])

    with col2:
        st.markdown('<div class="auth-header">', unsafe_allow_html=True)
        st.title("📓 Quid Notebook")
        st.caption("AI-powered knowledge engine")
        st.markdown('</div>', unsafe_allow_html=True)

        if "auth_mode" not in st.session_state:
            st.session_state.auth_mode = "login"

        tab1, tab2 = st.tabs(["Login", "Register"])

        with tab1:
            _render_login_form()

        with tab2:
            _render_register_form()

    return auth_client.is_authenticated()


def _render_login_form():
    with st.form("login_form"):
        identifier = st.text_input("Username or Email")
        password = st.text_input("Password", type="password")
        submitted = st.form_submit_button("Login", use_container_width=True)

        if submitted:
            if not identifier or not password:
                st.error("Please fill in all fields")
                return

            success, message = auth_client.login(identifier, password)
            if success:
                st.success(message)
                st.rerun()
            else:
                st.error(message)


def _render_register_form():
    with st.form("register_form"):
        username = st.text_input("Username")
        email = st.text_input("Email")
        full_name = st.text_input("Full Name (optional)")
        password = st.text_input("Password", type="password")
        confirm_password = st.text_input("Confirm Password", type="password")
        submitted = st.form_submit_button("Register", use_container_width=True)

        if submitted:
            if not username or not email or not password:
                st.error("Please fill in required fields")
                return

            if password != confirm_password:
                st.error("Passwords do not match")
                return

            if len(password) < 8:
                st.error("Password must be at least 8 characters")
                return

            success, message = auth_client.register(username, email, password, full_name or None)
            if success:
                st.success(message)
                st.rerun()
            else:
                st.error(message)


def render_user_menu():
    user = auth_client.get_current_user()
    if user:
        with st.sidebar:
            st.markdown("---")
            st.markdown(f"**{user.full_name or user.username}**")
            st.caption(user.email)
            if st.button("Logout", use_container_width=True):
                auth_client.logout()
                st.rerun()
