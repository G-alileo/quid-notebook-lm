# Migration Plan: quid-notebook to Next.js + Supabase + n8n

Status: draft v2, 2026-08-31. Decisions locked: RAG chat in Next.js route handler, open registration, Cohere embeddings.

## Goal

Replace the multi-integration stack (Milvus, Zep, MySQL, custom JWT auth, litellm multi-provider, dual UIs, multiple Python servers) with:

- **Next.js**: frontend and the synchronous RAG chat path in one app (route handlers)
- **Supabase**: Auth, Postgres + pgvector, Storage, Realtime
- **n8n**: async pipelines only (ingestion, podcast generation)
- **No extraction container**: retired 2026-09-10. PDF/text parsing happens inside n8n (Extract from File node + Code-node chunker); see `n8n/W1-SPEC.md`

All AI workloads stay remote-API: embeddings via Cohere, chat LLM via the Qwen endpoint (ModelScope inference API), hosted TTS. No local model inference anywhere: your dev box has 2 GB VRAM and the prod path shouldn't depend on it anyway.

Server count: Next.js (one process or Vercel) + n8n (already running for your other products) + Supabase cloud. The extraction container was retired 2026-09-10; parsing lives inside n8n. FastAPI, Streamlit, uvicorn, and the static-serving hacks all disappear.

## Target architecture

```
Next.js app (App Router)
  ├── @supabase/ssr: auth (open registration), session, Storage uploads, Realtime
  ├── POST /api/chat  (route handler)
  │     ├── embed query → Cohere API (input_type: search_query)
  │     ├── match_chunks() RPC (pgvector, RLS-scoped)
  │     ├── numbered-citation prompt
  │     └── Qwen endpoint, SSE stream to client
  └── uploads/podcast requests = Storage upload + Postgres insert, nothing more

Supabase
  ├── Postgres: profiles, documents, chunks, chat_messages, podcasts
  ├── pg_net trigger on documents insert ──▶ n8n W1 (ingestion)
  ├── pg_net trigger on podcasts insert ──▶ n8n W2 (podcast, not built)
  └── Storage buckets: uploads/, podcasts/ (private, RLS-scoped paths)

n8n
  ├── W1 ingestion: extract in-workflow (Extract from File + Code chunker, Firecrawl, AssemblyAI) → Cohere embed → insert chunks → mark ready
  └── W2 podcast: build script (Qwen) → hosted TTS → audio to Storage → mark ready

Client never talks to n8n. Triggers flow Supabase → n8n; results flow Postgres → Realtime → client.
```

Component map, current to target:

| Current | Target |
|---|---|
| Vite React frontend + FastAPI static serving | Next.js app, one deployment |
| Custom JWT auth (python-jose, bcrypt, MySQL users) | Supabase Auth, open registration |
| MySQL via SQLAlchemy | Supabase Postgres |
| Milvus, one DB file + collection per user | one pgvector table, RLS per user |
| Zep memory | chat_messages table, rolling context window |
| litellm (deepseek/gemini/openai fallback chain) | direct calls to one Qwen endpoint |
| Streamlit UI + React UI | Next.js only |
| PDF bytes in MySQL LargeBinary | Storage, signed URLs |
| Podcast audio served from FastAPI disk | Storage, signed URLs |
| Kokoro local TTS | hosted TTS API |
| fastembed local embeddings | Cohere embeddings API |
| Ingestion inline in request handlers | n8n W1, async with status column |

## Decisions

Locked 2026-08-31:

- **RAG chat runtime**: Next.js route handler. Streaming, latency, and citation formatting stay under your control; n8n hiccups never take down chat.
- **Signup**: open registration. Keep RLS as the isolation model; users get no role selection, and the only privilege boundary is `user_id = auth.uid()`.
- **Embeddings**: Cohere, default model `embed-multilingual-v3.0`, 1024 dimensions, user-provided key. Use the **v1 API surface** (`POST /v1/embed`): the user's key tier 404s on `/v2/embeddings`, and n8n's native Cohere node uses v1 anyway. input_type discipline is mandatory: `search_document` at ingestion, `search_query` at query time, or retrieval quality silently degrades. History: Qwen embeddings were attempted first, but the ModelScope inference router serves no embedding models and that key 401s on DashScope directly.
- **Data migration**: fresh start. Existing per-user Milvus files and MySQL rows are dev data; no migration script. New project lives in `quid-notebook-v2`, built clean-room.
- **No local AI**: Kokoro and fastembed are retired with the Python stack.

Still open:

- **TTS provider**: hosted TTS with multiple voices for the podcast pipeline. Check whether the Qwen endpoint includes TTS first; otherwise ElevenLabs or similar.

## Supabase schema

```sql
create extension if not exists vector;

create table profiles (
  id uuid primary key references auth.users on delete cascade,
  username text unique not null,
  full_name text,
  created_at timestamptz not null default now()
);

create table documents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  name text not null,
  type text not null,
  size text,
  status text not null default 'pending',
  storage_path text,
  source_url text,
  chunk_count int not null default 0,
  error text,
  created_at timestamptz not null default now()
);

create table chunks (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references documents(id) on delete cascade,
  user_id uuid not null,
  content text not null,
  embedding vector(1024),
  meta jsonb not null default '{}',
  created_at timestamptz not null default now()
);

create index chunks_embedding_idx on chunks using hnsw (embedding vector_cosine_ops);
create index chunks_document_idx on chunks (document_id);

create table chat_messages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  role text not null,
  content text not null,
  sources jsonb,
  created_at timestamptz not null default now()
);

create table podcasts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  document_id uuid references documents(id) on delete set null,
  style text not null,
  length text not null,
  script jsonb,
  status text not null default 'pending',
  audio_path text,
  error text,
  created_at timestamptz not null default now()
);

alter table profiles enable row level security;
alter table documents enable row level security;
alter table chunks enable row level security;
alter table chat_messages enable row level security;
alter table podcasts enable row level security;

create policy profiles_own on profiles for all using (id = auth.uid());
create policy documents_own on documents for all using (user_id = auth.uid());
create policy chunks_own on chunks for all using (user_id = auth.uid());
create policy chat_own on chat_messages for all using (user_id = auth.uid());
create policy podcasts_own on podcasts for all using (user_id = auth.uid());

create function match_chunks(query_embedding vector(1024), match_count int default 6)
returns table (id uuid, document_id uuid, content text, meta jsonb, similarity float)
language sql stable
as $$
  select c.id, c.document_id, c.content, c.meta,
         1 - (c.embedding <=> query_embedding) as similarity
  from chunks c
  order by c.embedding <=> query_embedding
  limit match_count;
$$;
```

Notes:

- `chunks.meta` carries the citation fields the UI renders: `source_file`, `source_type`, `page_number`, `timestamp`, `url`. Keep the `ChatSource` shape so the ported UI code barely changes.
- `match_chunks` runs as the invoking user, so RLS scopes every search to `auth.uid()`. One table replaces N per-user Milvus collections.
- Buckets: `uploads` and `podcasts`, both private. PDF viewer and audio player use signed URLs instead of authenticated blob endpoints.
- Database Webhooks are **unavailable on this project** — the `supabase_functions` schema does not exist. Migration `0006_ingestion_trigger.sql` provides the equivalent: a `pg_net` trigger on insert into `documents` and (later) `podcasts` where `status = 'pending'`.
- The full applied migration, including the profiles trigger and Storage policies, is at `quid-notebook-v2/supabase/migrations/0001_init.sql`.

## n8n workflow boundaries

### W1. Ingestion

Trigger: `pg_net` trigger on `documents` insert (migration `0006_ingestion_trigger.sql`). Database Webhooks were the original design but the project has no `supabase_functions` schema, so they cannot exist here.

1. Switch on `documents.type`
2. Extract in-workflow:
   - PDF: Extract from File node (per-page text) → Chunk content Code node
   - txt/md: Chunk content Code node decodes the downloaded binary
   - URL: Firecrawl node or HTTP request → Chunk content
   - YouTube/audio: AssemblyAI HTTP request (accepts YouTube URLs natively, yt-dlp disappears) → poll → Chunk content
3. Embed chunks with Cohere (input_type: search_document), batched in groups of 96 (Cohere's per-request limit)
4. Postgres node (direct connection): one parameterized bulk INSERT into `chunks` using `jsonb_array_elements` with an explicit `::vector` cast, then update `documents` (`status = 'ready'`, `chunk_count`). Direct Postgres beats the Supabase node here: payload size, cast control, single transaction. The webhook payload already carries the full row, so no reads are needed.
5. Error path: update `documents` (`status = 'failed'`, `error`), retries on transient steps

Chunking parameters (overlap, size) move into the extraction container, ported from `doc_processor.py`.

### W2. Podcast generation

Trigger: database webhook on `podcasts` insert.

1. Fetch source chunks from Postgres
2. LLM node (Qwen endpoint): script JSON in the existing speaker/line format
3. Hosted TTS per speaker, concatenate
4. Upload audio to `podcasts` bucket, update row (`status = 'ready'`, `audio_path`) or `failed` + `error`
5. UI picks up completion via Realtime, no polling

### Extraction container (retired 2026-09-10)

Removed from the pipeline because the hosted n8n instance could not reach it and no deployment path for it existed. Its job — PDF page text, chunking, citation meta — now runs inside W1: the core Extract from File node for PDFs and a Code node implementing the same 1000/200 sentence-snapped chunking for everything else. Known cost: PDF page numbers now depend on Extract from File's per-page output rather than PyMuPDF, and must be verified after the first PDF ingestion (see `n8n/W1-SPEC.md`). The `extractor/` directory remains in the repo as a reference implementation only.

## Next.js app

- App Router, `@supabase/ssr` for auth: signup, signin, middleware protecting routes, server components for session
- `/api/chat` route handler: verify session server-side, embed query with Cohere (input_type: search_query), `match_chunks()` RPC, port `_format_context_with_citations` and `_create_rag_prompt` from `rag.py` verbatim, fetch the Qwen endpoint, stream SSE back
- Memory: last N `chat_messages` rows prepended to the prompt; the Zep graph is gone
- Keep the SSE event shapes the current frontend parses: `{sources_used}` first, then `{token}` chunks, then `{done}`
- Upload flow: client uploads to Storage via supabase-js, inserts a `documents` row, done. Supabase fires the webhook; UI subscribes to Realtime for `status` changes
- Podcast flow: client inserts a `podcasts` row, subscribes to Realtime, plays the signed audio URL on completion

Port these components from `frontend/src/components/`: `AuthPage`, `Sidebar`, `ChatInterface`, `UploadInterface`, `StudioInterface`. The `ChatSource`, `ChatResponse`, `PodcastScriptResponse` types move with them.

## Build order

New path works before old code is deleted. Each phase is independently verifiable.

1. **Supabase foundation.** Schema, RLS, buckets, database webhooks pointed at placeholder n8n endpoints. Done when: policies verified with two test users.
2. **Answer the open decision.** Pick the TTS provider (embeddings already locked to Cohere).
3. **Extraction container.** Port `doc_processor.py` logic behind `/extract`. Done when: each source type returns chunks with correct page/timestamp metadata.
4. **n8n W1 ingestion.** Done when: an upload produces a `ready` document and queryable chunks end to end.
5. **Next.js scaffold: auth + documents.** Open registration, protected routes, upload UI against Storage + Postgres. Done when: register, login, upload, and status updates all work with no Python in the path.
6. **Chat route handler + ChatInterface port.** Done when: streaming cited answers match current quality against pgvector.
7. **n8n W2 podcast + StudioInterface port.** Done when: script to audio works via the workflow and plays from Storage.
8. **Deletion + README rewrite.** Everything below, then rewrite the README which still documents the dead Streamlit architecture.

## Deletion order

Roughly dependency-safe sequence:

1. `quid-notebook-lm-main/` (verify no unique work first)
2. Streamlit UI: `app.py`, `quid_notebook/ui/`
3. Auth stack: `quid_notebook/services/auth.py`, `services/auth_client/`, `services/user.py`, `core/security.py`, `api/routers/auth.py`, `api/routers/users.py`, `schemas/user.py`
4. Memory: `quid_notebook/services/memory/`
5. Vector DB: `quid_notebook/services/vector_database/`, `manage_collections.py` if present
6. MySQL layer: `core/database.py`, `core/user.py`, `core/document.py`
7. `services/llm/llm_client.py` litellm fallback logic (after Phase 6 replaces it)
8. `services/generation/`, `services/podcast/`, remaining `services/` (after Phases 3, 4, 7 have absorbed them)
9. `frontend/` Vite app (after Phase 5 to 7 ports complete)
10. Root leftovers: `walkthrough.txt`, `quid_auth_api.postman_collection.json`, audit `scripts/`
11. Prune `pyproject.toml` to what the extraction container needs: pymupdf, firecrawl-py, assemblyai, fastapi, uvicorn, requests. Everything else goes: pymilvus, zep-cloud, litellm, sqlalchemy, pymysql, passlib, bcrypt, python-jose, streamlit, plotly, torch, kokoro, yt-dlp, fastembed.

## Risks and honest caveats

- **Embedding drift**: changing the embedding model later means re-embedding every chunk. W1 makes that a replayable job, not a crisis. Both call sites must share one credential/model config from day one.
- **Provider split**: chat runs on the ModelScope/Qwen router, embeddings run on Cohere. Two credentials instead of one, accepted on 2026-08-31 after confirming the router serves no embedding models. Keep both keys in `.env.local` only, never committed.
- **Webhook reachability**: Supabase cloud calls your n8n, so n8n needs its existing public URL or tunnel, same as your other products. The client and Next.js never call n8n directly, which keeps the network surface small.
- **Route handler timeout**: long synchronous work is forbidden in `/api/chat`. If a retrieval or generation step ever needs minutes, it moves to a row + webhook like everything else.
- **Per-request service instantiation dies here**: the current chat router builds a Milvus client and RAGGenerator per request. The route handler is stateless by construction; do not port that pattern.
- **Citation quality now depends on n8n's Extract from File node**: the extractor that guaranteed PyMuPDF page numbers was retired 2026-09-10. If Extract from File joins pages instead of emitting one item per page, PDF citations degrade to page 1. Verify after the first PDF ingestion; restoring exact pages later means re-adding a parser and re-ingesting, which W1's replayable design allows.
- **No free rollback after Phase 8**: phases 1 to 7 are each verified against the live old app before deletion starts.
