import { card, header, SourceTag } from '../components/ui'
import type { Data, Project, Sourced, Stage } from '../data'
import { formatAsOf } from '../data'
import type { Theme } from '../hooks'
import { laneById, type LaneId } from '../lanes'

const STEPS: { stage: Stage; label: string }[] = [
  { stage: 'proposed', label: 'Proposed' },
  { stage: 'commercial', label: 'Commercial' },
  { stage: 'regulatory', label: 'Regulatory' },
  { stage: 'sanctioned', label: 'Sanctioned' },
  { stage: 'construction', label: 'Construction' },
  { stage: 'in-service', label: 'In service' },
]
const stepIndex = (s: Stage) => STEPS.findIndex((x) => x.stage === s)
const SANCTIONED: Stage[] = ['sanctioned', 'construction', 'in-service']

const Y0 = 2026
const Y1 = 2035
const xPct = (year: number) => `${((year - Y0) / (Y1 - Y0)) * 100}%`

const kbd = (n: number) => `${n >= 1000 ? (n / 1000).toFixed(n % 1000 ? 2 : 1).replace(/\.?0+$/, '') + ' Mb/d' : `${n.toLocaleString()} kb/d`}`

/** Projects are hand-entered: stale once their as-of date is over 6 months old. */
const projectSource = (p: Project): Sourced & { manual: true } => ({
  asOf: p.asOf,
  label: `${p.name}: status as reported`,
  source: p.source,
  sourceUrl: '',
  manual: true,
})

export default function OutlookTab({ data, theme }: { data: Data; theme: Theme }) {
  const items = data.projects.items
  const sanctioned = items.filter((p) => SANCTIONED.includes(p.stage))
  const developing = items.filter((p) => !SANCTIONED.includes(p.stage) && p.stage !== 'postponed')
  const postponed = items.filter((p) => p.stage === 'postponed')
  const sum = (ps: Project[]) => ps.reduce((s, p) => s + p.capacityKbd, 0)
  const last = (k: 'mainline' | 'tmx') => {
    const h = data.throughput[k].history.at(-1)!
    return Math.round((h.throughputKbd / h.capacityKbd) * 100)
  }
  const news = data.news?.items ?? []
  const nameOf = Object.fromEntries(items.map((p) => [p.id, p.name.replace(/ \(.*\)$/, '')]))

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-5xl space-y-6 px-4 py-6 md:px-6">
        <header>
          <h1 className={header}>Outlook</h1>
          <p className="mt-1 max-w-2xl text-[13px] text-muted">
            Export pipes are running at {last('mainline')}% (Mainline) and {last('tmx')}% (TMX) of capacity. Here is what&rsquo;s proposed to
            add room, how far along each project is, and the latest news. Turn on <span className="text-fg">Proposed</span> on the Map tab to
            see the new routes.
          </p>
        </header>

        {/* Headline numbers */}
        <section className="grid gap-2 sm:grid-cols-3">
          {[
            { k: 'Sanctioned', v: sum(sanctioned), note: sanctioned.map((p) => p.name).join(', ') },
            { k: 'In development', v: sum(developing), note: `${developing.length} projects, not yet sanctioned` },
            { k: 'Postponed', v: sum(postponed), note: postponed.map((p) => p.name).join(', ') || 'none' },
          ].map((s) => (
            <div key={s.k} className={`${card} p-4`}>
              <div className={header}>{s.k}</div>
              <div className="num mt-1 text-[24px] font-semibold">+{kbd(s.v)}</div>
              <div className="mt-0.5 truncate text-[12px] text-muted">{s.note}</div>
            </div>
          ))}
        </section>

        {/* Timeline */}
        <section className={`${card} p-4`} aria-labelledby="timeline">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 id="timeline" className={header}>
              Target in-service
            </h2>
            <div className="flex gap-4 text-[11px] text-muted">
              <span className="inline-flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full bg-accent" /> Sanctioned
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full border-2 border-accent" /> Not yet sanctioned
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full bg-subtle" /> Postponed / TBD
              </span>
            </div>
          </div>
          <div className="mt-4 space-y-2.5">
            {items.map((p) => (
              <TimelineRow key={p.id} p={p} />
            ))}
          </div>
          <div className="num relative ml-[38%] mt-2 h-4 text-[10px] text-subtle sm:ml-[30%]">
            {[2026, 2028, 2030, 2032, 2034].map((y) => (
              <span key={y} className="absolute -translate-x-1/2" style={{ left: xPct(y) }}>
                {y}
              </span>
            ))}
          </div>
        </section>

        {/* Project tracker */}
        <section aria-labelledby="tracker" className="space-y-2">
          <h2 id="tracker" className={header}>
            Project tracker
          </h2>
          <div className="grid gap-2 md:grid-cols-2">
            {items.map((p) => (
              <ProjectCard key={p.id} p={p} theme={theme} />
            ))}
          </div>
        </section>

        {/* News */}
        <section className={`${card} p-4`} aria-labelledby="news">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 id="news" className={header}>
              Latest news
            </h2>
            {data.news && <SourceTag s={data.news} />}
          </div>
          {news.length ? (
            <ul className="mt-3 divide-y divide-line">
              {news.map((n) => (
                <li key={n.title} className="grid grid-cols-[4.5rem_1fr] gap-3 py-2 text-[13px]">
                  <span className="num pt-0.5 text-[11px] text-subtle">{formatAsOf(n.date)}</span>
                  <div className="min-w-0">
                    <div className="text-fg">{n.title}</div>
                    <div className="mt-0.5 text-[11px] text-muted">
                      {n.outlet} · <span className="text-subtle">{nameOf[n.projectId] ?? n.projectId}</span>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-3 text-[13px] text-muted">No recent headlines.</p>
          )}
          <p className="mt-3 text-[11px] text-subtle">
            Headlines are collected automatically every three days and filtered by project. Project stages above are checked by hand.
          </p>
        </section>
      </div>
    </div>
  )
}

function TimelineRow({ p }: { p: Project }) {
  const done = SANCTIONED.includes(p.stage)
  const range = p.id === 'pacific-link' ? ([2032, 2034] as const) : null
  return (
    <div className="grid grid-cols-[38%_1fr] items-center gap-3 text-[12px] sm:grid-cols-[30%_1fr]">
      <div className="min-w-0">
        <div className="truncate font-medium text-fg">{p.name.replace(/ \(.*\)$/, '')}</div>
        <div className="num truncate text-[11px] text-muted">
          +{kbd(p.capacityKbd)} · {p.target}
        </div>
      </div>
      <div className="relative h-5">
        <div className="absolute inset-x-0 top-1/2 h-px bg-line-strong" />
        {/* "now" marker */}
        <div className="absolute top-0 h-5 w-px bg-subtle" style={{ left: xPct(2026.9) }} title="Today" />
        {range ? (
          <div
            className="absolute top-1/2 h-2.5 -translate-y-1/2 rounded-full border-2 border-accent"
            style={{ left: xPct(range[0]), width: `calc(${xPct(range[1])} - ${xPct(range[0])})` }}
            title={p.target}
          />
        ) : p.targetYear ? (
          <span
            className={`absolute top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full ${done ? 'bg-accent' : 'border-2 border-accent bg-surface'}`}
            style={{ left: xPct(p.targetYear + 0.5) }}
            title={p.target}
          />
        ) : (
          <span className="absolute left-[12%] top-1/2 -translate-y-1/2 rounded bg-sunken px-1.5 text-[10px] text-muted">
            {p.stage === 'postponed' ? 'Postponed' : 'In-service date TBD'}
          </span>
        )}
      </div>
    </div>
  )
}

function ProjectCard({ p, theme }: { p: Project; theme: Theme }) {
  const idx = stepIndex(p.stage)
  const postponed = p.stage === 'postponed'
  const lane = p.onLane ? laneById[p.onLane as LaneId] : null
  return (
    <article className={`${card} flex flex-col p-4 ${postponed ? 'opacity-70' : ''}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-[14px] font-semibold">{p.name}</h3>
          <p className="text-[12px] text-muted">{p.operator}</p>
        </div>
        <div className="text-right">
          <div className="num text-[17px] font-semibold">+{kbd(p.capacityKbd)}</div>
          <div className="text-[11px] text-muted">{p.target}</div>
        </div>
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[11px]">
        <span className="rounded bg-sunken px-1.5 py-0.5 text-muted">{p.kind === 'new' ? 'New pipeline' : 'Expansion'}</span>
        {lane && (
          <span className="inline-flex items-center gap-1 rounded bg-sunken px-1.5 py-0.5 text-muted">
            <span className="h-2 w-2 rounded-[2px]" style={{ backgroundColor: lane.color[theme] }} />
            on {p.onLane?.startsWith('tmx') ? 'Trans Mountain' : 'Enbridge Mainline'}
          </span>
        )}
        {postponed && <span className="rounded bg-sunken px-1.5 py-0.5 font-medium text-down">Postponed</span>}
      </div>

      {/* Stage stepper */}
      <ol className="mt-3 grid grid-cols-6 gap-1" aria-label={`Stage: ${postponed ? 'postponed' : STEPS[idx]?.label}`}>
        {STEPS.map((s, i) => {
          const reached = !postponed && i <= idx
          const current = !postponed && i === idx
          return (
            <li key={s.stage} className="min-w-0">
              <div className={`h-1.5 rounded-full ${reached ? 'bg-accent' : 'bg-line-strong'}`} />
              <div className={`mt-1 truncate text-[10px] ${current ? 'font-semibold text-fg' : 'hidden text-subtle sm:block'}`}>{s.label}</div>
            </li>
          )
        })}
      </ol>

      <p className="mt-3 text-[12.5px] leading-snug text-muted">{p.summary}</p>

      <ul className="mt-3 space-y-1 border-t border-line pt-2 text-[12px]">
        {[...p.milestones].reverse().map((m) => (
          <li key={m.date + m.text} className="grid grid-cols-[4.5rem_1fr] gap-2">
            <span className="num text-[11px] text-subtle">{formatAsOf(m.date)}</span>
            <span className="text-fg">{m.text}</span>
          </li>
        ))}
      </ul>
      {p.routeNote && <p className="mt-2 text-[11px] text-subtle">{p.routeNote}</p>}
      <div className="mt-auto pt-3">
        <SourceTag s={projectSource(p)} />
        <span className="ml-2 text-[11px] text-subtle">{p.source}</span>
      </div>
    </article>
  )
}
