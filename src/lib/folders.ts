import { toast } from 'sonner'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { FolderRow } from '@/lib/types'

export async function createFolder(
  supabase: SupabaseClient,
  userId: string,
  name: string
): Promise<FolderRow | null> {
  const trimmed = name.trim()
  if (!trimmed) return null

  const { data, error } = await supabase
    .from('folders')
    .insert({ user_id: userId, name: trimmed })
    .select('id, name')
    .single()

  if (error || !data) {
    toast.error(error?.message ?? 'Could not create that folder')
    return null
  }

  toast.success(`Folder "${trimmed}" created`)
  return data as FolderRow
}

export async function removeFolder(
  supabase: SupabaseClient,
  folder: FolderRow
): Promise<boolean> {
  const { data: docs, error: docsError } = await supabase
    .from('documents')
    .select('storage_path')
    .eq('folder_id', folder.id)
  if (docsError) {
    toast.error(docsError.message)
    return false
  }

  const { error } = await supabase.from('folders').delete().eq('id', folder.id)
  if (error) {
    toast.error(error.message)
    return false
  }

  const paths = (docs ?? [])
    .map((doc) => doc.storage_path)
    .filter((path): path is string => Boolean(path))
  if (paths.length > 0) {
    const { error: storageError } = await supabase.storage.from('uploads').remove(paths)
    if (storageError) toast.error(storageError.message)
  }

  toast.success(`Folder "${folder.name}" removed`)
  return true
}
