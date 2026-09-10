export interface TextBlock {
  index: number
  text: string
  start: number
  end: number
}

const MAX_BLOCK_CHARS = 1200
const SENTENCE_TERMINATORS = ['. ', '? ', '! ']

function boundary(content: string, start: number, end: number, reflow: boolean) {
  const terminators = reflow ? SENTENCE_TERMINATORS : [...SENTENCE_TERMINATORS, '\n']
  const halfway = start + (end - start) / 2
  let best = -1

  for (const terminator of terminators) {
    const at = content.lastIndexOf(terminator, end - 1)
    if (at < start) continue
    const candidate = at + terminator.length
    if (candidate > best) best = candidate
  }

  return best > halfway ? best : -1
}

function push(blocks: TextBlock[], content: string, start: number, end: number) {
  let from = start
  let to = end
  while (from < to && /\s/.test(content[from])) from += 1
  while (to > from && /\s/.test(content[to - 1])) to -= 1
  if (to > from) {
    blocks.push({ index: blocks.length, text: content.slice(from, to), start: from, end: to })
  }
}

export function segmentBlocks(content: string, reflow: boolean): TextBlock[] {
  const blocks: TextBlock[] = []
  let cursor = 0

  while (cursor < content.length) {
    const separator = content.indexOf('\n\n', cursor)
    const paragraphEnd = separator === -1 ? content.length : separator

    if (paragraphEnd - cursor <= MAX_BLOCK_CHARS) {
      push(blocks, content, cursor, paragraphEnd)
    } else {
      let start = cursor
      while (start < paragraphEnd) {
        let end = Math.min(start + MAX_BLOCK_CHARS, paragraphEnd)
        if (end < paragraphEnd) {
          const at = boundary(content, start, end, reflow)
          if (at > start) end = at
        }
        push(blocks, content, start, end)
        start = end
      }
    }

    cursor = separator === -1 ? content.length : separator + 2
  }

  return blocks
}
