import streamlit as st

# Clean color palette
COLORS = {
    'bg_primary': '#09090b',
    'bg_secondary': '#18181b',
    'bg_card': '#1f1f23',
    'accent': '#8b5cf6',
    'success': '#22c55e',
    'warning': '#f59e0b',
    'error': '#ef4444',
    'text_primary': '#fafafa',
    'text_secondary': '#a1a1aa',
    'text_muted': '#71717a',
    'border': '#27272a',
}

CHART_LAYOUT = {
    'paper_bgcolor': 'rgba(0,0,0,0)',
    'plot_bgcolor': 'rgba(0,0,0,0)',
    'font_color': '#a1a1aa',
}

CHART_COLORS = ['#8b5cf6', '#22c55e', '#f59e0b', '#06b6d4', '#ec4899', '#6366f1']


def apply_theme():
    """Apply minimal custom CSS - let Streamlit handle most styling."""
    st.markdown("""
    <style>
        /* Hide defaults */
        #MainMenu, footer, header, .stDeployButton { visibility: hidden !important; }

        /* Dark background */
        .stApp { background: #09090b; }

        /* Minimal spacing adjustments */
        .main .block-container {
            padding: 1.5rem 2rem;
            max-width: 100%;
        }

        /* Panel backgrounds */
        .left-panel {
            background: #0f0f12;
            border-right: 1px solid #1f1f23;
            padding: 1.25rem;
            height: auto;
        }

        .right-panel {
            background: #0f0f12;
            border-left: 1px solid #1f1f23;
            padding: 1.25rem;
            height: auto;
        }

        /* Fix column alignment */
        [data-testid="column"] {
            vertical-align: top !important;
        }

        [data-testid="column"] > div {
            align-self: flex-start !important;
        }

        /* Source cards */
        .source-card {
            background: #18181b;
            border: 1px solid #27272a;
            border-radius: 10px;
            padding: 14px 16px;
            margin: 6px 0;
            cursor: pointer;
        }

        .source-card:hover {
            background: #1f1f23;
            border-color: #3f3f46;
        }

        /* Chat messages */
        .chat-message {
            padding: 14px 18px;
            border-radius: 12px;
            margin: 10px 0;
            max-width: 85%;
            font-size: 0.9rem;
            line-height: 1.6;
        }

        .user-message {
            background: #8b5cf6;
            color: #ffffff;
            margin-left: auto;
        }

        .assistant-message {
            background: #18181b;
            border: 1px solid #27272a;
            color: #e4e4e7;
        }

        /* Upload zone */
        .upload-zone {
            border: 2px dashed #27272a;
            border-radius: 12px;
            padding: 40px;
            text-align: center;
            background: #0f0f12;
        }

        .upload-zone:hover {
            border-color: #3f3f46;
            background: #18181b;
        }

        /* Speaker styles for podcast */
        .speaker-1 {
            background: #18181b;
            border-left: 3px solid #8b5cf6;
            padding: 14px 18px;
            border-radius: 0 10px 10px 0;
            margin: 8px 0;
        }

        .speaker-2 {
            background: #18181b;
            border-left: 3px solid #22c55e;
            padding: 14px 18px;
            border-radius: 0 10px 10px 0;
            margin: 8px 0;
        }

        /* Interactive citation styling */
        .citation-number {
            background: #8b5cf6;
            color: white;
            padding: 2px 6px;
            border-radius: 4px;
            font-size: 11px;
            font-weight: bold;
            cursor: pointer;
            display: inline-block;
            margin: 0 2px;
            position: relative;
            transition: all 0.2s ease;
        }

        .citation-number:hover {
            background: #7c3aed;
            transform: translateY(-2px);
        }

        .citation-tooltip {
            position: absolute;
            bottom: 100%;
            left: 50%;
            transform: translateX(-50%);
            background: #18181b;
            color: #e4e4e7;
            padding: 12px;
            border-radius: 8px;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
            border: 1px solid #27272a;
            max-width: 400px;
            width: max-content;
            z-index: 1000;
            font-size: 12px;
            line-height: 1.4;
            margin-bottom: 8px;
            opacity: 0;
            visibility: hidden;
            transition: opacity 0.3s ease, visibility 0.3s ease;
            pointer-events: none;
        }

        .citation-number:hover .citation-tooltip {
            opacity: 1;
            visibility: visible;
        }

        /* Tooltip arrow */
        .citation-tooltip::after {
            content: '';
            position: absolute;
            top: 100%;
            left: 50%;
            transform: translateX(-50%);
            border: 6px solid transparent;
            border-top-color: #18181b;
        }

        .tooltip-source {
            font-weight: bold;
            color: #8b5cf6;
            margin-bottom: 6px;
            font-size: 11px;
        }

        .tooltip-content {
            max-height: 200px;
            overflow-y: auto;
            text-align: left;
        }

        /* Scrollbar */
        ::-webkit-scrollbar { width: 6px; height: 6px; }
        ::-webkit-scrollbar-track { background: #09090b; }
        ::-webkit-scrollbar-thumb { background: #3f3f46; border-radius: 3px; }
    </style>
    """, unsafe_allow_html=True)


def render_stat_card(value, label: str):
    """Render a stat using native st.metric in a container."""
    st.metric(label=label, value=value)


def render_section_header(title: str, subtitle: str = None):
    """Render section header using native Streamlit."""
    st.subheader(title)
    if subtitle:
        st.caption(subtitle)


def render_empty_state(icon: str, title: str, subtitle: str = None):
    """Render empty state placeholder."""
    st.markdown(f"""
    <div style="text-align: center; padding: 48px 24px;">
        <div style="font-size: 2.5rem; margin-bottom: 16px; opacity: 0.4;">{icon}</div>
        <div style="color: #a1a1aa; font-size: 0.95rem; font-weight: 500;">{title}</div>
        {"<div style='color: #52525b; font-size: 0.85rem; margin-top: 4px;'>" + subtitle + "</div>" if subtitle else ""}
    </div>
    """, unsafe_allow_html=True)


def render_info_row(label: str, value: str):
    """Render an info row with label and value."""
    col1, col2 = st.columns([1, 1])
    with col1:
        st.caption(label)
    with col2:
        st.write(value)


def render_progress_bar(progress: float, label: str = None):
    """Render progress bar using native Streamlit."""
    if label:
        st.caption(label)
    st.progress(progress)
