import os
import logging
from pathlib import Path

from src.document_processing.doc_processor import DocumentProcessor
from src.embeddings.embedding_generator import EmbeddingGenerator
from src.vector_database.milvus_vector_db import MilvusVectorDB
from src.generation.rag import RAGGenerator
from src.memory.memory_layer import MemoryLayer
from src.audio_processing.audio_transcriber import AudioTranscriber
from src.web_scraping.web_scraper import WebScraper

logging.basicConfig(level=logging.INFO, format='%(levelname)s - %(message)s')
logger = logging.getLogger(__name__)


class QuidNotebookPipeline:
    def __init__(self):
        self.assemblyai_key = os.getenv("ASSEMBLYAI_API_KEY")
        self.firecrawl_key = os.getenv("FIRECRAWL_API_KEY")
        self.zep_key = os.getenv("ZEP_API_KEY")

        llm_provider = os.getenv("LLM_PROVIDER", "deepseek").lower()
        deepseek_key = os.getenv("DEEPSEEK_API_KEY")
        gemini_key = os.getenv("GEMINI_API")
        openai_key = os.getenv("OPENAI_API_KEY")

        provider_keys = {"deepseek": deepseek_key, "gemini": gemini_key, "openai": openai_key}
        self.api_key = provider_keys.get(llm_provider)
        self.provider = llm_provider

        if not self.api_key:
            for p, k in provider_keys.items():
                if k:
                    self.api_key, self.provider = k, p
                    break

        if not self.api_key:
            raise ValueError("No LLM API key found. Set DEEPSEEK_API_KEY, GEMINI_API, or OPENAI_API_KEY.")

        fb_key, fb_provider = None, None
        if self.provider != "gemini" and gemini_key:
            fb_key, fb_provider = gemini_key, "gemini"
        elif self.provider != "deepseek" and deepseek_key:
            fb_key, fb_provider = deepseek_key, "deepseek"

        logger.info(f"Initializing pipeline with {self.provider}...")

        self.doc_processor = DocumentProcessor()
        self.embedding_generator = EmbeddingGenerator()
        self.vector_db = MilvusVectorDB()
        self.rag_generator = RAGGenerator(
            embedding_generator=self.embedding_generator,
            vector_db=self.vector_db,
            api_key=self.api_key,
            provider=self.provider,
            temperature=0.1,
            fallback_api_key=fb_key,
            fallback_provider=fb_provider,
        )

        self.audio_transcriber = AudioTranscriber(self.assemblyai_key) if self.assemblyai_key else None
        self.web_scraper = WebScraper(self.firecrawl_key) if self.firecrawl_key else None

        self.memory = None
        if self.zep_key:
            self.memory = MemoryLayer(
                user_id="test_user",
                session_id="test_session",
                create_new_session=True
            )

        logger.info("Pipeline initialized successfully!")

    def process_documents(self, file_paths):
        logger.info(f"Processing {len(file_paths)} documents...")

        all_chunks = []
        for file_path in file_paths:
            try:
                chunks = self.doc_processor.process_document(file_path)
                all_chunks.extend(chunks)
                logger.info(f"Processed {file_path}: {len(chunks)} chunks")
            except Exception as e:
                logger.error(f"Failed to process {file_path}: {e}")

        if not all_chunks:
            logger.error("No documents processed successfully!")
            return False

        embedded_chunks = self.embedding_generator.generate_embeddings(all_chunks)
        self.vector_db.create_index(use_binary_quantization=False)
        self.vector_db.insert_embeddings(embedded_chunks)

        logger.info(f"Processed {len(all_chunks)} chunks from {len(file_paths)} documents")
        return True

    def process_audio(self, audio_path):
        if not self.audio_transcriber:
            logger.warning("Audio transcriber not available (missing ASSEMBLYAI_API_KEY)")
            return False

        try:
            chunks = self.audio_transcriber.transcribe_audio(audio_path)
            if chunks:
                embedded_chunks = self.embedding_generator.generate_embeddings(chunks)
                self.vector_db.insert_embeddings(embedded_chunks)
                logger.info(f"Audio processed: {len(chunks)} chunks")
                return True
        except Exception as e:
            logger.error(f"Audio processing failed: {e}")
        return False

    def process_url(self, url):
        if not self.web_scraper:
            logger.warning("Web scraper not available (missing FIRECRAWL_API_KEY)")
            return False

        try:
            chunks = self.web_scraper.scrape_url(url)
            if chunks:
                embedded_chunks = self.embedding_generator.generate_embeddings(chunks)
                self.vector_db.insert_embeddings(embedded_chunks)
                logger.info(f"URL processed: {len(chunks)} chunks")
                return True
        except Exception as e:
            logger.error(f"URL processing failed: {e}")
        return False

    def ask_question(self, question):
        logger.info(f"Processing question: {question}")

        try:
            result = self.rag_generator.generate_response(question)
            if self.memory:
                self.memory.save_conversation_turn(result)
            return result
        except Exception as e:
            logger.error(f"Question processing failed: {e}")
            return None

    def cleanup(self):
        try:
            self.vector_db.close()
            logger.info("Pipeline cleaned up")
        except Exception as e:
            logger.error(f"Cleanup error: {e}")


def test_pipeline():
    logger.info("=" * 60)
    logger.info("STARTING PIPELINE TEST")
    logger.info("=" * 60)

    try:
        pipeline = QuidNotebookPipeline()

        logger.info("\nTEST 1: Document Processing")
        test_documents = []
        if test_documents:
            pipeline.process_documents(test_documents)
        else:
            logger.info("No test documents provided - skipping")

        logger.info("\nTEST 2: Question Answering")
        test_questions = [
            "What is the main topic discussed in the documents?",
            "Can you summarize the key points?",
        ]

        for question in test_questions:
            logger.info(f"\nQ: {question}")
            result = pipeline.ask_question(question)

            if result:
                logger.info(f"A: {result.response}")
                logger.info(f"Sources: {len(result.sources_used)} documents used")
            else:
                logger.error("Failed to get response")

        if pipeline.memory:
            logger.info("\nTEST 3: Memory Context")
            context = pipeline.memory.get_conversation_context()
            logger.info(f"Memory context available: {bool(context)}")

        logger.info("\n" + "=" * 60)
        logger.info("PIPELINE TEST COMPLETED")
        logger.info("=" * 60)

    except Exception as e:
        logger.error(f"Pipeline test failed: {e}")

    finally:
        if 'pipeline' in locals():
            pipeline.cleanup()


if __name__ == "__main__":
    required_keys = ["DEEPSEEK_API_KEY", "GEMINI_API", "OPENAI_API_KEY"]
    optional_keys = ["ASSEMBLYAI_API_KEY", "FIRECRAWL_API_KEY", "ZEP_API_KEY"]

    logger.info("Environment Check:")
    has_llm_key = False
    for key in required_keys:
        present = bool(os.getenv(key))
        has_llm_key = has_llm_key or present
        status = "set" if present else "not set"
        logger.info(f"  {key}: {status}")

    for key in optional_keys:
        status = "set" if os.getenv(key) else "not set"
        logger.info(f"  {key}: {status}")

    if not has_llm_key:
        logger.error("No LLM API key found - cannot proceed")
        exit(1)

    test_pipeline()
