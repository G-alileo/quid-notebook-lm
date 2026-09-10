'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { FolderPlus } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { createFolder } from '@/lib/folders'

export default function FirstRun({ userId }: { userId: string }) {
  const router = useRouter()
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

  return (
    <div className="mx-auto w-full max-w-md px-6 py-16 text-center lg:py-24">
      <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl border border-line bg-surface text-accent shadow-card">
        <FolderPlus className="h-5 w-5" />
      </span>
      <h2 className="mt-5 text-xl font-semibold tracking-tight">Create your first folder</h2>
      <p className="mt-2 text-sm leading-relaxed text-ink-2">
        A folder holds the sources for one course, case or project. Everything you ask inside it is
        answered from those files only.
      </p>

      <div className="mt-7 rounded-2xl border border-line bg-surface p-5 text-left shadow-card">
        <label htmlFor="first-folder" className="text-sm text-ink-2">
          Folder name
        </label>
        <input
          id="first-folder"
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') void handleCreate()
          }}
          placeholder="Cellular Biology"
          className="mt-1.5 w-full rounded-lg border border-line bg-pearl px-3 py-2 text-sm outline-none transition placeholder:text-ink-3 focus:border-accent focus:bg-surface"
        />
        <button
          onClick={handleCreate}
          disabled={!name.trim() || saving}
          className="mt-3 w-full rounded-lg bg-accent px-4 py-2 text-sm font-medium text-pearl transition hover:bg-accent-deep disabled:cursor-not-allowed disabled:opacity-50"
        >
          {saving ? 'Creating…' : 'Create and open'}
        </button>
      </div>

      <p className="mt-5 text-xs text-ink-3">
        Not organising yet?{' '}
        <Link href="/w/unfiled" className="font-medium text-accent hover:text-accent-deep">
          Start without a folder
        </Link>
      </p>
    </div>
  )
}
