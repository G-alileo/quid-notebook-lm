import streamlit as st


def render_navigation() -> str:
    """Render navigation using st.pills for a modern UI."""

    # App header
    col1, col2 = st.columns([1, 4])
    with col1:
        st.markdown("""
        <div style="
            width: 38px;
            height: 38px;
            background: #8b5cf6;
            border-radius: 10px;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 18px;
            font-weight: bold;
            color: white;
        ">Q</div>
        """, unsafe_allow_html=True)
    with col2:
        st.markdown("**Quid Notebook**")
        st.caption("Knowledge Engine")

    st.divider()

    # Navigation using pills
    if 'current_page' not in st.session_state:
        st.session_state.current_page = "Add Sources"

    # Map display labels to page names
    nav_options = {
        "📁 Sources": "Add Sources",
        "💬 Chat": "Chat",
        "🎙️ Studio": "Studio"
    }

    # Find current index
    current_label = None
    for label, page in nav_options.items():
        if page == st.session_state.current_page:
            current_label = label
            break

    # Use pills for navigation
    selected = st.pills(
        "Navigation",
        options=list(nav_options.keys()),
        default=current_label,
        label_visibility="collapsed"
    )

    if selected:
        new_page = nav_options[selected]
        if new_page != st.session_state.current_page:
            st.session_state.current_page = new_page
            st.rerun()

    # Status indicator using badge
    st.divider()
    st.badge("Online", icon=":material/check_circle:", color="green")

    return st.session_state.current_page
