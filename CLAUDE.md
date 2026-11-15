Project: Pipe Dreams — a Hardisty egress netback monitor.
Question it answers: "Where should a WCS barrel at Hardisty go this month, and what is it worth?"

TECH
- React + Vite + Tailwind, static site deployed to GitHub Pages (repo: pipe-dreams, user: SyedLine).
- Dark mode by default, polished and modern.
- Map: MapLibre with free basemap tiles. Hardisty at the centre.

SCOPE (keep it simple)
- One crude: WCS. One month view. Everything netbacked to Hardisty in US$/bbl.
- Seven lanes:
  1. Enbridge Mainline -> Chicago
  2. Enbridge Mainline -> US Gulf Coast
  3. Keystone -> Steele City -> Cushing / US Gulf Coast (tagged "mostly contracted": little spot capacity)
  4. Express -> Casper -> Rockies refiners / Wood River, IL (one destination price: Wood River)
  5. TMX -> Westridge -> US West Coast (tanker)
  6. TMX -> Westridge -> Asia (tanker; show distances to Japan, Korea, China, Taiwan)
  7. Rail -> US Gulf Coast (one all-in cost, default ~US$15–20/bbl, editable)
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
- Deploy: GitHub Actions Pages deployment (`base: '/pipe-dreams/'`).
- EIA key lives in repo secret `EIA_API_KEY`.
- Local Node 22 LTS lives in `~/.local/node` (no Homebrew on this Mac).
- Data: `npm run refresh` rewrites the auto sections of `public/data.json` (EIA WTI/Brent/ANS, Alberta WTI–WCS diff, Bank of Canada USD/CAD, CrudeMonitor WCS quality, CER throughput). `tolls` and `assumptions` are hand-maintained and never touched by the script.
- Brent and ANS are applied as same-month spreads to WTI (ANS first-purchase prices lag ~2 months), so the WTI slider moves every benchmark.
- Mainline utilization = ex-Gretna throughput (all products) vs available capacity; TMX = system committed + uncommitted vs available capacity.
- Tolls used (all hand-entered in `public/data.json` → `tolls`, with filing + effective date): Enbridge Mainline IJT Hardisty→Chicago (dual currency); Enbridge FSP IJT CER No. 12 uncommitted heavy Hardisty→USGC; South Bow Keystone IJT CER No. 84 / FERC 7.44.0 uncommitted heavy Hardisty→Cushing and →Houston (tolls differ per destination); Express/Platte joint *term* rate CER 209 / FERC 167.34.0 heavy Hardisty→Wood River (Express is largely contracted; its joint tariff only lists term rates); TMX Interim Tariff uncommitted heavy Edmonton→Westridge (+ assumed Hardisty→Edmonton feeder).
- Lanes are schematic routes in `src/lanes.ts`; a lane may carry a `tag` caveat chip (Keystone: "Mostly contracted"). Tolls can vary per destination (`destToll` in `src/netback.ts`).
- WCS quality shows API gravity, density (kg/m³) and sulphur, latest sample and 5-yr average, from CrudeMonitor.
- WCS differential is **local-only**: the Alberta API returns 403 to GitHub runners, so CI skips it (keeps last value; stale once >2 months old). Refresh it from the Mac with `npm run refresh`, then commit `public/data.json`. Don't try to evade the block (header spoofing etc.).

## Redesign (Nov 2026) — multi-tab app
- Tabs: Map, Netbacks, Rankings, Egress, Method; tab lives in the URL hash (#map …). Inputs drawer (left; bottom sheet on phones) is shared by all tabs.
- Look: neutral greys + ONE accent (blue, `--accent`), Inter (self-hosted via @fontsource-variable/inter), tabular numbers (`.num`). Green/red (`--up`/`--down`) only for ▲▼ deltas, always with the arrow. Tokens live in `src/index.css`.
- Theme: light/dark toggle in the top bar, remembered in localStorage (`pd-theme`), defaults to system; `index.html` applies it before paint. Map swaps CARTO Positron/Dark Matter.
- Map: lanes grey by default; only the best lane (accent + glow) and the hovered/selected lane (foreground colour) stand out; city labels only for the active lane; nm distances only in the panel.
- TMX originates at Edmonton: lanes are drawn from Edmonton with a dotted Hardisty→Edmonton `transfer` leg; its cost is an editable assumption (`transferCost`).
- Presets (`src/presets.ts`): Today, Pipes full (2023: WTI 77.58, Brent +4.91, diff 18.66, TMX offline), TMX outage (TMX offline, diff → rail breakeven), Wide diff (28.18). Lanes can be toggled offline.
- Every number is hover-explained (`data-tip`, `Money`/`tipFor` in `src/components/ui.tsx`).
- Footer: "All rights reserved & all wrongs reversed… feedback is welcome"; "feedback is welcome" opens an in-app form that POSTs to the author's Formspree form (`FEEDBACK_ENDPOINT` in `src/components/Feedback.tsx`), which emails them. Favicon: red crude tanker, side view (`public/favicon.svg`).
- Tabs: Netbacks = per-destination cards with shared-scale waterfalls; Rankings = FLIP-animated leaderboard with ▲▼ vs Today; Egress = throughput vs capacity per pipe + rail-breakeven gauge; Method = plain-English explainer, live worked example, assumptions, sources.
