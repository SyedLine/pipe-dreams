import { useMemo, useState } from 'react'
import { card, Money, tipFor } from '../components/ui'
import type { DestResult, Inputs, LaneResult, Results } from '../netback'

interface Props {
  results: Results
  inputs: Inputs
}

interface Row {
  lane: LaneResult
  d: DestResult
}

type Sort = 'netback' | 'uplift'

/**
 * One card per destination with a horizontal waterfall:
 * benchmark (dot) → each adjustment (segment) → netback (accent dot).
 * All cards share one $ scale so their positions are comparable; no bar is
 * drawn from zero, so the axis can start near the prices without distorting length.
 */
export default function NetbacksTab({ results, inputs }: Props) {
  const [sort, setSort] = useState<Sort>('netback')
  const hardisty = inputs.wti - inputs.wcsDiff

  const rows = useMemo(() => {
    const all: Row[] = (Object.values(results) as LaneResult[]).flatMap((lane) => lane.dests.map((d) => ({ lane, d })))
    const key = (r: Row) => (sort === 'netback' ? r.d.netback : r.d.uplift)
    return all.sort((a, b) => Number(a.lane.offline) - Number(b.lane.offline) || key(b) - key(a))
  }, [results, sort])

  // Shared domain across every card (rounded to $5)
  const [lo, hi] = useMemo(() => {
    let mn = hardisty
    let mx = hardisty
    for (const { d } of rows) {
      let v = 0
      for (const s of d.steps) {
        v = s === d.steps[0] ? s.value : v + s.value
        mn = Math.min(mn, v)
        mx = Math.max(mx, v)
      }
    }
    return [Math.floor((mn - 1) / 5) * 5, Math.ceil((mx + 1) / 5) * 5]
  }, [rows, hardisty])

  const topNetback = rows.find((r) => !r.lane.offline)?.d

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-6xl px-4 py-6 md:px-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-[22px] font-semibold tracking-tight">Netbacks</h1>
            <p className="mt-1 max-w-xl text-[13px] text-muted">
              Every destination, from benchmark price to what the barrel is worth back at Hardisty. Dashed line: WCS at Hardisty (
              <Money value={hardisty} extra="WTI − WTI–WCS differential" />
              ).
            </p>
          </div>
          <div role="radiogroup" aria-label="Sort by" className="flex rounded-lg bg-sunken p-0.5 text-[12px] font-medium">
            {(
              [
                ['netback', 'Netback'],
                ['uplift', 'vs Hardisty'],
              ] as const
            ).map(([k, label]) => (
              <button
                key={k}
                role="radio"
                aria-checked={sort === k}
                onClick={() => setSort(k)}
                className={`rounded-md px-3 py-1.5 ${sort === k ? 'bg-surface text-fg shadow-sm' : 'text-muted hover:text-fg'}`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <ol className="mt-5 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
          {rows.map(({ lane, d }, i) => (
            <li key={`${lane.lane.id}:${d.dest.id}`}>
              <DestCard lane={lane} d={d} rank={lane.offline ? null : i + 1} top={d === topNetback} lo={lo} hi={hi} hardisty={hardisty} />
            </li>
          ))}
        </ol>
        <p className="mt-4 text-[12px] text-subtle">
          Scale ${lo}–${hi}/bbl, shared by all cards. Hover a row for its source; quality adjustments, freight and transfers are assumptions.
        </p>
      </div>
    </div>
  )
}

function DestCard({
  lane,
  d,
  rank,
  top,
  lo,
  hi,
  hardisty,
}: {
  lane: LaneResult
  d: DestResult
  rank: number | null
  top: boolean
  lo: number
  hi: number
  hardisty: number
}) {
  const x = (v: number) => `${((v - lo) / (hi - lo)) * 100}%`
  // Running total after each step: benchmark, then benchmark + each adjustment
  const totals = d.steps.reduce<number[]>((acc, s, i) => [...acc, i === 0 ? s.value : acc[i - 1] + s.value], [])
  const steps = d.steps.map((s, i) => ({ s, from: i === 0 ? s.value : totals[i - 1], to: totals[i] }))

  return (
    <article className={`${card} h-full p-4 ${lane.offline ? 'opacity-50' : ''} ${top ? 'border-accent' : ''}`}>
      <header className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            {rank != null && <span className="num text-[12px] font-medium text-subtle">#{rank}</span>}
            <h2 className="truncate text-[15px] font-semibold">{d.dest.name}</h2>
            {top && <span className="rounded-md bg-accent-soft px-1.5 py-0.5 text-[11px] font-semibold text-accent">Best</span>}
            {lane.offline && <span className="rounded-md bg-sunken px-1.5 py-0.5 text-[11px] font-medium text-muted">Offline</span>}
          </div>
          <p className="truncate text-[12px] text-muted">
            {lane.lane.name}
            {lane.lane.tag && <span className="text-subtle"> · {lane.lane.tag.label}</span>}
          </p>
        </div>
        <div className="text-right">
          <Money value={d.netback} className={`text-[20px] font-semibold tracking-tight ${top ? 'text-accent' : ''}`} extra="Netback to Hardisty, US$/bbl" tipPos="left" />
          <div className="whitespace-nowrap text-[12px] text-muted">
            <Money value={d.uplift} signed extra="Netback minus WCS at Hardisty" tipPos="left" /> vs Hardisty
          </div>
        </div>
      </header>

      {/* Waterfall */}
      <div className="mt-4 space-y-1.5" role="list" aria-label={`${d.dest.name} netback build-up`}>
        {steps.map(({ s, from, to }, i) => {
          const first = i === 0
          const left = Math.min(from, to)
          const width = Math.abs(to - from)
          return (
            <div key={s.label} role="listitem" className="grid grid-cols-[7.75rem_1fr_4.25rem] items-center gap-2 text-[12px]">
              <span className="truncate text-muted" title={s.label}>
                {s.label}
              </span>
              <div className="relative h-4" data-tip={tipFor(s.source, s.note)}>
                <Hardisty x={x(hardisty)} />
                {first ? (
                  <span className="absolute top-1/2 h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-fg" style={{ left: x(to) }} />
                ) : (
                  <>
                    <span
                      className="absolute top-1/2 h-2 -translate-y-1/2 rounded-[3px] bg-line-strong transition-all duration-300"
                      style={{ left: x(left), width: `max(2px, ${(width / (hi - lo)) * 100}%)` }}
                    />
                    {/* connector from the previous running total */}
                    <span className="absolute -top-1.5 h-1.5 w-px bg-line-strong" style={{ left: x(from) }} />
                  </>
                )}
              </div>
              <Money value={s.value} signed={!first} source={s.source} extra={s.note} className="text-right text-fg" tipPos="left" />
            </div>
          )
        })}
        <div className="grid grid-cols-[7.75rem_1fr_4.25rem] items-center gap-2 border-t border-line pt-1.5 text-[12px]">
          <span className="font-medium text-fg">Netback</span>
          <div className="relative h-4">
            <Hardisty x={x(hardisty)} />
            <span className="absolute -top-1.5 h-1.5 w-px bg-line-strong" style={{ left: x(d.netback) }} />
            <span
              className="absolute top-1/2 h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-accent ring-2 ring-surface transition-all duration-300"
              style={{ left: x(d.netback) }}
            />
          </div>
          <Money value={d.netback} className="text-right font-semibold" extra="Netback to Hardisty, US$/bbl" tipPos="left" />
        </div>
      </div>
      {d.dest.seaNm != null && (
        <p className="mt-2 text-[11px] text-subtle">
          <span className="num">≈{d.dest.seaNm.toLocaleString()} nm</span> from Westridge by tanker
        </p>
      )}
    </article>
  )
}

function Hardisty({ x }: { x: string }) {
  return <span aria-hidden className="absolute inset-y-[-3px] w-0 border-l border-dashed border-subtle" style={{ left: x }} />
}

