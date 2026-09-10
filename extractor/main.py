import hashlib
import os
from typing import Optional

import pymupdf
from fastapi import FastAPI, File, HTTPException, UploadFile
from pydantic import BaseModel

CHUNK_SIZE = int(os.getenv("CHUNK_SIZE", "1000"))
CHUNK_OVERLAP = int(os.getenv("CHUNK_OVERLAP", "200"))
MAX_FILE_BYTES = 50 * 1024 * 1024

app = FastAPI(title="quid-extractor")


def make_chunks(
    text: str,
    source_file: str,
    source_type: str,
    page_number: Optional[int] = None,
    extra_meta: Optional[dict] = None,
    start_index: int = 0,
) -> list[dict]:
    chunks = []
    start = 0
    index = start_index
    while start < len(text):
        end = min(start + CHUNK_SIZE, len(text))
        if end < len(text):
            boundary = max(text.rfind(".", start, end), text.rfind("\n", start, end))
            if boundary > start + CHUNK_SIZE * 0.5:
                end = boundary + 1
        content = text[start:end].strip()
        if content:
            meta = {
                "source_file": source_file,
                "source_type": source_type,
                "chunk_index": index,
                "start_char": start,
                "end_char": end - 1,
            }
            if page_number:
                meta["page_number"] = page_number
            if extra_meta:
                meta.update(extra_meta)
            meta["chunk_id"] = f"{source_type}_{index}_{hashlib.md5(content.encode()).hexdigest()[:8]}"
            chunks.append({"content": content, "meta": meta})
            index += 1
        start = max(start + CHUNK_SIZE - CHUNK_OVERLAP, end)
        if start >= len(text):
            break
    return chunks


def decode_text(data: bytes) -> str:
    for enc in ("utf-8", "cp1252", "latin-1"):
        try:
            return data.decode(enc)
        except UnicodeDecodeError:
            continue
    return data.decode("utf-8", errors="replace")


def extract_pdf(data: bytes, source_name: str) -> tuple[list[dict], str]:
    doc = pymupdf.open(stream=data, filetype="pdf")
    chunks = []
    pages_text = []
    try:
        total_pages = len(doc)
        for page_num in range(total_pages):
            text = doc.load_page(page_num).get_text()
            if not text.strip():
                continue
            pages_text.append(text.strip())
            chunks.extend(
                make_chunks(
                    text,
                    source_name,
                    "pdf",
                    page_number=page_num + 1,
                    extra_meta={"total_pages": total_pages},
                    start_index=len(chunks),
                )
            )
    finally:
        doc.close()
    return chunks, "\n\n".join(pages_text)


class TextExtractRequest(BaseModel):
    content: str
    source_name: str
    source_type: str = "text"
    url: Optional[str] = None


@app.get("/health")
def health():
    return {"status": "ok"}


@app.post("/extract")
async def extract_file(file: UploadFile = File(...)):
    data = await file.read()
    if len(data) > MAX_FILE_BYTES:
        raise HTTPException(status_code=413, detail="file too large")

    name = file.filename or "upload"
    suffix = name.rsplit(".", 1)[-1].lower() if "." in name else ""

    if suffix == "pdf":
        try:
            chunks, full_text = extract_pdf(data, name)
        except HTTPException:
            raise
        except Exception:
            raise HTTPException(status_code=422, detail="could not parse PDF")
    elif suffix in ("txt", "md"):
        full_text = decode_text(data)
        chunks = make_chunks(full_text, name, suffix)
    else:
        raise HTTPException(status_code=415, detail=f"unsupported file type: {suffix or 'unknown'}")

    if not chunks:
        raise HTTPException(status_code=422, detail="no extractable text found")
    return {"source_name": name, "total_chunks": len(chunks), "chunks": chunks, "full_text": full_text}


@app.post("/extract/text")
def extract_text(request: TextExtractRequest):
    if not request.content.strip():
        raise HTTPException(status_code=422, detail="empty content")
    extra_meta = {"url": request.url} if request.url else None
    full_text = request.content.strip()
    chunks = make_chunks(full_text, request.source_name, request.source_type, extra_meta=extra_meta)
    if not chunks:
        raise HTTPException(status_code=422, detail="no extractable text found")
    return {
        "source_name": request.source_name,
        "total_chunks": len(chunks),
        "chunks": chunks,
        "full_text": full_text,
    }
