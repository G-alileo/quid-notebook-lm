from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
import os
import time
import logging
from pathlib import Path
from dataclasses import dataclass
from typing import List, Dict

from quid_notebook.api.dependencies import get_db, get_current_user
from quid_notebook.core.user import User
from quid_notebook.core.document import Document
from quid_notebook.schemas.podcast import PodcastScriptRequest, PodcastScriptResponse
from quid_notebook.services.podcast.script_generator import PodcastScriptGenerator
from quid_notebook.services.embeddings.embedding_generator import EmbeddingGenerator
from quid_notebook.services.vector_database.milvus_vector_db import MilvusVectorDB

try:
    from quid_notebook.services.podcast.text_to_speech import PodcastTTSGenerator
except Exception as tts_err:
    PodcastTTSGenerator = None
    logging.warning(f"Kokoro TTS generator import failed: {tts_err}")

router = APIRouter(prefix="/podcast", tags=["Podcast"])
logger = logging.getLogger(__name__)

embedding_generator = EmbeddingGenerator()


def get_milvus_db(user_id: str) -> MilvusVectorDB:
    os.makedirs("./data", exist_ok=True)
    collection_name = f"user_{user_id.replace('-', '_')}_documents"
    return MilvusVectorDB(
        db_path=f"./data/milvus_{user_id}.db",
        collection_name=collection_name
    )


@router.post("/script", response_model=PodcastScriptResponse)
def generate_script(
    request: PodcastScriptRequest,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user)
):
    try:
        doc = db.query(Document).filter(
            Document.name == request.source_name,
            Document.user_id == user.id
        ).first()

        if not doc:
            raise HTTPException(status.HTTP_404_NOT_FOUND, f"Source document '{request.source_name}' not found")

        vector_db = get_milvus_db(user.id)
        query_embedding = embedding_generator.generate_query_embedding(f"content from {request.source_name}")
        
        search_results = vector_db.search(
            query_vector=query_embedding.tolist(),
            limit=50,
            filter_expr=f'source_file == "{request.source_name}"'
        )

        if not search_results:
            raise HTTPException(status.HTTP_400_BAD_REQUEST, "No embedded content found for document")

        search_results.sort(key=lambda x: x.get('chunk_index', 0))

        # LLM Configurations
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

        script_generator = PodcastScriptGenerator(
            llm_api_key,
            provider=llm_provider,
            fallback_api_key=fb_key,
            fallback_provider=fb_provider,
        )

        if doc.type == 'Website':
            @dataclass
            class ChunkLike:
                content: str

            chunks = [ChunkLike(content=r['content']) for r in search_results]
            podcast_script = script_generator.generate_script_from_website(
                website_chunks=chunks,
                source_url=request.source_name,
                podcast_style=request.style.lower(),
                target_duration=request.length
            )
        else:
            combined_content = "\n\n".join([r['content'] for r in search_results])
            podcast_script = script_generator.generate_script_from_text(
                text_content=combined_content,
                source_name=request.source_name,
                podcast_style=request.style.lower(),
                target_duration=request.length
            )

        # Save script JSON under outputs/
        outputs_dir = Path("outputs")
        outputs_dir.mkdir(exist_ok=True)
        ts = int(time.time())
        script_path = outputs_dir / f"script_{ts}.json"
        script_path.write_text(podcast_script.to_json(), encoding="utf-8")

        # Map list of dictionaries format to match response schema
        formatted_script = []
        for line in podcast_script.script:
            speaker = list(line.keys())[0]
            dialogue = line[speaker]
            formatted_script.append({speaker: dialogue})

        return {
            "total_lines": podcast_script.total_lines,
            "estimated_duration": podcast_script.estimated_duration,
            "source_document": podcast_script.source_document,
            "script": formatted_script
        }
    except Exception as e:
        raise HTTPException(status.HTTP_500_INTERNAL_SERVER_ERROR, f"Script generation failed: {str(e)}")


@router.post("/audio")
def generate_audio(
    script_data: PodcastScriptResponse,
    user: User = Depends(get_current_user)
):
    if PodcastTTSGenerator is None:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Kokoro TTS is not available on this server host")

    try:
        # Re-construct PodcastScript object
        # Since text_to_speech module imports PodcastScript, let's load it
        from quid_notebook.services.podcast.script_generator import PodcastScript
        
        # Convert List[Dict] script representation
        script_list = []
        for line in script_data.script:
            speaker = list(line.keys())[0]
            dialogue = line[speaker]
            script_list.append({speaker: dialogue})

        podcast_script = PodcastScript(
            script=script_list,
            total_lines=script_data.total_lines,
            estimated_duration=script_data.estimated_duration,
            source_document=script_data.source_document
        )

        import tempfile
        temp_dir = tempfile.mkdtemp(prefix="podcast_")

        tts_generator = PodcastTTSGenerator()
        audio_files = tts_generator.generate_podcast_audio(
            podcast_script=podcast_script,
            output_dir=temp_dir,
            combine_audio=True
        )

        complete_audio = None
        for audio_file in audio_files:
            if "complete_podcast" in Path(audio_file).name:
                complete_audio = audio_file
                break

        if not complete_audio:
            raise HTTPException(status.HTTP_500_INTERNAL_SERVER_ERROR, "Failed to compile the completed podcast audio file")

        outputs_dir = Path("outputs")
        outputs_dir.mkdir(exist_ok=True)
        ts = int(time.time())
        filename = f"podcast_{ts}.wav"
        saved_path = outputs_dir / filename

        with open(complete_audio, "rb") as src:
            saved_path.write_bytes(src.read())

        # Clean up temp files
        try:
            for f in audio_files:
                os.unlink(f)
            os.rmdir(temp_dir)
        except Exception:
            pass

        return {"filename": filename}
    except Exception as e:
        raise HTTPException(status.HTTP_500_INTERNAL_SERVER_ERROR, f"Audio synthesis failed: {str(e)}")


@router.get("/audio/{filename}")
def serve_audio(
    filename: str,
    user: User = Depends(get_current_user)
):
    outputs_dir = Path("outputs")
    file_path = outputs_dir / filename
    if not file_path.exists():
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Audio file not found")
    return FileResponse(path=file_path, media_type="audio/wav")
