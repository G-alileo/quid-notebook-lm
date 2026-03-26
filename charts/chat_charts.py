import plotly.express as px
import plotly.graph_objects as go
import streamlit as st
from typing import List, Dict, Any

from styles.theme import CHART_LAYOUT, CHART_COLORS


def render_citation_frequency(chat_history: List[Dict[str, Any]]) -> None:
    citation_counts = {}

    for msg in chat_history:
        if msg.get('role') == 'assistant' and 'sources_used' in msg:
            for source in msg.get('sources_used', []):
                name = source.get('source_file', 'Unknown')
                display_name = name[:20] + '...' if len(name) > 20 else name
                citation_counts[display_name] = citation_counts.get(display_name, 0) + 1

    if not citation_counts:
        st.caption("No citations yet")
        return

    sorted_citations = sorted(citation_counts.items(), key=lambda x: x[1], reverse=True)[:5]
    names = [c[0] for c in sorted_citations]
    counts = [c[1] for c in sorted_citations]

    fig = go.Figure(data=[
        go.Bar(
            x=counts,
            y=names,
            orientation='h',
            marker_color=CHART_COLORS[1],
            marker_line_width=0,
            hovertemplate='<b>%{y}</b><br>Citations: %{x}<extra></extra>'
        )
    ])

    fig.update_layout(
        **CHART_LAYOUT,
        title=dict(text="Most Cited Sources", font=dict(size=14, color='#e2e8f0')),
        xaxis=dict(
            title=dict(text='Citations', font=dict(size=11, color='#a0aec0')),
            tickfont=dict(size=10, color='#a0aec0'),
            gridcolor='rgba(74, 85, 104, 0.3)'
        ),
        yaxis=dict(
            title='',
            tickfont=dict(size=10, color='#a0aec0'),
            autorange='reversed'
        ),
        height=200,
        margin=dict(t=40, b=30, l=100, r=10)
    )

    st.plotly_chart(fig, width='stretch', config={'displayModeBar': False})


def render_relevance_distribution(chat_history: List[Dict[str, Any]]) -> None:
    scores = []

    for msg in chat_history:
        if msg.get('role') == 'assistant' and 'sources_used' in msg:
            for source in msg.get('sources_used', []):
                if 'relevance_score' in source:
                    scores.append(source['relevance_score'])
                elif 'score' in source:
                    scores.append(source['score'])

    if not scores:
        st.caption("No relevance data")
        return

    fig = go.Figure(data=[
        go.Box(
            y=scores,
            name='Scores',
            marker_color=CHART_COLORS[0],
            boxmean=True,
            hovertemplate='Score: %{y:.3f}<extra></extra>'
        )
    ])

    fig.update_layout(
        **CHART_LAYOUT,
        title=dict(text="Search Relevance", font=dict(size=14, color='#e2e8f0')),
        yaxis=dict(
            title=dict(text='Score', font=dict(size=11, color='#a0aec0')),
            tickfont=dict(size=10, color='#a0aec0'),
            gridcolor='rgba(74, 85, 104, 0.3)'
        ),
        showlegend=False,
        height=180,
        margin=dict(t=40, b=20, l=40, r=10)
    )

    st.plotly_chart(fig, width='stretch', config={'displayModeBar': False})


def render_conversation_flow(chat_history: List[Dict[str, Any]]) -> None:
    user_msgs = []
    assistant_msgs = []

    for i, msg in enumerate(chat_history):
        if msg.get('role') == 'user':
            user_msgs.append(i)
        elif msg.get('role') == 'assistant':
            assistant_msgs.append(i)

    if len(user_msgs) < 2:
        return

    fig = go.Figure()

    fig.add_trace(go.Scatter(
        x=list(range(len(user_msgs))),
        y=[1] * len(user_msgs),
        mode='markers',
        name='Questions',
        marker=dict(size=10, color=CHART_COLORS[0]),
        hovertemplate='Question %{x}<extra></extra>'
    ))

    fig.add_trace(go.Scatter(
        x=list(range(len(assistant_msgs))),
        y=[0] * len(assistant_msgs),
        mode='markers',
        name='Responses',
        marker=dict(size=10, color=CHART_COLORS[1]),
        hovertemplate='Response %{x}<extra></extra>'
    ))

    fig.update_layout(
        **CHART_LAYOUT,
        title=dict(text="Conversation Flow", font=dict(size=14, color='#e2e8f0')),
        xaxis=dict(
            title=dict(text='Message', font=dict(size=11, color='#a0aec0')),
            tickfont=dict(size=10, color='#a0aec0'),
            gridcolor='rgba(74, 85, 104, 0.3)'
        ),
        yaxis=dict(
            showticklabels=False,
            range=[-0.5, 1.5],
            gridcolor='rgba(74, 85, 104, 0.3)'
        ),
        showlegend=True,
        legend=dict(
            orientation='h',
            yanchor='bottom',
            y=-0.3,
            xanchor='center',
            x=0.5,
            font=dict(size=11, color='#a0aec0')
        ),
        height=150,
        margin=dict(t=40, b=50, l=20, r=10)
    )

    st.plotly_chart(fig, width='stretch', config={'displayModeBar': False})


def render_chat_metrics_summary(chat_history: List[Dict[str, Any]]) -> Dict[str, Any]:
    user_count = sum(1 for m in chat_history if m.get('role') == 'user')
    assistant_count = sum(1 for m in chat_history if m.get('role') == 'assistant')

    total_citations = 0
    total_sources = set()

    for msg in chat_history:
        if msg.get('role') == 'assistant' and 'sources_used' in msg:
            sources = msg.get('sources_used', [])
            total_citations += len(sources)
            for s in sources:
                total_sources.add(s.get('source_file', ''))

    return {
        'total_questions': user_count,
        'total_responses': assistant_count,
        'total_citations': total_citations,
        'unique_sources': len(total_sources)
    }
