import re
import streamlit as st
import logging
from typing import List, Dict, Any
import uuid

logger = logging.getLogger(__name__)


def render_chat_interface() -> None:
    """Render chat interface using native Streamlit components."""

    col1, col2 = st.columns([4, 1])
    with col1:
        st.subheader("Chat")
        st.caption("Ask questions about your sources")
    with col2:
        if st.session_state.chat_history:
            if st.button("Clear", type="secondary"):
                reset_chat()

    if not st.session_state.sources:
        st.info("Add documents in the Sources tab to start chatting.")
        return

    _render_chat_messages()
    _render_chat_input()


def _render_chat_messages() -> None:
    """Render chat message history."""

    # Use native chat message components
    for message in st.session_state.chat_history:
        if message['role'] == 'user':
            with st.chat_message("user"):
                st.write(message['content'])
        else:
            with st.chat_message("assistant", avatar="🧠"):
                content_to_display = message.get('interactive_content', message['content'])

                # If we have interactive content with HTML, render it
                if message.get('interactive_content'):
                    st.markdown(content_to_display, unsafe_allow_html=True)
                else:
                    st.write(message['content'])

                # Show simple citations below if no interactive content
                if 'citations' in message and not message.get('interactive_content'):
                    st.caption("Sources:")
                    citations = message['citations'][:5]  # Limit display
                    for cite in citations:
                        st.badge(cite[:50] + "..." if len(cite) > 50 else cite, color="gray")


def _render_chat_input() -> None:
    """Render chat input using native chat_input."""

    if query := st.chat_input("Ask a question..."):
        if st.session_state.pipeline:
            _process_query(query)


def _process_query(query: str) -> None:
    """Process user query."""

    # Add user message immediately
    st.session_state.chat_history.append({
        'role': 'user',
        'content': query
    })

    with st.spinner("Thinking..."):
        try:
            result = st.session_state.pipeline['rag_generator'].generate_response(query)

            interactive_response = None
            if result.sources_used:
                try:
                    interactive_response = create_interactive_citations(
                        result.response,
                        result.sources_used
                    )
                except Exception as e:
                    logger.error(f"Citation error: {e}")

            citations = []
            for source in result.sources_used:
                cite = source.get('source_file', 'Unknown')
                if source.get('page_number'):
                    cite += f" p.{source['page_number']}"
                citations.append(cite)

            message_data = {
                'role': 'assistant',
                'content': result.response,
                'citations': citations,
                'sources_used': result.sources_used
            }

            if interactive_response:
                message_data['interactive_content'] = interactive_response

            st.session_state.chat_history.append(message_data)

            if st.session_state.pipeline.get('memory'):
                st.session_state.pipeline['memory'].save_conversation_turn(result)

            st.rerun()

        except Exception as e:
            st.error(f"Error: {str(e)}")
            logger.error(f"Query error: {e}")


def reset_chat() -> None:
    """Reset chat history."""
    try:
        if st.session_state.pipeline and st.session_state.pipeline.get('memory'):
            try:
                st.session_state.pipeline['memory'].clear_session()
            except Exception:
                pass

        st.session_state.chat_history = []
        st.session_state.session_id = str(uuid.uuid4())

        if st.session_state.pipeline and st.session_state.pipeline.get('memory'):
            from src.memory.memory_layer import MemoryLayer
            st.session_state.pipeline['memory'] = MemoryLayer(
                user_id="streamlit_user",
                session_id=st.session_state.session_id,
                create_new_session=True
            )

        st.rerun()

    except Exception as e:
        st.error(f"Reset failed: {e}")


def create_interactive_citations(response_text: str, sources_used: List[Dict[str, Any]]) -> str:
    """Create interactive citation references with tooltips."""

    logger.info(f"Processing interactive citations for {len(sources_used)} sources")

    citation_map = {}
    for source in sources_used:
        ref = source.get('reference', '')
        if ref:
            match = re.search(r'\[(\d+)\]', ref)
            if match:
                num = match.group(1)
                citation_map[num] = source

    def replace_citation(match):
        full_match = match.group(0)
        num = match.group(1)

        if num in citation_map:
            source = citation_map[num]
            chunk_content = "Content not available"
            source_info = f"Source: {source.get('source_file', 'Unknown')}"

            if source.get('page_number'):
                source_info += f", Page: {source['page_number']}"

            try:
                if st.session_state.pipeline and st.session_state.pipeline['vector_db']:
                    chunk_id = source.get('chunk_id')
                    logger.info(f"Processing citation {num} with chunk_id: {chunk_id}")

                    if chunk_id:
                        chunk_data = st.session_state.pipeline['vector_db'].get_chunk_by_id(chunk_id)
                        logger.info(f"Retrieved chunk data: {chunk_data is not None}")

                        if chunk_data and chunk_data.get('content'):
                            chunk_content = chunk_data['content']
                            logger.info(f"Got chunk content: {len(chunk_content)} characters")
                            if len(chunk_content) > 300:
                                chunk_content = chunk_content[:300] + "..."
                        else:
                            chunk_content = "Chunk content not available"
                            logger.warning(f"Chunk data missing or no content: {chunk_data}")
                    else:
                        chunk_content = "No chunk ID provided"
                        logger.warning(f"No chunk_id in source: {source}")
                else:
                    chunk_content = "Vector database not available"
                    logger.warning("Pipeline or vector_db not available")
            except Exception as e:
                logger.error(f"Error retrieving chunk content for citation {num}: {e}")
                chunk_content = f"Error retrieving chunk content: {str(e)}"

            chunk_content_escaped = (chunk_content
                                    .replace('<', '&lt;')
                                    .replace('>', '&gt;')
                                    .replace('\n', '<br>')
                                    .replace('"', '&quot;'))
            source_info_escaped = (source_info
                                 .replace('<', '&lt;')
                                 .replace('>', '&gt;')
                                 .replace('"', '&quot;'))

            return f'''<span class="citation-number">
                {num}
                <div class="citation-tooltip">
                    <div class="tooltip-source">{source_info_escaped}</div>
                    <div class="tooltip-content">{chunk_content_escaped}</div>
                </div>
            </span>'''
        else:
            return full_match

    interactive_text = re.sub(r'\[(\d+)\]', replace_citation, response_text)

    return interactive_text


def get_chat_stats() -> Dict[str, Any]:
    """Get chat statistics."""

    history = st.session_state.get('chat_history', [])

    user_count = sum(1 for m in history if m.get('role') == 'user')
    assistant_count = sum(1 for m in history if m.get('role') == 'assistant')

    total_citations = 0
    unique_sources = set()

    for msg in history:
        if msg.get('role') == 'assistant' and 'sources_used' in msg:
            sources = msg.get('sources_used', [])
            total_citations += len(sources)
            for s in sources:
                unique_sources.add(s.get('source_file', ''))

    return {
        'total_questions': user_count,
        'total_responses': assistant_count,
        'total_citations': total_citations,
        'unique_sources_cited': len(unique_sources)
    }
