const RAIL_SOURCES = [
  { name: 'cell-respiration.pdf', status: 'ready', checked: true },
  { name: 'glycolysis-notes.md', status: 'ready', checked: true },
  { name: 'krebs-cycle.pdf', status: 'ready', checked: true },
  { name: 'lecture-04.txt', status: 'processing', checked: false },
]

const STATUS_DOT: Record<string, string> = {
  pending: 'bg-amber-400',
  processing: 'bg-sky-400',
  ready: 'bg-emerald-400',
  failed: 'bg-red-400',
}

const PARAGRAPHS = [
  'Glycolysis runs in the cytosol and needs no oxygen. One glucose molecule is split into two molecules of pyruvate, yielding a net gain of two ATP and two NADH.',
  'Because the cycle turns twice per glucose, the yield of reduced carriers is doubled, and it is those carriers — not ATP directly — that drive the bulk of the energy harvest downstream.',
]

function Citation({ index }: { index: number }) {
  return (
    <span className="mx-0.5 align-super text-[8px] font-semibold text-accent">{`[${index}]`}</span>
  )
}

export default function WorkspaceMock() {
  return (
    <div
      aria-hidden="true"
      className="overflow-hidden rounded-2xl border border-line bg-surface shadow-pop"
    >
      <div className="flex items-center justify-between gap-3 border-b border-line bg-surface px-3 py-2">
        <div className="flex min-w-0 items-center gap-2">
          <span className="shrink-0 text-[10px] text-ink-3">Library</span>
          <span className="h-3 w-px shrink-0 bg-line" />
          <span className="truncate text-[11px] font-semibold tracking-tight">
            Cellular Biology
          </span>
          <span className="hidden truncate text-[10px] text-ink-3 sm:inline">
            cell-respiration.pdf
          </span>
        </div>
        <div className="hidden shrink-0 rounded-md border border-line bg-pearl p-0.5 sm:flex">
          <span className="rounded bg-surface px-2 py-0.5 text-[10px] font-medium text-ink shadow-card">
            Read
          </span>
          <span className="px-2 py-0.5 text-[10px] font-medium text-ink-3">Original</span>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-[9rem_minmax(0,1fr)_11rem]">
        <div className="hidden border-r border-line bg-surface md:block">
          <div className="flex items-center justify-between border-b border-line px-3 py-2">
            <span className="text-[11px] font-semibold tracking-tight">Sources</span>
            <span className="text-[9px] text-ink-3">3/3 in scope</span>
          </div>
          <ul className="divide-y divide-line">
            {RAIL_SOURCES.map((source) => (
              <li key={source.name} className="flex items-center gap-1.5 px-2.5 py-1.5">
                <span
                  className={`h-2.5 w-2.5 shrink-0 rounded-[3px] border ${
                    source.checked ? 'border-accent bg-accent' : 'border-line-2 bg-surface'
                  }`}
                />
                <span
                  className={`h-1 w-1 shrink-0 rounded-full ${STATUS_DOT[source.status]} ${
                    source.status === 'processing' ? 'animate-pulse' : ''
                  }`}
                />
                <span className="truncate text-[10px] text-ink-2">{source.name}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="relative bg-pearl px-5 py-5 sm:px-8">
          <p className="text-[13px] leading-7 text-ink sm:text-[14px]">
            {PARAGRAPHS[0]}
            <Citation index={1} />
          </p>
          <p className="mt-4 text-[13px] leading-7 text-ink sm:text-[14px]">
            The pyruvate then crosses into the{' '}
            <mark className="rounded-[2px] bg-[#fde68a]">mitochondrial matrix</mark>, where the
            citric acid cycle completes the oxidation and hands its electrons to the transport
            chain.
            <Citation index={2} />
          </p>
          <p className="mt-4 text-[13px] leading-7 text-ink sm:text-[14px]">{PARAGRAPHS[1]}</p>
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-14 bg-gradient-to-t from-pearl to-transparent" />
        </div>

        <div className="hidden border-l border-line bg-surface md:flex md:flex-col">
          <div className="border-b border-line px-2 py-1.5">
            <div className="flex rounded-md border border-line bg-pearl p-0.5">
              <span className="flex-1 rounded bg-surface px-1 py-0.5 text-center text-[9px] font-medium text-ink shadow-card">
                Assistant
              </span>
              <span className="flex-1 px-1 py-0.5 text-center text-[9px] font-medium text-ink-2">
                Notes · 1
              </span>
            </div>
            <p className="mt-1.5 px-0.5 text-[9px] text-ink-3">Searching 3 sources</p>
          </div>

          <div className="flex-1 space-y-2 px-2.5 py-3">
            <div className="ml-auto w-4/5 rounded-lg rounded-br-sm bg-accent-soft px-2 py-1.5 text-[9px] leading-relaxed text-accent-deep">
              Where does the citric acid cycle run?
            </div>
            <div className="w-11/12 rounded-lg rounded-bl-sm border border-line bg-pearl px-2 py-1.5 text-[9px] leading-relaxed text-ink-2">
              In the mitochondrial matrix, after pyruvate is transported across the inner
              membrane.
              <Citation index={1} />
              <span className="mt-1.5 block border-t border-line pt-1.5 text-[8px] text-ink-3">
                cell-respiration.pdf · p.42
              </span>
            </div>
          </div>

          <div className="border-t border-line p-2">
            <div className="flex items-center gap-1.5 rounded-lg border border-line bg-pearl px-2 py-1.5">
              <span className="flex-1 text-[9px] text-ink-3">Ask about these sources…</span>
              <span className="flex h-4 w-4 items-center justify-center rounded bg-accent text-[8px] text-pearl">
                ↑
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
