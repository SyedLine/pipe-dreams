import { useState } from 'react'
import MapView from './components/MapView'
import { LANES, PLACEHOLDER_BEST, type LaneId, type Mode } from './lanes'

const MODE_LABEL: Record<Mode, string> = { pipe: 'Pipeline', tanker: 'Tanker', rail: 'Rail' }

function ModeSwatch({ mode, color }: { mode: Mode; color: string }) {
  const dash = mode === 'tanker' ? '1 3' : mode === 'rail' ? '5 3' : undefined
  return (
    <svg width="22" height="6" aria-hidden className="shrink-0">
      <line x1="1" y1="3" x2="21" y2="3" stroke={color} strokeWidth="2.5" strokeDasharray={dash} strokeLinecap={dash ? 'butt' : 'round'} />
    </svg>
  )
}

export default function App() {
  const [hovered, setHovered] = useState<LaneId | null>(null)
  const best = PLACEHOLDER_BEST

  return (
    <div className="fixed inset-0 bg-zinc-950">
      <MapView best={best} hovered={hovered} onHover={setHovered} onSelect={setHovered} />

      {/* Title */}
      <header
        className="pointer-events-none absolute left-4 right-4 top-[calc(env(safe-area-inset-top,0px)+1rem)] sm:right-auto sm:max-w-sm"
      >
        <div className="pointer-events-auto rounded-2xl border border-white/10 bg-zinc-900/60 px-4 py-3 shadow-2xl shadow-black/40 backdrop-blur-xl">
          <p className="text-[10px] font-medium uppercase tracking-[0.25em] text-amber-400/80">Hardisty egress monitor</p>
          <h1 className="mt-0.5 text-xl font-semibold tracking-tight">Pipe Dreams</h1>
          <p className="mt-1 text-sm leading-snug text-zinc-400">
            Where should a WCS barrel at Hardisty go this month, and what is it worth?
          </p>
        </div>
      </header>

      {/* Lane legend */}
      <nav
        aria-label="Egress lanes"
        className="absolute bottom-[calc(env(safe-area-inset-bottom,0px)+2.75rem)] left-4 right-4 rounded-2xl border border-white/10 bg-zinc-900/60 p-2 shadow-2xl shadow-black/40 backdrop-blur-xl sm:left-auto sm:w-72"
      >
        <ul className="space-y-0.5">
          {LANES.map((lane) => {
            const modes = [...new Set(lane.segments.map((s) => s.mode))]
            const active = hovered === lane.id
            return (
              <li key={lane.id}>
                <button
                  type="button"
                  onMouseEnter={() => setHovered(lane.id)}
                  onMouseLeave={() => setHovered(null)}
                  onFocus={() => setHovered(lane.id)}
                  onBlur={() => setHovered(null)}
                  onClick={() => setHovered(lane.id)}
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
                    <span
                      className="rounded-full px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide"
                      style={{ color: lane.color, backgroundColor: `${lane.color}1f` }}
                      title="Placeholder until live data is wired in"
                    >
                      Best*
                    </span>
                  )}
                </button>
              </li>
            )
          })}
        </ul>
        <p className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1 border-t border-white/5 px-2.5 pt-2 text-[11px] text-zinc-500">
          {(['pipe', 'tanker', 'rail'] as Mode[]).map((m) => (
            <span key={m} className="inline-flex items-center gap-1.5">
              <ModeSwatch mode={m} color="#a1a1aa" /> {MODE_LABEL[m]}
            </span>
          ))}
          <span className="w-full">* Illustrative until live prices are added.</span>
        </p>
      </nav>
    </div>
  )
}
