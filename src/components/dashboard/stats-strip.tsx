import type { DashboardStats } from '@/lib/types'

function Tile({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="px-4 py-3.5">
      <p className="text-xs font-medium text-ink-3">{label}</p>
      <p className="mt-1 text-xl font-semibold tracking-tight tabular-nums">{value}</p>
      {sub && <p className="mt-0.5 text-xs text-ink-3">{sub}</p>}
    </div>
  )
}

export default function StatsStrip({ stats }: { stats: DashboardStats }) {
  const sourceSub = [
    stats.ready > 0 ? `${stats.ready} ready` : null,
    stats.processing > 0 ? `${stats.processing} processing` : null,
  ]
    .filter(Boolean)
    .join(' · ')

  return (
    <div className="grid grid-cols-2 divide-line overflow-hidden rounded-2xl border border-line bg-surface shadow-card sm:grid-cols-3 lg:grid-cols-5 lg:divide-x">
      <Tile label="Folders" value={String(stats.folders)} />
      <Tile
        label="Sources"
        value={String(stats.sources)}
        sub={sourceSub || undefined}
      />
      <Tile label="Passages indexed" value={stats.passages.toLocaleString('en-US')} />
      <Tile label="Notes" value={String(stats.notes)} />
      <div className="col-span-2 sm:col-span-1">
        {stats.cardsTotal === 0 ? (
          <Tile label="Cards mastered" value="—" sub="No deck yet" />
        ) : (
          <Tile
            label="Cards mastered"
            value={`${stats.cardsMastered}/${stats.cardsTotal}`}
          />
        )}
      </div>
    </div>
  )
}
