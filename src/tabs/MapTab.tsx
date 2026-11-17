import { useState } from 'react'
import MapView, { type Padding } from '../components/MapView'
import { LanePanel, PreviewCard } from '../components/LaneCards'
import { Delta, floating, header, Money } from '../components/ui'
import type { Data } from '../data'
import type { Theme } from '../hooks'
import type { LaneId } from '../lanes'
import { ranked, type Inputs, type LaneResult, type Results } from '../netback'

interface Props {
  data: Data
  theme: Theme
  results: Results
  /** Rank of each lane under Today's inputs (1 = best) */
  todayRank: Partial<Record<LaneId, number>>
  best: LaneId
  inputs: Inputs
  setInputs: (fn: (i: Inputs) => Inputs) => void
  isTouch: boolean
  isPhone: boolean
}

type Hover = { id: LaneId; at?: { x: number; y: number } } | null

function Toggle({ on, set, label, dash = false }: { on: boolean; set: (fn: (v: boolean) => boolean) => void; label: string; dash?: boolean }) {
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={() => set((v) => !v)}
      className={`inline-flex items-center gap-1.5 rounded border px-1.5 py-0.5 transition-colors ${
        on ? 'border-accent text-accent' : 'border-line-strong text-muted hover:text-fg'
      }`}
    >
      {dash && (
        <svg width="18" height="6" aria-hidden>
          <line x1="1" y1="3" x2="17" y2="3" stroke="currentColor" strokeWidth="2" strokeDasharray="3 3" opacity="0.8" />
        </svg>
      )}
      {label}
    </button>
  )
}

export function RankMove({ now, was }: { now: number | null; was: number | undefined }) {
  if (now == null || was == null || was === now) return <span className="num text-subtle">–</span>
  const up = was > now
  return (
    <span className={`num whitespace-nowrap text-[11px] ${up ? 'text-up' : 'text-down'}`} data-tip={`Today: #${was}`}>
      {up ? '▲' : '▼'}
      {Math.abs(was - now)}
    </span>
  )
}

export default function MapTab({ data, theme, results, todayRank, best, inputs, setInputs, isTouch, isPhone }: Props) {
  const [hover, setHover] = useState<Hover>(null)
  const [selected, setSelected] = useState<LaneId | null>(null)
  const [showProposed, setShowProposed] = useState(false)
  const [showPadds, setShowPadds] = useState(false)
  const [showRefineries, setShowRefineries] = useState(false)
  const refineries = [
    ...data.markets.refining.padds.flatMap((p) => p.top),
    ...(data.markets.asia?.refineries ?? []),
  ].map((t) => ({ name: t.site, operator: t.operator, crudeKbd: t.crudeKbd, cokeKbd: t.cokeKbd, coord: t.coord }))
  const proposed = data.projects.items.filter((p) => p.route).map((p) => ({ id: p.id, name: p.name.replace(/ \(.*\)$/, ''), route: p.route! }))
  const active = selected ?? hover?.id ?? null

  // Desktop: hover previews, click opens. Touch: tap previews (hover behaviour), "Details" opens.
  const onHover = (id: LaneId | null, at?: { x: number; y: number }) => !isTouch && setHover(id ? { id, at } : null)
  const onSelect = (id: LaneId | null) => {
    if (isTouch) setHover(id ? { id } : null)
    else {
      setSelected(id)
      setHover(null)
    }
  }
  const open = (id: LaneId) => {
    setSelected(id)
    setHover(null)
  }

  const padding: Padding = isPhone
    ? { top: 24, right: 24, bottom: 200, left: 24 }
    : { top: 40, right: selected ? 420 : 460, bottom: 40, left: 40 }
  const hovered = hover && !selected ? results[hover.id] : null
  const order = ranked(results)
  const rows: LaneResult[] = [...order, ...(Object.values(results) as LaneResult[]).filter((r) => r.offline)]

  return (
    <div className="relative h-full">
      <MapView
        theme={theme}
        best={best}
        active={active}
        showAsia={selected === 'tmx-asia'}
        offline={inputs.offline}
        proposed={proposed}
        showProposed={showProposed}
        showPadds={showPadds}
        refineries={refineries}
        showRefineries={showRefineries}
        padding={padding}
        onHover={onHover}
        onSelect={onSelect}
      />

      {/* Line-style legend */}
      <div
        className={`${floating} absolute z-10 flex flex-wrap items-center gap-x-3 gap-y-1.5 px-2.5 py-1.5 text-[11px] text-muted ${isPhone ? 'left-2 right-24 top-2' : 'bottom-3 left-3'}`}
      >
        {(
          [
            ['Pipeline', undefined],
            ['Tanker', '1 3'],
            ['Rail', '5 3'],
          ] as const
        ).map(([label, dash]) => (
          <span key={label} className="inline-flex items-center gap-1.5">
            <svg width="18" height="6" aria-hidden>
              <line x1="1" y1="3" x2="17" y2="3" stroke="currentColor" strokeWidth="2" strokeDasharray={dash} strokeLinecap={dash ? 'butt' : 'round'} />
            </svg>
            {label}
          </span>
        ))}
        <Toggle on={showProposed} set={setShowProposed} label="Proposed" dash />
        <Toggle on={showPadds} set={setShowPadds} label="PADDs" />
        <Toggle on={showRefineries} set={setShowRefineries} label="Refineries" />
      </div>

      {/* Refinery key: only coking refineries are drawn */}
      {showRefineries && (
        <div
          className={`${floating} pointer-events-none absolute z-10 max-w-[19rem] px-2.5 py-2 text-[11px] leading-snug text-muted ${
            isPhone ? 'left-2 right-24 top-[4.6rem]' : 'bottom-[3.6rem] left-3'
          }`}
        >
          <span className="font-medium text-fg">Coking refineries only.</span> Cokers let a refinery run heavy crude like WCS directly.
          <span className="mt-1 flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full border-2 border-accent bg-fg" /> Dot size = crude capacity; amber ring = coker. Locations approximate.
          </span>
        </div>
      )}

      {/* Lane board: sorted by netback */}
      {!selected && (
        <nav
          aria-label="Lanes by netback"
          className={`${floating} absolute z-10 ${isPhone ? 'inset-x-2 bottom-2 max-h-[188px] overflow-y-auto' : 'right-3 top-3 w-[27rem]'}`}
        >
          <div className="grid grid-cols-[2.6rem_1fr_4.6rem_5.4rem] items-center gap-2 border-b border-line px-3 py-1.5">
            <span className={header}>#</span>
            <span className={header}>Lane</span>
            <span className={`${header} text-right`}>Netback</span>
            <span className={`${header} text-right`}>vs Hardisty</span>
          </div>
          <ul className="divide-y divide-line">
            {rows.map((r) => {
              const rank = r.offline ? null : order.indexOf(r) + 1
              const isBest = r.lane.id === best
              return (
                <li key={r.lane.id}>
                  <button
                    type="button"
                    onMouseEnter={() => !isTouch && setHover({ id: r.lane.id })}
                    onMouseLeave={() => !isTouch && setHover(null)}
                    onClick={() => open(r.lane.id)}
                    className={`grid w-full grid-cols-[2.6rem_1fr_4.6rem_5.4rem] items-center gap-2 px-3 py-[7px] text-left text-[12.5px] transition-colors ${
                      active === r.lane.id ? 'bg-sunken' : 'hover:bg-sunken'
                    } ${r.offline ? 'opacity-45' : ''}`}
                  >
                    <span className="flex items-baseline gap-1.5">
                      <span className="num text-[12px] text-muted">{rank ?? '—'}</span>
                      <RankMove now={rank} was={todayRank[r.lane.id]} />
                    </span>
                    <span className="flex min-w-0 items-center gap-2">
                      <span
                        aria-hidden
                        className="h-2.5 w-2.5 shrink-0 rounded-[2px]"
                        style={{ backgroundColor: r.lane.color[theme], boxShadow: isBest ? `0 0 8px ${r.lane.color[theme]}` : undefined }}
                      />
                      <span className={`truncate ${isBest ? 'font-semibold' : ''}`}>{isPhone ? r.lane.short : r.lane.name}</span>
                    </span>
                    {r.offline ? (
                      <span className="text-right text-[11px] text-subtle">offline</span>
                    ) : (
                      <Money value={r.best.netback} className="text-right" extra={`Best netback via ${r.best.dest.name}`} tipPos="left" />
                    )}
                    <span className="text-right">
                      {r.offline ? <span className="text-subtle">—</span> : <Delta value={r.best.uplift} extra="Netback minus WCS at Hardisty (WTI − diff)" tipPos="left" />}
                    </span>
                  </button>
                </li>
              )
            })}
          </ul>
        </nav>
      )}

      {hovered &&
        (isTouch ? (
          <div className="absolute inset-x-2 top-2 z-30">
            <PreviewCard r={hovered} theme={theme} isBest={hovered.lane.id === best} onOpen={() => open(hovered.lane.id)} />
          </div>
        ) : hover?.at ? (
          <PreviewCard r={hovered} theme={theme} isBest={hovered.lane.id === best} at={hover.at} />
        ) : null)}

      {selected && (
        <LanePanel
          r={results[selected]}
          theme={theme}
          isBest={selected === best}
          data={data}
          inputs={inputs}
          setInputs={setInputs}
          onClose={() => setSelected(null)}
        />
      )}
    </div>
  )
}
