import { useState } from 'react'
import type { Data, Sourced } from '../data'
import { formatAsOf, isStale } from '../data'
import { glass, SourceTag } from './ui'

const LINKEDIN = 'https://www.linkedin.com/in/syedifrazahsan/'
const REPO = 'https://github.com/SyedLine/pipe-dreams'

function rows(d: Data): { what: string; s: Sourced }[] {
  return [
    { what: 'WTI (Cushing spot)', s: d.prices.wti },
    { what: 'Brent (spread to WTI)', s: d.prices.brent },
    { what: 'ANS (spread to WTI)', s: d.prices.ans },
    { what: 'WTI–WCS differential', s: d.wcsDiff },
    { what: 'USD/CAD', s: d.fx },
    { what: 'WCS quality', s: d.quality },
    { what: 'Mainline throughput & capacity', s: d.throughput.mainline },
    { what: 'TMX throughput & capacity', s: d.throughput.tmx },
    { what: 'Toll: Mainline → Chicago', s: d.tolls.mainlineChicago },
    { what: 'Toll: Mainline → US Gulf Coast', s: d.tolls.mainlineUsgc },
    { what: 'Toll: TMX Edmonton → Westridge', s: d.tolls.tmxWestridge },
  ]
}

/** Full source list — used in the desktop footer popover and the phone "About" tab. */
export function SourceList({ data }: { data: Data }) {
  return (
    <div className="space-y-3 text-xs">
      <ul className="divide-y divide-white/5">
        {rows(data).map(({ what, s }) => (
          <li key={what} className="flex items-start justify-between gap-3 py-1.5">
            <div className="min-w-0">
              <div className="text-zinc-200">{what}</div>
              <a href={s.sourceUrl} target="_blank" rel="noreferrer" className="text-[11px] text-zinc-500 hover:text-zinc-300 hover:underline">
                {s.source}
              </a>
            </div>
            <SourceTag s={s} className="shrink-0 pt-0.5" />
          </li>
        ))}
        <li className="py-1.5">
          <div className="text-zinc-200">Basemap</div>
          <span className="text-[11px] text-zinc-500">
            ©{' '}
            <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer" className="hover:text-zinc-300 hover:underline">
              OpenStreetMap
            </a>{' '}
            contributors ©{' '}
            <a href="https://carto.com/attributions" target="_blank" rel="noreferrer" className="hover:text-zinc-300 hover:underline">
              CARTO
            </a>
          </span>
        </li>
      </ul>
      <p className="text-[11px] leading-snug text-zinc-500">
        Quality discounts, tanker freight, the Hardisty→Edmonton feeder and rail cost are the author&rsquo;s editable
        assumptions, not published prices. Tolls are entered by hand from regulatory filings and marked stale after 6
        months. Prices refresh automatically every 3 days; last refresh {formatAsOf(data.generatedAt.slice(0, 10))}.
      </p>
    </div>
  )
}

export function Credits({ className = '' }: { className?: string }) {
  return (
    <p className={`text-[11px] text-zinc-500 ${className}`}>
      <span className="text-zinc-400">Public data only. Not investment advice.</span> · Built by{' '}
      <a href={LINKEDIN} target="_blank" rel="noreferrer" className="text-zinc-300 hover:text-white hover:underline">
        Syed Ifraz Ahsan
      </a>{' '}
      ·{' '}
      <a href={REPO} target="_blank" rel="noreferrer" className="hover:text-zinc-300 hover:underline">
        Source code
      </a>
    </p>
  )
}

/** Desktop footer bar with an expandable source list. */
export default function Footer({ data }: { data: Data }) {
  const [open, setOpen] = useState(false)
  const anyStale = rows(data).some(({ s }) => isStale(s))
  return (
    <footer className="pointer-events-none absolute inset-x-0 bottom-[calc(env(safe-area-inset-bottom,0px)+1rem)] flex justify-center px-[23.5rem] max-[1180px]:justify-start max-[1180px]:pl-16 max-[1180px]:pr-[22rem]">
      <div className={`${glass} pointer-events-auto max-w-xl`}>
        {open && (
          <div id="sources" className="max-h-[60dvh] overflow-y-auto border-b border-white/10 p-4">
            <h2 className="mb-1 text-sm font-semibold">Sources &amp; as-of dates</h2>
            <SourceList data={data} />
          </div>
        )}
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 px-3.5 py-2">
          <button
            type="button"
            aria-expanded={open}
            aria-controls="sources"
            onClick={() => setOpen((o) => !o)}
            className="inline-flex items-center gap-1.5 text-[11px] font-medium text-zinc-300 hover:text-white"
          >
            {anyStale && <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-amber-400" />}
            Sources &amp; dates {open ? '▾' : '▴'}
          </button>
          <Credits />
        </div>
      </div>
    </footer>
  )
}
