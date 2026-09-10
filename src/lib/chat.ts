export interface ChatSource {
  reference: string
  source_file: string
  source_type: string
  page_number?: number
  chunk_id: string
  relevance_score: number
}

export interface ChatStreamEvent {
  token?: string
  sources_used?: ChatSource[]
  done?: boolean
  conversation_id?: string
}
