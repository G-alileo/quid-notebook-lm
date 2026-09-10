import type { SupabaseClient } from '@supabase/supabase-js'
import { segmentBlocks } from '@/lib/text-blocks'
import type { HighlightRow, ReadableDocument } from '@/lib/types'

const SIGNED_URL_TTL = 3600

export async function loadReadableDocument(
  supabase: SupabaseClient,
  id: string
): Promise<ReadableDocument | null> {
  const { data, error } = await supabase
    .from('documents')
    .select('id, name, type, status, chunk_count, content, storage_path')
    .eq('id', id)
    .maybeSingle()

  if (error || !data) return null

  const storagePath = data.type === 'pdf' ? data.storage_path : null
  const signedPromise = storagePath
    ? supabase.storage.from('uploads').createSignedUrl(storagePath, SIGNED_URL_TTL)
    : null
  const highlightsPromise = supabase
    .from('highlights')
    .select('*')
    .eq('document_id', id)
    .eq('anchor_kind', 'text')
    .order('start_offset')

  const signed = signedPromise ? await signedPromise : null
  const { data: highlights } = await highlightsPromise

  return {
    id: data.id,
    name: data.name,
    type: data.type,
    status: data.status,
    chunk_count: data.chunk_count,
    blocks: segmentBlocks(data.content ?? '', data.type === 'pdf'),
    pdfUrl: signed?.data?.signedUrl ?? null,
    highlights: (highlights ?? []) as HighlightRow[],
  }
}
