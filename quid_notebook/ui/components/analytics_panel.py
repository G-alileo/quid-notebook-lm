import streamlit as st
from typing import List, Dict, Any

from quid_notebook.ui.charts.source_charts import render_source_type_pie, render_chunks_bar
from quid_notebook.ui.charts.chat_charts import (
    render_citation_frequency,
    render_relevance_distribution,
    render_chat_metrics_summary
)
from quid_notebook.ui.charts.podcast_charts import (
    render_script_gauge,
    render_speaker_balance,
    get_podcast_script_stats
)
from quid_notebook.ui.components.source_list import get_source_stats


def render_analytics_panel(current_page: str) -> None:
    """Render analytics panel using native Streamlit components."""

    st.markdown("**Analytics**")
    st.caption("Real-time insights")

    st.divider()

    if current_page == "Add Sources":
        _render_source_analytics()
    elif current_page == "Chat":
        _render_chat_analytics()
    elif current_page == "Studio":
        _render_studio_analytics()


def _render_source_analytics() -> None:
    """Render source analytics."""

    sources = st.session_state.get('sources', [])

    if not sources:
        st.info("Add sources to see analytics")
        return

    stats = get_source_stats(sources)

    # Key metrics using native components
    col1, col2 = st.columns(2)
    with col1:
        st.metric("Sources", stats['total_sources'])
    with col2:
        st.metric("Chunks", stats['total_chunks'])

    col3, col4 = st.columns(2)
    with col3:
        st.metric("Avg/Source", stats['avg_chunks'])
    with col4:
        st.metric("Types", len(stats['type_counts']))

    # Breakdown
    if stats['type_counts']:
        st.divider()
        st.caption("BREAKDOWN BY TYPE")

        for source_type, count in stats['type_counts'].items():
            pct = (count / stats['total_sources']) * 100
            col1, col2 = st.columns([2, 1])
            with col1:
                st.write(source_type.capitalize())
            with col2:
                st.badge(f"{count} ({pct:.0f}%)", color="violet")

    # Chart
    if len(sources) >= 2:
        st.divider()
        st.caption("DISTRIBUTION")
        render_source_type_pie(sources)


def _render_chat_analytics() -> None:
    """Render chat analytics."""

    chat_history = st.session_state.get('chat_history', [])

    if not chat_history:
        st.info("Start chatting to see analytics")
        return

    metrics = render_chat_metrics_summary(chat_history)

    # Key metrics
    col1, col2 = st.columns(2)
    with col1:
        st.metric("Questions", metrics['total_questions'])
    with col2:
        st.metric("Responses", metrics['total_responses'])

    col3, col4 = st.columns(2)
    with col3:
        st.metric("Citations", metrics['total_citations'])
    with col4:
        st.metric("Sources Used", metrics['unique_sources'])

    # Quality metrics
    if metrics['total_responses'] > 0:
        st.divider()
        st.caption("QUALITY METRICS")

        citation_rate = metrics['total_citations'] / metrics['total_responses']
        st.write(f"Citations per response: **{citation_rate:.1f}**")
        st.write(f"Source coverage: **{metrics['unique_sources']} sources**")

    # Chart
    if metrics['total_citations'] > 0:
        st.divider()
        st.caption("MOST CITED")
        render_citation_frequency(chat_history)


def _render_studio_analytics() -> None:
    """Render studio analytics."""

    podcast_script = st.session_state.get('current_podcast_script')
    podcast_history = st.session_state.get('podcast_history', [])

    if not podcast_script and not podcast_history:
        st.info("Create a podcast to see analytics")
        return

    if podcast_script:
        stats = get_podcast_script_stats(podcast_script)

        # Key metrics
        col1, col2 = st.columns(2)
        with col1:
            st.metric("Lines", stats['total_lines'])
        with col2:
            duration = stats['estimated_duration']
            dur_val = duration.split()[0] if isinstance(duration, str) else str(duration)
            st.metric("Minutes", dur_val)

        # Speaker balance
        if stats['speaker1_lines'] > 0 or stats['speaker2_lines'] > 0:
            st.divider()
            st.caption("SPEAKER BALANCE")

            total = stats['speaker1_lines'] + stats['speaker2_lines']
            s1_pct = (stats['speaker1_lines'] / total) * 100
            s2_pct = (stats['speaker2_lines'] / total) * 100

            st.write(f"Speaker 1: **{stats['speaker1_lines']}** ({s1_pct:.0f}%)")
            st.write(f"Speaker 2: **{stats['speaker2_lines']}** ({s2_pct:.0f}%)")

            # Balance indicator
            balance = min(s1_pct, s2_pct) / 50
            if balance > 0.8:
                st.badge("Balanced", icon=":material/check:", color="green")
            elif balance > 0.5:
                st.badge("Moderate", color="yellow")
            else:
                st.badge("Unbalanced", color="orange")

    # History
    if podcast_history:
        st.divider()
        st.caption("HISTORY")

        total_podcasts = len(podcast_history)
        total_minutes = sum(h.get('duration_minutes', 0) for h in podcast_history)

        col1, col2 = st.columns(2)
        with col1:
            st.metric("Total Podcasts", total_podcasts)
        with col2:
            st.metric("Total Runtime", f"{total_minutes}m")
