import { useLayoutEffect, useMemo, useRef } from 'react'
import { card, Money } from '../components/ui'
import type { Data } from '../data'
import { useReducedMotion } from '../hooks'
import type { LaneId } from '../lanes'
import { computeAll, defaultInputs, ranked, type LaneResult, type Results } from '../netback'

interface Props {
  data: Data
  results: Results
}

/** Up/down move: green/red + arrow (never colour alone). */
function Move({ n, money = false }: { n: number; money?: boolean }) {
  const eps = money ? 0.005 : 0.5
  if (Math.abs(n) < eps) return <span className="num text-subtle">{money ? '$0.00' : '–'}</span>
  const up = n > 0
  return (
    <span className={`num inline-flex items-center gap-0.5 whitespace-nowrap font-medium ${up ? 'text-up' : 'text-down'}`}>
      <span aria-hidden>{up ? '▲' : '▼'}</span>
      <span className="sr-only">{up ? 'up' : 'down'}</span>
      {money ? <Money value={Math.abs(n)} /> : Math.abs(n)}
    </span>
  )
}

export default function RankingsTab({ data, results }: Props) {
  const reduce = useReducedMotion()
  const today = useMemo(() => computeAll(data, defaultInputs(data)), [data])
  const todayOrder = useMemo(() => ranked(today).map((r) => r.lane.id), [today])

  const order = ranked(results)
  const offline = (Object.values(results) as LaneResult[]).filter((r) => r.offline)
  const leader = order[0]?.best.netback ?? 0
  const rows = [...order, ...offline]

  // FLIP: remember each row's last position, animate from there to the new one.
  const refs = useRef(new Map<LaneId, HTMLLIElement>())
  const last = useRef(new Map<LaneId, number>())
  const key = rows.map((r) => r.lane.id).join('|')
  useLayoutEffect(() => {
    const next = new Map<LaneId, number>()
    refs.current.forEach((el, id) => {
      const top = el.getBoundingClientRect().top
      next.set(id, top)
      const prev = last.current.get(id)
      if (!reduce && prev != null && Math.abs(prev - top) > 1) {
        el.animate([{ transform: `translateY(${prev - top}px)` }, { transform: 'translateY(0)' }], {
          duration: 420,
          easing: 'cubic-bezier(0.2, 0.8, 0.2, 1)',
        })
      }
    })
    last.current = next
  }, [key, reduce])

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-4xl px-4 py-6 md:px-6">
        <h1 className="text-[22px] font-semibold tracking-tight">Rankings</h1>
        <p className="mt-1 max-w-xl text-[13px] text-muted">
          All lanes ranked by best netback to Hardisty. Move a slider or pick a scenario: rows slide to their new rank, with the change
          against Today.
        </p>

        <div className={`${card} mt-5 overflow-hidden`}>
          {/* Header */}
          <div className="grid grid-cols-[1.75rem_1fr_6.5rem] items-center gap-3 border-b border-line px-4 py-2.5 text-[11px] font-medium uppercase tracking-wide text-subtle sm:grid-cols-[2.5rem_3rem_1fr_6rem_6.5rem_5.5rem]">
            <span>#</span>
            <span className="hidden sm:block">Move</span>
            <span>Lane</span>
            <span className="text-right">Netback</span>
            <span className="hidden text-right sm:block">vs Today</span>
            <span className="hidden text-right sm:block">Gap to #1</span>
          </div>
          <ol>
            {rows.map((r) => {
              const rank = r.offline ? null : order.indexOf(r) + 1
              const was = todayOrder.indexOf(r.lane.id)
              const rankMove = rank != null && was >= 0 ? was + 1 - rank : 0
              const delta = r.best.netback - today[r.lane.id].best.netback
              const isLeader = rank === 1
              return (
                <li
                  key={r.lane.id}
                  ref={(el) => {
                    if (el) refs.current.set(r.lane.id, el)
                    else refs.current.delete(r.lane.id)
                  }}
                  className={`relative grid grid-cols-[1.75rem_1fr_6.5rem] items-center gap-3 border-b border-line bg-surface px-4 py-3.5 last:border-b-0 sm:grid-cols-[2.5rem_3rem_1fr_6rem_6.5rem_5.5rem] ${
                    r.offline ? 'opacity-50' : ''
                  }`}
                >
                  {isLeader && <span aria-hidden className="absolute inset-y-0 left-0 w-[3px] bg-accent" />}
                  <span className={`num text-[15px] font-semibold ${isLeader ? 'text-accent' : 'text-fg'}`}>{rank ?? '—'}</span>
                  <span className="hidden text-[12px] sm:block" data-tip={rank != null ? `Today: #${was + 1}` : 'Offline in this scenario'}>
                    {r.offline ? <span className="text-subtle">–</span> : <Move n={rankMove} />}
                  </span>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="truncate text-[14px] font-medium">{r.lane.name}</span>
                      {r.offline && <span className="rounded-md bg-sunken px-1.5 py-0.5 text-[11px] text-muted">Offline</span>}
                    </div>
                    <div className="truncate text-[12px] text-muted">
                      {r.dests.length > 1 ? <>Best: {r.best.dest.name}</> : r.best.dest.place}
                      {r.lane.tag && <span className="text-subtle"> · {r.lane.tag.label}</span>}
                      <span className="sm:hidden">
                        {' '}
                        · <Move n={rankMove} />
                      </span>
                    </div>
                  </div>
                  <span className="text-right">
                    <Money
                      value={r.best.netback}
                      className={`text-[15px] font-semibold ${isLeader ? 'text-accent' : ''}`}
                      extra={`Best netback via ${r.best.dest.name}, US$/bbl`}
                      tipPos="left"
                    />
                    <span className="block text-[12px] sm:hidden">{r.offline ? <span className="text-subtle">—</span> : <Move n={delta} money />}</span>
                  </span>
                  <span
                    className="hidden text-right text-[13px] sm:block"
                    data-tip={`Today: $${today[r.lane.id].best.netback.toFixed(2)}`}
                    data-tip-pos="left"
                  >
                    {r.offline ? <span className="text-subtle">—</span> : <Move n={delta} money />}
                  </span>
                  <span className="hidden text-right text-[13px] text-muted sm:block">
                    {isLeader || r.offline ? '—' : <Money value={r.best.netback - leader} signed extra="Netback minus the #1 lane" tipPos="left" />}
                  </span>
                </li>
              )
            })}
          </ol>
        </div>
        <p className="mt-3 text-[12px] text-subtle">
          ▲▼ rank moves and $ changes are measured against Today (latest published data). Each lane&rsquo;s netback is its best destination.
        </p>
      </div>
    </div>
  )
}
