Project: Pipe Dreams — a Hardisty egress netback monitor.
Question it answers: "Where should a WCS barrel at Hardisty go this month, and what is it worth?"

TECH
- React + Vite + Tailwind, static site deployed to GitHub Pages (repo: hardisty-egress, user: SyedLine).
- Dark mode by default, polished and modern.
- Map: MapLibre with free basemap tiles. Hardisty at the centre.

SCOPE (keep it simple)
- One crude: WCS. One month view. Everything netbacked to Hardisty in US$/bbl.
- Five lanes:
  1. Enbridge Mainline -> Chicago
  2. Enbridge Mainline -> US Gulf Coast
  3. TMX -> Westridge -> US West Coast (tanker)
  4. TMX -> Westridge -> Asia (tanker; show distances to Japan, Korea, China, Taiwan)
  5. Rail -> US Gulf Coast (one all-in cost, default ~US$15–20/bbl, editable)
- Netback = destination price − pipeline toll − freight ± quality adjustment.

INTERACTION
- Each lane drawn as a line from Hardisty. Best lane glows.
- Hover a lane: small preview card (destinations + best netback).
- Click a lane: frosted, semi-transparent side panel, map visible behind.
  Lists each destination option with its own freight slider and live netback; best option highlighted.
- Phones: tap = hover behaviour.
- Global sliders: WTI, WCS diff, tanker freight, rail cost.
- Breakeven marker: when pipes are full, the WCS diff tends to widen toward rail cost. Show this.
- Utilization chart: pipe throughput vs capacity — "How close is egress to tight?"

DATA (public only, no employer data)
- CER pipeline throughput & capacity (open data CSV).
- CER-filed tolls for Mainline and TMX.
- EIA prices (free API) for WTI and destination benchmarks.
- Alberta government WTI–WCS differential.
- CrudeMonitor for WCS quality reference.
- Store a snapshot in data.json; show source and as-of date for every number.

AUTOMATION
- GitHub Action that refreshes data.json every 3 days and redeploys.
- If a source fails, keep the last good values and show the stale date.

FOOTER
- Sources with links, as-of dates, "Public data only. Not investment advice." Built by Syed Ifraz Ahsan, link to LinkedIn.

Work step by step: scaffold and deploy a placeholder first, then the map, then the data, then the panels. Check with me before big decisions.

## Decisions (agreed 2026-11-14)
- Basemap: CARTO Dark Matter GL style (no API key; attribution shown).
- Destination price = public benchmark (WTI for Chicago/USGC, EIA ANS for USWC, Brent for Asia) + editable heavy-sour quality diff; defaults sourced and labelled as assumptions.
- Tolls: entered by hand from CER tariff filings with link + effective date; the refresh Action never changes them. UI marks a toll stale if its as-of date is more than 6 months old.
- Deploy: GitHub Actions Pages deployment (`base: '/hardisty-egress/'`).
- EIA key lives in repo secret `EIA_API_KEY`.
- Local Node 22 LTS lives in `~/.local/node` (no Homebrew on this Mac).
