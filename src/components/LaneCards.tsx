import type { Data } from '../data'
import { signedUsd, usd } from '../data'
import type { DestResult, Inputs, LaneResult } from '../netback'
import { defaultTankerFreight } from '../netback'
import { glass, Slider, SourceTag } from './ui'

const BENCH_LABEL = { wti: 'WTI', brent: 'Brent', ans: 'ANS' } as const

export function LaneTag({ tag }: { tag: NonNullable<LaneResult['lane']['tag']> }) {
  return (
    <span
      title={tag.detail}
      className="shrink-0 rounded-full border border-white/15 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-zinc-300"
    >
      {tag.label}
    </span>
  )
}

function Uplift({ n }: { n: number }) {
  return (
    <span className={`whitespace-nowrap font-mono text-[11px] tabular-nums ${n >= 0 ? 'text-emerald-300' : 'text-zinc-500'}`}>
      {signedUsd(n)} vs Hardisty
    </span>
  )
}

// ── Hover / tap preview ─────────────────────────────────────────────────────
interface PreviewProps {
  r: LaneResult
  isBestLane: boolean
  /** Viewport position (desktop hover). Omit to dock at the bottom (touch). */
  at?: { x: number; y: number }
  onOpen?: () => void
}

export function PreviewCard({ r, isBestLane, at, onOpen }: PreviewProps) {
  const style = at
    ? {
        left: Math.min(at.x + 16, window.innerWidth - 288),
        top: Math.min(at.y + 16, window.innerHeight - 40 - 34 * r.dests.length - 110),
      }
    : undefined
  return (
    <div
      role="status"
      className={`${glass} ${at ? 'pointer-events-none fixed w-68' : 'pointer-events-auto'} z-30 p-3`}
      style={style}
    >
      <div className="flex items-center gap-2">
        <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: r.lane.color }} />
        <h3 className="flex-1 truncate text-sm font-semibold">{r.lane.name}</h3>
        {r.lane.tag && <LaneTag tag={r.lane.tag} />}
        {isBestLane && (
          <span className="rounded-full bg-white/10 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-zinc-200">
            Best lane
          </span>
        )}
      </div>
      <ul className="mt-2 space-y-1">
        {r.dests.map((d) => (
          <li key={d.dest.id} className="flex items-baseline gap-2 text-xs">
            <span className={`flex-1 truncate ${d === r.best ? 'text-zinc-100' : 'text-zinc-400'}`}>
              {d.dest.name}
              {d.dest.seaNm != null && <span className="text-zinc-500"> · {d.dest.seaNm.toLocaleString()} nm</span>}
            </span>
            <span className={`font-mono tabular-nums ${d === r.best ? 'font-semibold text-zinc-100' : 'text-zinc-400'}`}>
              {usd(d.netback)}
            </span>
          </li>
        ))}
      </ul>
      <div className="mt-2 flex items-baseline justify-between border-t border-white/10 pt-2">
        <span className="text-[11px] text-zinc-500">Best netback</span>
        <span className="font-mono text-base font-semibold tabular-nums" style={{ color: r.lane.color }}>
          {usd(r.best.netback)}
        </span>
      </div>
      {onOpen ? (
        <button
          type="button"
          onClick={onOpen}
          className="mt-2 w-full rounded-lg bg-white/10 py-1.5 text-xs font-medium text-zinc-100 hover:bg-white/15"
        >
          Open details
        </button>
      ) : (
        <p className="mt-1.5 text-[11px] text-zinc-500">Click the lane for details</p>
      )}
    </div>
  )
}

// ── Side panel ──────────────────────────────────────────────────────────────
interface PanelProps {
  r: LaneResult
  data: Data
  inputs: Inputs
  setInputs: (fn: (i: Inputs) => Inputs) => void
  onClose: () => void
}

export function LanePanel({ r, data, inputs, setInputs, onClose }: PanelProps) {
  const isRail = r.lane.id === 'rail-usgc'
  return (
    <aside
      aria-label={`${r.lane.name} details`}
      className={`${glass} pointer-events-auto fixed inset-x-2 bottom-[calc(env(safe-area-inset-bottom,0px)+2.25rem)] z-40 flex max-h-[72dvh] flex-col sm:inset-x-auto sm:bottom-4 sm:right-4 sm:top-[calc(env(safe-area-inset-top,0px)+1rem)] sm:max-h-none sm:w-[25rem]`}
    >
      <header className="flex items-start gap-3 border-b border-white/10 p-4">
        <span className="mt-1.5 h-3 w-3 shrink-0 rounded-full" style={{ backgroundColor: r.lane.color, boxShadow: `0 0 12px ${r.lane.color}` }} />
        <div className="min-w-0 flex-1">
          <h2 className="text-lg font-semibold leading-tight">{r.lane.name}</h2>
          <p className="mt-0.5 text-xs text-zinc-400">{r.lane.route}</p>
          {r.lane.tag && (
            <div className="mt-2 space-y-1">
              <LaneTag tag={r.lane.tag} />
              <p className="text-[11px] leading-snug text-zinc-400">{r.lane.tag.detail}</p>
            </div>
          )}
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close panel"
          className="-mr-1 -mt-1 rounded-lg p-1.5 text-zinc-400 hover:bg-white/10 hover:text-zinc-100"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        </button>
      </header>

      <div className="flex-1 space-y-3 overflow-y-auto p-4">
        {/* Toll / rail cost */}
        <section className="rounded-xl border border-white/5 bg-black/20 p-3">
          {isRail ? (
            <Slider
              label="Rail all-in cost"
              value={inputs.railCost}
              min={10}
              max={25}
              step={0.25}
              format={(n) => usd(n)}
              onChange={(v) => setInputs((i) => ({ ...i, railCost: v }))}
              defaultValue={data.assumptions.railAllInUsd.value}
              source={r.tollSource}
              accent={r.lane.color}
            />
          ) : (
            r.tollVaries ? (
              <>
                <div className="flex items-baseline justify-between">
                  <span className="text-xs font-medium text-zinc-300">Pipeline toll</span>
                  <span className="text-xs text-zinc-400">varies by destination</span>
                </div>
                <p className="mt-1 text-[11px] leading-snug text-zinc-500">{r.tollSource.source}</p>
                <SourceTag s={r.tollSource} className="mt-1.5" />
              </>
            ) : (
              <>
                <div className="flex items-baseline justify-between">
                  <span className="text-xs font-medium text-zinc-300">Pipeline toll</span>
                  <span className="font-mono text-sm tabular-nums">{usd(r.toll)}</span>
                </div>
                <p className="mt-1 text-[11px] leading-snug text-zinc-500">{r.tollNote}</p>
                <SourceTag s={r.tollSource} className="mt-1.5" />
              </>
            )
          )}
        </section>

        <h3 className="pt-1 text-[11px] font-medium uppercase tracking-wider text-zinc-500">
          {r.dests.length > 1 ? `${r.dests.length} destinations` : 'Destination'}
        </h3>
        {r.dests.map((d) => (
          <DestRow
            key={d.dest.id}
            d={d}
            best={r.dests.length > 1 && d === r.best}
            color={r.lane.color}
            data={data}
            inputs={inputs}
            setInputs={setInputs}
          />
        ))}
      </div>
      <footer className="border-t border-white/10 px-4 py-2.5 text-[11px] leading-snug text-zinc-500">
        Netback = delivered price − toll − freight. Quality discounts and freight are editable assumptions.
      </footer>
    </aside>
  )
}

function DestRow({
  d,
  best,
  color,
  data,
  inputs,
  setInputs,
}: {
  d: DestResult
  best: boolean
  color: string
  data: Data
  inputs: Inputs
  setInputs: (fn: (i: Inputs) => Inputs) => void
}) {
  const benchSrc = data.prices[d.benchmark]
  return (
    <article
      className={`rounded-xl border p-3 transition-colors ${best ? 'bg-white/[0.07]' : 'border-white/5 bg-white/[0.02]'}`}
      style={best ? { borderColor: `${color}80`, boxShadow: `0 0 24px -8px ${color}` } : undefined}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h4 className="flex items-center gap-2 text-sm font-semibold">
            {d.dest.name}
            {best && (
              <span className="rounded-full px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide" style={{ color, backgroundColor: `${color}26` }}>
                Best
              </span>
            )}
          </h4>
          <p className="text-[11px] text-zinc-500">
            {d.dest.place}
            {d.dest.seaNm != null && ` · ≈${d.dest.seaNm.toLocaleString()} nm from Westridge`}
          </p>
        </div>
        <div className="text-right">
          <div className="font-mono text-lg font-semibold leading-tight tabular-nums">{usd(d.netback)}</div>
          <Uplift n={d.uplift} />
        </div>
      </div>

      <dl className="mt-2 grid grid-cols-[1fr_auto] gap-x-3 gap-y-0.5 text-[11px] text-zinc-400">
        <dt>
          {BENCH_LABEL[d.benchmark]} benchmark{' '}
          {d.benchmark !== 'wti' && <span className="text-zinc-500">(WTI {signedUsd(benchSrc.spreadToWti ?? 0)})</span>}
        </dt>
        <dd className="text-right font-mono tabular-nums text-zinc-300">{usd(d.benchmarkPrice)}</dd>
        <dt>Heavy-sour quality adj. (assumed)</dt>
        <dd className="text-right font-mono tabular-nums text-zinc-300">{signedUsd(d.qualityAdj)}</dd>
        <dt title={d.tollNote}>{d.freightKind === 'rail' ? 'Rail all-in' : 'Pipeline toll'}</dt>
        <dd className="text-right font-mono tabular-nums text-zinc-300">−{usd(d.toll)}</dd>
        {d.freightKind === 'tanker' && (
          <>
            <dt>Tanker freight</dt>
            <dd className="text-right font-mono tabular-nums text-zinc-300">−{usd(d.freight)}</dd>
          </>
        )}
      </dl>
      {d.benchmark !== 'wti' && <SourceTag s={benchSrc} className="mt-1" />}

      {d.freightKind === 'tanker' && (
        <div className="mt-2.5">
          <Slider
            label="Freight to here"
            value={d.freight}
            min={0}
            max={15}
            step={0.05}
            format={(n) => usd(n)}
            onChange={(v) => setInputs((i) => ({ ...i, freight: { ...i.freight, [d.dest.id]: v } }))}
            defaultValue={defaultTankerFreight(data, d.dest.seaNm!, inputs.tankerRate)}
            accent={color}
          />
        </div>
      )}
    </article>
  )
}
