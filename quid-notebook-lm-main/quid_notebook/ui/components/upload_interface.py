import streamlit as st
import tempfile
import time
import os
import logging
from typing import List, Any

logger = logging.getLogger(__name__)


def render_upload_interface() -> None:
    """Render upload interface using native Streamlit components."""

    st.subheader("Add Sources")
    st.caption("Upload documents, paste URLs, or add text to your knowledge base")

    # File uploader with native styling
    uploaded_files = st.file_uploader(
        "Upload files",
        accept_multiple_files=True,
        type=['pdf', 'txt', 'md', 'mp3', 'wav', 'm4a', 'ogg'],
        help="Supported: PDF, TXT, Markdown, Audio files"
    )

    if uploaded_files:
        st.success(f"{len(uploaded_files)} file(s) selected")
        if st.button("Process Files", type="primary", width='stretch'):
            process_uploaded_files(uploaded_files)
            st.rerun()

    st.divider()

    # Other source types using segmented control
    source_type = st.segmented_control(
        "Source type",
        options=["🌐 Website", "🎬 YouTube", "📝 Text"],
        default="🌐 Website",
        label_visibility="collapsed"
    )

    if source_type == "🌐 Website":
        _render_url_input()
    elif source_type == "🎬 YouTube":
        _render_youtube_input()
    elif source_type == "📝 Text":
        _render_text_input()


def _render_url_input() -> None:
    """Render URL input section."""
    urls_text = st.text_area(
        "Enter URLs (one per line)",
        placeholder="https://example.com/article\nhttps://docs.example.com",
        height=100
    )

    if st.button("Scrape URLs", width='stretch') and urls_text.strip():
        process_urls(urls_text)
        st.rerun()


def _render_youtube_input() -> None:
    """Render YouTube input section."""
    youtube_url = st.text_input(
        "YouTube URL",
        placeholder="https://youtube.com/watch?v=..."
    )

    if st.button("Transcribe Video", width='stretch') and youtube_url.strip():
        process_youtube_video(youtube_url.strip())
        st.rerun()


def _render_text_input() -> None:
    """Render text paste section."""
    text_content = st.text_area(
        "Paste text content",
        placeholder="Paste your content here...",
        height=150
    )

    if st.button("Add Text", width='stretch') and text_content.strip():
        process_text(text_content)
        st.rerun()


def process_uploaded_files(uploaded_files: List[Any]) -> None:
    """Process uploaded files."""
    if not st.session_state.pipeline:
        st.error("Pipeline not initialized")
        return

    pipeline = st.session_state.pipeline
    progress_bar = st.progress(0, text="Processing files...")

    for idx, uploaded_file in enumerate(uploaded_files):
        progress = (idx + 1) / len(uploaded_files)
        progress_bar.progress(progress, text=f"Processing {uploaded_file.name}...")

        try:
            suffix = f".{uploaded_file.name.split('.')[-1]}"
            with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp_file:
                tmp_file.write(uploaded_file.getbuffer())
                temp_path = tmp_file.name

            if uploaded_file.type and uploaded_file.type.startswith('audio/'):
                if pipeline.get('audio_transcriber'):
                    chunks = pipeline['audio_transcriber'].transcribe_audio(temp_path)
                    source_type = "Audio"
                    for chunk in chunks:
                        chunk.source_file = uploaded_file.name
                else:
                    st.warning(f"Audio processing unavailable")
                    os.unlink(temp_path)
                    continue
            else:
                chunks = pipeline['doc_processor'].process_document(temp_path)
                source_type = "PDF" if uploaded_file.name.endswith('.pdf') else "Text"
                for chunk in chunks:
                    chunk.source_file = uploaded_file.name

            if chunks:
                embedded_chunks = pipeline['embedding_generator'].generate_embeddings(chunks)

                if len(st.session_state.sources) == 0:
                    pipeline['vector_db'].create_index(use_binary_quantization=False)

                pipeline['vector_db'].insert_embeddings(embedded_chunks)

                source_info = {
                    'name': uploaded_file.name,
                    'type': source_type,
                    'size': f"{len(uploaded_file.getbuffer()) / 1024:.1f} KB",
                    'chunks': len(chunks),
                    'uploaded_at': time.strftime("%Y-%m-%dT%H:%M:%S")
                }
                st.session_state.sources.append(source_info)

            os.unlink(temp_path)

        except Exception as e:
            st.error(f"Error: {uploaded_file.name} - {str(e)}")
            if 'temp_path' in locals() and os.path.exists(temp_path):
                os.unlink(temp_path)

    progress_bar.empty()
    st.success(f"Added {len(uploaded_files)} source(s)")


def process_urls(urls_text: str) -> None:
    """Process URLs."""
    if not st.session_state.pipeline or not st.session_state.pipeline.get('web_scraper'):
        st.warning("Web scraping not available (missing FIRECRAWL_API_KEY)")
        return

    urls = [url.strip() for url in urls_text.split('\n') if url.strip()]
    if not urls:
        return

    pipeline = st.session_state.pipeline

    with st.spinner(f"Scraping {len(urls)} URL(s)..."):
        for url in urls:
            try:
                chunks = pipeline['web_scraper'].scrape_url(url)

                if chunks:
                    for chunk in chunks:
                        chunk.source_file = url

                    embedded_chunks = pipeline['embedding_generator'].generate_embeddings(chunks)

                    if len(st.session_state.sources) == 0:
                        pipeline['vector_db'].create_index(use_binary_quantization=False)

                    pipeline['vector_db'].insert_embeddings(embedded_chunks)

                    source_info = {
                        'name': url,
                        'type': 'Website',
                        'size': f"{len(chunks)} chunks",
                        'chunks': len(chunks),
                        'uploaded_at': time.strftime("%Y-%m-%dT%H:%M:%S")
                    }
                    st.session_state.sources.append(source_info)
                    st.success(f"Added: {url[:40]}...")

            except Exception as e:
                st.error(f"Failed: {url[:30]}... - {str(e)}")


def process_youtube_video(youtube_url: str) -> None:
    """Process YouTube video."""
    if not st.session_state.pipeline or not st.session_state.pipeline.get('youtube_transcriber'):
        st.warning("YouTube processing not available (missing ASSEMBLYAI_API_KEY)")
        return

    pipeline = st.session_state.pipeline
    transcriber = pipeline['youtube_transcriber']

    with st.spinner("Transcribing video..."):
        try:
            chunks = transcriber.transcribe_youtube_video(youtube_url, cleanup_audio=True)

            if chunks:
                video_id = transcriber.extract_video_id(youtube_url)
                video_name = f"YouTube: {video_id}"

                for chunk in chunks:
                    chunk.source_file = video_name

                embedded_chunks = pipeline['embedding_generator'].generate_embeddings(chunks)

                if len(st.session_state.sources) == 0:
                    pipeline['vector_db'].create_index(use_binary_quantization=False)

                pipeline['vector_db'].insert_embeddings(embedded_chunks)

                source_info = {
                    'name': video_name,
                    'type': 'YouTube Video',
                    'size': f"{len(chunks)} segments",
                    'chunks': len(chunks),
                    'uploaded_at': time.strftime("%Y-%m-%dT%H:%M:%S"),
                    'url': youtube_url,
                    'video_id': video_id
                }
                st.session_state.sources.append(source_info)
                st.success(f"Added video: {len(chunks)} segments")
            else:
                st.warning("No transcript extracted")

        except Exception as e:
            st.error(f"Failed: {str(e)}")
            logger.error(f"YouTube error: {e}")


def process_text(text_content: str) -> None:
    """Process pasted text."""
    if not st.session_state.pipeline or not text_content.strip():
        return

    pipeline = st.session_state.pipeline

    with st.spinner("Processing text..."):
        try:
            with tempfile.NamedTemporaryFile(mode='w', delete=False, suffix='.txt') as tmp_file:
                tmp_file.write(text_content)
                temp_path = tmp_file.name

            chunks = pipeline['doc_processor'].process_document(temp_path)

            original_name = f"Text ({time.strftime('%H:%M')})"
            for chunk in chunks:
                chunk.source_file = original_name

            if chunks:
                embedded_chunks = pipeline['embedding_generator'].generate_embeddings(chunks)

                if len(st.session_state.sources) == 0:
                    pipeline['vector_db'].create_index(use_binary_quantization=False)

                pipeline['vector_db'].insert_embeddings(embedded_chunks)

                source_info = {
                    'name': original_name,
                    'type': 'Text',
                    'size': f"{len(text_content)} chars",
                    'chunks': len(chunks),
                    'uploaded_at': time.strftime("%Y-%m-%dT%H:%M:%S")
                }
                st.session_state.sources.append(source_info)
                st.success(f"Added: {len(chunks)} chunks")

            os.unlink(temp_path)

        except Exception as e:
            st.error(f"Failed: {str(e)}")
