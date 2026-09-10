# W1 Ingestion: wiring spec

`w1-ingestion.json` is an export of the live workflow and already carries the ten credential assignments, so importing it into the same n8n instance preserves them. Extraction runs **entirely inside n8n** — the extractor container was retired on 2026-09-10 because it could not be reached from the hosted n8n instance, and n8n's own Extract from File node plus a Code-node chunker replace it with no extra service to deploy.

## Access-path split

- UI talks to Supabase directly (supabase-js). The workflow never receives calls from the client.
- Trigger: `pg_net` trigger on `documents` INSERT (migration `0006_ingestion_trigger.sql`), hitting the workflow's Webhook node.
- Inside the workflow:
  - HTTP Request + `supabaseApi` predefined credential for Storage (object download, signed URLs). The Supabase node has no Storage operations.
  - PDF text via the core **Extract from File** node; txt/md decoded from base64 binary in the **Chunk content** Code node; URL markdown and AssemblyAI transcripts fed straight into the same Code node.
  - Postgres node (direct connection) for chunks bulk insert and status updates. Vectors need an explicit `::vector` cast and a single transaction; PostgREST row-by-row is the wrong tool for thousands of 1024-dim rows.
  - No table reads: the webhook payload already carries the full `documents` row in `body.record`.

## Credentials to create (n8n → Credentials)

Five credentials, referenced by ten nodes. Two use the HTTP Request node's **Predefined Credential Type**; the rest use Generic Credential Type (Header Auth) or the Postgres node's own credential. The JSON embeds the live assignments (`Supabase account 7`, `Header Auth account 7`, `assembly`, `Cohere account`, `Postgres account 4`); re-map them only if importing into a different n8n instance.

| Credential | n8n type | Nodes | Value |
|---|---|---|---|
| Supabase service_role | `supabaseApi` (predefined) | Download file, Sign audio URL | project URL `https://egemmkssgdhsdyjpsuzo.supabase.co` + service_role key |
| Cohere | `cohereApi` (predefined) | Embed chunks | `COHERE_API_KEY` |
| Firecrawl | `httpHeaderAuth` | Scrape URL | `Authorization: Bearer <FIRECRAWL_API_KEY>` |
| AssemblyAI | `httpHeaderAuth` | Create transcript (YouTube), Create transcript (Audio), Get transcript | `Authorization: <ASSEMBLYAI_API_KEY>` (no Bearer prefix, AssemblyAI uses the raw key) |
| Supabase DB | `postgres` | Insert chunks, Mark ready, Mark failed | host `db.egemmkssgdhsdyjpsuzo.supabase.co`, port 5432, user `postgres`, database `postgres`, your DB password, SSL on |

Firecrawl and AssemblyAI stay on Header Auth because n8n ships no dedicated credential type for either service.

**Every credential reference in the JSON points at a real credential in the live instance.** If a node shows an unresolved credential after import, the credential was deleted or renamed on that instance — reselect it from the dropdown.

If your n8n build does not expose `supabaseApi` or `cohereApi` to the HTTP Request node, revert those three nodes to Generic Credential Type → Header Auth with `Authorization: Bearer <key>` and create them as Header Auth credentials instead. The predefined types are a convenience, not a requirement.

The service_role key bypasses RLS. Keep it in n8n credentials only, never in the client bundle.

## Ingestion trigger

Supabase Database Webhooks are **not available on this project**: the `supabase_functions` schema they are built on does not exist, so neither the dashboard page nor `supabase_functions.http_request` can be used. Migration `0006_ingestion_trigger.sql` replaces them with a direct `pg_net` trigger — on INSERT into `documents` where `status = 'pending'`, `public.notify_ingestion()` posts the same payload shape Database Webhooks produced (`{ type, table, schema, record, old_record }`) to `https://agents.customcx.com/webhook/quid-w1-ingest`.

That URL is the production endpoint composed from the n8n base host and the Webhook node's `path` (`quid-w1-ingest`), which is already set in the JSON. It only resolves once the workflow is **active** — the test URL uses `/webhook-test/` and only listens while you are waiting on an execution.

If `create extension pg_net` fails, this project lacks pg_net as well and the trigger approach is dead; fall back to an app-side notify route in Next.js instead.

W2 will need the same trigger on `podcasts` when it is built.

## Branch behavior

- **file (pdf)**: Storage download → `PDF?` switch → Extract from File (per-page text) → Chunk content
- **file (txt/md)**: Storage download → `PDF?` switch → Chunk content (base64 decode, utf-8 with latin-1 fallback)
- **url**: Firecrawl scrape (markdown) → Chunk content
- **youtube**: AssemblyAI transcript from the YouTube URL directly → poll every 10s → Chunk content
- **audio**: sign a Storage URL (1h expiry) → AssemblyAI transcript from that URL → same poll path
- **Chunk content** implements the chunking contract in JavaScript: 1000-char chunks, 200 overlap, snapped to the last `.` or newline in the second half of the window, with `source_file`, `source_type`, `chunk_index`, `start_char`, `end_char`, `chunk_id` meta and `page_number` for PDFs. It emits `{ chunks, full_text }`, the same shape the old extractor returned.
- All branches converge into: batch texts in groups of 96 (Cohere's limit) → embed with `input_type: search_document` → one parameterized Postgres INSERT into `chunks` via `jsonb_array_elements` → `documents.status = 'ready'`, `chunk_count` set, and `full_text` written to `documents.content` (feeds the reader view)
- Any node error routes to Mark failed: `status = 'failed'`, `error` column carries the message, the UI shows the red pill

## Before first run

1. **Verify PDF pagination after the first PDF ingestion.** `page_number` is derived from Extract from File emitting one item per page. Check `select meta->>'page_number', count(*) from chunks group by 1;` — if every row reports page 1, the node joined pages and its options need flipping.
2. The Supabase project URL is hardcoded in three expressions (download, sign, audio URL). It is set to `https://egemmkssgdhsdyjpsuzo.supabase.co`.
3. Workflow execution timeout is set to 900s for long transcriptions. Self-hosted n8n must allow it (`EXECUTIONS_TIMEOUT`).
4. If you don't have Firecrawl or AssemblyAI keys yet, those branches simply fail to Mark failed with a clear error. PDF/text ingestion works without them.

## Test order

1. Activate the workflow, then upload a small `.md` or `.txt` from the UI. Watch execution: Download file → PDF? → Chunk content → Prepare batches → Embed chunks → Insert chunks → Mark ready. The UI pill should go pending → ready with a chunk count.
2. Verify in SQL editor: `select count(*) from chunks;` and `select meta->>'page_number' from chunks limit 5;`
3. Upload a PDF and confirm page numbers spread across the document.
4. Add a web URL source, then a YouTube link.

## Known sharp edges

- The Postgres node's query-parameters field splits on commas in the expression text, not in evaluated values. The expressions used here are comma-free by design; keep it that way if you edit them.
- AssemblyAI transcripts that end in `error` status route to Mark failed. Transcripts stuck in `processing` loop until the workflow timeout, which also lands on failed via timeout.
- The Wait node loop keeps one execution open per media source. Concurrent media uploads are fine, just expect parallel executions.
