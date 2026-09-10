'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { ArrowUp, UploadCloud } from 'lucide-react'
import { toast } from 'sonner'
import type { ChatSource, ChatStreamEvent } from '@/lib/chat'
import { createClient } from '@/lib/supabase/client'

interface Message {
  role: 'user' | 'assistant'
  content: string
  sources?: ChatSource[]
}

function renderWithCitations(content: string) {
  const parts = content.split(/(\[\d+\])/g)
  return parts.map((part, i) => {
    const match = part.match(/^\[(\d+)\]$/)
    if (match) {
      return (
        <span
          key={i}
          className="mx-0.5 align-super text-[10px] font-semibold text-accent"
        >
          {`[${match[1]}]}`}
        </span>
      )
    }
    return <span key={i}>{part}</span>
  })
}

export default function ChatPanel({
  className = '',
  hasSources = true,
  folderId = null,
  conversationId = null,
  documentIds = null,
}: {
  className?: string
  hasSources?: boolean
  folderId?: string | null
  conversationId?: string | null
  documentIds?: string[] | null
}) {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [streaming, setStreaming] = useState(false)
  const [hydrating, setHydrating] = useState(conversationId !== null)
  const [activeConversationId, setActiveConversationId] = useState<string | null>(
    conversationId
  )
  const listRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!conversationId) return

    let cancelled = false
    createClient()
      .from('chat_messages')
      .select('role, content, sources')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true })
      .then(({ data, error }) => {
        if (cancelled) return
        if (error) {
          toast.error('Could not load this conversation')
        } else {
          setMessages(
            (data ?? []).map((row) => ({
              role: row.role === 'user' ? 'user' : 'assistant',
              content: row.content,
              sources: (row.sources as ChatSource[] | null) ?? undefined,
            }))
          )
        }
        setHydrating(false)
      })

    return () => {
      cancelled = true
    }
  }, [conversationId])

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight })
  }, [messages, hydrating])

  async function send() {
    const query = input.trim()
    if (!query || streaming) return
    setInput('')
    setMessages((m) => [
      ...m,
      { role: 'user', content: query },
      { role: 'assistant', content: '' },
    ])
    setStreaming(true)

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query,
          folder_id: folderId,
          conversation_id: activeConversationId,
          document_ids: documentIds,
        }),
      })
      if (!res.ok || !res.body) {
        const err = await res.json().catch(() => ({ error: 'Chat request failed' }))
        throw new Error(err.error ?? `status ${res.status}`)
      }

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let partial = ''
      for (;;) {
        const { done, value } = await reader.read()
        if (done) break
        const lines = (partial + decoder.decode(value, { stream: true })).split('\n')
        partial = lines.pop() ?? ''
        for (const line of lines) {
          const trimmed = line.trim()
          if (!trimmed.startsWith('data: ')) continue
          try {
            const event: ChatStreamEvent = JSON.parse(trimmed.slice(6))
            if (event.conversation_id) {
              setActiveConversationId(event.conversation_id)
            }
            if (event.sources_used) {
              const sources = event.sources_used
              setMessages((m) => {
                const copy = [...m]
                copy[copy.length - 1] = { ...copy[copy.length - 1], sources }
                return copy
              })
            }
            if (event.token) {
              const token = event.token
              setMessages((m) => {
                const copy = [...m]
                copy[copy.length - 1] = {
                  ...copy[copy.length - 1],
                  content: copy[copy.length - 1].content + token,
                }
                return copy
              })
            }
          } catch {
            // malformed SSE line
          }
        }
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Chat request failed')
      setMessages((m) => m.slice(0, -1))
    } finally {
      setStreaming(false)
    }
  }

  const empty = messages.length === 0 && !hydrating

  return (
    <div className={`flex flex-col ${className}`}>
      <div ref={listRef} className="flex-1 space-y-4 overflow-y-auto p-4 lg:p-6">
        {hydrating && messages.length === 0 && (
          <div className="space-y-4 pt-1">
            {[0, 1].map((i) => (
              <div
                key={i}
                className={`h-16 animate-pulse rounded-2xl border border-line bg-pearl ${
                  i === 0 ? 'ml-auto w-[70%]' : 'w-[85%]'
                }`}
              />
            ))}
          </div>
        )}
        {empty &&
          (hasSources ? (
            <div className="mx-auto max-w-md pt-10 text-center">
              <p className="text-sm font-medium text-ink">Ask anything about your sources</p>
              <p className="mt-1.5 text-sm leading-relaxed text-ink-3">
                Answers arrive with citations you can trace back to the original page.
              </p>
            </div>
          ) : (
            <div className="mx-auto max-w-md rounded-2xl border border-line bg-surface px-6 py-8 text-center shadow-card">
              <span className="mx-auto flex h-10 w-10 items-center justify-center rounded-xl border border-line bg-pearl text-accent">
                <UploadCloud className="h-4.5 w-4.5" />
              </span>
              <p className="mt-3 text-sm font-medium text-ink">No sources yet</p>
              <p className="mt-1.5 text-sm leading-relaxed text-ink-3">
                Chat answers are grounded in your documents. Add a source first, then come back
                and ask away.
              </p>
              <Link
                href="/dashboard"
                className="mt-4 inline-block rounded-lg bg-accent px-4 py-2 text-sm font-medium text-pearl transition hover:bg-accent-deep"
              >
                Add your first source
              </Link>
            </div>
          ))}
        {messages.map((message, i) => (
          <div
            key={i}
            className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            {message.role === 'user' ? (
              <div className="max-w-[85%] rounded-2xl rounded-br-md bg-ink px-4 py-2.5 text-sm leading-relaxed text-pearl">
                {message.content}
              </div>
            ) : (
              <div className="max-w-[92%] rounded-2xl rounded-bl-md border border-line bg-surface px-4 py-3 shadow-card">
                <p className="whitespace-pre-wrap text-sm leading-relaxed text-ink">
                  {renderWithCitations(message.content)}
                  {streaming && i === messages.length - 1 && (
                    <span className="ml-0.5 inline-block h-3.5 w-1.5 animate-pulse bg-accent align-middle" />
                  )}
                </p>
                {message.sources && message.sources.length > 0 && (
                  <div className="mt-2.5 flex flex-wrap gap-1.5 border-t border-line pt-2.5">
                    {message.sources.map((source) => (
                      <span
                        key={source.chunk_id}
                        className="rounded-full border border-line bg-pearl px-2 py-0.5 text-[11px] text-ink-2"
                        title={`Relevance ${(source.relevance_score * 100).toFixed(0)}%`}
                      >
                        <span className="font-semibold text-accent">{source.reference}</span>{' '}
                        {source.source_file}
                        {source.page_number ? ` · p.${source.page_number}` : ''}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="border-t border-line p-3 lg:p-4">
        <div className="flex items-center gap-2 rounded-xl border border-line bg-surface px-3 py-1.5 shadow-card transition focus-within:border-accent">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                send()
              }
            }}
            placeholder={folderId ? 'Ask about this folder…' : 'Ask about your sources…'}
            className="w-full bg-transparent py-1.5 text-sm outline-none placeholder:text-ink-3"
          />
          <button
            onClick={send}
            disabled={streaming || !input.trim()}
            title="Send"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-accent text-pearl transition hover:bg-accent-deep disabled:cursor-not-allowed disabled:opacity-40"
          >
            <ArrowUp className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  )
}
