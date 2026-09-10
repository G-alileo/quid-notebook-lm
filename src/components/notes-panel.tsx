'use client'

import { useState } from 'react'
import { NotebookPen, Trash2 } from 'lucide-react'
import type { HighlightRow } from '@/lib/types'

function AnnotationEditor({
  highlight,
  onSave,
  onDelete,
  onDone,
}: {
  highlight: HighlightRow
  onSave: (id: string, annotation: string) => void
  onDelete: (id: string) => void
  onDone: () => void
}) {
  const [draft, setDraft] = useState(highlight.annotation ?? '')

  return (
    <div className="mt-2 space-y-2">
      <label className="sr-only" htmlFor={`note-${highlight.id}`}>
        Note on this highlight
      </label>
      <textarea
        id={`note-${highlight.id}`}
        autoFocus
        rows={3}
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        placeholder="Add a note…"
        className="w-full rounded-lg border border-line bg-pearl px-3 py-2 text-sm leading-relaxed outline-none transition placeholder:text-ink-3 focus:border-accent"
      />
      <div className="flex items-center gap-2">
        <button
          onClick={() => onSave(highlight.id, draft.trim())}
          className="rounded-lg bg-accent px-3 py-1.5 text-xs font-medium text-pearl transition hover:bg-accent-deep"
        >
          Save note
        </button>
        <button
          onClick={onDone}
          className="rounded-lg border border-line px-3 py-1.5 text-xs font-medium text-ink-2 transition hover:border-line-2 hover:text-ink"
        >
          Cancel
        </button>
        <button
          onClick={() => onDelete(highlight.id)}
          className="ml-auto rounded-lg p-1.5 text-ink-3 transition hover:bg-red-50 hover:text-red-500"
          title="Delete highlight"
          aria-label="Delete highlight"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>
    </div>
  )
}

export default function NotesPanel({
  highlights,
  editingId,
  onEdit,
  onSaveAnnotation,
  onDelete,
  onJump,
  className = '',
}: {
  highlights: HighlightRow[]
  editingId: string | null
  onEdit: (id: string | null) => void
  onSaveAnnotation: (id: string, annotation: string) => void
  onDelete: (id: string) => void
  onJump: (highlight: HighlightRow) => void
  className?: string
}) {
  return (
    <div className={`flex min-h-0 flex-col ${className}`}>
      {highlights.length === 0 ? (
        <div className="mx-auto max-w-xs px-6 pt-10 text-center">
          <span className="mx-auto flex h-10 w-10 items-center justify-center rounded-xl border border-line bg-pearl text-accent">
            <NotebookPen className="h-4 w-4" />
          </span>
          <p className="mt-3 text-sm font-medium text-ink">No highlights yet</p>
          <p className="mt-1.5 text-sm leading-relaxed text-ink-3">
            Select any passage while reading to highlight it, then attach a note.
          </p>
        </div>
      ) : (
        <ul className="min-h-0 flex-1 divide-y divide-line overflow-y-auto">
          {highlights.map((highlight) => (
            <li key={highlight.id} className="px-4 py-3">
              <button
                onClick={() => onJump(highlight)}
                className="block w-full border-l-2 pl-3 text-left text-sm leading-relaxed text-ink-2 transition hover:text-ink"
                style={{ borderColor: highlight.color }}
                title="Jump to this passage"
              >
                {highlight.text}
              </button>

              {highlight.annotation && editingId !== highlight.id && (
                <p className="mt-1.5 pl-3 text-xs leading-relaxed text-ink-3">
                  {highlight.annotation}
                </p>
              )}

              {editingId === highlight.id ? (
                <AnnotationEditor
                  key={highlight.id}
                  highlight={highlight}
                  onSave={onSaveAnnotation}
                  onDelete={onDelete}
                  onDone={() => onEdit(null)}
                />
              ) : (
                <button
                  onClick={() => onEdit(highlight.id)}
                  className="mt-1.5 pl-3 text-xs font-medium text-accent transition hover:text-accent-deep"
                >
                  {highlight.annotation ? 'Edit note' : 'Add note'}
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
