import { useState } from 'react'
import MapView, { type Padding } from '../components/MapView'
import { LanePanel, PreviewCard } from '../components/LaneCards'
import { floating, Money } from '../components/ui'
import type { Data } from '../data'
import type { Theme } from '../hooks'
import { LANES, type LaneId } from '../lanes'
import type { Inputs, Results } from '../netback'

interface Props {
  data: Data
  theme: Theme
  results: Results
  best: LaneId
  inputs: Inputs
  setInputs: (fn: (i: Inputs) => Inputs) => void
  isTouch: boolean
  isPhone: boolean
}

type Hover = { id: LaneId; at?: { x: number; y: number } } | null

export default function MapTab({ data, theme, results, best, inputs, setInputs, isTouch, isPhone }: Props) {
  const [hover, setHover] = useState<Hover>(null)
  const [selected, setSelected] = useState<LaneId | null>(null)
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

  const padding: Padding = isPhone ? { top: 0, right: 0, bottom: 140, left: 0 } : { top: 0, right: 0, bottom: 0, left: 0 }
  const hovered = hover && !selected ? results[hover.id] : null

  return (
    <div className="relative h-full">
      <MapView
        theme={theme}
        best={best}
        active={active}
        offline={inputs.offline}
        padding={padding}
        onHover={onHover}
        onSelect={onSelect}
      />

      {/* Lane list */}
      {!selected && (
        <nav
          aria-label="Lanes"
          className={`${floating} absolute z-10 p-1.5 ${isPhone ? 'inset-x-2 bottom-2 max-h-[132px] overflow-y-auto' : 'right-3 top-3 w-[20rem]'}`}
        >
          <ul>
            {LANES.map((lane) => {
              const r = results[lane.id]
              const isBest = lane.id === best
              return (
                <li key={lane.id}>
                  <button
                    type="button"
                    onMouseEnter={() => !isTouch && setHover({ id: lane.id })}
                    onMouseLeave={() => !isTouch && setHover(null)}
                    onClick={() => open(lane.id)}
                    className={`flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-[13px] transition-colors ${
                      active === lane.id ? 'bg-sunken' : 'hover:bg-sunken'
                    } ${r.offline ? 'opacity-50' : ''}`}
                  >
                    <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${isBest ? 'bg-accent' : 'bg-line-strong'}`} />
                    <span className="min-w-0 flex-1 truncate">{lane.name}</span>
                    {r.offline ? (
                      <span className="text-[12px] text-subtle">offline</span>
                    ) : (
                      <Money value={r.best.netback} className={isBest ? 'font-semibold text-accent' : 'text-muted'} />
                    )}
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
            <PreviewCard r={hovered} isBest={hovered.lane.id === best} onOpen={() => open(hovered.lane.id)} />
          </div>
        ) : hover?.at ? (
          <PreviewCard r={hovered} isBest={hovered.lane.id === best} at={hover.at} />
        ) : null)}

      {selected && (
        <LanePanel
          r={results[selected]}
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
