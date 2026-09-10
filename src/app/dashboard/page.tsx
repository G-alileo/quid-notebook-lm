import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import FirstRun from '@/components/dashboard/first-run'
import FolderGrid from '@/components/dashboard/folder-grid'
import StatsStrip from '@/components/dashboard/stats-strip'
import SourcesManager from '@/components/sources-manager'
import { summarizeDashboard } from '@/lib/dashboard-stats'
import type { DocumentSummary, FolderRow } from '@/lib/types'

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ folder?: string }>
}) {
  const { folder } = await searchParams
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/auth/sign-in')

  const [folderRes, docRes, noteRes, cardRes, masteredRes] = await Promise.all([
    supabase.from('folders').select('id, name').order('name'),
    supabase.from('documents').select('status, chunk_count, folder_id').eq('user_id', user.id),
    supabase.from('highlights').select('id', { count: 'exact', head: true }).eq('user_id', user.id),
    supabase.from('flashcards').select('id', { count: 'exact', head: true }).eq('user_id', user.id),
    supabase
      .from('flashcards')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .eq('mastered', true),
  ])

  const { firstRun, stats, folders, unfiled } = summarizeDashboard(
    (folderRes.data ?? []) as FolderRow[],
    (docRes.data ?? []) as DocumentSummary[],
    {
      notes: noteRes.count ?? 0,
      cardsTotal: cardRes.count ?? 0,
      cardsMastered: masteredRes.count ?? 0,
    }
  )

  if (firstRun) return <FirstRun userId={user.id} />

  return (
    <>
      <div className="mx-auto w-full max-w-5xl space-y-6 px-6 pt-6 lg:px-8 lg:pt-8">
        <StatsStrip stats={stats} />
        <FolderGrid userId={user.id} folders={folders} unfiled={unfiled} />
      </div>
      <SourcesManager userId={user.id} activeFolderId={folder} />
    </>
  )
}
