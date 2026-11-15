import { useMemo, useRef, useState } from 'react'
import { card, Money, SourceTag, tipFor } from '../components/ui'
import type { Data, Throughput } from '../data'
import { formatAsOf, usd } from '../data'
import type { Inputs } from '../netback'

interface Props {
  data: Data
  inputs: Inputs
  pipeParity: number
  railParity: number
}

const TIGHT = 95
const MONTHS = 24

export default function EgressTab({ data, inputs, pipeParity, railParity }: Props) {
  const pipes = [
    { key: 'mainline', name: 'Enbridge Mainline', note: 'Exports at the ex-Gretna border point, all products', t: data.throughput.mainline },
    { key: 'tmx', name: 'Trans Mountain', note: 'System throughput, committed + uncommitted', t: data.throughput.tmx },
  ] as const

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-5xl space-y-6 px-4 py-6 md:px-6">
        <header>
          <h1 className="text-[22px] font-semibold tracking-tight">Egress</h1>
          <p className="mt-1 max-w-2xl text-[13px] text-muted">
            How close are the export pipes to full? When they&rsquo;re tight, the next barrel out of Alberta has to move by rail, and the WCS
            discount at Hardisty widens toward the cost of rail.
          </p>
        </header>

        <section className="grid gap-4 md:grid-cols-2">
          {pipes.map((p) => (
            <PipeCard key={p.key} name={p.name} note={p.note} t={p.t} />
          ))}
        </section>

        <DiffGauge data={data} diff={inputs.wcsDiff} pipeParity={pipeParity} railParity={railParity} />

        <p className="text-[12px] text-subtle">
          Keystone and Express don&rsquo;t publish comparable throughput in the CER open data, so only Mainline and TMX are shown.
        </p>
      </div>
    </div>
  )
}

// ── Throughput vs capacity, one chart per pipe ──────────────────────────────
function PipeCard({ name, note, t }: { name: string; note: string; t: Throughput }) {
  const svgRef = useRef<SVGSVGElement>(null)
  const [hover, setHover] = useState<number | null>(null)
  const pts = useMemo(
    () => t.history.slice(-MONTHS).map((h) => ({ ...h, pct: (h.throughputKbd / h.capacityKbd) * 100 })),
    [t],
  )
  const last = pts[pts.length - 1]
  const tightMonths = pts.filter((p) => p.pct >= TIGHT).length

  const W = 560
  const H = 200
  const PAD = { l: 48, r: 10, t: 10, b: 26 }
  const yMax = Math.ceil((Math.max(...pts.map((p) => Math.max(p.capacityKbd, p.throughputKbd))) * 1.08) / 500) * 500
  const x = (i: number) => PAD.l + (i / Math.max(1, pts.length - 1)) * (W - PAD.l - PAD.r)
  const y = (v: number) => PAD.t + (1 - v / yMax) * (H - PAD.t - PAD.b)
  const line = (k: 'throughputKbd' | 'capacityKbd') => pts.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(p[k]).toFixed(1)}`).join('')
  const area = `${line('throughputKbd')}L${x(pts.length - 1)},${y(0)}L${x(0)},${y(0)}Z`
  const ticks = Array.from({ length: 5 }, (_, i) => (yMax / 4) * i)

  const onMove = (e: React.PointerEvent) => {
    const r = svgRef.current!.getBoundingClientRect()
    const px = ((e.clientX - r.left) / r.width) * W
    setHover(Math.max(0, Math.min(pts.length - 1, Math.round(((px - PAD.l) / (W - PAD.l - PAD.r)) * (pts.length - 1)))))
  }
  const hp = hover != null ? pts[hover] : null

  return (
    <article className={`${card} p-5`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-[15px] font-semibold">{name}</h2>
          <p className="text-[12px] text-muted">{note}</p>
        </div>
        <div className="text-right">
          <div className="num text-[26px] font-semibold leading-none tracking-tight" data-tip={tipFor(t, `${last.throughputKbd.toLocaleString()} of ${last.capacityKbd.toLocaleString()} kb/d`)} data-tip-pos="left">
            {last.pct.toFixed(0)}%
          </div>
          <div className="mt-1 text-[12px] text-muted">
            {last.pct >= TIGHT ? 'Tight' : last.pct >= 90 ? 'Near full' : 'Has room'} · {formatAsOf(last.month)}
          </div>
        </div>
      </div>

      <div className="relative mt-4">
        <svg
          ref={svgRef}
          viewBox={`0 0 ${W} ${H}`}
          className="w-full touch-none select-none"
          role="img"
          aria-label={`${name}: throughput vs available capacity, last ${pts.length} months. Latest ${formatAsOf(last.month)}: ${last.throughputKbd.toLocaleString()} of ${last.capacityKbd.toLocaleString()} thousand barrels per day (${last.pct.toFixed(0)}%).`}
          onPointerMove={onMove}
          onPointerDown={onMove}
          onPointerLeave={() => setHover(null)}
        >
          {ticks.map((v) => (
            <g key={v}>
              <line x1={PAD.l} x2={W - PAD.r} y1={y(v)} y2={y(v)} stroke="var(--border)" />
              <text x={PAD.l - 6} y={y(v) + 3.5} textAnchor="end" fontSize="12" fill="var(--subtle)" className="num">
                {v >= 1000 ? `${(v / 1000).toFixed(1)}M` : `${v}k`}
              </text>
            </g>
          ))}
          {[0, Math.floor((pts.length - 1) / 2), pts.length - 1].map((i) => (
            <text key={i} x={x(i)} y={H - 7} fontSize="12" fill="var(--subtle)" textAnchor={i === 0 ? 'start' : i === pts.length - 1 ? 'end' : 'middle'}>
              {formatAsOf(pts[i].month)}
            </text>
          ))}
          <path d={area} fill="var(--accent)" opacity="0.14" />
          <path d={line('throughputKbd')} fill="none" stroke="var(--accent)" strokeWidth="2" strokeLinejoin="round" />
          <path d={line('capacityKbd')} fill="none" stroke="var(--muted)" strokeWidth="1.5" strokeDasharray="4 3" />
          {hp && (
            <>
              <line x1={x(hover!)} x2={x(hover!)} y1={PAD.t} y2={H - PAD.b} stroke="var(--border-strong)" />
              <circle cx={x(hover!)} cy={y(hp.throughputKbd)} r="4" fill="var(--accent)" stroke="var(--surface)" strokeWidth="2" />
            </>
          )}
        </svg>
        {hp && (
          <div
            className="pointer-events-none absolute top-0 z-10 rounded-lg border border-line-strong bg-elev px-2.5 py-1.5 text-[12px] shadow-xl"
            style={{ left: `${(x(hover!) / W) * 100}%`, transform: `translateX(${hover! > pts.length / 2 ? '-105%' : '5%'})` }}
          >
            <div className="text-muted">{formatAsOf(hp.month)}</div>
            <div className="num font-semibold">{hp.pct.toFixed(1)}% full</div>
            <div className="num text-muted">
              {hp.throughputKbd.toLocaleString()} / {hp.capacityKbd.toLocaleString()} kb/d
            </div>
          </div>
        )}
      </div>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-[12px]">
        <div className="flex items-center gap-4 text-muted">
          <span className="inline-flex items-center gap-1.5">
            <svg width="16" height="6" aria-hidden>
              <line x1="1" y1="3" x2="15" y2="3" stroke="var(--accent)" strokeWidth="2" />
            </svg>
            Throughput
          </span>
          <span className="inline-flex items-center gap-1.5">
            <svg width="16" height="6" aria-hidden>
              <line x1="1" y1="3" x2="15" y2="3" stroke="var(--muted)" strokeWidth="1.5" strokeDasharray="4 3" />
            </svg>
            Available capacity
          </span>
        </div>
        <span className="text-muted">
          <span className="num font-medium text-fg">{tightMonths}</span> of {pts.length} months ≥ {TIGHT}% full
        </span>
      </div>
      <div className="mt-2 flex items-center justify-between gap-2">
        <SourceTag s={t} />
        <details className="text-[12px] text-subtle">
          <summary className="cursor-pointer hover:text-fg">Table</summary>
          <div className="mt-2 max-h-48 overflow-auto">
            <table className="num w-full text-right">
              <thead className="text-muted">
                <tr>
                  <th className="pr-3 text-left font-normal">Month</th>
                  <th className="px-2 font-normal">kb/d</th>
                  <th className="px-2 font-normal">Capacity</th>
                  <th className="pl-2 font-normal">Full</th>
                </tr>
              </thead>
              <tbody className="text-fg">
                {[...pts].reverse().map((p) => (
                  <tr key={p.month}>
                    <td className="pr-3 text-left text-muted">{formatAsOf(p.month)}</td>
                    <td className="px-2">{p.throughputKbd.toLocaleString()}</td>
                    <td className="px-2">{p.capacityKbd.toLocaleString()}</td>
                    <td className="pl-2">{p.pct.toFixed(1)}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      </div>
    </article>
  )
}

// ── Where today's differential sits between pipe parity and rail ───────────
function DiffGauge({ data, diff, pipeParity, railParity }: { data: Data; diff: number; pipeParity: number; railParity: number }) {
  const lo = 0
  const hi = Math.ceil((Math.max(diff, railParity, pipeParity) + 4) / 5) * 5
  const x = (v: number) => `${((Math.min(hi, Math.max(lo, v)) - lo) / (hi - lo)) * 100}%`
  const span = railParity - pipeParity
  const tight = span > 0 ? Math.min(1, Math.max(0, (diff - pipeParity) / span)) : 0
  const gap = railParity - diff

  return (
    <section className={`${card} p-5`} aria-labelledby="diff-gauge">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 id="diff-gauge" className="text-[15px] font-semibold">
            Rail breakeven vs today&rsquo;s differential
          </h2>
          <p className="mt-0.5 max-w-xl text-[12px] text-muted">
            If pipes have room, the WTI–WCS differential only needs to cover the best pipe (pipe parity). Once they&rsquo;re full, the marginal
            barrel goes by rail and the differential gets pulled toward the rail breakeven.
          </p>
        </div>
        <div className="text-right">
          <div className="num text-[26px] font-semibold leading-none tracking-tight">{Math.round(tight * 100)}%</div>
          <div className="mt-1 text-[12px] text-muted">of the way to rail</div>
        </div>
      </div>

      <div className="relative mt-8 h-10">
        {/* track */}
        <div className="absolute inset-x-0 top-4 h-2 rounded-full bg-sunken" />
        {/* pipe → rail zone */}
        <div className="absolute top-4 h-2 rounded-full bg-accent-soft" style={{ left: x(Math.min(pipeParity, railParity)), width: `calc(${x(Math.max(pipeParity, railParity))} - ${x(Math.min(pipeParity, railParity))})` }} />
        <Marker at={x(pipeParity)} frac={(pipeParity - lo) / (hi - lo)} label="Pipe parity" value={pipeParity} tone="muted" />
        <Marker at={x(railParity)} frac={(railParity - lo) / (hi - lo)} label="Rail breakeven" value={railParity} tone="accent" />
        {/* current diff */}
        <div className="absolute top-2.5 -translate-x-1/2 transition-[left] duration-300" style={{ left: x(diff) }}>
          <span className="block h-5 w-5 rounded-full border-2 border-surface bg-fg shadow" data-tip={tipFor(data.wcsDiff)} tabIndex={0} />
        </div>
      </div>
      <div className="num mt-6 flex justify-between text-[11px] text-subtle">
        <span>{usd(lo, 0)}</span>
        <span>{usd(hi, 0)} / bbl</span>
      </div>

      <dl className="mt-4 grid grid-cols-1 gap-3 border-t border-line pt-4 text-[13px] sm:grid-cols-3">
        <div>
          <dt className="text-muted">Differential now</dt>
          <dd className="mt-0.5 text-[17px] font-semibold">
            <Money value={diff} source={data.wcsDiff} />
          </dd>
        </div>
        <div>
          <dt className="text-muted">Rail breakeven</dt>
          <dd className="mt-0.5 text-[17px] font-semibold text-accent">
            <Money value={railParity} extra="WTI minus the rail netback: rail cost plus the Gulf Coast heavy discount" />
          </dd>
        </div>
        <div>
          <dt className="text-muted">Room before rail sets the price</dt>
          <dd className="mt-0.5 text-[17px] font-semibold">
            <Money value={gap} extra="Rail breakeven minus today's differential" />
          </dd>
        </div>
      </dl>
    </section>
  )
}

function Marker({ at, frac, label, value, tone }: { at: string; frac: number; label: string; value: number; tone: 'muted' | 'accent' }) {
  // Keep the label on screen near the ends of the track
  const align = frac < 0.2 ? 'left-0' : frac > 0.8 ? 'right-0' : 'left-1/2 -translate-x-1/2'
  return (
    <div className="absolute top-0 -translate-x-1/2 text-center transition-[left] duration-300" style={{ left: at }}>
      <span className={`mx-auto block h-10 w-[2px] rounded-full ${tone === 'accent' ? 'bg-accent' : 'bg-muted'}`} />
      <span className={`absolute -top-6 ${align} whitespace-nowrap text-[11px] ${tone === 'accent' ? 'text-accent' : 'text-muted'}`}>
        {label} <span className="num">{usd(value)}</span>
      </span>
    </div>
  )
}
