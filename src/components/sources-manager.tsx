'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import {
  AlignLeft,
  FileText,
  Globe,
  Link2,
  MessageSquare,
  GraduationCap,
  Play,
  Sparkles,
  Trash2,
  UploadCloud,
} from 'lucide-react'
import CategoriesManager from '@/components/categories-manager'
import { createClient } from '@/lib/supabase/client'
import { ACCEPTED_EXTENSIONS, registerFiles, registerLink } from '@/lib/uploads'
import type { CategoryRow, DocumentRow, FolderRow } from '@/lib/types'

const STATUS_STYLES: Record<string, string> = {
  pending: 'bg-amber-50 text-amber-700 border-amber-200',
  processing: 'bg-sky-50 text-sky-700 border-sky-200',
  ready: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  failed: 'bg-red-50 text-red-600 border-red-200',
}

function TypeIcon({ type }: { type: string }) {
  const classes = 'h-4 w-4'
  switch (type) {
    case 'pdf':
      return (
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-red-100 bg-red-50 text-red-500">
          <FileText className={classes} />
        </span>
      )
    case 'url':
      return (
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-sky-100 bg-sky-50 text-sky-600">
          <Globe className={classes} />
        </span>
      )
    case 'youtube':
      return (
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-red-100 bg-red-50 text-red-600">
          <Play className={classes} />
        </span>
      )
    default:
      return (
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-amber-100 bg-amber-50 text-amber-600">
          <AlignLeft className={classes} />
        </span>
      )
  }
}

export default function SourcesManager({
  userId,
  activeFolderId,
}: {
  userId: string
  activeFolderId?: string
}) {
  const router = useRouter()
  const [documents, setDocuments] = useState<DocumentRow[]>([])
  const [folders, setFolders] = useState<FolderRow[]>([])
  const [categories, setCategories] = useState<CategoryRow[]>([])
  const [targetFolder, setTargetFolder] = useState(activeFolderId ?? '')
  const [targetCategory, setTargetCategory] = useState('')
  const [link, setLink] = useState('')
  const [busy, setBusy] = useState(false)
  const [dragging, setDragging] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const load = useCallback(async () => {
    const supabase = createClient()
    const [docRes, folderRes, categoryRes] = await Promise.all([
      supabase.from('documents').select('*').order('created_at', { ascending: false }),
      supabase.from('folders').select('id, name').order('name'),
      supabase.from('categories').select('id, name, color').order('name'),
    ])
    if (docRes.error) {
      toast.error(docRes.error.message)
      return
    }
    if (folderRes.error) toast.error(folderRes.error.message)
    if (categoryRes.error) toast.error(categoryRes.error.message)
    setDocuments((docRes.data ?? []) as DocumentRow[])
    setFolders(folderRes.data ?? [])
    setCategories(categoryRes.data ?? [])
  }, [])

  useEffect(() => {
    const supabase = createClient()
    const channel = supabase
      .channel('documents-list')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'documents',
          filter: `user_id=eq.${userId}`,
        },
        () => load()
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') load()
      })
    return () => {
      supabase.removeChannel(channel)
    }
  }, [userId, load])

  const selectedFolder = folders.some((f) => f.id === targetFolder) ? targetFolder : ''
  const selectedCategory = categories.some((c) => c.id === targetCategory) ? targetCategory : ''

  const target = {
    userId,
    folderId: selectedFolder || null,
    categoryId: selectedCategory || null,
  }

  async function handleFiles(files: FileList | File[]) {
    setBusy(true)
    await registerFiles(createClient(), files, target)
    setBusy(false)
    load()
  }

  async function handleLink() {
    if (!link.trim()) return
    if (await registerLink(createClient(), link, target)) {
      setLink('')
      load()
    }
  }

  async function handleDelete(doc: DocumentRow) {
    const supabase = createClient()
    const { error } = await supabase.from('documents').delete().eq('id', doc.id)
    if (error) {
      toast.error(error.message)
      return
    }
    if (doc.storage_path) {
      await supabase.storage.from('uploads').remove([doc.storage_path])
    }
    toast.success(`Removed ${doc.name}`)
    load()
  }

  const activeFolder = folders.find((f) => f.id === activeFolderId)
  const visible = activeFolderId
    ? documents.filter((d) => d.folder_id === activeFolderId)
    : documents

  const selectClasses =
    'rounded-lg border border-line bg-surface px-2.5 py-1.5 text-xs text-ink-2 outline-none transition focus:border-accent'

  return (
    <div className="mx-auto w-full max-w-5xl space-y-6 p-6 lg:p-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold tracking-tight">
            {activeFolder ? activeFolder.name : 'All sources'}
          </h2>
          <p className="mt-1 text-sm text-ink-3">
            {visible.length} {visible.length === 1 ? 'source' : 'sources'}
            {activeFolder && (
              <Link href="/dashboard" className="ml-2 font-medium text-accent hover:text-accent-deep">
                Show all
              </Link>
            )}
          </p>
        </div>
      </div>

      <div className="rounded-2xl border border-line bg-surface p-5 shadow-card">
        <div
          onDragOver={(e) => {
            e.preventDefault()
            setDragging(true)
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault()
            setDragging(false)
            if (e.dataTransfer.files.length > 0) handleFiles(e.dataTransfer.files)
          }}
          onClick={() => fileInputRef.current?.click()}
          className={`flex cursor-pointer flex-col items-center rounded-xl border border-dashed px-6 py-8 text-center transition ${
            dragging
              ? 'border-accent bg-accent-soft'
              : 'border-line-2 bg-pearl hover:border-accent/60 hover:bg-accent-soft/40'
          }`}
        >
          <span className="flex h-11 w-11 items-center justify-center rounded-xl border border-line bg-surface text-accent shadow-card">
            <UploadCloud className="h-5 w-5" />
          </span>
          <p className="mt-3 text-sm font-medium text-ink">
            {busy ? 'Uploading…' : 'Drop PDF, TXT or MD files here, or click to browse'}
          </p>
          <p className="mt-1 text-xs text-ink-3">Files are chunked and embedded automatically</p>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept={ACCEPTED_EXTENSIONS}
            className="hidden"
            onChange={(e) => {
              if (e.target.files && e.target.files.length > 0) handleFiles(e.target.files)
              e.target.value = ''
            }}
          />
        </div>

        <div className="mt-4 flex flex-col gap-3 sm:flex-row">
          <div className="relative flex-1">
            <Link2 className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-3" />
            <input
              value={link}
              onChange={(e) => setLink(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && link.trim()) handleLink()
              }}
              placeholder="Or paste a web page / YouTube link"
              className="w-full rounded-lg border border-line bg-surface py-2 pl-9 pr-3 text-sm outline-none transition placeholder:text-ink-3 focus:border-accent"
            />
          </div>
          <button
            onClick={handleLink}
            disabled={!link.trim()}
            className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-pearl transition hover:bg-accent-deep disabled:cursor-not-allowed disabled:opacity-50"
          >
            Add link
          </button>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-line pt-4">
          <span className="text-xs font-medium text-ink-3">File new sources to</span>
          <select
            value={selectedFolder}
            onChange={(e) => setTargetFolder(e.target.value)}
            className={selectClasses}
          >
            <option value="">No folder</option>
            {folders.map((folder) => (
              <option key={folder.id} value={folder.id}>
                {folder.name}
              </option>
            ))}
          </select>
          <select
            value={selectedCategory}
            onChange={(e) => setTargetCategory(e.target.value)}
            className={selectClasses}
          >
            <option value="">No category</option>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>
          <div className="ml-auto">
            <CategoriesManager userId={userId} categories={categories} onChanged={load} />
          </div>
        </div>
      </div>

      {visible.length === 0 ? (
        documents.length === 0 ? (
          <div className="rounded-2xl border border-line bg-surface px-6 py-10 shadow-card">
            <div className="mx-auto grid max-w-2xl gap-6 text-center sm:grid-cols-3">
              <div>
                <span className="mx-auto flex h-10 w-10 items-center justify-center rounded-xl border border-line bg-pearl text-accent">
                  <UploadCloud className="h-4.5 w-4.5" />
                </span>
                <p className="mt-3 text-sm font-medium">1 · Add sources</p>
                <p className="mt-1 text-xs leading-relaxed text-ink-3">
                  Upload documents or paste web and YouTube links above
                </p>
              </div>
              <div>
                <span className="mx-auto flex h-10 w-10 items-center justify-center rounded-xl border border-line bg-pearl text-accent">
                  <Sparkles className="h-4.5 w-4.5" />
                </span>
                <p className="mt-3 text-sm font-medium">2 · Automatic ingestion</p>
                <p className="mt-1 text-xs leading-relaxed text-ink-3">
                  Everything is chunked, embedded and indexed for retrieval
                </p>
              </div>
              <div>
                <span className="mx-auto flex h-10 w-10 items-center justify-center rounded-xl border border-line bg-pearl text-accent">
                  <MessageSquare className="h-4.5 w-4.5" />
                </span>
                <p className="mt-3 text-sm font-medium">3 · Chat & study</p>
                <p className="mt-1 text-xs leading-relaxed text-ink-3">
                  Ask questions with cited answers, or generate flashcard decks
                </p>
              </div>
            </div>
            <p className="mt-8 text-center text-xs text-ink-3">
              Then open a folder above to read and ask, or build a deck in{' '}
              <Link
                href="/dashboard/flashcards"
                className="font-medium text-accent hover:text-accent-deep"
              >
                Flashcards
              </Link>
              {' '}<GraduationCap className="inline h-3.5 w-3.5 align-[-2px] text-ink-3" />
            </p>
          </div>
        ) : (
          <p className="py-8 text-center text-sm text-ink-3">
            No sources in this folder yet.
          </p>
        )
      ) : (
        <ul className="divide-y divide-line overflow-hidden rounded-2xl border border-line bg-surface shadow-card">
          {visible.map((doc) => {
            const category = categories.find((c) => c.id === doc.category_id)
            const folder = folders.find((f) => f.id === doc.folder_id)
            return (
              <li key={doc.id} className="group flex items-center gap-3 px-4 py-3 transition hover:bg-pearl/60">
                <button
                  onClick={() => router.push(`/w/${doc.folder_id ?? 'unfiled'}?doc=${doc.id}`)}
                  className="flex min-w-0 flex-1 items-center gap-3 text-left"
                >
                  <TypeIcon type={doc.type} />
                  <span className="min-w-0">
                    <span className="flex items-center gap-2">
                      {category && (
                        <span
                          className="h-2 w-2 shrink-0 rounded-full"
                          style={{ backgroundColor: category.color }}
                        />
                      )}
                      <span className="truncate text-sm font-medium text-ink group-hover:text-accent-deep">
                        {doc.name}
                      </span>
                    </span>
                    <span className="mt-0.5 block truncate text-xs text-ink-3">
                      {doc.type}
                      {folder ? ` · ${folder.name}` : ''}
                      {category ? ` · ${category.name}` : ''}
                      {doc.size ? ` · ${doc.size}` : ''}
                      {doc.status === 'ready' ? ` · ${doc.chunk_count} chunks` : ''}
                    </span>
                  </span>
                </button>
                <span
                  className={`flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium ${
                    STATUS_STYLES[doc.status] ?? 'bg-pearl text-ink-2 border-line'
                  }`}
                >
                  {doc.status === 'processing' && (
                    <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-sky-500" />
                  )}
                  {doc.status}
                </span>
                <button
                  onClick={() => handleDelete(doc)}
                  className="rounded-lg p-1.5 text-ink-3 transition hover:bg-red-50 hover:text-red-500"
                  title={`Remove ${doc.name}`}
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
