import streamlit as st
from typing import List, Dict, Any


def render_source_list(sources: List[Dict[str, Any]] = None) -> None:
    """Render source list using native Streamlit components."""

    if sources is None:
        sources = st.session_state.get('sources', [])

    # Header with badge count
    col1, col2 = st.columns([3, 1])
    with col1:
        st.caption("SOURCES")
    with col2:
        st.badge(str(len(sources)), color="violet")

    if not sources:
        st.info("No sources yet. Add documents to get started.")
        return

    # Quick stats
    total_chunks = sum(s.get('chunks', 0) for s in sources)
    st.caption(f"{total_chunks} total chunks")

    # Source list
    for i, source in enumerate(sources):
        render_source_card(source, i)


def render_source_card(source: Dict[str, Any], index: int) -> None:
    """Render a single source card."""

    name = source.get('name', 'Unknown')
    source_type = source.get('type', 'document')
    chunks = source.get('chunks', 0)

    # Type icons
    type_icons = {
        'pdf': '📄',
        'text': '📝',
        'audio': '🎵',
        'youtube': '🎬',
        'website': '🌐',
    }
    icon = type_icons.get(source_type.lower(), '📋')

    # Truncate name
    display_name = name[:22] + '...' if len(name) > 22 else name

    # Use expander for each source
    with st.container(border=True):
        col1, col2 = st.columns([4, 1])
        with col1:
            st.markdown(f"{icon} **{display_name}**")
            st.caption(f"{source_type.upper()} • {chunks} chunks")


def get_source_stats(sources: List[Dict[str, Any]]) -> Dict[str, Any]:
    """Calculate source statistics."""

    if not sources:
        return {
            'total_sources': 0,
            'total_chunks': 0,
            'type_counts': {},
            'avg_chunks': 0
        }

    total_chunks = sum(s.get('chunks', 0) for s in sources)
    type_counts = {}

    for source in sources:
        source_type = source.get('type', 'unknown')
        type_counts[source_type] = type_counts.get(source_type, 0) + 1

    return {
        'total_sources': len(sources),
        'total_chunks': total_chunks,
        'type_counts': type_counts,
        'avg_chunks': total_chunks // len(sources) if sources else 0
    }
