'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { toast } from 'sonner'
import {
  ArrowLeft,
  BookOpen,
  Library,
  MessageSquare,
  NotebookPen,
  PanelLeft,
  PanelRight,
  Sparkles,
} from 'lucide-react'
import AddSourcesPopover from '@/components/add-sources-popover'
import ChatPanel from '@/components/chat-panel'
import NotesPanel from '@/components/notes-panel'
import ReadingPane from '@/components/reading-pane'
import { createClient } from '@/lib/supabase/client'
import { loadReadableDocument } from '@/lib/documents'
import { blockForOffset } from '@/lib/highlight-ranges'
import type { HighlightRow, ReadableDocument, SourceSummary } from '@/lib/types'

type Pane = 'sources' | 'read' | 'ask'

const STATUS_DOT: Record<string, string> = {
  pending: 'bg-amber-400',
  processing: 'bg-sky-400',
  ready: 'bg-emerald-400',
  failed: 'bg-red-400',
}

const FLASH_MS = 1600

const byOffset = (a: HighlightRow, b: HighlightRow) =>
  (a.start_offset ?? 0) - (b.start_offset ?? 0)

export default function Workspace({
  userId,
  folderName,
  folderId,
  sources: initialSources,
  initialDocument,
  conversationId,
}: {
  userId: string
  folderName: string
  folderId: string | null
  sources: SourceSummary[]
  initialDocument: ReadableDocument | null
  conversationId: string | null
}) {
  const router = useRouter()
  const pathname = usePathname()
  const [sources, setSources] = useState(initialSources)
  const [activeDoc, setActiveDoc] = useState<ReadableDocument | null>(initialDocument)
  const [loadingDoc, setLoadingDoc] = useState(false)
  const [view, setView] = useState<'read' | 'original'>('read')
  const [excluded, setExcluded] = useState<Set<string>>(new Set())
  const [leftOpen, setLeftOpen] = useState(true)
  const [rightOpen, setRightOpen] = useState(true)
  const [mobilePane, setMobilePane] = useState<Pane>(initialDocument ? 'read' : 'sources')
  const [rightTab, setRightTab] = useState<'assistant' | 'notes'>('assistant')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [flashId, setFlashId] = useState<string | null>(null)
  const [highlights, setHighlights] = useState<HighlightRow[]>(
    initialDocument?.highlights ?? []
  )
  const activeDocRef = useRef<ReadableDocument | null>(initialDocument)

  const scopeIds = sources
    .filter((source) => source.status === 'ready' && !excluded.has(source.id))
    .map((source) => source.id)

  const applyDoc = useCallback((doc: ReadableDocument) => {
    activeDocRef.current = doc
    setActiveDoc(doc)
    setHighlights(doc.highlights)
    setEditingId(null)
    setFlashId(null)
  }, [])

  const loadDoc = useCallback(
    async (id: string, quiet = false) => {
      if (!quiet) setLoadingDoc(true)
      const doc = await loadReadableDocument(createClient(), id)
      if (!quiet) setLoadingDoc(false)
      if (!doc) {
        toast.error('Could not open that source')
        return
      }
      applyDoc(doc)
      if (!quiet) setView('read')
    },
    [applyDoc]
  )

  const fetchSources = useCallback(async (): Promise<SourceSummary[] | null> => {
    const supabase = createClient()
    let query = supabase
      .from('documents')
      .select('id, name, type, status, chunk_count')
      .eq('user_id', userId)
    query = folderId ? query.eq('folder_id', folderId) : query.is('folder_id', null)

    const { data, error } = await query.order('created_at', { ascending: false })
    if (error) {
      toast.error(error.message)
      return null
    }
    return (data ?? []) as SourceSummary[]
  }, [userId, folderId])

  useEffect(() => {
    const supabase = createClient()
    const channel = supabase
      .channel(`workspace-${folderId ?? 'unfiled'}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'documents',
          filter: `user_id=eq.${userId}`,
        },
        async () => {
          const next = await fetchSources()
          if (!next) return
          setSources(next)

          const current = activeDocRef.current
          if (!current) return
          const fresh = next.find((source) => source.id === current.id)
          if (fresh && fresh.status !== current.status) void loadDoc(current.id, true)
        }
      )
      .subscribe()
    return () => {
      supabase.removeChannel(channel)
    }
  }, [userId, folderId, fetchSources, loadDoc])

  function openDocument(id: string) {
    setMobilePane('read')
    if (activeDoc?.id === id) return
    router.replace(`${pathname}?doc=${id}`)
    void loadDoc(id)
  }

  function toggleScope(id: string) {
    setExcluded((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  async function createHighlight(start: number, end: number, text: string, color: string) {
    const doc = activeDocRef.current
    if (!doc) return

    const pendingId = `pending-${crypto.randomUUID()}`
    setHighlights((prev) =>
      [
        ...prev,
        {
          id: pendingId,
          document_id: doc.id,
          anchor_kind: 'text',
          start_offset: start,
          end_offset: end,
          page_number: null,
          rects: null,
          text,
          color,
          annotation: null,
          created_at: new Date().toISOString(),
        },
      ].sort(byOffset)
    )

    const { data, error } = await createClient()
      .from('highlights')
      .insert({
        user_id: userId,
        document_id: doc.id,
        anchor_kind: 'text',
        start_offset: start,
        end_offset: end,
        text,
        color,
      })
      .select('*')
      .single()

    if (error || !data) {
      toast.error(error?.message ?? 'Could not save that highlight')
      setHighlights((prev) => prev.filter((highlight) => highlight.id !== pendingId))
      return
    }
    setHighlights((prev) =>
      prev.map((highlight) => (highlight.id === pendingId ? (data as HighlightRow) : highlight))
    )
  }

  async function saveAnnotation(id: string, annotation: string) {
    setHighlights((prev) =>
      prev.map((highlight) =>
        highlight.id === id ? { ...highlight, annotation: annotation || null } : highlight
      )
    )
    setEditingId(null)

    const { error } = await createClient()
      .from('highlights')
      .update({ annotation: annotation || null })
      .eq('id', id)
    if (error) toast.error(error.message)
  }

  async function deleteHighlight(id: string) {
    const previous = highlights
    setHighlights((prev) => prev.filter((highlight) => highlight.id !== id))
    setEditingId(null)

    const { error } = await createClient().from('highlights').delete().eq('id', id)
    if (error) {
      toast.error(error.message)
      setHighlights(previous)
      return
    }
    toast.success('Highlight removed')
  }

  function openHighlight(id: string) {
    setRightTab('notes')
    setRightOpen(true)
    setMobilePane('ask')
    setEditingId(id)
  }

  function jumpToHighlight(highlight: HighlightRow) {
    const doc = activeDocRef.current
    if (!doc || highlight.start_offset === null) return

    const block = blockForOffset(doc.blocks, highlight.start_offset)
    if (!block) return

    setMobilePane('read')
    document
      .querySelector(`[data-block="${block.index}"]`)
      ?.scrollIntoView({ block: 'center', behavior: 'smooth' })
    setFlashId(highlight.id)
    window.setTimeout(() => setFlashId(null), FLASH_MS)
  }

  const gridClass =
    leftOpen && rightOpen
      ? 'lg:grid-cols-[16rem_minmax(0,1fr)_22rem]'
      : leftOpen
        ? 'lg:grid-cols-[16rem_minmax(0,1fr)]'
        : rightOpen
          ? 'lg:grid-cols-[minmax(0,1fr)_22rem]'
          : 'lg:grid-cols-[minmax(0,1fr)]'

  const paneClass = (pane: Pane, desktopOpen: boolean) =>
    `min-h-0 flex-col ${mobilePane === pane ? 'flex' : 'hidden'} ${
      desktopOpen ? 'lg:flex' : 'lg:hidden'
    }`

  const tabClasses = (active: boolean) =>
    `rounded-md px-3 py-1.5 text-sm font-medium transition ${
      active ? 'bg-surface text-ink shadow-card' : 'text-ink-2 hover:text-ink'
    }`

  const railTabClasses = (active: boolean) =>
    `flex-1 rounded-md px-2 py-1.5 text-xs font-medium transition ${
      active ? 'bg-surface text-ink shadow-card' : 'text-ink-2 hover:text-ink'
    }`

  const railToggle = (open: boolean, onClick: () => void, label: string, Icon: typeof PanelLeft) => (
    <button
      onClick={onClick}
      title={label}
      aria-label={label}
      aria-pressed={open}
      className="hidden rounded-lg p-1.5 text-ink-3 transition hover:bg-pearl hover:text-ink lg:block"
    >
      <Icon className="h-4 w-4" />
    </button>
  )

  return (
    <div className="flex h-dvh flex-col">
      <header className="flex shrink-0 items-center justify-between gap-3 border-b border-line bg-surface px-4 py-2.5">
        <div className="flex min-w-0 items-center gap-3">
          <Link
            href="/dashboard"
            className="flex shrink-0 items-center gap-1 text-xs text-ink-3 transition hover:text-accent"
          >
            <ArrowLeft className="h-3 w-3" />
            <span className="hidden sm:inline">Dashboard</span>
          </Link>
          <div className="min-w-0 border-l border-line pl-3">
            <h2 className="truncate text-sm font-semibold tracking-tight">{folderName}</h2>
            <p className="truncate text-xs text-ink-3">
              {activeDoc ? activeDoc.name : `${sources.length} sources`}
            </p>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          {activeDoc?.pdfUrl && (
            <div className="hidden rounded-lg border border-line bg-pearl p-0.5 sm:flex">
              <button onClick={() => setView('read')} className={tabClasses(view === 'read')}>
                Read
              </button>
              <button
                onClick={() => setView('original')}
                className={tabClasses(view === 'original')}
              >
                Original
              </button>
            </div>
          )}
          {railToggle(leftOpen, () => setLeftOpen((v) => !v), 'Toggle sources', PanelLeft)}
          {railToggle(rightOpen, () => setRightOpen((v) => !v), 'Toggle assistant', PanelRight)}
        </div>
      </header>

      <div className={`grid min-h-0 flex-1 grid-cols-1 ${gridClass}`}>
        <aside
          className={`${paneClass('sources', leftOpen)} border-r border-line bg-surface`}
          aria-label="Sources in this folder"
        >
          <div className="flex items-center justify-between gap-2 border-b border-line px-4 py-2.5">
            <h3 className="text-sm font-semibold tracking-tight">Sources</h3>
            <div className="flex items-center gap-2">
              <span className="text-xs text-ink-3">
                {scopeIds.length}/{sources.filter((s) => s.status === 'ready').length} in scope
              </span>
              <AddSourcesPopover userId={userId} folderId={folderId} />
            </div>
          </div>

          {sources.length === 0 ? (
            <div className="px-4 py-8 text-center">
              <p className="text-sm text-ink-3">No sources in this folder yet.</p>
              <p className="mt-1.5 text-xs leading-relaxed text-ink-3">
                Use Add above to upload files or paste a link.
              </p>
            </div>
          ) : (
            <ul className="min-h-0 flex-1 divide-y divide-line overflow-y-auto">
              {sources.map((source) => (
                <li key={source.id} className="flex items-center gap-2 px-3 py-2">
                  <input
                    type="checkbox"
                    checked={scopeIds.includes(source.id)}
                    disabled={source.status !== 'ready'}
                    onChange={() => toggleScope(source.id)}
                    aria-label={`Include ${source.name} in AI scope`}
                    className="h-3.5 w-3.5 shrink-0 accent-accent disabled:opacity-30"
                  />
                  <button
                    onClick={() => openDocument(source.id)}
                    className={`flex min-w-0 flex-1 items-center gap-2 text-left text-sm transition ${
                      activeDoc?.id === source.id
                        ? 'font-medium text-accent-deep'
                        : 'text-ink-2 hover:text-ink'
                    }`}
                  >
                    <span
                      className={`h-1.5 w-1.5 shrink-0 rounded-full ${
                        STATUS_DOT[source.status] ?? 'bg-line-2'
                      } ${source.status === 'processing' ? 'animate-pulse' : ''}`}
                      title={source.status}
                    />
                    <span className="truncate">{source.name}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </aside>

        <main className={`${paneClass('read', true)} min-w-0 overflow-hidden bg-pearl`}>
          {loadingDoc ? (
            <div className="mx-auto max-w-[66ch] space-y-4 px-6 py-10">
              {[0, 1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="h-4 animate-pulse rounded bg-line"
                  style={{ width: `${92 - i * 7}%` }}
                />
              ))}
            </div>
          ) : activeDoc ? (
            <div className="min-h-0 flex-1 overflow-y-auto">
              <ReadingPane
                view={view}
                name={activeDoc.name}
                status={activeDoc.status}
                blocks={activeDoc.blocks}
                pdfUrl={activeDoc.pdfUrl}
                chunkCount={activeDoc.chunk_count}
                reflow={activeDoc.type === 'pdf'}
                highlights={highlights}
                flashId={flashId}
                onCreateHighlight={createHighlight}
                onOpenHighlight={openHighlight}
              />
            </div>
          ) : (
            <div className="flex min-h-0 flex-1 items-center justify-center p-6">
              <div className="max-w-sm text-center">
                <span className="mx-auto flex h-10 w-10 items-center justify-center rounded-xl border border-line bg-surface text-accent shadow-card">
                  <Library className="h-4 w-4" />
                </span>
                <p className="mt-3 text-sm font-medium text-ink">Pick a source to read</p>
                <p className="mt-1.5 text-sm leading-relaxed text-ink-2">
                  Choose a document from the list and it opens here, with the assistant scoped to
                  whatever you have selected.
                </p>
              </div>
            </div>
          )}
        </main>

        <aside
          className={`${paneClass('ask', rightOpen)} border-l border-line bg-surface`}
          aria-label="AI assistant"
        >
          <div className="border-b border-line px-3 py-2">
            <div className="flex rounded-lg border border-line bg-pearl p-0.5">
              <button
                onClick={() => setRightTab('assistant')}
                className={railTabClasses(rightTab === 'assistant')}
              >
                <Sparkles className="mr-1 inline h-3 w-3" />
                Assistant
              </button>
              <button
                onClick={() => setRightTab('notes')}
                className={railTabClasses(rightTab === 'notes')}
              >
                <NotebookPen className="mr-1 inline h-3 w-3" />
                Notes
                {highlights.length > 0 ? ` · ${highlights.length}` : ''}
              </button>
            </div>
            {rightTab === 'assistant' && (
              <p className="mt-2 px-1 text-xs text-ink-3">
                {scopeIds.length === 0
                  ? 'No sources in scope'
                  : `Searching ${scopeIds.length} ${scopeIds.length === 1 ? 'source' : 'sources'}`}
              </p>
            )}
          </div>

          <div className={rightTab === 'assistant' ? 'flex min-h-0 flex-1 flex-col' : 'hidden'}>
            <ChatPanel
              key={`${folderId ?? 'unfiled'}:${conversationId ?? 'new'}`}
              className="min-h-0 flex-1"
              hasSources={scopeIds.length > 0}
              folderId={folderId}
              conversationId={conversationId}
              documentIds={scopeIds}
            />
          </div>

          <div className={rightTab === 'notes' ? 'flex min-h-0 flex-1 flex-col' : 'hidden'}>
            <NotesPanel
              className="min-h-0 flex-1"
              highlights={highlights}
              editingId={editingId}
              onEdit={setEditingId}
              onSaveAnnotation={saveAnnotation}
              onDelete={deleteHighlight}
              onJump={jumpToHighlight}
            />
          </div>
        </aside>
      </div>

      <nav
        className="flex shrink-0 border-t border-line bg-surface lg:hidden"
        aria-label="Workspace sections"
      >
        {(
          [
            { id: 'sources', label: 'Sources', Icon: Library },
            { id: 'read', label: 'Read', Icon: BookOpen },
            { id: 'ask', label: 'Ask', Icon: MessageSquare },
          ] as const
        ).map(({ id, label, Icon }) => (
          <button
            key={id}
            onClick={() => setMobilePane(id)}
            className={`flex min-h-11 flex-1 flex-col items-center justify-center gap-0.5 py-2 text-xs font-medium transition ${
              mobilePane === id ? 'text-accent-deep' : 'text-ink-3'
            }`}
          >
            <Icon className="h-4 w-4" />
            {label}
          </button>
        ))}
      </nav>
    </div>
  )
}
