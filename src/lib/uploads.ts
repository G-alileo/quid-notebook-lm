import { toast } from 'sonner'
import type { SupabaseClient } from '@supabase/supabase-js'

export const FILE_TYPES: Record<string, string> = {
  pdf: 'pdf',
  txt: 'text',
  md: 'text',
}

export const ACCEPTED_EXTENSIONS = '.pdf,.txt,.md'

export interface SourceTarget {
  userId: string
  folderId: string
  categoryId: string | null
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export async function registerFile(
  supabase: SupabaseClient,
  file: File,
  target: SourceTarget
): Promise<boolean> {
  const ext = file.name.split('.').pop()?.toLowerCase() ?? ''
  const type = FILE_TYPES[ext]
  if (!type) {
    toast.error(`Unsupported file type: .${ext} (use PDF, TXT or MD)`)
    return false
  }

  const path = `${target.userId}/${crypto.randomUUID()}-${file.name}`
  const { error: uploadError } = await supabase.storage.from('uploads').upload(path, file)
  if (uploadError) {
    toast.error(uploadError.message)
    return false
  }

  const { error } = await supabase.from('documents').insert({
    user_id: target.userId,
    name: file.name,
    type,
    size: formatBytes(file.size),
    storage_path: path,
    status: 'pending',
    folder_id: target.folderId,
    category_id: target.categoryId,
  })

  if (error) {
    await supabase.storage.from('uploads').remove([path])
    toast.error(error.message)
    return false
  }

  toast.success(`Uploaded ${file.name}`)
  return true
}

export async function registerFiles(
  supabase: SupabaseClient,
  files: FileList | File[],
  target: SourceTarget
): Promise<number> {
  let uploaded = 0
  for (const file of Array.from(files)) {
    if (await registerFile(supabase, file, target)) uploaded += 1
  }
  return uploaded
}

export async function registerLink(
  supabase: SupabaseClient,
  link: string,
  target: SourceTarget
): Promise<boolean> {
  let parsed: URL
  try {
    parsed = new URL(link.trim())
  } catch {
    toast.error('Enter a valid URL, including https://')
    return false
  }

  const isYoutube = /youtube\.com|youtu\.be/.test(parsed.hostname + parsed.pathname)
  const { error } = await supabase.from('documents').insert({
    user_id: target.userId,
    name: isYoutube ? parsed.toString() : parsed.hostname,
    type: isYoutube ? 'youtube' : 'url',
    source_url: parsed.toString(),
    status: 'pending',
    folder_id: target.folderId,
    category_id: target.categoryId,
  })

  if (error) {
    toast.error(error.message)
    return false
  }

  toast.success('Source added')
  return true
}

export async function deleteDocument(
  supabase: SupabaseClient,
  doc: { id: string; name: string; storage_path: string | null }
): Promise<boolean> {
  const { error } = await supabase.from('documents').delete().eq('id', doc.id)
  if (error) {
    toast.error(error.message)
    return false
  }

  if (doc.storage_path) {
    const { error: removeError } = await supabase.storage
      .from('uploads')
      .remove([doc.storage_path])
    if (removeError) toast.error(removeError.message)
  }

  toast.success(`Removed ${doc.name}`)
  return true
}
