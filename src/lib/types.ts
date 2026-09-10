import type { TextBlock } from '@/lib/text-blocks'

export interface FolderRow {
  id: string
  name: string
}

export interface CategoryRow {
  id: string
  name: string
  color: string
}

export interface DocumentRow {
  id: string
  name: string
  type: string
  size: string | null
  status: string
  chunk_count: number
  storage_path: string | null
  source_url: string | null
  folder_id: string | null
  category_id: string | null
  content: string | null
  created_at: string
}

export interface FlashcardRow {
  id: string
  document_id: string | null
  question: string
  answer: string
  mastered: boolean
}

export interface SourceSummary {
  id: string
  name: string
  type: string
  status: string
  chunk_count: number
  size: string | null
  error: string | null
  storage_path: string | null
}

export interface LooseDocument {
  id: string
  name: string
  type: string
  size: string | null
}

export interface FolderStat {
  total: number
  ready: number
  processing: number
}

export interface FolderCard extends FolderRow, FolderStat {}

export interface DocumentSummary {
  status: string
  chunk_count: number
  folder_id: string | null
}

export interface DashboardStats {
  folders: number
  sources: number
  ready: number
  processing: number
  passages: number
  notes: number
  cardsTotal: number
  cardsMastered: number
}

export interface HighlightRow {
  id: string
  document_id: string
  anchor_kind: string
  start_offset: number | null
  end_offset: number | null
  page_number: number | null
  rects: unknown
  text: string
  color: string
  annotation: string | null
  created_at: string
}

export interface ReadableDocument extends SourceSummary {
  blocks: TextBlock[]
  pdfUrl: string | null
  highlights: HighlightRow[]
}
