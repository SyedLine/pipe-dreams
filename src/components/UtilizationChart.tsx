import { useMemo, useRef, useState } from 'react'
import type { Data } from '../data'
import { formatAsOf } from '../data'
import { SourceTag } from './ui'

// Validated (dataviz validator, dark surface #18181b): blue/orange, ΔE 26.8 worst CVD.
const SERIES = [
  { key: 'mainline', name: 'Mainline', color: '#3987e5' },
  { key: 'tmx', name: 'TMX', color: '#d95926' },
] as const

const W = 300
const H = 132
const PAD = { l: 30, r: 8, t: 8, b: 18 }
const Y_MIN = 70
const Y_MAX = 105
const TIGHT = 95
const MONTHS = 24

export default function UtilizationChart({ data }: { data: Data }) {
  const svgRef = useRef<SVGSVGElement>(null)
  const [hover, setHover] = useState<number | null>(null)

  const { months, series } = useMemo(() => {
    const all = SERIES.map((s) => data.throughput[s.key].history)
    const months = [...new Set(all.flat().map((h) => h.month))].sort().slice(-MONTHS)
    const series = SERIES.map((s, i) => {
      const byMonth = new Map(all[i].map((h) => [h.month, h]))
      return {
        ...s,
        points: months.map((m) => {
          const h = byMonth.get(m)
          return h ? { ...h, pct: (h.throughputKbd / h.capacityKbd) * 100 } : null
        }),
      }
    })
    return { months, series }
  }, [data])

  const x = (i: number) => PAD.l + (i / Math.max(1, months.length - 1)) * (W - PAD.l - PAD.r)
  const y = (pct: number) => PAD.t + (1 - (Math.min(Y_MAX, Math.max(Y_MIN, pct)) - Y_MIN) / (Y_MAX - Y_MIN)) * (H - PAD.t - PAD.b)
  const path = (pts: (null | { pct: number })[]) =>
    pts.reduce((d, p, i) => (p ? `${d}${d && pts[i - 1] ? 'L' : 'M'}${x(i).toFixed(1)},${y(p.pct).toFixed(1)}` : d), '')

  const latest = series.map((s) => [...s.points].reverse().find(Boolean)!)
  const onMove = (e: React.PointerEvent) => {
    const r = svgRef.current!.getBoundingClientRect()
    const px = ((e.clientX - r.left) / r.width) * W
    const i = Math.round(((px - PAD.l) / (W - PAD.l - PAD.r)) * (months.length - 1))
    setHover(Math.max(0, Math.min(months.length - 1, i)))
  }
  const hi = hover ?? months.length - 1

  return (
    <figure>
      <figcaption>
        <h2 className="text-sm font-semibold text-zinc-100">How close is egress to tight?</h2>
        <p className="text-[11px] text-zinc-500">Throughput as % of available capacity, monthly</p>
      </figcaption>

      {/* Headline numbers double as the legend (line key + name + latest value) */}
      <div className="mt-2 flex gap-4">
        {series.map((s, i) => (
          <div key={s.key} className="min-w-0">
            <div className="flex items-center gap-1.5 text-[11px] text-zinc-400">
              <svg width="14" height="4" aria-hidden>
                <line x1="1" y1="2" x2="13" y2="2" stroke={s.color} strokeWidth="2" strokeLinecap="round" />
              </svg>
              {s.name}
            </div>
            <div className="font-mono text-lg font-semibold tabular-nums text-zinc-100">
              {latest[i].pct.toFixed(0)}%
              {latest[i].pct >= TIGHT && (
                <span className="ml-1.5 align-middle font-sans text-[10px] font-medium uppercase tracking-wide text-zinc-400">
                  ▲ tight
                </span>
              )}
            </div>
          </div>
        ))}
      </div>

      <div className="relative mt-1">
        <svg
          ref={svgRef}
          viewBox={`0 0 ${W} ${H}`}
          className="w-full touch-none select-none"
          role="img"
          aria-label={`Utilization over the last ${months.length} months. Latest ${formatAsOf(months.at(-1)!)}: ${series
            .map((s, i) => `${s.name} ${latest[i].pct.toFixed(0)}%`)
            .join(', ')}.`}
          onPointerMove={onMove}
          onPointerLeave={() => setHover(null)}
          onPointerDown={onMove}
        >
          {/* Tight band */}
          <rect x={PAD.l} y={y(Y_MAX)} width={W - PAD.l - PAD.r} height={y(TIGHT) - y(Y_MAX)} fill="rgb(255 255 255 / 0.05)" />
          <text x={PAD.l + 3} y={y(Y_MAX) + 8} className="fill-zinc-500 text-[8px]">
            tight ≥ {TIGHT}%
          </text>
          {/* Recessive grid */}
          {[70, 80, 90, 100].map((v) => (
            <g key={v}>
              <line x1={PAD.l} x2={W - PAD.r} y1={y(v)} y2={y(v)} stroke="rgb(255 255 255 / 0.06)" />
              <text x={PAD.l - 4} y={y(v) + 3} textAnchor="end" className="fill-zinc-500 text-[8px] tabular-nums">
                {v}%
              </text>
            </g>
          ))}
          {[0, Math.floor((months.length - 1) / 2), months.length - 1].map((i) => (
            <text key={i} x={x(i)} y={H - 4} textAnchor={i === 0 ? 'start' : i === months.length - 1 ? 'end' : 'middle'} className="fill-zinc-500 text-[8px]">
              {formatAsOf(months[i])}
            </text>
          ))}
          {/* Crosshair */}
          {hover != null && <line x1={x(hi)} x2={x(hi)} y1={PAD.t} y2={H - PAD.b} stroke="rgb(255 255 255 / 0.25)" />}
          {series.map((s) => (
            <path key={s.key} d={path(s.points)} fill="none" stroke={s.color} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
          ))}
          {series.map((s) => {
            const p = s.points[hi]
            return p ? <circle key={s.key} cx={x(hi)} cy={y(p.pct)} r="3.5" fill={s.color} stroke="#18181b" strokeWidth="2" /> : null
          })}
        </svg>

        {/* Tooltip: values lead, one row per series */}
        {hover != null && (
          <div
            className="pointer-events-none absolute top-0 z-10 rounded-lg border border-white/10 bg-zinc-950/90 px-2.5 py-1.5 text-[11px] shadow-xl"
            style={{ left: `${(x(hi) / W) * 100}%`, transform: `translateX(${hi > months.length / 2 ? '-105%' : '5%'})` }}
          >
            <div className="mb-0.5 text-zinc-400">{formatAsOf(months[hi])}</div>
            {series.map((s) => {
              const p = s.points[hi]
              return (
                <div key={s.key} className="flex items-center gap-1.5 whitespace-nowrap">
                  <svg width="10" height="4" aria-hidden>
                    <line x1="1" y1="2" x2="9" y2="2" stroke={s.color} strokeWidth="2" />
                  </svg>
                  <span className="font-mono font-semibold text-zinc-100">{p ? `${p.pct.toFixed(1)}%` : '—'}</span>
                  <span className="text-zinc-500">
                    {s.name}
                    {p && ` · ${p.throughputKbd.toLocaleString()} / ${p.capacityKbd.toLocaleString()} kb/d`}
                  </span>
                </div>
              )
            })}
          </div>
        )}
      </div>

      <div className="mt-1 flex flex-wrap items-center justify-between gap-2">
        <SourceTag s={data.throughput.mainline} />
        <details className="text-[11px] text-zinc-500">
          <summary className="cursor-pointer hover:text-zinc-300">Table</summary>
          <div className="mt-1 max-h-40 overflow-auto">
            <table className="w-full text-right tabular-nums">
              <thead>
                <tr className="text-zinc-400">
                  <th className="pr-2 text-left font-normal">Month</th>
                  {series.map((s) => (
                    <th key={s.key} className="pl-2 font-normal">
                      {s.name}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {[...months].reverse().map((m) => (
                  <tr key={m}>
                    <td className="pr-2 text-left">{formatAsOf(m)}</td>
                    {series.map((s) => {
                      const p = s.points[months.indexOf(m)]
                      return (
                        <td key={s.key} className="pl-2 text-zinc-300">
                          {p ? `${p.pct.toFixed(1)}%` : '—'}
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      </div>
    </figure>
  )
}
