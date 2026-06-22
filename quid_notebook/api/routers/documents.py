from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, status
from fastapi.responses import Response
from sqlalchemy.orm import Session
import tempfile
import os
import time
from typing import List

from quid_notebook.api.dependencies import get_db, get_current_user
from quid_notebook.core.user import User
from quid_notebook.core.document import Document
from quid_notebook.schemas.document import DocumentResponse

from quid_notebook.services.document_processing.doc_processor import DocumentProcessor
from quid_notebook.services.embeddings.embedding_generator import EmbeddingGenerator
from quid_notebook.services.vector_database.milvus_vector_db import MilvusVectorDB
from quid_notebook.services.audio_processing.audio_transcriber import AudioTranscriber
from quid_notebook.services.web_scraping.web_scraper import WebScraper
from quid_notebook.services.audio_processing.youtube_transcriber import YouTubeTranscriber

router = APIRouter(prefix="/documents", tags=["Documents"])

doc_processor = DocumentProcessor()
embedding_generator = EmbeddingGenerator()


def get_milvus_db(user_id: str) -> MilvusVectorDB:
    os.makedirs("./data", exist_ok=True)
    collection_name = f"user_{user_id.replace('-', '_')}_documents"
    return MilvusVectorDB(
        db_path=f"./data/milvus_{user_id}.db",
        collection_name=collection_name
    )


def get_audio_transcriber() -> AudioTranscriber:
    key = os.getenv("ASSEMBLYAI_API_KEY")
    if not key:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Audio transcription is not configured (missing ASSEMBLYAI_API_KEY)")
    return AudioTranscriber(key)


def get_youtube_transcriber() -> YouTubeTranscriber:
    key = os.getenv("ASSEMBLYAI_API_KEY")
    if not key:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "YouTube transcription is not configured (missing ASSEMBLYAI_API_KEY)")
    return YouTubeTranscriber(key)


def get_web_scraper() -> WebScraper:
    key = os.getenv("FIRECRAWL_API_KEY")
    if not key:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Web scraping is not configured (missing FIRECRAWL_API_KEY)")
    return WebScraper(key)


@router.post("/upload", response_model=DocumentResponse)
async def upload_file(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user)
):
    try:
        suffix = f".{file.filename.split('.')[-1]}"
        file_bytes = await file.read()

        with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp_file:
            tmp_file.write(file_bytes)
            temp_path = tmp_file.name

        vector_db = get_milvus_db(user.id)

        if file.content_type and file.content_type.startswith('audio/'):
            transcriber = get_audio_transcriber()
            chunks = transcriber.transcribe_audio(temp_path)
            source_type = "Audio"
            for chunk in chunks:
                chunk.source_file = file.filename
        else:
            chunks = doc_processor.process_document(temp_path)
            source_type = "PDF" if file.filename.endswith('.pdf') else "Text"
            for chunk in chunks:
                chunk.source_file = file.filename

        os.unlink(temp_path)

        if not chunks:
            raise HTTPException(status.HTTP_400_BAD_REQUEST, "No content could be extracted from the file")

        embedded_chunks = embedding_generator.generate_embeddings(chunks)
        
        # Check if the user has other documents to avoid recreating index
        user_docs_count = db.query(Document).filter(Document.user_id == user.id).count()
        if user_docs_count == 0:
            vector_db.create_index(use_binary_quantization=False)

        vector_db.insert_embeddings(embedded_chunks)

        size_kb = f"{len(file_bytes) / 1024:.1f} KB"
        doc = Document(
            user_id=user.id,
            name=file.filename,
            type=source_type,
            size=size_kb,
            chunks=len(chunks),
            file_bytes=file_bytes if file.filename.endswith('.pdf') else None
        )
        db.add(doc)
        db.commit()
        db.refresh(doc)
        
        return doc
    except Exception as e:
        if 'temp_path' in locals() and os.path.exists(temp_path):
            os.unlink(temp_path)
        raise HTTPException(status.HTTP_500_INTERNAL_SERVER_ERROR, f"File processing failed: {str(e)}")


@router.post("/url", response_model=DocumentResponse)
def add_url(
    url: str = Form(...),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user)
):
    try:
        scraper = get_web_scraper()
        chunks = scraper.scrape_url(url)

        if not chunks:
            raise HTTPException(status.HTTP_400_BAD_REQUEST, "No content could be scraped from URL")

        for chunk in chunks:
            chunk.source_file = url

        vector_db = get_milvus_db(user.id)
        embedded_chunks = embedding_generator.generate_embeddings(chunks)

        user_docs_count = db.query(Document).filter(Document.user_id == user.id).count()
        if user_docs_count == 0:
            vector_db.create_index(use_binary_quantization=False)

        vector_db.insert_embeddings(embedded_chunks)

        doc = Document(
            user_id=user.id,
            name=url,
            type="Website",
            size=f"{len(chunks)} chunks",
            chunks=len(chunks)
        )
        db.add(doc)
        db.commit()
        db.refresh(doc)
        return doc
    except Exception as e:
        raise HTTPException(status.HTTP_500_INTERNAL_SERVER_ERROR, f"URL processing failed: {str(e)}")


@router.post("/youtube", response_model=DocumentResponse)
def add_youtube(
    url: str = Form(...),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user)
):
    try:
        transcriber = get_youtube_transcriber()
        chunks = transcriber.transcribe_youtube_video(url, cleanup_audio=True)

        if not chunks:
            raise HTTPException(status.HTTP_400_BAD_REQUEST, "No transcript extracted from YouTube video")

        video_id = transcriber.extract_video_id(url)
        video_name = f"YouTube: {video_id}"

        for chunk in chunks:
            chunk.source_file = video_name

        vector_db = get_milvus_db(user.id)
        embedded_chunks = embedding_generator.generate_embeddings(chunks)

        user_docs_count = db.query(Document).filter(Document.user_id == user.id).count()
        if user_docs_count == 0:
            vector_db.create_index(use_binary_quantization=False)

        vector_db.insert_embeddings(embedded_chunks)

        doc = Document(
            user_id=user.id,
            name=video_name,
            type="YouTube Video",
            size=f"{len(chunks)} segments",
            chunks=len(chunks)
        )
        db.add(doc)
        db.commit()
        db.refresh(doc)
        return doc
    except Exception as e:
        raise HTTPException(status.HTTP_500_INTERNAL_SERVER_ERROR, f"YouTube transcription failed: {str(e)}")


@router.post("/text", response_model=DocumentResponse)
def add_text(
    name: str = Form(...),
    content: str = Form(...),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user)
):
    try:
        if not content.strip():
            raise HTTPException(status.HTTP_400_BAD_REQUEST, "Content cannot be empty")

        with tempfile.NamedTemporaryFile(mode='w', delete=False, suffix='.txt') as tmp_file:
            tmp_file.write(content)
            temp_path = tmp_file.name

        chunks = doc_processor.process_document(temp_path)
        os.unlink(temp_path)

        if not chunks:
            raise HTTPException(status.HTTP_400_BAD_REQUEST, "No chunks generated")

        for chunk in chunks:
            chunk.source_file = name

        vector_db = get_milvus_db(user.id)
        embedded_chunks = embedding_generator.generate_embeddings(chunks)

        user_docs_count = db.query(Document).filter(Document.user_id == user.id).count()
        if user_docs_count == 0:
            vector_db.create_index(use_binary_quantization=False)

        vector_db.insert_embeddings(embedded_chunks)

        doc = Document(
            user_id=user.id,
            name=name,
            type="Text",
            size=f"{len(content)} chars",
            chunks=len(chunks)
        )
        db.add(doc)
        db.commit()
        db.refresh(doc)
        return doc
    except Exception as e:
        if 'temp_path' in locals() and os.path.exists(temp_path):
            os.unlink(temp_path)
        raise HTTPException(status.HTTP_500_INTERNAL_SERVER_ERROR, f"Text processing failed: {str(e)}")


@router.get("/", response_model=List[DocumentResponse])
def list_documents(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user)
):
    return db.query(Document).filter(Document.user_id == user.id).all()


@router.get("/{document_id}/pdf")
def get_document_pdf(
    document_id: str,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user)
):
    doc = db.query(Document).filter(Document.id == document_id, Document.user_id == user.id).first()
    if not doc:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Document not found")
    if not doc.file_bytes:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Document is not a PDF or does not have saved bytes")

    return Response(content=doc.file_bytes, media_type="application/pdf")
