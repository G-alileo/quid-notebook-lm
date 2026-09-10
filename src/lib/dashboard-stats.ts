import type {
  DashboardStats,
  DocumentSummary,
  FolderCard,
  FolderRow,
  FolderStat,
} from '@/lib/types'

const PROCESSING = new Set(['pending', 'processing'])

export interface DashboardCounts {
  notes: number
  cardsTotal: number
  cardsMastered: number
}

export interface DashboardSummary {
  firstRun: boolean
  stats: DashboardStats
  folders: FolderCard[]
}

const emptyStat = (): FolderStat => ({ total: 0, ready: 0, processing: 0 })

export function summarizeDashboard(
  rows: FolderRow[],
  documents: DocumentSummary[],
  counts: DashboardCounts
): DashboardSummary {
  const byFolder = new Map<string, FolderStat>(rows.map((row) => [row.id, emptyStat()]))
  const stats: DashboardStats = {
    folders: rows.length,
    sources: documents.length,
    ready: 0,
    processing: 0,
    passages: 0,
    notes: counts.notes,
    cardsTotal: counts.cardsTotal,
    cardsMastered: counts.cardsMastered,
  }

  for (const doc of documents) {
    const isReady = doc.status === 'ready'
    const isProcessing = PROCESSING.has(doc.status)
    if (isReady) stats.ready += 1
    else if (isProcessing) stats.processing += 1
    stats.passages += doc.chunk_count

    const stat = doc.folder_id ? byFolder.get(doc.folder_id) : undefined
    if (!stat) continue
    stat.total += 1
    if (isReady) stat.ready += 1
    else if (isProcessing) stat.processing += 1
  }

  return {
    firstRun: rows.length === 0 && documents.length === 0,
    stats,
    folders: rows.map((row) => ({
      id: row.id,
      name: row.name,
      ...(byFolder.get(row.id) ?? emptyStat()),
    })),
  }
}
