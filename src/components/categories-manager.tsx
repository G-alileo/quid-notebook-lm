'use client'

import { useCallback, useRef, useState } from 'react'
import { Tag, X } from 'lucide-react'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import { useDismissable } from '@/lib/use-dismissable'
import type { CategoryRow } from '@/lib/types'

const PALETTE = ['#6366f1', '#22c55e', '#f59e0b', '#ef4444', '#06b6d4', '#a855f7']

export default function CategoriesManager({
  userId,
  categories,
  onChanged,
}: {
  userId: string
  categories: CategoryRow[]
  onChanged: () => void
}) {
  const wrapperRef = useRef<HTMLDivElement>(null)
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [color, setColor] = useState(PALETTE[0])
  const [busy, setBusy] = useState(false)

  const dismiss = useCallback(() => setOpen(false), [])
  useDismissable(wrapperRef, open, dismiss)

  async function handleCreate() {
    const trimmed = name.trim()
    if (!trimmed || busy) return

    setBusy(true)
    const { data, error } = await createClient()
      .from('categories')
      .insert({ user_id: userId, name: trimmed, color })
      .select('id, name, color')
      .single()
    setBusy(false)

    if (error || !data) {
      toast.error(error?.message ?? 'Could not create that category')
      return
    }

    setName('')
    toast.success(`Category "${trimmed}" created`)
    onChanged()
  }

  async function handleDelete(category: CategoryRow) {
    const { error } = await createClient().from('categories').delete().eq('id', category.id)
    if (error) {
      toast.error(error.message)
      return
    }

    toast.success(`Category "${category.name}" removed`)
    onChanged()
  }

  return (
    <div ref={wrapperRef} className="relative">
      <button
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        className="flex items-center gap-1 rounded-lg border border-line px-2.5 py-1.5 text-xs font-medium text-ink-2 transition hover:border-line-2 hover:bg-pearl hover:text-ink"
      >
        <Tag className="h-3.5 w-3.5" />
        Manage
      </button>

      {open && (
        <div className="absolute right-0 top-full z-30 mt-2 w-[19rem] max-w-[calc(100vw-2rem)] rounded-2xl border border-line bg-surface p-3 shadow-pop">
          <p className="text-xs font-medium text-ink-2">Categories</p>

          {categories.length === 0 ? (
            <p className="mt-2 text-xs text-ink-3">No categories yet.</p>
          ) : (
            <ul className="mt-2 max-h-40 space-y-0.5 overflow-y-auto">
              {categories.map((category) => (
                <li key={category.id} className="group flex items-center gap-2 rounded-lg px-1.5 py-1">
                  <span
                    className="h-2.5 w-2.5 shrink-0 rounded-full"
                    style={{ backgroundColor: category.color }}
                  />
                  <span className="min-w-0 flex-1 truncate text-xs text-ink-2">{category.name}</span>
                  <button
                    onClick={() => handleDelete(category)}
                    aria-label={`Delete ${category.name}`}
                    title={`Delete ${category.name}`}
                    className="rounded p-0.5 text-ink-3 transition hover:text-red-500"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </li>
              ))}
            </ul>
          )}

          <div className="mt-3 border-t border-line pt-3">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') void handleCreate()
              }}
              placeholder="New category name"
              aria-label="New category name"
              className="w-full rounded-lg border border-line bg-pearl px-2.5 py-1.5 text-xs outline-none transition placeholder:text-ink-3 focus:border-accent"
            />
            <div className="mt-2 flex items-center justify-between gap-2">
              <div className="flex gap-1.5">
                {PALETTE.map((swatch) => (
                  <button
                    key={swatch}
                    onClick={() => setColor(swatch)}
                    aria-label={`Use colour ${swatch}`}
                    title={swatch}
                    className={`h-4 w-4 rounded-full transition ${
                      color === swatch ? 'ring-2 ring-ink/50 ring-offset-1 ring-offset-surface' : ''
                    }`}
                    style={{ backgroundColor: swatch }}
                  />
                ))}
              </div>
              <button
                onClick={handleCreate}
                disabled={!name.trim() || busy}
                className="rounded-lg bg-accent px-3 py-1.5 text-xs font-medium text-pearl transition hover:bg-accent-deep disabled:cursor-not-allowed disabled:opacity-50"
              >
                {busy ? 'Adding…' : 'Add'}
              </button>
            </div>
          </div>

          <p className="mt-2.5 text-[11px] leading-relaxed text-ink-3">
            Deleting a category unfiles its sources; the sources themselves are kept.
          </p>
        </div>
      )}
    </div>
  )
}
