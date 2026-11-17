import { card, header, Money, SourceTag } from '../components/ui'
import type { Data } from '../data'
import type { Theme } from '../hooks'
import { laneById, type LaneId } from '../lanes'
import type { DestResult, LaneResult, Results } from '../netback'

/** Which PADD each priced destination sits in. */
const DEST_PADD: Record<string, string> = {
  chicago: '2',
  'wood-river': '2',
  cushing: '2',
  houston: '3',
  'houston-keystone': '3',
  'port-arthur': '3',
  puget: '5',
  sf: '5',
  la: '5',
}

const mbd = (kbd: number) => `${(kbd / 1000).toFixed(2)} Mb/d`

export default function MarketsTab({ data, theme, results }: { data: Data; theme: Theme; results: Results }) {
  const ref = data.markets.refining
  const imports = data.prices.imports
  const all: { r: LaneResult; d: DestResult }[] = (Object.values(results) as LaneResult[])
    .filter((r) => !r.offline)
    .flatMap((r) => r.dests.map((d) => ({ r, d })))

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-5xl space-y-6 px-4 py-6 md:px-6">
        <header>
          <h1 className={header}>Markets</h1>
          <p className="mt-1 max-w-2xl text-[13px] text-muted">
            Where Canadian heavy crude gets refined. Each US refining district (PADD) with the lanes that reach it, how much it can run, how much
            heavy crude it can handle (coking), how much of its imported crude comes from Canada, and its largest refineries. Turn on{' '}
            <span className="text-fg">PADDs</span> and <span className="text-fg">Refineries</span> on the Map tab to see them.
          </p>
        </header>

        <p className="rounded-md border border-line bg-surface px-3 py-2 text-[12px] leading-snug text-muted">
          <span className="font-medium text-fg">Coking refineries only.</span> The refineries listed have coking capacity, which lets them run
          heavy crude like WCS directly; plants without a coker are left out.
        </p>

        <div className="grid gap-3 md:grid-cols-2">
          {ref.padds.map((p) => {
            const imp = imports?.padds[p.padd]
            const share = imp && imp.totalKbd > 0 ? imp.canadaKbd / imp.totalKbd : null
            const here = all.filter((x) => DEST_PADD[x.d.dest.id] === p.padd)
            const best = here.reduce<(typeof here)[number] | null>((a, b) => (!a || b.d.netback > a.d.netback ? b : a), null)
            return (
              <article key={p.padd} className={`${card} flex flex-col p-4`}>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className={header}>PADD {p.padd}</div>
                    <h2 className="text-[17px] font-semibold tracking-tight">{p.name}</h2>
                  </div>
                  <div className="text-right">
                    <div className="text-[11px] text-muted">Best netback here</div>
                    {best ? (
                      <>
                        <Money value={best.d.netback} className="text-[17px] font-semibold text-accent" extra={`${best.r.lane.name} → ${best.d.dest.name}`} tipPos="left" />
                        <div className="text-[11px] text-muted">via {best.r.lane.name.split(' →')[0]}</div>
                      </>
                    ) : (
                      <div className="text-[12px] text-subtle">No priced destination</div>
                    )}
                  </div>
                </div>

                <div className="mt-2 flex flex-wrap gap-1.5 text-[11px]">
                  {p.lanes.map((id) => {
                    const lane = laneById[id as LaneId]
                    return (
                      <span key={id} className="inline-flex items-center gap-1 rounded bg-sunken px-1.5 py-0.5 text-muted">
                        <span className="h-2 w-2 rounded-[2px]" style={{ backgroundColor: lane.color[theme] }} />
                        {lane.name}
                      </span>
                    )
                  })}
                </div>

                <dl className="mt-3 grid grid-cols-3 gap-2 border-t border-line pt-3">
                  <div>
                    <dt className="text-[11px] text-muted">Refining</dt>
                    <dd className="num text-[15px] font-semibold">{mbd(p.crudeKbd)}</dd>
                    <dd className="text-[11px] text-subtle">{p.refineries} refineries</dd>
                  </div>
                  <div>
                    <dt className="text-[11px] text-muted" title="Coking capacity lets a refinery run heavy crude like WCS">
                      Coking (heavy)
                    </dt>
                    <dd className="num text-[15px] font-semibold">{mbd(p.cokingKbd)}</dd>
                    <dd className="text-[11px] text-subtle">{p.cokerSites} sites with cokers</dd>
                  </div>
                  <div>
                    <dt className="text-[11px] text-muted">Canadian crude in</dt>
                    <dd className="num text-[15px] font-semibold">{imp ? mbd(imp.canadaKbd) : '—'}</dd>
                    <dd className="text-[11px] text-subtle">{share != null ? `${Math.round(share * 100)}% of crude imports` : ''}</dd>
                  </div>
                </dl>
                {share != null && (
                  <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-line-strong" aria-label={`${Math.round(share * 100)}% of crude imports from Canada`}>
                    <div className="h-full rounded-full bg-accent" style={{ width: `${share * 100}%` }} />
                  </div>
                )}

                <table className="mt-4 w-full text-[12px]">
                  <thead>
                    <tr className="text-left text-[11px] text-subtle">
                      <th className="pb-1 font-normal">Largest coking refineries</th>
                      <th className="pb-1 text-right font-normal">Crude kb/d</th>
                      <th className="pb-1 text-right font-normal">Coker kb/d</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line">
                    {p.top.map((t) => (
                      <tr key={t.site}>
                        <td className="py-1.5 pr-2">
                          <div className="text-fg">{t.site}</div>
                          <div className="text-[11px] text-muted">{t.operator}</div>
                        </td>
                        <td className="num py-1.5 text-right">{t.crudeKbd}</td>
                        <td className="num py-1.5 text-right">
                          {t.cokeKbd}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </article>
            )
          })}
        </div>

        {data.markets.asia && <ChinaCard data={data} theme={theme} all={all} />}

        <section className={`${card} p-4 text-[12px] leading-relaxed text-muted`}>
          <p>
            <span className="text-fg">PADD 1</span> (East Coast) isn&rsquo;t served by these lanes. Japan, Korea and Taiwan are priced on the
            Netbacks tab.
          </p>
          <p className="mt-2">
            Imports are counted by the PADD where the crude is refined, so Canadian barrels that reach the Gulf Coast through the Midwest may
            not all appear as Gulf Coast imports. Crude capacity is per calendar day; coking per stream day. Refinery locations on the map are
            approximate.
          </p>
          <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1">
            <span>
              <SourceTag s={ref} /> <span className="text-subtle">{ref.source}</span>
            </span>
            {imports && (
              <span>
                <SourceTag s={imports} /> <span className="text-subtle">{imports.source}</span>
              </span>
            )}
          </div>
        </section>
      </div>
    </div>
  )
}

function ChinaCard({ data, theme, all }: { data: Data; theme: Theme; all: { r: LaneResult; d: DestResult }[] }) {
  const asia = data.markets.asia!
  const china = all.find((x) => x.d.dest.id === 'china')
  const lane = laneById['tmx-asia']
  return (
    <article className={`${card} p-4`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className={header}>Asia</div>
          <h2 className="text-[17px] font-semibold tracking-tight">China</h2>
        </div>
        <div className="text-right">
          <div className="text-[11px] text-muted">Netback to China</div>
          {china ? (
            <Money value={china.d.netback} className="text-[17px] font-semibold text-accent" extra="TMX → Westridge → tanker to Ningbo-Zhoushan" tipPos="left" />
          ) : (
            <div className="text-[12px] text-subtle">TMX offline</div>
          )}
        </div>
      </div>
      <div className="mt-2 flex flex-wrap gap-1.5 text-[11px]">
        <span className="inline-flex items-center gap-1 rounded bg-sunken px-1.5 py-0.5 text-muted">
          <span className="h-2 w-2 rounded-[2px]" style={{ backgroundColor: lane.color[theme] }} />
          {lane.name}
        </span>
        <span className="rounded bg-sunken px-1.5 py-0.5 text-muted">China takes roughly half of seaborne TMX exports</span>
      </div>
      <table className="mt-4 w-full text-[12px]">
        <thead>
          <tr className="text-left text-[11px] text-subtle">
            <th className="pb-1 font-normal">Coking refineries buying TMX crude</th>
            <th className="pb-1 text-right font-normal">Crude kb/d</th>
            <th className="pb-1 text-right font-normal">Coker kb/d</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {asia.refineries.map((t) => (
            <tr key={t.site}>
              <td className="py-1.5 pr-2">
                <div className="text-fg">{t.site}</div>
                <div className="text-[11px] text-muted">{t.operator}</div>
                <div className="text-[11px] text-subtle">{t.cokeNote}</div>
              </td>
              <td className="num py-1.5 text-right align-top">{t.crudeKbd}</td>
              <td className="num py-1.5 text-right align-top">≈{t.cokeKbd}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="mt-3 text-[12px] leading-snug text-muted">
        Also buying TMX crude, coker capacity not confirmed in public sources:{' '}
        {asia.otherBuyers.map((b, i) => (
          <span key={b.site}>
            {i > 0 && '; '}
            <span className="text-fg">{b.site}</span> ({b.operator}, {b.crudeKbd} kb/d)
          </span>
        ))}
        .
      </p>
      <div className="mt-2 flex flex-wrap gap-x-2">
        <SourceTag s={asia} /> <span className="text-[11px] text-subtle">{asia.source}</span>
      </div>
    </article>
  )
}
