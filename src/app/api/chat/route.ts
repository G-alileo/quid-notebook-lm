import type { SupabaseClient } from '@supabase/supabase-js'
import type { ChatSource } from '@/lib/chat'
import { createClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const COHERE_EMBED_URL = 'https://api.cohere.com/v1/embed'
const TOP_K = 6
const MAX_CHUNKS = 5
const MAX_CONTEXT_CHARS = 6000
const HISTORY_TURNS = 10
const MAX_HISTORY_CHARS = 4000
const TITLE_CHARS = 60

interface MatchRow {
  id: string
  document_id: string
  content: string
  meta: Record<string, unknown> | null
  similarity: number
}

const sse = (payload: Record<string, unknown>) => `data: ${JSON.stringify(payload)}\n\n`

const SYSTEM_PROMPT = `You are the assistant inside Quid Notebook, a personal knowledge base. You answer questions from the numbered sources supplied with each question.

Grounding
- Base every factual claim on the sources. Cite inline with the source number in brackets, [1], immediately after the claim it supports. Use only numbers that appear in SOURCES.
- When several sources support one claim, cite them together: [1][3].
- Never add facts, figures, dates, or examples that are not in the sources. Your own knowledge may shape structure and wording, never content.

Answering
- Open with the answer: the most relevant thing the sources actually say about the question.
- If the sources only partially cover the question, answer from the closest relevant material first and note what they do not cover in one short sentence at the end. Never open with what the sources lack.
- Synthesise the chunks into one coherent answer. Use flowing prose, or a short list only when the answer is genuinely a set of items. Do not walk through the chunks one by one.
- Match depth to the question. A narrow question gets a few sentences. A broad one gets a compact structured overview.
- If nothing in the sources is relevant, say so in one sentence and suggest a related question the sources could answer. Do not guess.

Conversation
- Use CONVERSATION HISTORY to resolve pronouns and follow-ups. History is context, not a source: never cite it.
- The current question overrides anything earlier in the history.

Style
- Plain, direct English. No preamble, no restating the question, no sign-off.
- As short as the question allows.`

function buildPrompt(query: string, context: string, history: string) {
  const historySection = history ? `\nCONVERSATION HISTORY:\n${history}\n` : ''
  return `SOURCES:
${context}
${historySection}
QUESTION: ${query}`
}

async function persistTurn(
  supabase: SupabaseClient,
  userId: string,
  conversationId: string,
  query: string,
  response: string,
  sources: ChatSource[]
) {
  const { error } = await supabase.from('chat_messages').insert([
    { user_id: userId, conversation_id: conversationId, role: 'user', content: query },
    {
      user_id: userId,
      conversation_id: conversationId,
      role: 'assistant',
      content: response,
      sources: sources.length > 0 ? sources : null,
    },
  ])
  if (error) console.error('chat history persist failed:', error.message)
}

export async function POST(req: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let query = ''
  let folderId: string | null = null
  let requestedConversationId: string | null = null
  let requestedDocumentIds: string[] | null = null
  try {
    const body = await req.json()
    query = typeof body.query === 'string' ? body.query.trim() : ''
    folderId = typeof body.folder_id === 'string' ? body.folder_id : null
    requestedConversationId =
      typeof body.conversation_id === 'string' ? body.conversation_id : null
    if (Array.isArray(body.document_ids)) {
      requestedDocumentIds = body.document_ids.filter(
        (id: unknown): id is string => typeof id === 'string'
      )
    }
  } catch {
    return Response.json({ error: 'Invalid JSON body' }, { status: 400 })
  }
  if (!query) {
    return Response.json({ error: 'Query is required' }, { status: 400 })
  }

  let conversationId: string
  let scopeFolderId: string | null = folderId

  if (requestedConversationId) {
    const { data: existing } = await supabase
      .from('conversations')
      .select('id, folder_id')
      .eq('id', requestedConversationId)
      .maybeSingle()
    if (!existing) {
      return Response.json({ error: 'Conversation not found' }, { status: 404 })
    }
    conversationId = existing.id
    scopeFolderId = existing.folder_id
  } else {
    const { data: created, error } = await supabase
      .from('conversations')
      .insert({
        user_id: user.id,
        folder_id: scopeFolderId,
        title: query.slice(0, TITLE_CHARS),
      })
      .select('id')
      .single()
    if (error || !created) {
      return Response.json({ error: 'Could not start a conversation' }, { status: 500 })
    }
    conversationId = created.id
  }

  let scopeDocumentIds: string[] | null = requestedDocumentIds
  if (!scopeDocumentIds && scopeFolderId) {
    const { data: scoped } = await supabase
      .from('documents')
      .select('id')
      .eq('folder_id', scopeFolderId)
    scopeDocumentIds = (scoped ?? []).map((d) => d.id)
  }

  const emptyScopeMessage = requestedDocumentIds
    ? 'No sources are selected. Choose at least one on the left to ask about it.'
    : 'This folder has no sources yet. Add a document to it, then ask away.'

  const encoder = new TextEncoder()

  const stream = new ReadableStream({
    async start(controller) {
      const send = (payload: Record<string, unknown>) =>
        controller.enqueue(encoder.encode(sse(payload)))
      let fullResponse = ''
      const sources: ChatSource[] = []

      send({ conversation_id: conversationId })

      try {
        if (scopeDocumentIds && scopeDocumentIds.length === 0) {
          send({ token: emptyScopeMessage, done: true, sources_used: [] })
          await persistTurn(supabase, user.id, conversationId, query, emptyScopeMessage, [])
          controller.close()
          return
        }

        const { data: historyRows } = await supabase
          .from('chat_messages')
          .select('role, content')
          .eq('conversation_id', conversationId)
          .order('created_at', { ascending: false })
          .limit(HISTORY_TURNS)
        let history = (historyRows ?? [])
          .slice()
          .reverse()
          .map((m) => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content}`)
          .join('\n\n')
        if (history.length > MAX_HISTORY_CHARS) {
          history = history.slice(-MAX_HISTORY_CHARS)
        }

        const embedRes = await fetch(COHERE_EMBED_URL, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${process.env.COHERE_API_KEY}`,
          },
          body: JSON.stringify({
            model: process.env.COHERE_EMBED_MODEL,
            input_type: 'search_query',
            texts: [query],
          }),
        })
        if (!embedRes.ok) {
          throw new Error(`embedding failed with status ${embedRes.status}`)
        }
        const embedData = await embedRes.json()
        const queryEmbedding = embedData.embeddings?.[0]
        if (!Array.isArray(queryEmbedding)) {
          throw new Error('embedding response was empty')
        }

        const { data: matches, error: rpcError } = await supabase.rpc('match_chunks', {
          query_embedding: queryEmbedding,
          match_count: TOP_K,
          document_ids: scopeDocumentIds,
        })
        if (rpcError) throw new Error(rpcError.message)

        const contextParts: string[] = []
        let totalChars = 0
        const rows = (matches ?? []) as MatchRow[]
        rows.slice(0, MAX_CHUNKS).forEach((row, i) => {
          const meta = row.meta ?? {}
          const reference = `[${i + 1}]`
          const origin =
            typeof meta.page_number === 'number'
              ? `${meta.source_file ?? 'Unknown Source'}, page ${meta.page_number}`
              : String(meta.source_file ?? 'Unknown Source')
          const chunkText = `${reference} ${origin}\n${row.content}`
          if (totalChars + chunkText.length > MAX_CONTEXT_CHARS && contextParts.length > 0) {
            return
          }
          contextParts.push(chunkText)
          totalChars += chunkText.length
          sources.push({
            reference,
            source_file: String(meta.source_file ?? 'Unknown Source'),
            source_type: String(meta.source_type ?? 'unknown'),
            page_number: typeof meta.page_number === 'number' ? meta.page_number : undefined,
            chunk_id: String(meta.chunk_id ?? row.id),
            relevance_score: row.similarity,
          })
        })

        if (sources.length === 0) {
          const message =
            "I couldn't find any relevant information in the available documents to answer your question."
          send({ token: message, done: true, sources_used: [] })
          await persistTurn(supabase, user.id, conversationId, query, message, [])
          controller.close()
          return
        }

        send({ sources_used: sources, done: false })

        const prompt = buildPrompt(query, contextParts.join('\n\n'), history)
        const qwenRes = await fetch(
          `${process.env.QWEN_BASE_URL!.replace(/\/$/, '')}/chat/completions`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${process.env.QWEN_API_KEY}`,
            },
            body: JSON.stringify({
              model: process.env.QWEN_CHAT_MODEL,
              messages: [
                { role: 'system', content: SYSTEM_PROMPT },
                { role: 'user', content: prompt },
              ],
              temperature: 0.1,
              max_tokens: 1500,
              stream: true,
            }),
          }
        )
        if (!qwenRes.ok || !qwenRes.body) {
          throw new Error(`LLM request failed with status ${qwenRes.status}`)
        }

        const reader = qwenRes.body.getReader()
        const decoder = new TextDecoder()
        let partial = ''
        for (;;) {
          const { done, value } = await reader.read()
          if (done) break
          const lines = (partial + decoder.decode(value, { stream: true })).split('\n')
          partial = lines.pop() ?? ''
          for (const line of lines) {
            const trimmed = line.trim()
            if (!trimmed.startsWith('data:')) continue
            const data = trimmed.slice(5).trim()
            if (data === '[DONE]') continue
            try {
              const parsed = JSON.parse(data)
              const token = parsed.choices?.[0]?.delta?.content
              if (token) {
                fullResponse += token
                send({ token, done: false })
              }
            } catch {
              // non-JSON keepalive line
            }
          }
        }

        send({ done: true })
        await persistTurn(supabase, user.id, conversationId, query, fullResponse, sources)
        controller.close()
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        send({ token: `\nError processing question: ${message}`, done: true })
        controller.close()
      }
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
    },
  })
}
