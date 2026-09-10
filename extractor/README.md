# quid-extractor

Stateless parsing service for the ingestion pipeline. No auth, no database, no inference: file or text in, citation-ready chunks out. Called by the n8n ingestion workflow (W1 in `docs/MIGRATION_PLAN.md`).

## Endpoints

### `GET /health`

Returns `{"status": "ok"}`.

### `POST /extract`

Multipart form with one `file` field. Accepts `.pdf`, `.txt`, `.md` up to 50 MB. PDFs are extracted per page so chunks carry page numbers.

Response:

```json
{
  "source_name": "report.pdf",
  "total_chunks": 12,
  "chunks": [
    {
      "content": "...",
      "meta": {
        "source_file": "report.pdf",
        "source_type": "pdf",
        "chunk_index": 0,
        "start_char": 0,
        "end_char": 940,
        "page_number": 1,
        "total_pages": 8,
        "chunk_id": "pdf_0_1a2b3c4d"
      }
    }
  ]
}
```

Errors: `413` too large, `415` unsupported type, `422` unparseable or no text.

### `POST /extract/text`

JSON body for content already fetched elsewhere (Firecrawl pages, AssemblyAI transcripts):

```json
{
  "content": "[00:12] Host: ...",
  "source_name": "Episode 1 transcript",
  "source_type": "youtube",
  "url": "https://www.youtube.com/watch?v=abc123"
}
```

Same response shape; `url` lands in chunk meta when provided, no `page_number`.

## Chunking

1000-char chunks with 200-char overlap, snapping to the nearest sentence or line break when one exists in the second half of the window. Override with `CHUNK_SIZE` and `CHUNK_OVERLAP` env vars.

## Run

```bash
docker compose up --build
```

or locally:

```bash
uv venv .venv
uv pip install --python .venv\Scripts\python.exe -r requirements.txt
.venv\Scripts\python.exe -m uvicorn main:app --port 8100
```

Tests: `.venv\Scripts\python.exe -m pytest tests -q`

## Deployment note

Runs next to n8n in the same compose stack on port 8100. Merge the service block from `docker-compose.yml` into the n8n stack rather than running two compose projects.
