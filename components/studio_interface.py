import streamlit as st
import tempfile
import time
import logging
from pathlib import Path
from dataclasses import dataclass

logger = logging.getLogger(__name__)


def render_studio_interface() -> None:
    """Render studio interface using native Streamlit components."""

    st.subheader("Studio")
    st.caption("Transform your documents into AI-generated podcasts")

    if not st.session_state.sources:
        st.info("Add documents in the Sources tab to create podcasts.")
        return

    _render_podcast_form()

    if st.session_state.get('current_podcast_script'):
        _render_current_podcast()


def _render_podcast_form() -> None:
    """Render podcast generation form."""

    with st.container(border=True):
        st.markdown("**Generate Podcast**")

        source_names = [source['name'] for source in st.session_state.sources]

        selected_source = st.selectbox(
            "Source document",
            source_names,
            index=0 if source_names else None
        )

        col1, col2 = st.columns(2)

        with col1:
            podcast_style = st.selectbox(
                "Style",
                ["Conversational", "Interview", "Debate", "Educational"]
            )

        with col2:
            podcast_length = st.selectbox(
                "Duration",
                ["5 minutes", "10 minutes", "15 minutes", "20 minutes"],
                index=1
            )

    if st.button("Generate Podcast", type="primary", width='stretch'):
        if selected_source:
            generate_podcast(selected_source, podcast_style, podcast_length)
        else:
            st.warning("Select a source document")


def _render_current_podcast() -> None:
    """Render current podcast script."""

    script = st.session_state.current_podcast_script

    st.divider()
    st.markdown("**Generated Script**")

    # Stats using native metrics
    col1, col2, col3 = st.columns(3)
    with col1:
        st.metric("Lines", script.total_lines)
    with col2:
        st.metric("Duration", script.estimated_duration)
    with col3:
        source = getattr(script, 'source_document', 'Document')
        st.metric("Source", source[:10] + "..." if len(str(source)) > 10 else source)

    # Script viewer
    with st.expander("View Script"):
        for line_dict in script.script:
            speaker, dialogue = next(iter(line_dict.items()))

            if speaker == "Speaker 1":
                with st.chat_message("user", avatar="👩"):
                    st.write(dialogue)
            else:
                with st.chat_message("assistant", avatar="👨"):
                    st.write(dialogue)


def generate_podcast(selected_source: str, podcast_style: str, podcast_length: str) -> None:
    """Generate podcast from source."""

    if not st.session_state.pipeline or not st.session_state.pipeline.get('podcast_script_generator'):
        st.error("Podcast generation not available")
        return

    pipeline = st.session_state.pipeline

    try:
        source_info = None
        for source in st.session_state.sources:
            if source['name'] == selected_source:
                source_info = source
                break

        if not source_info:
            st.error("Source not found")
            return

        with st.spinner("Gathering content..."):
            query_embedding = pipeline['embedding_generator'].generate_query_embedding(
                f"content from {selected_source}"
            )
            search_results = pipeline['vector_db'].search(
                query_embedding,
                limit=50,
                filter_expr=f'source_file == "{selected_source}"'
            )

            if not search_results:
                st.error("No content found")
                return

            search_results.sort(key=lambda x: x.get('chunk_index', 0))

        with st.spinner("Generating script..."):
            script_generator = pipeline['podcast_script_generator']

            if source_info['type'] == 'Website':
                @dataclass
                class ChunkLike:
                    content: str

                chunks = [ChunkLike(content=r['content']) for r in search_results]
                podcast_script = script_generator.generate_script_from_website(
                    website_chunks=chunks,
                    source_url=selected_source,
                    podcast_style=podcast_style.lower(),
                    target_duration=podcast_length
                )
            else:
                combined_content = "\n\n".join([r['content'] for r in search_results])
                podcast_script = script_generator.generate_script_from_text(
                    text_content=combined_content,
                    source_name=selected_source,
                    podcast_style=podcast_style.lower(),
                    target_duration=podcast_length
                )

            st.session_state.current_podcast_script = podcast_script
            st.success(f"Script generated: {podcast_script.total_lines} lines")

        # Generate audio if available
        tts_generator = pipeline.get('podcast_tts_generator')
        if tts_generator:
            _generate_audio(tts_generator, podcast_script, source_info)
        else:
            st.info("Audio generation not available")

        _save_script(podcast_script)

    except Exception as e:
        st.error(f"Generation failed: {str(e)}")
        logger.error(f"Podcast error: {e}")


def _generate_audio(tts_generator, podcast_script, source_info) -> None:
    """Generate audio from script."""

    with st.spinner("Generating audio (this may take a few minutes)..."):
        try:
            temp_dir = tempfile.mkdtemp(prefix="podcast_")

            audio_files = tts_generator.generate_podcast_audio(
                podcast_script=podcast_script,
                output_dir=temp_dir,
                combine_audio=True
            )

            st.success(f"Generated {len(audio_files)} audio file(s)")

            outputs_dir = Path("outputs")
            outputs_dir.mkdir(exist_ok=True)
            ts = int(time.time())

            st.markdown("**Listen to Your Podcast**")

            for audio_file in audio_files:
                file_name = Path(audio_file).name

                if "complete_podcast" in file_name:
                    st.audio(audio_file, format="audio/wav")

                    saved_path = outputs_dir / f"podcast_{ts}.wav"
                    with open(audio_file, "rb") as src:
                        audio_bytes = src.read()
                    saved_path.write_bytes(audio_bytes)

                    st.download_button(
                        "Download Podcast",
                        data=audio_bytes,
                        file_name=f"podcast_{ts}.wav",
                        mime="audio/wav",
                        width='stretch'
                    )

                    if 'podcast_history' not in st.session_state:
                        st.session_state.podcast_history = []

                    st.session_state.podcast_history.append({
                        'source': source_info['name'],
                        'total_lines': podcast_script.total_lines,
                        'duration_minutes': int(podcast_script.estimated_duration.split()[0]),
                        'timestamp': time.strftime("%Y-%m-%dT%H:%M:%S")
                    })

        except Exception as e:
            st.error(f"Audio generation failed: {str(e)}")
            logger.error(f"Audio error: {e}")


def _save_script(podcast_script) -> None:
    """Save script as JSON."""

    outputs_dir = Path("outputs")
    outputs_dir.mkdir(exist_ok=True)

    ts = int(time.time())
    script_json = podcast_script.to_json()

    saved_path = outputs_dir / f"script_{ts}.json"
    saved_path.write_text(script_json, encoding="utf-8")

    st.download_button(
        "Download Script (JSON)",
        data=script_json,
        file_name=f"script_{ts}.json",
        mime="application/json",
        width='stretch'
    )


def get_studio_stats() -> dict:
    """Get studio statistics."""

    history = st.session_state.get('podcast_history', [])
    return {
        'total_podcasts': len(history),
        'total_lines': sum(h.get('total_lines', 0) for h in history),
        'total_minutes': sum(h.get('duration_minutes', 0) for h in history)
    }
