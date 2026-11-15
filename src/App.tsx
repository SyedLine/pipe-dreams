import { useEffect, useMemo, useState, useSyncExternalStore } from 'react'
import MapView from './components/MapView'
import Controls from './components/Controls'
import UtilizationChart from './components/UtilizationChart'
import { LanePanel, PreviewCard } from './components/LaneCards'
import { glass, SourceTag } from './components/ui'
import Footer, { Credits, SourceList } from './components/Footer'
import { loadData, signedUsd, usd, type Data } from './data'
import { LANES, type LaneId, type Mode } from './lanes'
import { bestLane, breakevens, computeAll, defaultInputs, type Inputs } from './netback'

const MODE_LABEL: Record<Mode, string> = { pipe: 'Pipeline', tanker: 'Tanker', rail: 'Rail' }

function useMedia(query: string) {
  return useSyncExternalStore(
    (cb) => {
      const m = window.matchMedia(query)
      m.addEventListener('change', cb)
      return () => m.removeEventListener('change', cb)
    },
    () => window.matchMedia(query).matches,
  )
}

function ModeSwatch({ mode, color }: { mode: Mode; color: string }) {
  const dash = mode === 'tanker' ? '1 3' : mode === 'rail' ? '5 3' : undefined
  return (
    <svg width="22" height="6" aria-hidden className="shrink-0">
      <line x1="1" y1="3" x2="21" y2="3" stroke={color} strokeWidth="2.5" strokeDasharray={dash} strokeLinecap={dash ? 'butt' : 'round'} />
    </svg>
  )
}

type Hover = { id: LaneId; at?: { x: number; y: number } } | null

export default function App() {
  const [data, setData] = useState<Data | null>(null)
  const [error, setError] = useState<string | null>(null)
  useEffect(() => {
    loadData().then(setData, (e) => setError(String(e)))
  }, [])

  if (error)
    return (
      <div className="grid h-full place-items-center p-6 text-center text-sm text-zinc-400">Couldn&rsquo;t load data: {error}</div>
    )
  if (!data) return <div className="grid h-full place-items-center text-sm text-zinc-500">Loading Hardisty netbacks…</div>
  return <Monitor data={data} />
}

function Monitor({ data }: { data: Data }) {
  const defaults = useMemo(() => defaultInputs(data), [data])
  const [inputs, setInputs] = useState<Inputs>(defaults)
  const [hover, setHover] = useState<Hover>(null)
  const [selected, setSelected] = useState<LaneId | null>(null)
  const [tab, setTab] = useState<'lanes' | 'inputs' | 'egress' | 'about'>('lanes')
  const isPhone = useMedia('(max-width: 639px)')
  const isTouch = useMedia('(hover: none)')

  const results = useMemo(() => computeAll(data, inputs), [data, inputs])
  const best = bestLane(results)
  const { pipeParity, railParity } = breakevens(results, inputs)
  const bestR = results[best]
  const hardisty = inputs.wti - inputs.wcsDiff

  // Desktop: hover previews, click opens the panel. Touch: tap previews (hover behaviour), card opens panel.
  const onMapHover = (id: LaneId | null, at?: { x: number; y: number }) => {
    if (!isTouch) setHover(id ? { id, at } : null)
  }
  const onMapSelect = (id: LaneId | null) => {
    if (isTouch) setHover(id ? { id } : null)
    else if (id) {
      setSelected(id)
      setHover(null)
    }
  }
  const open = (id: LaneId) => {
    setSelected(id)
    setHover(null)
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && (setSelected(null), setHover(null))
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const answer = (
    <p className="mt-2 text-sm leading-snug text-zinc-300">
      Best: <span className="font-semibold" style={{ color: bestR.lane.color }}>{bestR.lane.name}</span>
      {bestR.dests.length > 1 && <span className="text-zinc-400"> ({bestR.best.dest.name})</span>} at{' '}
      <span className="font-mono font-semibold text-zinc-100">{usd(bestR.best.netback)}</span>/bbl,{' '}
      <span className={bestR.best.uplift >= 0 ? 'text-emerald-300' : 'text-zinc-400'}>{signedUsd(bestR.best.uplift)}</span> vs
      selling at Hardisty ({usd(hardisty)}).
    </p>
  )

  const legend = (
    <ul className="space-y-0.5">
      {LANES.map((lane) => {
        const r = results[lane.id]
        const modes = [...new Set(lane.segments.map((s) => s.mode))]
        const active = (selected ?? hover?.id) === lane.id
        return (
          <li key={lane.id}>
            <button
              type="button"
              onMouseEnter={(e) => {
                if (isTouch) return
                const rect = e.currentTarget.getBoundingClientRect()
                setHover({ id: lane.id, at: { x: rect.left - 300, y: rect.top - 20 } })
              }}
              onMouseLeave={() => !isTouch && setHover(null)}
              onClick={() => open(lane.id)}
              className={`flex w-full items-center gap-2.5 rounded-xl px-2.5 py-1.5 text-left text-sm transition-colors ${
                active ? 'bg-white/10 text-white' : 'text-zinc-300 hover:bg-white/5'
              }`}
            >
              <span className="flex flex-col gap-1">
                {modes.map((m) => (
                  <ModeSwatch key={m} mode={m} color={lane.color} />
                ))}
              </span>
              <span className="min-w-0 flex-1 truncate">{lane.name}</span>
              {lane.id === best && (
                <span className="rounded-full px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide" style={{ color: lane.color, backgroundColor: `${lane.color}1f` }}>
                  Best
                </span>
              )}
              <span className={`font-mono text-xs tabular-nums ${lane.id === best ? 'font-semibold text-zinc-100' : 'text-zinc-400'}`}>
                {usd(r.best.netback)}
              </span>
            </button>
          </li>
        )
      })}
      <li className="flex flex-wrap gap-x-3 gap-y-1 border-t border-white/5 px-2.5 pt-2 text-[11px] text-zinc-500">
        {(['pipe', 'tanker', 'rail'] as Mode[]).map((m) => (
          <span key={m} className="inline-flex items-center gap-1.5">
            <ModeSwatch mode={m} color="#a1a1aa" /> {MODE_LABEL[m]}
          </span>
        ))}
        <span className="ml-auto">Best netback, US$/bbl</span>
      </li>
    </ul>
  )

  const controls = (
    <Controls data={data} inputs={inputs} defaults={defaults} setInputs={setInputs} pipeParity={pipeParity} railParity={railParity} />
  )
  const quality = (
    <p className="text-[11px] leading-snug text-zinc-500">
      WCS quality: {data.quality.apiGravity}° API, {data.quality.sulphurPct}% sulphur{' '}
      <span className="text-zinc-600">(5-yr avg {data.quality.apiGravity5y}°, {data.quality.sulphurPct5y}%)</span> ·{' '}
      <SourceTag s={data.quality} />
    </p>
  )

  const hovered = hover ? results[hover.id] : null
  // Keep Hardisty centred in the part of the map not covered by cards.
  const mapPadding = isPhone ? { top: 110, right: 0, bottom: 260, left: 0 } : { top: 0, right: 0, bottom: 0, left: 368 }
  const panel = selected && (
    <LanePanel r={results[selected]} data={data} inputs={inputs} setInputs={setInputs} onClose={() => setSelected(null)} />
  )

  return (
    <div className="fixed inset-0 overflow-hidden bg-zinc-950">
      <MapView best={best} padding={mapPadding} hovered={selected ?? hover?.id ?? null} onHover={onMapHover} onSelect={onMapSelect} />

      {isPhone ? (
        <>
          <header className={`${glass} absolute inset-x-2 top-[calc(env(safe-area-inset-top,0px)+0.5rem)] px-3.5 py-2.5`}>
            <h1 className="text-base font-semibold tracking-tight">
              Pipe Dreams <span className="text-xs font-normal text-zinc-500">· Hardisty WCS netbacks</span>
            </h1>
            {answer}
          </header>

          {hovered && !selected && (
            <div className="absolute inset-x-2 top-[calc(env(safe-area-inset-top,0px)+8.5rem)] z-30">
              <PreviewCard r={hovered} isBestLane={hovered.lane.id === best} onOpen={() => open(hovered.lane.id)} />
            </div>
          )}

          {!selected && (
            <section className={`${glass} absolute inset-x-2 bottom-[calc(env(safe-area-inset-bottom,0px)+2.25rem)] flex max-h-[46dvh] flex-col`}>
              <div role="tablist" className="flex gap-1 border-b border-white/10 p-1.5">
                {(
                  [
                    ['lanes', 'Lanes'],
                    ['inputs', 'Inputs'],
                    ['egress', 'Egress'],
                    ['about', 'About'],
                  ] as const
                ).map(([k, label]) => (
                  <button
                    key={k}
                    role="tab"
                    aria-selected={tab === k}
                    onClick={() => setTab(k)}
                    className={`flex-1 rounded-lg py-1.5 text-xs font-medium ${tab === k ? 'bg-white/10 text-zinc-100' : 'text-zinc-400'}`}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <div className="overflow-y-auto p-2">
                {tab === 'lanes' && legend}
                {tab === 'inputs' && (
                  <div className="space-y-3 p-1.5">
                    {controls}
                    {quality}
                  </div>
                )}
                {tab === 'egress' && (
                  <div className="p-1.5">
                    <UtilizationChart data={data} />
                  </div>
                )}
                {tab === 'about' && (
                  <div className="space-y-3 p-1.5">
                    <Credits />
                    <SourceList data={data} />
                  </div>
                )}
              </div>
            </section>
          )}
          {panel}
        </>
      ) : (
        <>
          <header
            className={`${glass} absolute left-4 top-[calc(env(safe-area-inset-top,0px)+1rem)] flex max-h-[calc(100dvh-2rem)] w-[22rem] flex-col`}
          >
            <div className="px-4 pb-3 pt-3.5">
              <p className="text-[10px] font-medium uppercase tracking-[0.25em] text-amber-400/80">Hardisty egress monitor</p>
              <h1 className="mt-0.5 text-xl font-semibold tracking-tight">Pipe Dreams</h1>
              <p className="mt-1 text-sm leading-snug text-zinc-400">
                Where should a WCS barrel at Hardisty go this month, and what is it worth?
              </p>
              {answer}
            </div>
            <details open className="group min-h-0 border-t border-white/10">
              <summary className="flex cursor-pointer list-none items-center justify-between px-4 py-2.5 text-xs font-medium text-zinc-300 hover:text-zinc-100">
                Inputs
                <span className="text-zinc-500 transition-transform group-open:rotate-180">▾</span>
              </summary>
              <div className="max-h-[calc(100dvh-17rem)] space-y-4 overflow-y-auto px-4 pb-4">
                {controls}
                {quality}
              </div>
            </details>
          </header>

          {!selected && (
            <>
              <section className={`${glass} absolute right-4 top-[calc(env(safe-area-inset-top,0px)+1rem)] w-80 p-3.5`}>
                <UtilizationChart data={data} />
              </section>
              <nav aria-label="Egress lanes" className={`${glass} absolute bottom-[calc(env(safe-area-inset-bottom,0px)+2.75rem)] right-4 w-80 p-2`}>
                {legend}
              </nav>
            </>
          )}

          {!selected && <Footer data={data} />}
          {hovered && !selected && <PreviewCard r={hovered} isBestLane={hovered.lane.id === best} at={hovered && hover?.at} />}
          {panel}
        </>
      )}
    </div>
  )
}
