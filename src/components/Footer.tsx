import type { Data, Sourced } from '../data'
import { formatAsOf } from '../data'
import { SourceTag } from './ui'

const LINKEDIN = 'https://www.linkedin.com/in/syedifrazahsan/'
const REPO = 'https://github.com/SyedLine/pipe-dreams'
/** Feedback form URL — set once a form service is chosen; until then the text isn't a link. */
const FEEDBACK_URL = ''
const YEAR = new Date().getFullYear()

export function sourceRows(d: Data): { what: string; s: Sourced }[] {
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
    { what: 'Toll: Keystone → Cushing', s: d.tolls.keystoneCushing },
    { what: 'Toll: Keystone → Houston', s: d.tolls.keystoneUsgc },
    { what: 'Toll: Express → Wood River', s: d.tolls.expressWoodRiver },
    { what: 'Toll: TMX Edmonton → Westridge', s: d.tolls.tmxWestridge },
  ]
}

/** Full source list — Sources sheet and Method tab. */
export function SourceList({ data }: { data: Data }) {
  return (
    <div className="space-y-3">
      <ul className="divide-y divide-line">
        {sourceRows(data).map(({ what, s }) => (
          <li key={what} className="flex items-start justify-between gap-4 py-2.5">
            <div className="min-w-0">
              <div className="text-[13px] text-fg">{what}</div>
              <a href={s.sourceUrl} target="_blank" rel="noreferrer" className="text-[12px] text-muted hover:text-accent">
                {s.source}
              </a>
            </div>
            <SourceTag s={s} className="shrink-0 pt-1" />
          </li>
        ))}
        <li className="py-2.5">
          <div className="text-[13px] text-fg">Basemap</div>
          <span className="text-[12px] text-muted">
            ©{' '}
            <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer" className="hover:text-accent">
              OpenStreetMap
            </a>{' '}
            contributors ©{' '}
            <a href="https://carto.com/attributions" target="_blank" rel="noreferrer" className="hover:text-accent">
              CARTO
            </a>
          </span>
        </li>
      </ul>
      <p className="text-[12px] leading-snug text-muted">
        Prices refresh automatically every 3 days (last refresh {formatAsOf(data.generatedAt.slice(0, 10))}). Tolls are entered by hand from
        regulatory filings and flagged stale after 6 months.
      </p>
    </div>
  )
}

/** Slim bar at the bottom of every tab. */
export default function AppFooter() {
  const feedback = FEEDBACK_URL ? (
    <a href={FEEDBACK_URL} target="_blank" rel="noreferrer" className="text-accent hover:underline">
      feedback is welcome
    </a>
  ) : (
    'feedback is welcome'
  )
  return (
    <footer className="flex flex-wrap items-center justify-center gap-x-3 gap-y-0.5 border-t border-line bg-surface px-4 py-2 pb-[calc(env(safe-area-inset-bottom,0px)+0.5rem)] text-center text-[11px] text-subtle md:justify-between md:text-left">
      <span>
        © {YEAR}{' '}
        <a href={LINKEDIN} target="_blank" rel="noreferrer" className="text-muted hover:text-accent">
          Syed Ifraz Ahsan
        </a>
        . All rights reserved &amp; all wrongs reversed. I&rsquo;m always learning, and {feedback}.
      </span>
      <span>
        Public data only. Not investment advice. ·{' '}
        <a href={REPO} target="_blank" rel="noreferrer" className="hover:text-accent">
          Source
        </a>
      </span>
    </footer>
  )
}
