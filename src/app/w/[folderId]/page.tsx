import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { latestConversationId } from '@/lib/conversations'
import { loadReadableDocument } from '@/lib/documents'
import Workspace from '@/components/workspace'
import type { SourceSummary } from '@/lib/types'

export default async function WorkspacePage({
  params,
  searchParams,
}: {
  params: Promise<{ folderId: string }>
  searchParams: Promise<{ doc?: string }>
}) {
  const { folderId } = await params
  const { doc } = await searchParams
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/auth/sign-in')

  const { data: folder } = await supabase
    .from('folders')
    .select('name')
    .eq('id', folderId)
    .maybeSingle()
  if (!folder) notFound()

  const { data } = await supabase
    .from('documents')
    .select('id, name, type, status, chunk_count, size, error, storage_path')
    .eq('user_id', user.id)
    .eq('folder_id', folderId)
    .order('created_at', { ascending: false })
  const sources = (data ?? []) as SourceSummary[]

  const conversationId = await latestConversationId(supabase, folderId)
  const initialId =
    doc && sources.some((source) => source.id === doc) ? doc : (sources[0]?.id ?? null)
  const initialDocument = initialId ? await loadReadableDocument(supabase, initialId) : null

  return (
    <Workspace
      userId={user.id}
      folderName={folder.name}
      folderId={folderId}
      sources={sources}
      initialDocument={initialDocument}
      conversationId={conversationId}
    />
  )
}
