import plotly.express as px
import plotly.graph_objects as go
import streamlit as st
from typing import List, Dict, Any

from styles.theme import CHART_LAYOUT, CHART_COLORS


def render_source_type_pie(sources: List[Dict[str, Any]]) -> None:
    if not sources:
        st.caption("No sources to display")
        return

    type_counts = {}
    for source in sources:
        source_type = source.get('type', 'unknown')
        type_counts[source_type] = type_counts.get(source_type, 0) + 1

    fig = px.pie(
        values=list(type_counts.values()),
        names=list(type_counts.keys()),
        color_discrete_sequence=CHART_COLORS,
        hole=0.4
    )

    fig.update_layout(
        **CHART_LAYOUT,
        title=dict(text="Source Types", font=dict(size=14, color='#e2e8f0')),
        showlegend=True,
        legend=dict(
            orientation="h",
            yanchor="bottom",
            y=-0.2,
            xanchor="center",
            x=0.5,
            font=dict(size=11, color='#a0aec0')
        ),
        height=220,
        margin=dict(t=40, b=50, l=10, r=10)
    )

    fig.update_traces(
        textposition='inside',
        textinfo='percent',
        textfont=dict(size=11, color='white'),
        hovertemplate='<b>%{label}</b><br>Count: %{value}<extra></extra>'
    )

    st.plotly_chart(fig, width='stretch', config={'displayModeBar': False})


def render_chunks_bar(sources: List[Dict[str, Any]]) -> None:
    if not sources:
        st.caption("No sources to display")
        return

    sorted_sources = sorted(sources, key=lambda x: x.get('chunks', 0), reverse=True)[:6]

    names = []
    for s in sorted_sources:
        name = s.get('name', 'Unknown')
        names.append(name[:12] + '...' if len(name) > 12 else name)

    chunks = [s.get('chunks', 0) for s in sorted_sources]

    fig = go.Figure(data=[
        go.Bar(
            x=names,
            y=chunks,
            marker_color=CHART_COLORS[0],
            marker_line_width=0,
            hovertemplate='<b>%{x}</b><br>Chunks: %{y}<extra></extra>'
        )
    ])

    fig.update_layout(
        **CHART_LAYOUT,
        title=dict(text="Chunks by Source", font=dict(size=14, color='#e2e8f0')),
        xaxis=dict(
            title='',
            tickangle=-45,
            tickfont=dict(size=10, color='#a0aec0'),
            gridcolor='rgba(74, 85, 104, 0.3)'
        ),
        yaxis=dict(
            title=dict(text='Chunks', font=dict(size=11, color='#a0aec0')),
            tickfont=dict(size=10, color='#a0aec0'),
            gridcolor='rgba(74, 85, 104, 0.3)'
        ),
        height=200,
        margin=dict(t=40, b=60, l=40, r=10)
    )

    st.plotly_chart(fig, width='stretch', config={'displayModeBar': False})


def render_source_timeline(sources: List[Dict[str, Any]]) -> None:
    """Render a timeline of source uploads."""
    if not sources or len(sources) < 2:
        return

    # Create cumulative count over time
    sorted_sources = sorted(sources, key=lambda x: x.get('uploaded_at', ''))

    counts = list(range(1, len(sorted_sources) + 1))
    labels = [s.get('name', 'Unknown')[:15] for s in sorted_sources]

    fig = go.Figure(data=[
        go.Scatter(
            x=list(range(len(counts))),
            y=counts,
            mode='lines+markers',
            line=dict(color=CHART_COLORS[1], width=2),
            marker=dict(size=8, color=CHART_COLORS[1]),
            hovertext=labels,
            hovertemplate='<b>%{hovertext}</b><br>Total: %{y}<extra></extra>'
        )
    ])

    fig.update_layout(
        **CHART_LAYOUT,
        title=dict(text="Source Growth", font=dict(size=14, color='#e2e8f0')),
        xaxis=dict(
            title='',
            showticklabels=False,
            gridcolor='rgba(74, 85, 104, 0.3)'
        ),
        yaxis=dict(
            title=dict(text='Total Sources', font=dict(size=11, color='#a0aec0')),
            tickfont=dict(size=10, color='#a0aec0'),
            gridcolor='rgba(74, 85, 104, 0.3)'
        ),
        height=180,
        margin=dict(t=40, b=20, l=40, r=10)
    )

    st.plotly_chart(fig, width='stretch', config={'displayModeBar': False})
