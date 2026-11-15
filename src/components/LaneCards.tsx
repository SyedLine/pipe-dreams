import type { Data } from '../data'
import type { DestResult, Inputs, LaneResult } from '../netback'
import { defaultTankerFreight } from '../netback'
import { floating, Money, Slider, SourceTag } from './ui'

export function LaneTag({ tag }: { tag: NonNullable<LaneResult['lane']['tag']> }) {
  return (
    <span data-tip={tag.detail} tabIndex={0} className="shrink-0 rounded-md bg-sunken px-1.5 py-0.5 text-[11px] font-medium text-muted">
      {tag.label}
    </span>
  )
}

// ── Hover / tap preview ─────────────────────────────────────────────────────
export function PreviewCard({
  r,
  isBest,
  at,
  onOpen,
}: {
  r: LaneResult
  isBest: boolean
  /** Viewport position (desktop hover). Omit to dock (touch). */
  at?: { x: number; y: number }
  onOpen?: () => void
}) {
  const style = at
    ? { left: Math.min(at.x + 16, window.innerWidth - 284), top: Math.max(64, Math.min(at.y + 16, window.innerHeight - 60 - 30 * r.dests.length - 120)) }
    : undefined
  return (
    <div role="status" className={`${floating} ${at ? 'pointer-events-none fixed w-[17rem]' : ''} z-30 p-3.5`} style={style}>
      <div className="flex items-center gap-2">
        <h3 className="flex-1 truncate text-[14px] font-semibold">{r.lane.name}</h3>
        {isBest && <span className="rounded-md bg-accent-soft px-1.5 py-0.5 text-[11px] font-semibold text-accent">Best</span>}
        {r.offline && <span className="rounded-md bg-sunken px-1.5 py-0.5 text-[11px] font-medium text-muted">Offline</span>}
      </div>
      {r.lane.tag && <p className="mt-0.5 text-[12px] text-muted">{r.lane.tag.label}</p>}
      <ul className="mt-2.5 space-y-1">
        {r.dests.map((d) => (
          <li key={d.dest.id} className="flex items-baseline gap-2 text-[13px]">
            <span className={`flex-1 truncate ${d === r.best ? 'text-fg' : 'text-muted'}`}>{d.dest.name}</span>
            <Money value={d.netback} className={d === r.best ? 'font-semibold' : 'text-muted'} />
          </li>
        ))}
      </ul>
      {onOpen ? (
        <button type="button" onClick={onOpen} className="mt-3 w-full rounded-lg bg-accent py-2 text-[13px] font-medium text-on-accent">
          Details
        </button>
      ) : (
        <p className="mt-2.5 text-[12px] text-subtle">Click for the breakdown</p>
      )}
    </div>
  )
}

// ── Side panel ──────────────────────────────────────────────────────────────
interface PanelProps {
  r: LaneResult
  isBest: boolean
  data: Data
  inputs: Inputs
  setInputs: (fn: (i: Inputs) => Inputs) => void
  onClose: () => void
}

export function LanePanel({ r, isBest, data, inputs, setInputs, onClose }: PanelProps) {
  return (
    <aside
      aria-label={`${r.lane.name} details`}
      className={`${floating} pointer-events-auto absolute inset-x-2 bottom-2 z-40 flex max-h-[75%] flex-col md:inset-x-auto md:bottom-3 md:right-3 md:top-3 md:max-h-none md:w-[24rem]`}
    >
      <header className="flex items-start gap-3 border-b border-line p-4">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h2 className="text-[17px] font-semibold tracking-tight">{r.lane.name}</h2>
            {isBest && <span className="rounded-md bg-accent-soft px-1.5 py-0.5 text-[11px] font-semibold text-accent">Best</span>}
            {r.offline && <span className="rounded-md bg-sunken px-1.5 py-0.5 text-[11px] font-medium text-muted">Offline</span>}
          </div>
          <p className="mt-1 text-[13px] leading-snug text-muted">{r.lane.route}</p>
          {r.lane.tag && (
            <p className="mt-2 text-[12px] leading-snug text-muted">
              <LaneTag tag={r.lane.tag} /> <span className="ml-1">{r.lane.tag.detail}</span>
            </p>
          )}
        </div>
        <button type="button" onClick={onClose} aria-label="Close" className="-mr-1 -mt-1 rounded-lg p-1.5 text-muted hover:bg-sunken hover:text-fg">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        </button>
      </header>

      <div className="flex-1 space-y-3 overflow-y-auto p-4">
        {r.dests.map((d) => (
          <DestBlock key={d.dest.id} d={d} best={r.dests.length > 1 && d === r.best} data={data} inputs={inputs} setInputs={setInputs} />
        ))}
      </div>
      <footer className="border-t border-line px-4 py-3 text-[12px] leading-snug text-subtle">
        Hover any number for its source. Quality adjustments, freight and transfers are assumptions.
      </footer>
    </aside>
  )
}

function DestBlock({
  d,
  best,
  data,
  inputs,
  setInputs,
}: {
  d: DestResult
  best: boolean
  data: Data
  inputs: Inputs
  setInputs: (fn: (i: Inputs) => Inputs) => void
}) {
  return (
    <article className={`rounded-xl border p-3.5 ${best ? 'border-accent' : 'border-line'}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-[14px] font-semibold">
            {d.dest.name}
            {best && <span className="ml-2 text-[11px] font-semibold text-accent">Best</span>}
          </h3>
          <p className="text-[12px] text-muted">
            {d.dest.place}
            {d.dest.seaNm != null && (
              <>
                {' '}
                · <span className="num">≈{d.dest.seaNm.toLocaleString()} nm</span> from Westridge
              </>
            )}
          </p>
        </div>
        <div className="text-right">
          <Money value={d.netback} className="text-[18px] font-semibold tracking-tight" extra="Netback to Hardisty, US$/bbl" tipPos="left" />
          <div className="whitespace-nowrap text-[12px] text-muted">
            <Money value={d.uplift} signed extra="Netback minus WCS at Hardisty (WTI − diff)" tipPos="left" /> vs Hardisty
          </div>
        </div>
      </div>
      <dl className="mt-3 space-y-1 text-[12px]">
        {d.steps.map((s, i) => (
          <div key={s.label} className="flex items-baseline justify-between gap-3">
            <dt className="text-muted">
              {s.label}
              {s.note && <span className="text-subtle"> · {s.note}</span>}
            </dt>
            <dd>
              <Money value={s.value} signed={i > 0} source={s.source} extra={s.note} tipPos="left" />
            </dd>
          </div>
        ))}
      </dl>
      {d.steps.some((s) => s.source.asOf) && (
        <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1">
          {d.steps
            .filter((s) => s.source.asOf)
            .map((s) => (
              <SourceTag key={s.label} s={s.source} />
            ))}
        </div>
      )}
      {d.freightKind === 'tanker' && (
        <div className="mt-3 border-t border-line pt-3">
          <Slider
            label="Freight to here"
            value={d.freight}
            min={0}
            max={15}
            step={0.05}
            onChange={(v) => setInputs((i) => ({ ...i, freight: { ...i.freight, [d.dest.id]: v } }))}
            defaultValue={defaultTankerFreight(data, d.dest.seaNm!, inputs.tankerRate)}
          />
        </div>
      )}
    </article>
  )
}
