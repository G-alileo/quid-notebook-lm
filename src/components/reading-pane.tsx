'use client'

import { useMemo, useRef, useState } from 'react'
import type { TextBlock } from '@/lib/text-blocks'
import type { HighlightRow } from '@/lib/types'
import { blockSegments } from '@/lib/highlight-ranges'

export const HIGHLIGHT_COLORS = [
  '#fde68a',
  '#bbf7d0',
  '#bae6fd',
  '#fecaca',
  '#ddd6fe',
  '#e5e7eb',
]

interface PendingSelection {
  start: number
  end: number
  text: string
  x: number
  y: number
  width: number
}

function offsetIn(container: HTMLElement, node: Node, nodeOffset: number): number | null {
  const element = node.nodeType === Node.TEXT_NODE ? node.parentElement : (node as Element)
  const block = element?.closest<HTMLElement>('[data-start]')
  if (!block || !container.contains(block)) return null

  const start = Number(block.dataset.start)
  if (!Number.isFinite(start)) return null

  const range = document.createRange()
  range.selectNodeContents(block)
  range.setEnd(node, nodeOffset)
  return start + range.toString().length
}

export default function ReadingPane({
  view,
  name,
  status,
  blocks,
  pdfUrl,
  chunkCount,
  reflow = false,
  highlights = [],
  flashId = null,
  onCreateHighlight,
  onOpenHighlight,
}: {
  view: 'read' | 'original'
  name: string
  status: string
  blocks: TextBlock[]
  pdfUrl: string | null
  chunkCount: number
  reflow?: boolean
  highlights?: HighlightRow[]
  flashId?: string | null
  onCreateHighlight?: (start: number, end: number, text: string, color: string) => void
  onOpenHighlight?: (id: string) => void
}) {
  const articleRef = useRef<HTMLElement>(null)
  const [pending, setPending] = useState<PendingSelection | null>(null)

  const segments = useMemo(
    () => blocks.map((block) => blockSegments(block, highlights)),
    [blocks, highlights]
  )

  if (view === 'original' && pdfUrl) {
    return <iframe src={pdfUrl} title={name} className="h-full w-full" />
  }

  function captureSelection() {
    const article = articleRef.current
    if (!article || !onCreateHighlight) return

    const selection = window.getSelection()
    if (!selection || selection.rangeCount === 0 || selection.isCollapsed) {
      setPending(null)
      return
    }

    const range = selection.getRangeAt(0)
    const anchor = offsetIn(article, range.startContainer, range.startOffset)
    const focus = offsetIn(article, range.endContainer, range.endOffset)
    if (anchor === null || focus === null) {
      setPending(null)
      return
    }

    const raw = range.toString()
    const text = (reflow ? raw.replace(/\s+/g, ' ') : raw).trim()
    if (!text) {
      setPending(null)
      return
    }

    const rect = range.getBoundingClientRect()
    const articleRect = article.getBoundingClientRect()
    setPending({
      start: Math.min(anchor, focus),
      end: Math.max(anchor, focus),
      text,
      x: rect.left - articleRect.left + rect.width / 2,
      y: rect.top - articleRect.top,
      width: articleRect.width,
    })
  }

  function commit(color: string) {
    if (!pending || !onCreateHighlight) return
    onCreateHighlight(pending.start, pending.end, pending.text, color)
    setPending(null)
    window.getSelection()?.removeAllRanges()
  }

  return (
    <article
      ref={articleRef}
      className="relative mx-auto max-w-[66ch] px-6 py-10"
      onMouseUp={captureSelection}
      onKeyUp={captureSelection}
      onClick={(event) => {
        const mark = (event.target as Element).closest?.('[data-highlight]')
        const id = mark?.getAttribute('data-highlight')
        if (id && onOpenHighlight) onOpenHighlight(id)
      }}
    >
      {pending && (
        <div
          className="absolute z-20 flex -translate-x-1/2 items-center gap-1 rounded-xl border border-line bg-surface p-1.5 shadow-pop"
          style={{
            left: Math.max(56, Math.min(pending.x, pending.width - 56)),
            top: Math.max(0, pending.y - 44),
          }}
          onMouseDown={(event) => event.preventDefault()}
        >
          {HIGHLIGHT_COLORS.map((color) => (
            <button
              key={color}
              onClick={() => commit(color)}
              aria-label={`Highlight in ${color}`}
              title={`Highlight in ${color}`}
              className="h-5 w-5 rounded-full transition hover:scale-110"
              style={{ backgroundColor: color }}
            />
          ))}
        </div>
      )}

      {status !== 'ready' && blocks.length === 0 && (
        <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          {status === 'failed'
            ? 'Ingestion failed for this source, so there is nothing to read yet.'
            : 'This source is still being processed. The readable text appears here when ingestion finishes.'}
        </p>
      )}

      {blocks.length > 0 ? (
        blocks.map((block, position) => (
          <p
            key={block.index}
            data-block={block.index}
            data-start={block.start}
            className={`reading-block mb-5 text-[16.5px] leading-8 text-ink last:mb-0 ${
              reflow ? '' : 'whitespace-pre-line'
            }`}
          >
            {segments[position].map((segment, index) =>
              segment.highlightId ? (
                <mark
                  key={index}
                  data-highlight={segment.highlightId}
                  className={`cursor-pointer rounded-[2px] transition ${
                    flashId === segment.highlightId ? 'ring-2 ring-accent ring-offset-1' : ''
                  }`}
                  style={{ backgroundColor: segment.color ?? undefined }}
                >
                  {segment.text}
                </mark>
              ) : (
                <span key={index}>{segment.text}</span>
              )
            )}
          </p>
        ))
      ) : (
        status === 'ready' && (
          <p className="text-sm text-ink-3">
            No readable text was stored for this source ({chunkCount} chunks indexed for chat).
          </p>
        )
      )}
    </article>
  )
}
