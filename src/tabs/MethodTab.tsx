import type { ReactNode } from 'react'
import { SourceList } from '../components/Footer'
import { card, Delta, Money } from '../components/ui'
import type { Benchmark, Data } from '../data'
import { signedUsd, usd } from '../data'
import { LANES } from '../lanes'
import type { Inputs, LaneResult } from '../netback'

interface Props {
  data: Data
  inputs: Inputs
  bestR: LaneResult
}

const BENCH: Record<Benchmark, string> = { wti: 'WTI', brent: 'Brent', ans: 'ANS' }

function Section({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <section aria-labelledby={id} className="space-y-3">
      <h2 id={id} className="text-[12px] font-semibold uppercase tracking-[0.08em] text-accent">
        {title}
      </h2>
      <div className="space-y-3 text-[14px] leading-relaxed text-muted [&_strong]:font-medium [&_strong]:text-fg">{children}</div>
    </section>
  )
}

export default function MethodTab({ data, inputs, bestR }: Props) {
  const d = bestR.best
  const a = data.assumptions
  const qualityRows = LANES.flatMap((l) =>
    l.destinations.map((dest) => {
      const q = a.qualityAdjUsd[dest.id] as { value: number; benchmark: Benchmark }
      return { lane: l.name, dest: dest.name, q }
    }),
  )

  return (
    <div className="h-full overflow-y-auto">
      <article className="mx-auto max-w-3xl space-y-10 px-4 py-8 md:px-6">
        <header>
          <h1 className="text-[12px] font-semibold uppercase tracking-[0.08em] text-accent">Method</h1>
          <p className="mt-2 text-[15px] leading-relaxed text-muted">
            Pipe Dreams asks one question: <strong className="font-medium text-fg">where should a barrel of Western Canadian Select at Hardisty go this month, and what is it worth?</strong>{' '}
            Here is how every number is built, where it comes from, and what&rsquo;s assumed.
          </p>
        </header>

        <Section id="m-netback" title="What a netback is">
          <p>
            A <strong>netback</strong> is the price a barrel fetches at its destination, minus everything it costs to get there, expressed back at the
            starting point. If WCS sells for $95 in Houston and it costs $9 to pipe it there, the barrel is worth about $86 at Hardisty. Compare
            netbacks across destinations and the highest one is where the barrel &ldquo;wants&rdquo; to go.
          </p>
          <div className={`${card} p-4 font-mono text-[13px] text-fg`}>
            netback = benchmark + quality adj. − pipeline toll − transfer − freight
          </div>
          <ul className="list-disc space-y-1 pl-5">
            <li>
              <strong>Benchmark</strong>: the marker crude priced at the destination: WTI for US Midwest and Gulf Coast, ANS for the US West Coast, Brent
              for Asia. Brent and ANS are WTI plus a spread, so moving WTI moves everything.
            </li>
            <li>
              <strong>Quality adjustment</strong>: WCS is heavy (≈{data.quality.apiGravity}° API, {data.quality.densityKgM3} kg/m³) and sour (≈
              {data.quality.sulphurPct}% sulphur), so it sells below light-sweet benchmarks.
            </li>
            <li>
              <strong>Pipeline toll</strong>: the regulated rate to ship a barrel, from each pipeline&rsquo;s filed tariff.
            </li>
            <li>
              <strong>Transfer</strong>: Trans Mountain starts in Edmonton, not Hardisty, so TMX barrels pay to get to Edmonton first.
            </li>
            <li>
              <strong>Freight</strong>: tanker cost from Westridge for coastal and Asian destinations, or the all-in cost for rail.
            </li>
          </ul>
        </Section>

        <Section id="m-example" title="Worked example (live)">
          <p>
            With the current inputs, the best destination is <strong>{d.dest.name}</strong> via <strong>{bestR.lane.name}</strong>:
          </p>
          <div className={`${card} divide-y divide-line text-[13px]`}>
            {d.steps.map((s, i) => (
              <div key={s.label} className="flex items-baseline justify-between gap-4 px-4 py-2.5">
                <span className="text-muted">
                  {s.label}
                  {s.note && <span className="text-subtle"> · {s.note}</span>}
                </span>
                <Money value={s.value} signed={i > 0} source={s.source} extra={s.note} className="text-fg" tipPos="left" />
              </div>
            ))}
            <div className="flex items-baseline justify-between gap-4 px-4 py-2.5">
              <span className="font-medium text-fg">Netback at Hardisty</span>
              <Money value={d.netback} className="font-semibold text-accent" />
            </div>
            <div className="flex items-baseline justify-between gap-4 px-4 py-2.5">
              <span className="text-muted">vs selling WCS at Hardisty (WTI − diff = {usd(inputs.wti - inputs.wcsDiff)})</span>
              <Delta value={d.uplift} />
            </div>
          </div>
          <p className="text-[13px]">Move any slider in the Inputs drawer and this example updates.</p>
        </Section>

        <Section id="m-egress" title="Egress, rail and the differential">
          <p>
            The <strong>WTI–WCS differential</strong> is the discount WCS trades at in Alberta. When export pipes have spare room, competition between
            pipes keeps the discount close to <strong>pipe parity</strong>, roughly what it costs to ship on the best pipe. When pipes fill up, the
            next barrel has to go by rail, which is more expensive, and the discount widens toward the <strong>rail breakeven</strong>. The Egress tab shows how
            full Mainline and TMX are, and where today&rsquo;s differential sits between those two anchors.
          </p>
        </Section>

        <Section id="m-assumptions" title="Assumptions">
          <p>These are judgement calls, not published prices. Every one can be changed on the page.</p>
          <div className={`${card} overflow-hidden`}>
            <table className="w-full text-[13px]">
              <tbody className="divide-y divide-line">
                <tr>
                  <td className="px-4 py-2.5 text-muted">Tanker freight</td>
                  <td className="num px-4 py-2.5 text-right text-fg">
                    {usd(a.tanker.fixedUsd)} + {usd(inputs.tankerRate)} per 1,000 nm
                  </td>
                </tr>
                <tr>
                  <td className="px-4 py-2.5 text-muted">Rail, all-in to the Gulf Coast</td>
                  <td className="num px-4 py-2.5 text-right text-fg">{usd(inputs.railCost)}</td>
                </tr>
                <tr>
                  <td className="px-4 py-2.5 text-muted">Hardisty → Edmonton transfer (TMX only)</td>
                  <td className="num px-4 py-2.5 text-right text-fg">{usd(inputs.transferCost)}</td>
                </tr>
                <tr>
                  <td className="px-4 py-2.5 text-muted">Brent − WTI spread</td>
                  <td className="num px-4 py-2.5 text-right text-fg">{signedUsd(inputs.brentSpread)}</td>
                </tr>
                <tr>
                  <td className="px-4 py-2.5 text-muted">ANS − WTI spread (same month)</td>
                  <td className="num px-4 py-2.5 text-right text-fg">{signedUsd(data.prices.ans.spreadToWti ?? 0)}</td>
                </tr>
              </tbody>
            </table>
          </div>
          <details className={`${card} px-4 py-3 text-[13px]`}>
            <summary className="cursor-pointer font-medium text-fg">Quality adjustments by destination</summary>
            <table className="mt-2 w-full">
              <tbody className="divide-y divide-line">
                {qualityRows.map((r) => (
                  <tr key={`${r.lane}:${r.dest}`}>
                    <td className="py-2 text-muted">
                      {r.dest} <span className="text-subtle">· {r.lane}</span>
                    </td>
                    <td className="num py-2 text-right text-fg">
                      {signedUsd(r.q.value)} vs {BENCH[r.q.benchmark]}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </details>
        </Section>

        <Section id="m-sources" title="Sources and as-of dates">
          <p>
            Public data only. Prices, exchange rate, crude quality and pipeline throughput refresh automatically every three days; the WTI–WCS
            differential is refreshed by hand because its source blocks automated servers. Anything older than its normal update cycle is marked{' '}
            <span className="text-stale">stale</span>.
          </p>
          <div className={`${card} px-4`}>
            <SourceList data={data} />
          </div>
        </Section>

        <Section id="m-limits" title="Limits">
          <ul className="list-disc space-y-1 pl-5">
            <li>One crude (WCS), one month. Monthly averages hide daily moves.</li>
            <li>Uncommitted (spot) tolls are used where published; Express uses a term rate. Most capacity on Keystone and Express is contracted.</li>
            <li>Routes on the map are schematic, and tanker distances are approximate sailing routes.</li>
            <li>Destination prices are benchmark plus an assumed discount, not observed WCS prices at each destination.</li>
            <li>Not investment advice.</li>
          </ul>
        </Section>
      </article>
    </div>
  )
}
