import { createClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const CONTEXT_CHARS = 8000
const DEFAULT_CARDS = 12
const MAX_CARDS = 30

function parseCards(raw: string): { question: string; answer: string }[] {
  let text = raw.trim()
  text = text.replace(/^```(?:json)?/i, '').replace(/```$/, '').trim()
  const start = text.indexOf('[')
  const end = text.lastIndexOf(']')
  if (start === -1 || end === -1 || end <= start) return []
  try {
    const parsed = JSON.parse(text.slice(start, end + 1))
    if (!Array.isArray(parsed)) return []
    return parsed
      .filter(
        (card) =>
          card &&
          typeof card.question === 'string' &&
          typeof card.answer === 'string' &&
          card.question.trim() &&
          card.answer.trim()
      )
      .map((card) => ({ question: card.question.trim(), answer: card.answer.trim() }))
      .slice(0, MAX_CARDS)
  } catch {
    return []
  }
}

export async function POST(req: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let documentId = ''
  let count = DEFAULT_CARDS
  try {
    const body = await req.json()
    documentId = typeof body.document_id === 'string' ? body.document_id : ''
    if (typeof body.count === 'number') count = Math.min(Math.max(body.count, 3), MAX_CARDS)
  } catch {
    return Response.json({ error: 'Invalid JSON body' }, { status: 400 })
  }
  if (!documentId) {
    return Response.json({ error: 'document_id is required' }, { status: 400 })
  }

  const { data: doc, error: docError } = await supabase
    .from('documents')
    .select('id, name, content')
    .eq('id', documentId)
    .maybeSingle()
  if (docError) {
    return Response.json({ error: docError.message }, { status: 500 })
  }
  if (!doc) {
    return Response.json({ error: 'Document not found' }, { status: 404 })
  }

  let sourceText = doc.content ?? ''
  if (!sourceText) {
    const { data: chunkRows, error: chunkError } = await supabase
      .from('chunks')
      .select('content')
      .eq('document_id', documentId)
      .order('chunk_index', { ascending: true })
    if (chunkError) {
      return Response.json({ error: chunkError.message }, { status: 500 })
    }
    sourceText = (chunkRows ?? []).map((row) => row.content).join('\n\n')
  }
  if (!sourceText.trim()) {
    return Response.json(
      { error: 'This document has no readable content yet. Wait for ingestion to finish.' },
      { status: 409 }
    )
  }
  if (sourceText.length > CONTEXT_CHARS) {
    sourceText = sourceText.slice(0, CONTEXT_CHARS)
  }

  const prompt = `You create study flashcards from the provided document text.
Return ONLY a JSON array of objects with "question" and "answer" keys. No markdown fences, no commentary.
Generate ${count} cards covering the most important facts and concepts. Answers must be 1-3 sentences.

DOCUMENT:
${sourceText}`

  const llmRes = await fetch(`${process.env.QWEN_BASE_URL!.replace(/\/$/, '')}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${process.env.QWEN_API_KEY}`,
    },
    body: JSON.stringify({
      model: process.env.QWEN_CHAT_MODEL,
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.4,
      max_tokens: 2500,
    }),
  })
  if (!llmRes.ok) {
    return Response.json({ error: `LLM request failed with status ${llmRes.status}` }, { status: 502 })
  }
  const llmData = await llmRes.json()
  const raw = llmData.choices?.[0]?.message?.content
  if (typeof raw !== 'string') {
    return Response.json({ error: 'LLM returned no content' }, { status: 502 })
  }

  const cards = parseCards(raw)
  if (cards.length === 0) {
    return Response.json({ error: 'The model returned no usable flashcards. Try again.' }, { status: 502 })
  }

  const { data: inserted, error: insertError } = await supabase
    .from('flashcards')
    .insert(
      cards.map((card) => ({
        user_id: user.id,
        document_id: documentId,
        question: card.question,
        answer: card.answer,
      }))
    )
    .select('id, question, answer, mastered')
  if (insertError) {
    return Response.json({ error: insertError.message }, { status: 500 })
  }

  return Response.json({ document_id: documentId, document_name: doc.name, cards: inserted })
}
