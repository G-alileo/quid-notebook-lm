from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
import os
import logging
import json

from quid_notebook.api.dependencies import get_db, get_current_user
from quid_notebook.core.user import User
from quid_notebook.schemas.chat import ChatRequest, ChatResponse
from quid_notebook.services.generation.rag import RAGGenerator
from quid_notebook.services.embeddings.embedding_generator import EmbeddingGenerator
from quid_notebook.services.vector_database.milvus_vector_db import MilvusVectorDB
from quid_notebook.services.memory.memory_layer import MemoryLayer

router = APIRouter(prefix="/chat", tags=["Chat"])
logger = logging.getLogger(__name__)

embedding_generator = EmbeddingGenerator()


def get_milvus_db(user_id: str) -> MilvusVectorDB:
    os.makedirs("./data", exist_ok=True)
    # Isolate user collections in Milvus Cloud and Local
    collection_name = f"user_{user_id.replace('-', '_')}_documents"
    return MilvusVectorDB(
        db_path=f"./data/milvus_{user_id}.db",
        collection_name=collection_name
    )


@router.post("/", response_model=ChatResponse)
def query_chat(
    request: ChatRequest,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user)
):
    try:
        vector_db = get_milvus_db(user.id)

        # Configure LLM Client settings
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

        # Fallback to any set key
        if not llm_api_key:
            for p, k in provider_keys.items():
                if k:
                    llm_provider, llm_api_key = p, k
                    break

        if not llm_api_key:
            raise HTTPException(status.HTTP_400_BAD_REQUEST, "No LLM API key configured in backend environment")

        fb_key, fb_provider = None, None
        if llm_provider != "gemini" and gemini_key:
            fb_key, fb_provider = gemini_key, "gemini"
        elif llm_provider != "deepseek" and deepseek_key:
            fb_key, fb_provider = deepseek_key, "deepseek"
        elif llm_provider != "openai" and openai_key:
            fb_key, fb_provider = openai_key, "openai"

        rag_generator = RAGGenerator(
            embedding_generator=embedding_generator,
            vector_db=vector_db,
            api_key=llm_api_key,
            provider=llm_provider,
            fallback_api_key=fb_key,
            fallback_provider=fb_provider,
        )

        result = rag_generator.generate_response(request.query)

        # Zep memory save
        zep_key = os.getenv("ZEP_API_KEY")
        if zep_key:
            try:
                # Thread ID corresponds to the user's chat thread
                session_id = f"session_{user.id}"
                memory = MemoryLayer(
                    user_id=user.id,
                    session_id=session_id,
                    zep_api_key=zep_key,
                    create_new_session=False
                )
                memory.save_conversation_turn(result)
            except Exception as memory_err:
                logger.warning(f"Zep memory integration failed: {memory_err}")

        return result
    except Exception as e:
        raise HTTPException(status.HTTP_500_INTERNAL_SERVER_ERROR, f"Chat processing failed: {str(e)}")


@router.post("/stream")
def query_chat_stream(
    request: ChatRequest,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user)
):
    try:
        vector_db = get_milvus_db(user.id)

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
            raise HTTPException(status.HTTP_400_BAD_REQUEST, "No LLM API key configured in backend environment")

        fb_key, fb_provider = None, None
        if llm_provider != "gemini" and gemini_key:
            fb_key, fb_provider = gemini_key, "gemini"
        elif llm_provider != "deepseek" and deepseek_key:
            fb_key, fb_provider = deepseek_key, "deepseek"
        elif llm_provider != "openai" and openai_key:
            fb_key, fb_provider = openai_key, "openai"

        rag_generator = RAGGenerator(
            embedding_generator=embedding_generator,
            vector_db=vector_db,
            api_key=llm_api_key,
            provider=llm_provider,
            fallback_api_key=fb_key,
            fallback_provider=fb_provider,
        )

        def sse_generator():
            for chunk in rag_generator.generate_response_stream(request.query):
                yield f"data: {json.dumps(chunk)}\n\n"

        return StreamingResponse(sse_generator(), media_type="text/event-stream")

    except Exception as e:
        raise HTTPException(status.HTTP_500_INTERNAL_SERVER_ERROR, f"Chat streaming failed: {str(e)}")

