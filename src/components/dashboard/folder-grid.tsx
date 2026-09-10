'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Folder, FolderPlus, Inbox, X } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { createFolder, removeFolder } from '@/lib/folders'
import type { FolderCard, FolderRow, FolderStat } from '@/lib/types'

function statLine(stat: FolderStat) {
  const parts = [`${stat.total} ${stat.total === 1 ? 'source' : 'sources'}`]
  if (stat.processing > 0) parts.push(`${stat.processing} processing`)
  return parts.join(' · ')
}

function DeleteButton({ folder, onDeleted }: { folder: FolderRow; onDeleted: () => void }) {
  async function handleDelete() {
    if (await removeFolder(createClient(), folder)) onDeleted()
  }

  return (
    <button
      onClick={handleDelete}
      aria-label={`Delete ${folder.name}`}
      title={`Delete ${folder.name}`}
      className="absolute right-2 top-2 hidden rounded-lg p-1.5 text-ink-3 transition hover:bg-red-50 hover:text-red-500 group-hover:block"
    >
      <X className="h-3.5 w-3.5" />
    </button>
  )
}

export default function FolderGrid({
  userId,
  folders: initialFolders,
  unfiled,
}: {
  userId: string
  folders: FolderCard[]
  unfiled: FolderStat
}) {
  const router = useRouter()
  const [folders, setFolders] = useState(initialFolders)
  const [adding, setAdding] = useState(false)
  const [name, setName] = useState('')
  const [saving, setSaving] = useState(false)

  async function handleCreate() {
    const trimmed = name.trim()
    if (!trimmed || saving) return

    setSaving(true)
    const created = await createFolder(createClient(), userId, trimmed)
    setSaving(false)
    if (!created) return

    router.push(`/w/${created.id}`)
  }

  const cardClasses =
    'group relative rounded-2xl border border-line bg-surface shadow-card transition hover:border-line-2'

  return (
    <section>
      <h2 className="text-sm font-semibold tracking-tight">Folders</h2>
      <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {folders.map((folder) => (
          <div key={folder.id} className={cardClasses}>
            <Link href={`/w/${folder.id}`} className="block p-4">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl border border-line bg-pearl text-accent">
                <Folder className="h-4 w-4" />
              </span>
              <p className="mt-3 truncate text-sm font-medium tracking-tight">{folder.name}</p>
              <p className="mt-0.5 truncate text-xs text-ink-3">{statLine(folder)}</p>
            </Link>
            <DeleteButton
              folder={folder}
              onDeleted={() => setFolders((prev) => prev.filter((f) => f.id !== folder.id))}
            />
          </div>
        ))}

        <div className={cardClasses}>
          <Link href="/w/unfiled" className="block p-4">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl border border-line bg-pearl text-ink-3">
              <Inbox className="h-4 w-4" />
            </span>
            <p className="mt-3 truncate text-sm font-medium tracking-tight">Unfiled</p>
            <p className="mt-0.5 truncate text-xs text-ink-3">{statLine(unfiled)}</p>
          </Link>
        </div>

        <div className="rounded-2xl border border-dashed border-line-2 bg-surface/60 p-4">
          {adding ? (
            <div>
              <input
                autoFocus
                value={name}
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') void handleCreate()
                  if (e.key === 'Escape') {
                    setAdding(false)
                    setName('')
                  }
                }}
                placeholder="Folder name"
                aria-label="New folder name"
                className="w-full rounded-lg border border-line bg-pearl px-2.5 py-1.5 text-sm outline-none transition placeholder:text-ink-3 focus:border-accent"
              />
              <div className="mt-2 flex gap-2">
                <button
                  onClick={handleCreate}
                  disabled={!name.trim() || saving}
                  className="rounded-lg bg-accent px-3 py-1.5 text-xs font-medium text-pearl transition hover:bg-accent-deep disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {saving ? 'Creating…' : 'Create'}
                </button>
                <button
                  onClick={() => {
                    setAdding(false)
                    setName('')
                  }}
                  className="rounded-lg px-3 py-1.5 text-xs font-medium text-ink-2 transition hover:bg-pearl hover:text-ink"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setAdding(true)}
              className="flex h-full w-full flex-col items-start gap-3 text-left"
            >
              <span className="flex h-9 w-9 items-center justify-center rounded-xl border border-line bg-pearl text-ink-3">
                <FolderPlus className="h-4 w-4" />
              </span>
              <span className="text-sm font-medium text-ink-2">New folder</span>
            </button>
          )}
        </div>
      </div>
    </section>
  )
}
