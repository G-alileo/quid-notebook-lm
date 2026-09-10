import type { TextBlock } from '@/lib/text-blocks'
import type { HighlightRow } from '@/lib/types'

export interface HighlightSegment {
  text: string
  highlightId: string | null
  color: string | null
}

export function blockSegments(block: TextBlock, highlights: HighlightRow[]): HighlightSegment[] {
  const cuts = new Set<number>([block.start, block.end])

  for (const highlight of highlights) {
    const { start_offset: from, end_offset: to } = highlight
    if (from === null || to === null) continue
    if (to <= block.start || from >= block.end) continue
    if (from > block.start) cuts.add(from)
    if (to < block.end) cuts.add(to)
  }

  const points = [...cuts].sort((a, b) => a - b)
  const segments: HighlightSegment[] = []

  for (let i = 0; i < points.length - 1; i += 1) {
    const from = points[i]
    const to = points[i + 1]
    if (to <= from) continue

    const covering = highlights
      .filter(
        (h) =>
          h.start_offset !== null &&
          h.end_offset !== null &&
          h.start_offset <= from &&
          h.end_offset >= to
      )
      .sort((a, b) => a.created_at.localeCompare(b.created_at))

    const top = covering[covering.length - 1] ?? null
    segments.push({
      text: block.text.slice(from - block.start, to - block.start),
      highlightId: top?.id ?? null,
      color: top?.color ?? null,
    })
  }

  return segments
}

export function blockForOffset(blocks: TextBlock[], offset: number): TextBlock | null {
  return blocks.find((block) => offset >= block.start && offset < block.end) ?? null
}
