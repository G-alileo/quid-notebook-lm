import streamlit as st
import os
import uuid
import logging
from dotenv import load_dotenv

load_dotenv()

os.environ.setdefault('LITELLM_LOG', 'ERROR')
os.environ.setdefault('LITELLM_DROP_PARAMS', 'True')
os.environ.setdefault('LITELLM_DISABLE_PROXY', 'True')

import logging
logging.getLogger('litellm').setLevel(logging.CRITICAL)

os.environ.setdefault('OTEL_SDK_DISABLED', 'true')

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

from quid_notebook.ui.styles.theme import apply_theme
from quid_notebook.ui.components.navigation import render_navigation
from quid_notebook.ui.components.source_list import render_source_list
from quid_notebook.ui.components.upload_interface import render_upload_interface
from quid_notebook.ui.components.chat_interface import render_chat_interface
from quid_notebook.ui.components.studio_interface import render_studio_interface
from quid_notebook.ui.components.analytics_panel import render_analytics_panel
from quid_notebook.ui.components.auth_page import render_auth_page, render_user_menu

from quid_notebook.services.auth_client import auth_client

from quid_notebook.services.document_processing.doc_processor import DocumentProcessor
from quid_notebook.services.embeddings.embedding_generator import EmbeddingGenerator
from quid_notebook.services.vector_database.milvus_vector_db import MilvusVectorDB
from quid_notebook.services.generation.rag import RAGGenerator
from quid_notebook.services.memory.memory_layer import MemoryLayer
from quid_notebook.services.audio_processing.audio_transcriber import AudioTranscriber
from quid_notebook.services.audio_processing.youtube_transcriber import YouTubeTranscriber
from quid_notebook.services.web_scraping.web_scraper import WebScraper
from quid_notebook.services.podcast.script_generator import PodcastScriptGenerator

try:
    from quid_notebook.services.podcast.text_to_speech import PodcastTTSGenerator
    logger.info("✓ Kokoro TTS is available for podcast generation")
except Exception as e:
    PodcastTTSGenerator = None
    logger.warning(f"⚠ TTS not available: {e}")


st.set_page_config(
    page_title="Quid Notebook",
    page_icon="📓",
    layout="wide",
    initial_sidebar_state="collapsed"
)


def init_session_state():
    defaults = {
        'pipeline': None,
        'sources': [],
        'chat_history': [],
        'session_id': str(uuid.uuid4()),
        'pipeline_initialized': False,
        'current_page': "Add Sources",
        'selected_source_idx': None,
        'current_podcast_script': None,
        'podcast_history': []
    }
    for key, value in defaults.items():
        if key not in st.session_state:
            st.session_state[key] = value


def initialize_pipeline() -> bool:
    if st.session_state.pipeline_initialized:
        return True

    try:
        assemblyai_key = os.getenv("ASSEMBLYAI_API_KEY")
        firecrawl_key = os.getenv("FIRECRAWL_API_KEY")
        zep_key = os.getenv("ZEP_API_KEY")

        with st.spinner("Initializing AI engine..."):
            doc_processor = DocumentProcessor()
            embedding_generator = EmbeddingGenerator()

            user = auth_client.get_current_user()
            user_id = user.id if user else "default"

            vector_db = MilvusVectorDB(
                db_path=f"./data/milvus_{user_id}.db",
                collection_name="notebook_documents"
            )

            llm_provider = os.getenv("LLM_PROVIDER", "deepseek").lower()
            deepseek_key = os.getenv("DEEPSEEK_API_KEY")
            gemini_key = os.getenv("GEMINI_API")
            openai_key = os.getenv("OPENAI_API_KEY")

            provider_keys = {
                "deepseek": deepseek_key,
                "gemini": gemini_key,
                "openai": openai_key
            }
            llm_api_key = provider_keys.get(llm_provider)

            if not llm_api_key:
                for p, k in provider_keys.items():
                    if k:
                        llm_provider, llm_api_key = p, k
                        break

            if not llm_api_key:
                st.error("No LLM API key found. Set DEEPSEEK_API_KEY, GEMINI_API, or OPENAI_API_KEY")
                return False

            fb_key, fb_provider = None, None
            if llm_provider != "gemini" and gemini_key:
                fb_key, fb_provider = gemini_key, "gemini"
            elif llm_provider != "deepseek" and deepseek_key:
                fb_key, fb_provider = deepseek_key, "deepseek"
            elif llm_provider != "openai" and openai_key:
                fb_key, fb_provider = openai_key, "openai"

            logger.info(f"LLM: {llm_provider} | Fallback: {fb_provider or 'none'}")

            rag_generator = RAGGenerator(
                embedding_generator=embedding_generator,
                vector_db=vector_db,
                api_key=llm_api_key,
                provider=llm_provider,
                fallback_api_key=fb_key,
                fallback_provider=fb_provider,
            )

            podcast_script_generator = PodcastScriptGenerator(
                llm_api_key,
                provider=llm_provider,
                fallback_api_key=fb_key,
                fallback_provider=fb_provider,
            )

            audio_transcriber = AudioTranscriber(assemblyai_key) if assemblyai_key else None
            youtube_transcriber = YouTubeTranscriber(assemblyai_key) if assemblyai_key else None
            web_scraper = WebScraper(firecrawl_key) if firecrawl_key else None

            podcast_tts_generator = None
            if PodcastTTSGenerator is not None:
                try:
                    podcast_tts_generator = PodcastTTSGenerator()
                except Exception as e:
                    logger.error(f"TTS error: {e}")

            memory = None
            if zep_key and user:
                memory = MemoryLayer(
                    user_id=user.id,
                    session_id=st.session_state.session_id,
                    create_new_session=True
                )

            st.session_state.pipeline = {
                'doc_processor': doc_processor,
                'embedding_generator': embedding_generator,
                'vector_db': vector_db,
                'rag_generator': rag_generator,
                'audio_transcriber': audio_transcriber,
                'youtube_transcriber': youtube_transcriber,
                'web_scraper': web_scraper,
                'podcast_script_generator': podcast_script_generator,
                'podcast_tts_generator': podcast_tts_generator,
                'memory': memory
            }

            st.session_state.pipeline_initialized = True
            return True

    except Exception as e:
        st.error(f"Initialization failed: {str(e)}")
        logger.error(f"Init error: {e}")
        return False


def render_app():
    init_session_state()
    apply_theme()

    if not initialize_pipeline():
        st.stop()

    render_user_menu()

    left_panel, center_panel, right_panel = st.columns([2, 5.5, 2.5], vertical_alignment="top")

    with left_panel:
        st.markdown('<div class="left-panel">', unsafe_allow_html=True)
        current_page = render_navigation()
        render_source_list()
        st.markdown('</div>', unsafe_allow_html=True)

    with center_panel:
        if current_page == "Add Sources":
            render_upload_interface()
        elif current_page == "Chat":
            render_chat_interface()
        elif current_page == "Studio":
            render_studio_interface()

    with right_panel:
        st.markdown('<div class="right-panel">', unsafe_allow_html=True)
        render_analytics_panel(current_page)
        st.markdown('</div>', unsafe_allow_html=True)

    st.divider()
    user = auth_client.get_current_user()
    st.caption(f"Quid Notebook • Logged in as {user.username if user else 'Guest'}")


def main():
    if not auth_client.is_authenticated():
        render_auth_page()
        return

    render_app()


if __name__ == "__main__":
    main()
