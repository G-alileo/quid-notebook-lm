# Product & UX Spec: quid-notebook-v2

Status: draft v1, 2026-09-10. Decisions locked: folder-scoped workspace, three coverage metrics, highlights + annotations, PDF.js text layer, Web Speech API read-aloud, hosted TTS stock voices for podcast.

Companion to `MIGRATION_PLAN.md`, which owns the infrastructure architecture (Next.js + Supabase + n8n W1/W2 + extraction container, Cohere embeddings, Qwen chat, no local AI). This document owns the product surface: routes, screen behavior, data model, and build sequencing. Where the two disagree, `MIGRATION_PLAN.md` wins on infrastructure and this file wins on UX.

## Goal

Turn the working but page-scattered study loop (sources manager, standalone reader, standalone chat, standalone flashcards) into one folder-scoped workspace, and add the four things the product is named for but does not yet have: a public front door, notes, audio, and honest progress data.

The unit of work is the **folder**, not the document. A user picks a folder, and reading, asking, annotating, listening, and measuring all happen inside that scope.

## Information architecture

```
/                        public landing — value prop, CTA, real product shot
/auth/sign-in            exists
/auth/sign-up            exists
/home                    overview + stats; first-run variant routes to folder creation
/library                 folders, categories, all sources (today's /dashboard)
/w/[folderId]            THE WORKSPACE — three columns, folder-scoped
/podcasts                audio library + player
/settings                profile, password, read-aloud, podcast defaults, workspace prefs
```

`/w/[folderId]?doc=[documentId]` keeps the open document in the query string so back/forward and reload restore the exact state.

Migration from current routes: `/` stops hard-redirecting to `/dashboard`; `/dashboard` becomes `/library`; `/dashboard/documents/[id]` is replaced by the workspace; `/dashboard/chat` is absorbed into the workspace right rail (a folder-less global chat is not worth keeping as a separate surface).

`src/proxy.ts` currently redirects every unauthenticated non-`/auth` request to sign-in. `/` must be added to a public allowlist or the landing page will bounce. `proxy.ts` is the correct Next 16 convention rather than a stray filename — the production build reports it as `Proxy (Middleware)`.

**There is no sidebar.** The original four-item rail (Home, Library, Podcasts, Settings) was dropped along with the persistent folder list it carried. A rail that lists folders on the dashboard duplicates the folder grid on the same screen, makes the dashboard optional as a navigation stage, and costs 16rem on a screen meant to be minimal — while `/w/[folderId]` sits outside the dashboard layout and never had the rail at all, so the shell changed shape mid-flow.

Chrome is now one model across all authenticated screens: a slim top bar (`src/components/app-bar.tsx`: mark, Dashboard, Flashcards, user, sign out) above full-bleed content on `/dashboard` and `/dashboard/flashcards`, and the workspace's own header with a back link on `/w/[folderId]`. Folders are managed in exactly one place (the dashboard grid) and categories in exactly one place (the sources section). Folder switching from inside the workspace means going back to the dashboard — deliberate, since the flow is sequential and a header switcher would reintroduce the same stage-collapsing shortcut the rail did.

## Screen behavior

### Landing (`/`)

One viewport does the work: value proposition, single primary CTA, and a screenshot of the actual workspace — not an illustration. Below the fold: the three coverage metrics explained, read-aloud, podcast, cited chat. Secondary CTA repeats once. No pricing page, no blog, no cookie theatre.

Auth pages keep passive privacy acceptance ("By signing in, you agree to our Privacy Policy"), consistent with the existing `/auth` layout.

**Implemented in Phase 7**, with these deviations:

- **No screenshot exists, so the hero shows a CSS replica instead.** `src/components/landing/workspace-mock.tsx` is a static, JS-free Tailwind reconstruction of the real three-column workspace, built from the same `@theme` tokens, the same `STATUS_DOT` colors, and a real `HIGHLIGHT_COLORS` pastel. It depicts the shipped layout rather than an invented one, and cannot drift silently because it reuses the product's own tokens.
- **Below-the-fold sections cover only what ships.** The metrics, read-aloud, and podcast sections are omitted: `reading_progress` and `passage_hits` do not exist (Phase 6), there is no Web Speech transport (Phase 5), and n8n W2 does not exist (Phase 10). Advertising them would be a claim the product cannot honor. The page states this explicitly ("No feature listed here is on a roadmap") and lists cited answers, folder-scoped retrieval, Read/Original views, highlights and annotations, flashcards, and the five ingest types.
- **Signed-in visitors are redirected off `/`** to `/dashboard` in `src/lib/supabase/proxy.ts`, which now carries a `PUBLIC_PATHS` allowlist. Without the allowlist the landing page bounced to sign-in.
- **No OG image** is generated, since there is still no real product screenshot to use.

### Home (`/home`)

Two states, because a stats screen for a brand-new account is a wall of zeros:

- **First run** (no folders, no documents): no metrics rendered at all. One card — "Create your first folder" — that goes straight to the workspace. Zeros advertise an unused product; do not show them.
- **Populated**: the three coverage metrics, recent folders, continue-reading row, podcast shelf.

Home is a *return* surface. It must never be the first thing a new user sees.

**Implemented in Phase 7 as a combined `/dashboard`, not a separate `/home`.** Both states are kept as specified: `first-run.tsx` renders one card with a single primary CTA and no numbers anywhere, then routes straight into the new folder's workspace; `stats-strip.tsx` and `folder-grid.tsx` render the populated state on the same route, with `sources-manager.tsx` below as the all-sources section. No `/library` route was created.

Only metrics that trace to a real row today are shown: folders, sources (with the ready/processing split), passages indexed (`sum(chunk_count)`), notes (`highlights` count), and cards mastered (`flashcards.mastered ÷ total`). The three coverage metrics, the continue-reading row, and the podcast shelf wait on Phases 6 and 10. Mastery renders "No deck yet" rather than 0% when no deck exists, as specified. Folder cards are open-and-delete only; rename and per-card category assignment are deferred. Aggregation lives in `src/lib/dashboard-stats.ts` as a pure function, so the arithmetic is verifiable apart from the fetch.

### Library (`/library`)

What `sources-manager.tsx` does today: upload (drag-drop, PDF/TXT/MD), add URL or YouTube, folder and category CRUD, status pills, delete. Add search and multi-select so several sources can be moved or filed at once.

### Workspace (`/w/[folderId]`)

Three columns, both rails collapsible:

| Column | Contents | Default |
|---|---|---|
| Left rail | sources in this folder, status, select/deselect for retrieval scope | open, auto-collapses after source selection |
| Center | reader: `Read` (segmented text) and `Original` (PDF.js) tabs, highlight/annotation layer, read-aloud transport | always visible |
| Right rail | AI assistant, scoped to selected sources; podcast controls | open |

Progressive disclosure matters here: the left rail is used once per session and then gets out of the way.

Center column gets a user-adjustable measure, defaulting to ~65–75 characters. The current `max-w-3xl` (768px at 16.5px) is roughly 90ch — too wide for sustained reading and a source of line-tracking errors.

**Ingestion latency is a first-class state.** Uploads go to Storage, then n8n W1 parses, chunks, and embeds asynchronously; documents sit at `pending`. A user who drops a PDF wants to read immediately. The workspace must render `pending` / `ready` / `failed` distinctly, and where `documents.content` arrives before chunks are searchable, allow reading while showing "AI answers are not available for this source yet." Never present a processing delay as a broken product.

**Mobile** is not a squeezed three-column layout. Stacked tabs for sources / read / ask, with the AI assistant as a bottom sheet and the read-aloud transport pinned in the thumb zone.

**Implemented in Phase 3**, with these deviations from the plan above:

- **Retrieval scope is an explicit document set, not a folder id.** The left rail's checkboxes produce a `document_ids` array sent to `/api/chat`, which takes precedence over `folder_id`. This makes the scope visible to the user ("Searching 3 sources") and is what allows unfiled documents to be scoped correctly — `folder_id = null` means *unscoped* at the API level, so an unfiled workspace could not have expressed "only unfiled documents" through a folder id.
- **Unfiled documents get a real workspace at `/w/unfiled`**, resolved server-side to `folder_id is null`. Without this, documents outside any folder had no folder-scoped surface at all.
- **Rail collapse state is component state, not persisted.** Persistence needs the `preferences` table; same deferral as the adjustable measure. The rails do not yet auto-collapse after source selection.
- **Mobile uses a bottom tab bar switching one pane at a time**, not a bottom sheet over the reader. The sheet is worth revisiting once read-aloud adds a transport that must stay reachable while reading.
- **Live ingestion status** arrives through a Realtime subscription on `documents`; when the open document's status changes, its content is quietly refetched so a pending source becomes readable without a reload.
- **Sources can be added from inside the workspace.** `add-sources-popover.tsx` hangs off the left rail header and files uploads and links straight into the open folder (`null` at `/w/unfiled`). It needs no refresh wiring: the existing Realtime subscription on `documents` already refetches the rail, so a new source appears and flips `pending → ready` on its own. Upload logic is shared with the library through `src/lib/uploads.ts` rather than duplicated. The popover has no category picker — categories stay a library concern.

Route migration is **partially complete**. `/dashboard` stays as the combined dashboard rather than being renamed to `/library`; `/home` and `/podcasts` do not exist. `/dashboard/chat`, `/dashboard/documents/[id]`, `reader.tsx`, and `sidebar.tsx` are **deleted** — chat now lives only in the workspace right rail, reading only in `/w/[folderId]`, and navigation only in the top bar, so deleting the global chat route is a real capability removal, not a rename. Top-bar nav is Dashboard and Flashcards; `/w/unfiled` is reached from the dashboard folder grid rather than from persistent chrome. `/dashboard/flashcards` is retained: it is document-scoped and has no workspace equivalent yet. The filtered library view (`/dashboard?folder=`) still works but is linked from nowhere.

## The reader's text layer (foundational)

`src/components/reader.tsx` — since deleted, its role filled by `src/components/reading-pane.tsx` — rendered the entire document as one element:

```tsx
<p className="whitespace-pre-wrap text-[16.5px] leading-8 text-ink">{content}</p>
```

That single monolith blocks every approved feature. There are no anchor points for highlights, nothing to highlight during read-aloud, no way to compute honest read coverage beyond scroll depth, and no virtualization — so a large book costs a full re-layout of a million-character string on every reflow.

**Implemented in Phase 2.** `src/lib/text-blocks.ts` segments `documents.content` into `TextBlock`s of `{ index, text, start, end }`, splitting on blank lines and then snapping to sentence boundaries at a 1200-char ceiling — the same snapping rule the extractor uses for chunks. `start` and `end` are offsets into `documents.content`, which is immutable after ingestion, so block indices and offsets are permanent anchors for highlights, read-aloud, and progress.

Line handling is type-aware but **non-destructive**. PDF extraction hard-wraps at page margins, so for `type = 'pdf'` blocks render with `whitespace-normal` and the browser collapses those newlines into flowing prose; `txt` and `md` render with `whitespace-pre-line` and keep their breaks. Block text is never rewritten — `block.text === content.slice(block.start, block.end)` exactly, and blocks are trimmed so the offsets bound the text tightly.

That invariant is load-bearing and was nearly lost: the first implementation collapsed newlines into spaces *inside the segmenter*, which made DOM character offsets diverge from `documents.content` offsets and would have silently corrupted every highlight anchor. The `reflow` flag now controls only where long blocks split and which CSS class renders them. It is observable solely when a document has no sentence terminators — with `. ` present, the 1200-char ceiling decides the split either way.

Rendering uses native `content-visibility: auto` with `contain-intrinsic-size` (the `reading-block` utility in `globals.css`) rather than a JS windowing library: off-screen blocks skip layout and paint, the browser handles variable heights, and no dependency is added. The measure is `66ch`, replacing `max-w-3xl` which rendered roughly 90 characters per line.

User-adjustable measure is deferred to Phase 9 — it needs the `preferences` table to persist, and a control that resets on reload is worse than no control at all.

## PDF.js

`pdfjs-dist` used directly rather than through a wrapper — a custom highlight overlay and text-layer selection need control that abstraction hides.

Constraints to design around, not discover later:

- **Dynamic import on the reader route only.** The worker is ~1 MB; it must never land in the shared bundle.
- **Self-host the worker** in `public/` and point `GlobalWorkerOptions.workerSrc` at it. The bundler-default resolution path breaks under Next.
- **CORS on signed Storage URLs.** PDF.js issues its own range requests. Supabase Storage must allow them from the app origin — verify before building the viewer, not after.
- **The text layer is absolutely-positioned spans over a canvas.** Selection across those spans does not map cleanly to a linear offset in `documents.content`.

That last point drives the anchoring model below.

## Notes: highlights and annotations

Scope is highlights plus annotations attached to them. Freeform unanchored notes are out of v1.

Because the reader has two surfaces that do not share a coordinate space, highlights use **dual anchoring**:

| Anchor kind | Stored | Used to re-render in |
|---|---|---|
| `text` | `start_offset`, `end_offset` into `documents.content` | Read view |
| `pdf` | `page_number` + rects normalized as fractions of page width/height | Original view |

Normalized rects survive zoom and resize. `page_number` is already produced by the extraction container and carried in `chunks.meta`.

**The `text` snapshot column is the portable payload.** PyMuPDF extraction and the PDF.js text layer produce different whitespace, hyphenation, and reading order, so a PDF-view highlight cannot be reliably mapped back to a `documents.content` offset. Rather than attempt a lossy mapping, every highlight stores its own extracted text, and anything downstream — "ask about my highlights", flashcards from annotations, search within notes — consumes the snapshot, never the offsets. Offsets and rects exist only to repaint the highlight where it was made.

Consequence to accept explicitly: **a highlight made in the Original view does not appear in the Read view, and vice versa.** This is a real limitation, not a bug. Surface it in the UI rather than letting users discover it.

Annotation is a nullable body on the highlight (1:1). Color comes from a fixed six-swatch pastel palette tuned for text backgrounds (`HIGHLIGHT_COLORS` in `reading-pane.tsx`) rather than the saturated category palette — the pastels stay legible under `--color-ink` at full opacity, which the category colors do not.

**Implemented in Phase 4, text view only.** Migration `0005_highlights.sql` creates the table with both anchor shapes. `src/lib/highlight-ranges.ts` intersects highlights with a block and emits renderable segments, so a selection spanning several paragraphs stores as one row and repaints correctly in each. Selection offsets are computed with a `Range` from the block start to the selection point, which stays correct once blocks contain nested `<mark>` elements. Creation is optimistic and rolls back with a toast on failure. The right rail gained an Assistant / Notes tab pair; clicking a note scrolls to its block and flashes it.

**PDF-view anchoring is not built.** `pdfjs-dist` is not installed, so `anchor_kind`, `page_number`, and `rects` exist in the schema but are unused — every row is `'text'`. The Original tab is still the read-only `<iframe>`, which cannot be annotated. Phase 4 is therefore half done against its own "done when" criterion of *a highlight made in either view*.

Overlapping highlights render the newest on top, and the older one loses its click target within the overlapped span. Acceptable for v1; a real fix needs per-highlight range rendering rather than segment merging.

The differentiating move once this exists: **notes become RAG inputs.** "Ask about my highlights" and "generate flashcards from my annotations" reuse retrieval and flashcard machinery that already works, and are what separate this from a plain PDF reader.

## Coverage metrics

Three metrics, separately labeled. Never fused into one ring chart — they measure different things and a blended number is uninterpretable.

### Read

Visited blocks ÷ total blocks in the Read view. Tracked with `IntersectionObserver` plus a minimum dwell threshold per block; ranges stored, not a single high-water mark. Furthest-scroll is rejected: it is gameable and cannot distinguish skimming from reading.

In the Original view, progress is page-based (highest page viewed with dwell ÷ page count). The two units are not perfectly comparable, so the stored value is normalized 0–1 and combined with `max()`. Label the metric **Read**, not "% complete" — it measures exposure, and the naming should not overclaim.

### Asked

Recorded per retrieval as `passage_hits` rows.

**Presented as a count and a heatmap, never as a percentage.** With `TOP_K=6` / `MAX_CHUNKS=5` against a ~1,500-chunk book, reaching even 20% would require 60+ non-overlapping queries. Real users land at 1–4% permanently, and a ring that never moves reads as failure rather than progress.

So: "142 passages consulted" (monotonic, always rewarding) plus a heatmap across the book's spine showing which regions have been interrogated. The heatmap is the more valuable half — it tells the user something actionable, e.g. that chapters 6–9 have never been asked about.

### Mastered

`flashcards.mastered` ÷ total, rolled up per document → folder → global.

The denominator is unstable: decks exist only where the user generated them. A document with zero cards has undefined mastery, not 0%. Render "No deck yet — generate one" instead of an empty ring.

## Read-aloud

Web Speech API (`speechSynthesis`). Free, client-side, no network, no per-character cost — which is the whole reason it is the right choice for reading your own documents while hosted TTS stays reserved for produced podcast artifacts.

Browser reality to design around:

- **Voices load asynchronously.** Populate the voice picker on `voiceschanged`, not on mount.
- **`onboundary` is unreliable.** Unsupported in Firefox, inconsistent in Chrome. **Sentence-level highlighting is the guaranteed granularity**; word-level highlighting is progressive enhancement only, never a dependency.
- **Chrome stalls on long utterances** (~15s). Split text into sentence-sized utterance chunks and apply the resume-interval workaround.
- Rate, pitch, and voice are user settings, persisted, with sane defaults.

Read-aloud is driven from the segmented `documents.content` blocks and is therefore a **Read-view feature**. In the Original view the transport is disabled with an explanation rather than silently doing nothing. PDF page auto-advance during playback is a stretch goal, not v1 — do not promise it.

The feature must itself be accessible: `aria-live` announcements for play/pause/position, keyboard-reachable transport, no focus trapping, and `prefers-reduced-motion` respected for the highlight transition.

Terminology: the control is labeled **Read aloud** or **Listen**, never "Screen reader." That term already means assistive technology (NVDA, JAWS, VoiceOver), and mislabeling it confuses precisely the users who depend on real screen readers.

## Podcast

The existing `podcasts` table already carries `style` and `length`, so user-selectable format needs no new columns — only a `folder_id` for folder-scoped generation, since `document_id` alone cannot express "make an episode from these sources."

**Settings holds the defaults; the Generate button offers an override popover.** Burying style only in settings forces a user who wants a one-off conversational episode to change a global preference, generate, then change it back.

**Generation requires explicit confirmation.** A long multi-voice episode costs real money and takes minutes. It must never fire on a single click. The confirmation shows style, duration, voice assignment, and an estimated time/cost range before committing.

Styles: `briefing` (single narrator), `conversational` (two voices), `deep_dive` (two voices, longer). Lengths: `short` / `standard` / `long`.

Pipeline is unchanged from `MIGRATION_PLAN.md`: client inserts a `podcasts` row → Supabase webhook → n8n W2 builds the script with Qwen → hosted TTS per speaker → audio to the `podcasts` bucket → row marked `ready` → client picks it up via Realtime, no polling. **W2 does not exist yet and is the long pole in this phase.**

TTS is a hosted provider with good stock voices; voice cloning is explicitly out of scope. Multi-voice conversational output with acceptable prosody eliminates most budget providers, so the candidate set is narrow. Current pricing and voice counts must be verified at selection time rather than assumed. Because the provider lives entirely inside n8n W2, it stays swappable — keep it there and never call TTS from Next.js.

## Data model additions

```sql
-- segmentation
alter table documents add column block_count int;

-- Read coverage
create table reading_progress (
  document_id uuid references documents(id) on delete cascade,
  user_id     uuid not null references profiles(id) on delete cascade,
  anchor_kind text not null,          -- 'text' | 'pdf'
  ranges      jsonb not null,         -- visited block indices, or page numbers
  normalized  numeric(4,3) not null default 0,
  updated_at  timestamptz not null default now(),
  primary key (document_id, user_id)
);

-- Asked coverage
create table passage_hits (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references profiles(id) on delete cascade,
  document_id uuid not null references documents(id) on delete cascade,
  chunk_id    uuid not null references chunks(id) on delete cascade,
  hit_at      timestamptz not null default now()
);

-- notes
create table highlights (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references profiles(id) on delete cascade,
  document_id  uuid not null references documents(id) on delete cascade,
  anchor_kind  text not null,         -- 'text' | 'pdf'
  start_offset int,                   -- anchor_kind = 'text'
  end_offset   int,                   -- anchor_kind = 'text'
  page_number  int,                   -- anchor_kind = 'pdf'
  rects        jsonb,                 -- anchor_kind = 'pdf', normalized 0-1
  text         text not null,         -- portable snapshot; consumed by RAG
  color        text not null default '#6366f1',
  annotation   text,                  -- 1:1 note body
  created_at   timestamptz not null default now()
);

-- scoped, threaded chat
create table conversations (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references profiles(id) on delete cascade,
  folder_id  uuid references folders(id) on delete cascade,
  title      text,
  created_at timestamptz not null default now()
);
alter table chat_messages add column conversation_id uuid references conversations(id) on delete cascade;

-- folder-scoped podcast
alter table podcasts add column folder_id uuid references folders(id) on delete set null;

-- preferences
create table preferences (
  user_id         uuid primary key references profiles(id) on delete cascade,
  read_aloud_voice text,
  read_aloud_rate  numeric(3,2) not null default 1.0,
  podcast_style    text not null default 'briefing',
  podcast_length   text not null default 'standard',
  measure_width    int not null default 70,
  rails_collapsed  jsonb not null default '{}'::jsonb
);
```

RLS `*_own` policies on every new table, matching the existing convention. Realtime publication additions for `podcasts` status already exist.

`match_chunks` gains a scope parameter:

```sql
create or replace function match_chunks(
  query_embedding vector(1024),
  match_count int default 6,
  document_ids uuid[] default null
)
```

It is `language sql stable`, not `security definer`, so RLS on `chunks` already scopes every search to `auth.uid()` — there is no cross-user exposure today. What is missing is narrowing to the open folder, which is exactly what scoped retrieval requires.

## Known defects to fix before workspace work

Both undermine the folder-scoped premise directly:

1. **Chat history never re-hydrates.** `chat-panel.tsx` holds messages in React state only, so a reload clears the visible conversation even though rows persist server-side and still feed the model. Unacceptable in a surface a user lives in for hours.
2. **Retrieval is unscoped.** `/api/chat` searches across all of a user's chunks, so opening the Biology folder and asking a question can retrieve and cite Tax Law. The workspace premise is "ask about *these* sources."

These are foundation work. Building the three-column shell on top of them means rebuilding the panel twice.

## Design system

Stays light-only, consistent with the existing `@theme` tokens in `src/app/globals.css` (pearl / surface / ink tiers / line tiers / indigo accent). Geist + Geist Mono. No dark theme is in scope.

Two debts to pay while building the workspace rather than after:

- **Radius is untoked.** `rounded-md/lg/xl/2xl` are hardcoded inconsistently across components. Add a radius scale to `@theme`.
- **There are no primitives.** Every element is inline Tailwind and there is no Button, Card, Dialog, or Input. The workspace adds a modal confirmation, a config popover, a highlight color picker, an audio player, and a settings form — building those as one-off inline Tailwind is how the codebase becomes unmaintainable. Introduce a small primitive set first.

No animation library is installed. Read-aloud highlight transitions, rail collapse, and the audio player want motion; decide once whether to add `motion` or stay CSS-only, and respect `prefers-reduced-motion` either way.

## Build order

Sequenced by dependency, not by which screen is most fun. Each phase independently verifiable, matching the convention in `MIGRATION_PLAN.md`.

1. **Fix chat foundations.** Scope `match_chunks`, thread conversations, rehydrate history. *Done when:* a folder workspace retrieves only from its own sources and survives a reload intact.
2. **Segment the text layer.** Blocks with stable indices, virtualization, adjustable measure. *Done when:* a 500-page document renders and scrolls smoothly, and every block has an addressable index.
3. **Workspace shell.** Three columns, collapsible persisted rails, `pending`/`ready`/`failed` states, mobile stacked variant. *Done when:* a folder can be opened and read with the AI panel scoped to it.
4. **Highlights + annotations.** Dual anchoring, text snapshots, color palette, notes panel. *Done when:* a highlight made in either view survives a reload and repaints correctly. — **text view complete; PDF view blocked on `pdfjs-dist`, which is not installed.**
5. **Read-aloud.** Web Speech transport, sentence highlighting, settings. *Done when:* a document can be listened to with the current sentence visibly tracked.
6. **Progress instrumentation.** `reading_progress`, `passage_hits`, mastery rollup. *Done when:* all three metrics compute from real data with no hardcoded values.
7. **Landing + first-run.** Public `/`, proxy allowlist, empty-state Home. *Done when:* an unauthenticated visitor reaches sign-up without a redirect loop, and a new account never sees a wall of zeros.
8. **Home dashboard.** Metrics, continue-reading, podcast shelf. *Done when:* every number on the screen traces to a real row.
9. **Settings.** Profile, password, read-aloud, podcast defaults, workspace prefs. *Done when:* every preference persists and is honored on next load.
10. **Podcast.** Provider selection → n8n W2 → generate popover with confirmation → player → `/podcasts` library. *Done when:* a folder generates a two-voice episode that plays from a signed URL.

Phases 1–2 are non-negotiable prerequisites for 3–5. Phase 7 is isolated and low-risk and can be pulled forward, but it must not gate the workspace. Phase 6 before phase 8 — a dashboard built ahead of its instrumentation gets filled with invented numbers.

## Risks and honest caveats

- **PDF.js is the largest single cost in this plan** and the one most likely to overrun. Custom text-layer selection, normalized-rect overlays, worker bundling under Next, and Storage CORS are each a potential day of debugging. If it slips, the fallback is highlights in the Read view only, with the Original tab reverting to a read-only iframe. That fallback is acceptable and should be treated as a live option, not a failure.
- **Highlights do not cross views.** A PDF-view highlight is invisible in the Read view. This is inherent to dual anchoring against two different text extractions and will not be fixed by effort — only communicated clearly in the UI.
- **`documents.content` does not preserve page boundaries — verified.** `extractor/main.py` builds `full_text` as `"\n\n".join(pages_text)`, and `\n\n` also occurs naturally inside page text, so page breaks cannot be recovered from stored content. Page information survives only in `chunks.meta` (`page_number`, `total_pages`, plus `start_char`/`end_char` that are relative to the individual page rather than to `full_text`). Consequence: text-view blocks carry no page number, and any block-to-page mapping must be reconstructed from `chunks.meta` or dropped. PDF-view anchoring must use PDF.js's own page indices, never anything derived from `content`.
- **`content-visibility: auto` and cross-block selection need testing before Phase 4.** Highlights will frequently span two or more blocks, and each block is a containment context. Verify that a selection dragged across blocks yields a usable range in Chrome, Edge, and Safari. If it does not, the fallback is JS windowing, which costs a dependency plus dynamic-height measurement.
- **Web Speech voice quality varies by browser and OS** and is not controllable. Edge on Windows exposes strong neural voices; other combinations are materially worse. The product cannot guarantee a consistent listening experience, and should not claim one.
- **`passage_hits` grows without bound.** Every chat turn writes ~5 rows. Needs a retention policy or periodic rollup before it becomes the largest table in the database.
- **Read coverage from `IntersectionObserver` is approximate.** Dwell thresholds are a heuristic for attention, not a measurement of comprehension. The metric is labeled "Read" for that reason; do not market it as understanding.
- **Podcast cost is unbounded per user** until a rate limit exists. A user clicking Generate repeatedly on long sources produces real spend. Add a per-user daily cap in the same phase as the feature, not after.
- **Filtered vector search can silently under-return.** `match_chunks` now takes a `document_ids` scope filter, but the HNSW index on `chunks.embedding` finds nearest neighbours globally and filters afterwards. Against a small folder, a scoped query can return fewer rows than `match_count` — or none at all — even when relevant chunks exist, presenting to the user as "the AI can't find anything in my folder." pgvector 0.8+ addresses this with iterative index scans (`hnsw.iterative_scan`); **verify the installed pgvector version on the Supabase project and enable it, or fall back to an exact scan when the scope is small.** Test scoped retrieval against a folder with only a handful of documents before trusting it.
