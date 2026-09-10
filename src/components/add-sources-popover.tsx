'use client'

import { useCallback, useRef, useState } from 'react'
import { Link2, Plus, UploadCloud } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { ACCEPTED_EXTENSIONS, registerFiles, registerLink } from '@/lib/uploads'
import { useDismissable } from '@/lib/use-dismissable'

export default function AddSourcesPopover({
  userId,
  folderId,
}: {
  userId: string
  folderId: string | null
}) {
  const wrapperRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [open, setOpen] = useState(false)
  const [dragging, setDragging] = useState(false)
  const [busy, setBusy] = useState(false)
  const [link, setLink] = useState('')

  const dismiss = useCallback(() => setOpen(false), [])
  useDismissable(wrapperRef, open, dismiss)

  const target = { userId, folderId, categoryId: null }

  async function upload(files: FileList | File[]) {
    setBusy(true)
    const uploaded = await registerFiles(createClient(), files, target)
    setBusy(false)
    if (uploaded > 0) setOpen(false)
  }

  async function submitLink() {
    if (!link.trim() || busy) return
    setBusy(true)
    const added = await registerLink(createClient(), link, target)
    setBusy(false)
    if (added) {
      setLink('')
      setOpen(false)
    }
  }

  return (
    <div ref={wrapperRef} className="relative">
      <button
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-label="Add sources to this folder"
        className="flex items-center gap-1 rounded-md px-1.5 py-0.5 text-xs font-medium text-accent transition hover:bg-accent-soft"
      >
        <Plus className="h-3.5 w-3.5" />
        Add
      </button>

      {open && (
        <div className="absolute left-0 top-full z-30 mt-2 w-[19rem] max-w-[calc(100vw-2rem)] rounded-2xl border border-line bg-surface p-3 shadow-pop">
          <div
            onDragOver={(e) => {
              e.preventDefault()
              setDragging(true)
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => {
              e.preventDefault()
              setDragging(false)
              if (e.dataTransfer.files.length > 0) void upload(e.dataTransfer.files)
            }}
            onClick={() => fileInputRef.current?.click()}
            className={`flex cursor-pointer flex-col items-center rounded-xl border border-dashed px-3 py-5 text-center transition ${
              dragging
                ? 'border-accent bg-accent-soft'
                : 'border-line-2 bg-pearl hover:border-accent/60'
            }`}
          >
            <UploadCloud className="h-4 w-4 text-accent" />
            <p className="mt-2 text-xs font-medium text-ink">
              {busy ? 'Uploading…' : 'Drop files or click to browse'}
            </p>
            <p className="mt-0.5 text-[11px] text-ink-3">PDF, TXT or MD</p>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept={ACCEPTED_EXTENSIONS}
              className="hidden"
              onChange={(e) => {
                if (e.target.files && e.target.files.length > 0) void upload(e.target.files)
                e.target.value = ''
              }}
            />
          </div>

          <div className="mt-2.5 flex gap-2">
            <div className="relative flex-1">
              <Link2 className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ink-3" />
              <input
                value={link}
                onChange={(e) => setLink(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') void submitLink()
                }}
                placeholder="Web page or YouTube link"
                aria-label="Web page or YouTube link"
                className="w-full rounded-lg border border-line bg-pearl py-1.5 pl-8 pr-2.5 text-xs outline-none transition placeholder:text-ink-3 focus:border-accent"
              />
            </div>
            <button
              onClick={submitLink}
              disabled={!link.trim() || busy}
              className="rounded-lg bg-accent px-3 py-1.5 text-xs font-medium text-pearl transition hover:bg-accent-deep disabled:cursor-not-allowed disabled:opacity-50"
            >
              Add
            </button>
          </div>

          <p className="mt-2.5 text-[11px] leading-relaxed text-ink-3">
            Added to {folderId ? 'this folder' : 'Unfiled'}. Sources are readable as soon as
            ingestion finishes.
          </p>
        </div>
      )}
    </div>
  )
}
