import plotly.graph_objects as go
import streamlit as st
from typing import Any, Dict, List

from styles.theme import CHART_LAYOUT, CHART_COLORS


def render_script_gauge(total_lines: int, max_lines: int = 60) -> None:
    fig = go.Figure(go.Indicator(
        mode="gauge+number",
        value=total_lines,
        title={'text': "Script Lines", 'font': {'color': '#e2e8f0', 'size': 14}},
        number={'font': {'color': '#ffffff', 'size': 28}},
        gauge={
            'axis': {
                'range': [0, max_lines],
                'tickcolor': '#a0aec0',
                'tickfont': {'size': 10, 'color': '#a0aec0'}
            },
            'bar': {'color': CHART_COLORS[1]},
            'bgcolor': '#2d3748',
            'borderwidth': 0,
            'steps': [
                {'range': [0, max_lines * 0.3], 'color': 'rgba(26, 32, 44, 0.8)'},
                {'range': [max_lines * 0.3, max_lines * 0.6], 'color': 'rgba(45, 55, 72, 0.8)'},
                {'range': [max_lines * 0.6, max_lines], 'color': 'rgba(61, 71, 88, 0.8)'}
            ],
            'threshold': {
                'line': {'color': CHART_COLORS[2], 'width': 2},
                'thickness': 0.75,
                'value': total_lines
            }
        }
    ))

    fig.update_layout(
        paper_bgcolor='rgba(0,0,0,0)',
        plot_bgcolor='rgba(0,0,0,0)',
        font_color='#e2e8f0',
        height=180,
        margin=dict(t=30, b=20, l=30, r=30)
    )

    st.plotly_chart(fig, width='stretch', config={'displayModeBar': False})


def render_speaker_balance(speaker1_lines: int, speaker2_lines: int) -> None:
    total = speaker1_lines + speaker2_lines
    if total == 0:
        st.caption("No dialogue data")
        return

    fig = go.Figure(data=[go.Pie(
        labels=['Speaker 1', 'Speaker 2'],
        values=[speaker1_lines, speaker2_lines],
        hole=0.5,
        marker_colors=[CHART_COLORS[0], CHART_COLORS[1]],
        textposition='inside',
        textinfo='percent',
        textfont=dict(size=12, color='white'),
        hovertemplate='<b>%{label}</b><br>Lines: %{value}<br>%{percent}<extra></extra>'
    )])

    fig.update_layout(
        **CHART_LAYOUT,
        title=dict(text="Speaker Balance", font=dict(size=14, color='#e2e8f0')),
        showlegend=True,
        legend=dict(
            orientation='h',
            yanchor='bottom',
            y=-0.2,
            xanchor='center',
            x=0.5,
            font=dict(size=11, color='#a0aec0')
        ),
        height=200,
        margin=dict(t=40, b=50, l=10, r=10)
    )

    st.plotly_chart(fig, width='stretch', config={'displayModeBar': False})


def render_podcast_duration_bar(estimated_minutes: int, target_minutes: int) -> None:
    completion = min(estimated_minutes / target_minutes * 100, 100) if target_minutes > 0 else 0

    fig = go.Figure(go.Indicator(
        mode="gauge+number",
        value=estimated_minutes,
        title={'text': "Est. Duration (min)", 'font': {'color': '#e2e8f0', 'size': 14}},
        number={'font': {'color': '#ffffff', 'size': 24}, 'suffix': ' min'},
        gauge={
            'axis': {
                'range': [0, target_minutes],
                'tickcolor': '#a0aec0',
                'tickfont': {'size': 10, 'color': '#a0aec0'}
            },
            'bar': {'color': CHART_COLORS[0]},
            'bgcolor': '#2d3748',
            'borderwidth': 0
        }
    ))

    fig.update_layout(
        paper_bgcolor='rgba(0,0,0,0)',
        plot_bgcolor='rgba(0,0,0,0)',
        font_color='#e2e8f0',
        height=150,
        margin=dict(t=30, b=10, l=30, r=30)
    )

    st.plotly_chart(fig, width='stretch', config={'displayModeBar': False})


def render_podcast_history(history: List[Dict[str, Any]]) -> None:
    if not history:
        st.caption("No podcast history")
        return

    recent = history[-5:]

    names = [h.get('source', 'Unknown')[:15] for h in recent]
    durations = [h.get('duration_minutes', 0) for h in recent]
    lines = [h.get('total_lines', 0) for h in recent]

    fig = go.Figure()

    fig.add_trace(go.Bar(
        x=names,
        y=lines,
        name='Lines',
        marker_color=CHART_COLORS[0],
        hovertemplate='<b>%{x}</b><br>Lines: %{y}<extra></extra>'
    ))

    fig.update_layout(
        **CHART_LAYOUT,
        title=dict(text="Recent Podcasts", font=dict(size=14, color='#e2e8f0')),
        xaxis=dict(
            title='',
            tickangle=-45,
            tickfont=dict(size=10, color='#a0aec0')
        ),
        yaxis=dict(
            title=dict(text='Lines', font=dict(size=11, color='#a0aec0')),
            tickfont=dict(size=10, color='#a0aec0'),
            gridcolor='rgba(74, 85, 104, 0.3)'
        ),
        showlegend=False,
        height=180,
        margin=dict(t=40, b=60, l=40, r=10)
    )

    st.plotly_chart(fig, width='stretch', config={'displayModeBar': False})


def get_podcast_script_stats(podcast_script: Any) -> Dict[str, Any]:
    if podcast_script is None:
        return {
            'total_lines': 0,
            'speaker1_lines': 0,
            'speaker2_lines': 0,
            'estimated_duration': '0 min'
        }

    script_lines = getattr(podcast_script, 'script', [])
    speaker1_count = 0
    speaker2_count = 0

    for line in script_lines:
        if isinstance(line, dict):
            if 'Speaker 1' in line:
                speaker1_count += 1
            elif 'Speaker 2' in line:
                speaker2_count += 1

    return {
        'total_lines': getattr(podcast_script, 'total_lines', len(script_lines)),
        'speaker1_lines': speaker1_count,
        'speaker2_lines': speaker2_count,
        'estimated_duration': getattr(podcast_script, 'estimated_duration', '0 min')
    }
