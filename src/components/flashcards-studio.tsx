'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { GraduationCap, Sparkles } from 'lucide-react'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import type { DocumentRow, FlashcardRow } from '@/lib/types'

function shuffle<T>(items: T[]): T[] {
  const copy = [...items]
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[copy[i], copy[j]] = [copy[j], copy[i]]
  }
  return copy
}

export default function FlashcardsStudio() {
  const [documents, setDocuments] = useState<DocumentRow[]>([])
  const [cards, setCards] = useState<FlashcardRow[]>([])
  const [generating, setGenerating] = useState<string | null>(null)
  const [deck, setDeck] = useState<FlashcardRow[] | null>(null)
  const [deckName, setDeckName] = useState('')
  const [index, setIndex] = useState(0)
  const [flipped, setFlipped] = useState(false)
  const [knownCount, setKnownCount] = useState(0)
  const [finished, setFinished] = useState(false)

  const load = useCallback(async () => {
    const supabase = createClient()
    const [docRes, cardRes] = await Promise.all([
      supabase
        .from('documents')
        .select('*')
        .eq('status', 'ready')
        .order('created_at', { ascending: false }),
      supabase.from('flashcards').select('*'),
    ])
    if (docRes.error) toast.error(docRes.error.message)
    if (cardRes.error) toast.error(cardRes.error.message)
    setDocuments((docRes.data ?? []) as DocumentRow[])
    setCards((cardRes.data ?? []) as FlashcardRow[])
  }, [])

  useEffect(() => {
    const init = async () => {
      await load()
    }
    init()
  }, [load])

  async function generate(documentId: string) {
    setGenerating(documentId)
    try {
      const res = await fetch('/api/flashcards/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ document_id: documentId }),
      })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(body.error ?? `status ${res.status}`)
      toast.success(`${body.cards.length} flashcards generated`)
      await load()
      openDeck(documentId)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Generation failed')
    } finally {
      setGenerating(null)
    }
  }

  async function toggleMastered(card: FlashcardRow, mastered: boolean) {
    const supabase = createClient()
    const { error } = await supabase
      .from('flashcards')
      .update({ mastered })
      .eq('id', card.id)
    if (error) toast.error(error.message)
    setCards((prev) => prev.map((c) => (c.id === card.id ? { ...c, mastered } : c)))
  }

  async function openDeck(documentId: string) {
    const supabase = createClient()
    const { data, error } = await supabase
      .from('flashcards')
      .select('*')
      .eq('document_id', documentId)
      .order('created_at')
    if (error) {
      toast.error(error.message)
      return
    }
    const rows = (data ?? []) as FlashcardRow[]
    if (rows.length === 0) {
      toast.error('No cards in this deck yet')
      return
    }
    const doc = documents.find((d) => d.id === documentId)
    setDeckName(doc?.name ?? 'Deck')
    setDeck(shuffle(rows))
    setIndex(0)
    setFlipped(false)
    setKnownCount(0)
    setFinished(false)
  }

  function advance(known: boolean) {
    if (!deck) return
    const current = deck[index]
    toggleMastered(current, known)
    if (known) setKnownCount((n) => n + 1)
    if (index + 1 >= deck.length) {
      setFinished(true)
    } else {
      setIndex((i) => i + 1)
      setFlipped(false)
    }
  }

  const cardsFor = (documentId: string) => cards.filter((c) => c.document_id === documentId)

  if (deck) {
    const current = deck[Math.min(index, deck.length - 1)]
    return (
      <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-pearl px-4">
        <div className="mb-6 flex w-full max-w-xl items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold tracking-tight">{deckName}</h3>
            <p className="text-sm text-ink-2">
              {finished ? 'Session complete' : `Card ${index + 1} of ${deck.length}`}
            </p>
          </div>
          <button
            onClick={() => setDeck(null)}
            className="rounded-lg border border-line bg-surface px-3 py-1.5 text-sm text-ink-2 transition hover:border-line-2 hover:text-ink"
          >
            Exit
          </button>
        </div>

        {finished ? (
          <div className="w-full max-w-xl rounded-2xl border border-line bg-surface p-10 text-center shadow-pop">
            <p className="text-3xl font-semibold tracking-tight">
              {knownCount} / {deck.length}
            </p>
            <p className="mt-2 text-sm text-ink-3">cards answered from memory</p>
            <div className="mt-8 flex justify-center gap-3">
              <button
                onClick={() => openDeck(current.document_id ?? '')}
                className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-pearl transition hover:bg-accent-deep"
              >
                Study again
              </button>
              <button
                onClick={() => setDeck(null)}
                className="rounded-lg border border-line bg-surface px-4 py-2 text-sm text-ink-2 transition hover:border-line-2 hover:text-ink"
              >
                Back to decks
              </button>
            </div>
          </div>
        ) : (
          <>
            <button
              onClick={() => setFlipped((v) => !v)}
              className="h-80 w-full max-w-xl [perspective:1200px]"
            >
              <div
                className={`relative h-full w-full transition-transform duration-500 [transform-style:preserve-3d] ${
                  flipped ? '[transform:rotateY(180deg)]' : ''
                }`}
              >
                <div className="absolute inset-0 flex items-center justify-center rounded-2xl border border-line bg-surface p-8 shadow-pop [backface-visibility:hidden]">
                  <p className="text-center text-lg leading-relaxed text-ink">
                    {current.question}
                  </p>
                </div>
                <div className="absolute inset-0 flex items-center justify-center rounded-2xl border border-accent/30 bg-accent-soft p-8 shadow-pop [backface-visibility:hidden] [transform:rotateY(180deg)]">
                  <p className="text-center text-lg leading-relaxed text-ink">
                    {current.answer}
                  </p>
                </div>
              </div>
            </button>
            <p className="mt-3 text-xs text-ink-2">Click the card to flip it</p>
            <div className="mt-6 flex gap-3">
              <button
                onClick={() => advance(false)}
                className="rounded-lg border border-line bg-surface px-6 py-2.5 text-sm text-ink-2 transition hover:border-red-300 hover:text-red-500"
              >
                Still learning
              </button>
              <button
                onClick={() => advance(true)}
                className="rounded-lg bg-emerald-600 px-6 py-2.5 text-sm font-medium text-white transition hover:bg-emerald-500"
              >
                Knew it
              </button>
            </div>
          </>
        )}
      </div>
    )
  }

  return (
    <div className="mx-auto w-full max-w-5xl space-y-6 p-6 lg:p-8">
      <div>
        <h2 className="text-xl font-semibold tracking-tight">Flashcards</h2>
        <p className="mt-1 text-sm text-ink-2">
          Generate a deck from any ingested source, then study it
        </p>
      </div>

      {documents.length === 0 ? (
        <div className="rounded-2xl border border-line bg-surface px-6 py-10 text-center shadow-card">
          <span className="mx-auto flex h-10 w-10 items-center justify-center rounded-xl border border-line bg-pearl text-accent">
            <GraduationCap className="h-4.5 w-4.5" />
          </span>
          <p className="mt-3 text-sm font-medium text-ink">No ready sources yet</p>
          <p className="mx-auto mt-1.5 max-w-sm text-sm leading-relaxed text-ink-3">
            Upload documents and wait for ingestion to finish, then come back to generate decks.
          </p>
          <Link
            href="/dashboard"
            className="mt-4 inline-block rounded-lg bg-accent px-4 py-2 text-sm font-medium text-pearl transition hover:bg-accent-deep"
          >
            Go to sources
          </Link>
        </div>
      ) : (
        <ul className="divide-y divide-line overflow-hidden rounded-2xl border border-line bg-surface shadow-card">
          {documents.map((doc) => {
            const docCards = cardsFor(doc.id)
            const mastered = docCards.filter((c) => c.mastered).length
            return (
              <li key={doc.id} className="flex items-center gap-3 px-4 py-3 transition hover:bg-pearl/60">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-ink">{doc.name}</p>
                  <p className="mt-0.5 text-xs text-ink-3">
                    {docCards.length === 0
                      ? 'No cards yet'
                      : `${docCards.length} cards · ${mastered} mastered`}
                  </p>
                </div>
                {docCards.length > 0 && (
                  <button
                    onClick={() => openDeck(doc.id)}
                    className="rounded-lg border border-line px-3 py-1.5 text-sm text-ink-2 transition hover:border-accent/40 hover:bg-accent-soft hover:text-accent-deep"
                  >
                    Study
                  </button>
                )}
                <button
                  onClick={() => generate(doc.id)}
                  disabled={generating !== null}
                  className="flex items-center gap-1.5 rounded-lg bg-accent px-3 py-1.5 text-sm font-medium text-pearl transition hover:bg-accent-deep disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <Sparkles className="h-3.5 w-3.5" />
                  {generating === doc.id ? 'Generating…' : 'Generate'}
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
