import io

import pymupdf
import pytest
from fastapi.testclient import TestClient

from main import app, make_chunks

client = TestClient(app)


def build_pdf(pages: list[str]) -> bytes:
    doc = pymupdf.open()
    for text in pages:
        page = doc.new_page()
        page.insert_text((72, 72), text, fontsize=11)
    data = doc.tobytes()
    doc.close()
    return data


def test_health():
    res = client.get("/health")
    assert res.status_code == 200
    assert res.json() == {"status": "ok"}


def test_pdf_extraction_tracks_pages():
    pdf = build_pdf(["First page content about apples.", "Second page content about oranges."])
    res = client.post("/extract", files={"file": ("report.pdf", pdf, "application/pdf")})
    assert res.status_code == 200
    body = res.json()
    assert body["source_name"] == "report.pdf"
    assert body["total_chunks"] == len(body["chunks"])
    assert "First page" in body["full_text"]
    assert "Second page" in body["full_text"]
    pages = {chunk["meta"]["page_number"] for chunk in body["chunks"]}
    assert pages == {1, 2}
    first = body["chunks"][0]
    assert first["meta"]["source_type"] == "pdf"
    assert first["meta"]["source_file"] == "report.pdf"
    assert first["meta"]["total_pages"] == 2
    assert first["meta"]["chunk_id"].startswith("pdf_0_")


def test_long_text_produces_overlapping_indexed_chunks():
    text = ("The quick brown fox jumps over the lazy dog. " * 60).strip()
    res = client.post(
        "/extract", files={"file": ("notes.txt", io.BytesIO(text.encode()), "text/plain")}
    )
    assert res.status_code == 200
    chunks = res.json()["chunks"]
    assert res.json()["full_text"].startswith("The quick brown fox")
    assert len(chunks) > 1
    indices = [chunk["meta"]["chunk_index"] for chunk in chunks]
    assert indices == list(range(len(chunks)))
    for chunk in chunks:
        assert chunk["content"]
        assert chunk["meta"]["end_char"] >= chunk["meta"]["start_char"]


def test_text_endpoint_carries_url_and_type():
    res = client.post(
        "/extract/text",
        json={
            "content": "[00:12] Host: welcome to the show. " * 20,
            "source_name": "Episode 1 transcript",
            "source_type": "youtube",
            "url": "https://www.youtube.com/watch?v=abc123",
        },
    )
    assert res.status_code == 200
    body = res.json()
    assert body["source_name"] == "Episode 1 transcript"
    assert body["full_text"].startswith("[00:12] Host:")
    for chunk in body["chunks"]:
        assert chunk["meta"]["source_type"] == "youtube"
        assert chunk["meta"]["url"] == "https://www.youtube.com/watch?v=abc123"
        assert "page_number" not in chunk["meta"]


def test_unsupported_extension_rejected():
    res = client.post("/extract", files={"file": ("malware.exe", b"MZ...", "application/octet-stream")})
    assert res.status_code == 415


def test_blank_pdf_rejected():
    pdf = build_pdf([""])
    res = client.post("/extract", files={"file": ("blank.pdf", pdf, "application/pdf")})
    assert res.status_code == 422


def test_empty_text_content_rejected():
    res = client.post("/extract/text", json={"content": "   ", "source_name": "empty"})
    assert res.status_code == 422


def test_boundary_snaps_to_sentence():
    text = "a" * 900 + ". " + "b" * 200
    chunks = make_chunks(text, "t.txt", "txt")
    assert chunks[0]["content"].endswith(".")
    assert len(chunks) >= 2
