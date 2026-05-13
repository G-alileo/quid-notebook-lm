import streamlit as st
from streamlit_pdf_viewer import pdf_viewer
import logging

logger = logging.getLogger(__name__)


def render_pdf_viewer(source_name: str, pdf_bytes: bytes) -> None:
    """Render a PDF viewer for the given PDF bytes."""

    # Header
    display_name = source_name if len(source_name) <= 50 else source_name[:47] + "..."
    col_back, col_title = st.columns([1, 6])

    with col_back:
        if st.button("← Back", key=f"pdf_back_{source_name}"):
            st.session_state.viewing_pdf = None
            st.rerun()
    with col_title:
        st.markdown(f"### 📄 {display_name}")

    st.divider()

    # Render the PDF
    pdf_viewer(input=pdf_bytes, width=700)