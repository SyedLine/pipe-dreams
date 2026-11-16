#!/usr/bin/env node
/**
 * Refreshes the auto-sourced sections of public/data.json.
 *
 *   EIA_API_KEY=... node scripts/refresh-data.mjs
 *
 * Every source is fetched independently. If one fails, its last good value is
 * kept, `stale` is set to true and `error` records why — the rest still update.
 * `tolls` and `assumptions` are maintained by hand and never touched here.
 */
import { readFile, writeFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'

const DATA_PATH = new URL('../public/data.json', import.meta.url)
const UA = 'pipe-dreams-data-refresh (+https://github.com/SyedLine/pipe-dreams)'
const M3_TO_BBL = 6.289811
const TIMEOUT_MS = 30_000

// ── helpers ────────────────────────────────────────────────────────────────
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

/** fetch with timeout and up to 3 attempts (backoff 2s, 6s). */
async function get(url, { type = 'json', headers = {} } = {}) {
  const safe = url.replace(/api_key=[^&]+/, 'api_key=***')
  let lastErr
  for (let attempt = 0; attempt < 3; attempt++) {
    if (attempt) await sleep(2000 * 3 ** (attempt - 1))
    try {
      const res = await fetch(url, {
        headers: { 'User-Agent': UA, ...headers },
        signal: AbortSignal.timeout(TIMEOUT_MS),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status} for ${safe}`)
      return type === 'json' ? await res.json() : await res.text()
    } catch (e) {
      lastErr = e?.name === 'TimeoutError' ? new Error(`timeout after ${TIMEOUT_MS / 1000}s for ${safe}`) : e
    }
  }
  throw lastErr
}

const round = (n, dp = 2) => Math.round(n * 10 ** dp) / 10 ** dp
const monthOf = (s) => String(s).slice(0, 7) // "2026-10-01T00:00" → "2026-10"

/** Minimal RFC-4180 CSV parser (handles quoted fields with commas/newlines). */
function parseCsv(text) {
  const rows = []
  let row = []
  let field = ''
  let quoted = false
  for (let i = 0; i < text.length; i++) {
    const c = text[i]
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') (field += '"'), i++
      else if (c === '"') quoted = false
      else field += c
    } else if (c === '"') quoted = true
    else if (c === ',') row.push(field), (field = '')
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++
      row.push(field), rows.push(row), (row = []), (field = '')
    } else field += c
  }
  if (field || row.length) row.push(field), rows.push(row)
  const [header, ...body] = rows
  const keys = header.map((h) => h.replace(/^﻿/, '').trim())
  return body
    .filter((r) => r.length === keys.length)
    .map((r) => Object.fromEntries(keys.map((k, i) => [k, r[i]])))
}

// ── sources ────────────────────────────────────────────────────────────────
async function eiaMonthly(route, series, label) {
  const key = process.env.EIA_API_KEY
  if (!key) throw new Error('EIA_API_KEY not set')
  const url =
    `https://api.eia.gov/v2/petroleum/${route}/data/?api_key=${key}` +
    `&frequency=monthly&data[0]=value&facets[series][]=${series}` +
    `&sort[0][column]=period&sort[0][direction]=desc&length=12`
  const json = await get(url)
  const history = (json?.response?.data ?? [])
    .map((r) => ({ month: r.period, value: round(Number(r.value)) }))
    .filter((r) => Number.isFinite(r.value))
    .reverse()
  if (!history.length) throw new Error(`EIA ${series}: no data`)
  const latest = history.at(-1)
  return {
    value: latest.value,
    unit: 'US$/bbl',
    asOf: latest.month,
    history,
    label,
    source: `U.S. EIA, series ${series}`,
    sourceUrl: `https://www.eia.gov/dnav/pet/hist/LeafHandler.ashx?n=PET&s=${series}&f=M`,
  }
}

async function albertaDiff() {
  const rows = await get('https://api.economicdata.alberta.ca/data?table=OilPrices')
  // Note: the API's field is literally "Type " (trailing space).
  const typeOf = (r) => (r.Type ?? r['Type '] ?? '').trim()
  const latest = (t) =>
    rows.filter((r) => typeOf(r) === t).sort((a, b) => (a.Date < b.Date ? 1 : -1))[0]
  const diff = latest('Differential')
  const wcs = latest('WCS')
  if (!diff || !wcs) throw new Error('Alberta OilPrices: missing Differential/WCS rows')
  return {
    value: round(Number(diff.Value)),
    wcsHardisty: round(Number(wcs.Value)),
    unit: 'US$/bbl',
    asOf: monthOf(diff.Date),
    label: 'WTI–WCS differential (monthly average)',
    source: 'Government of Alberta, Economic Dashboard — Oil prices',
    sourceUrl: 'https://economicdashboard.alberta.ca/OilPrice',
  }
}

async function usdCad() {
  const json = await get('https://www.bankofcanada.ca/valet/observations/FXMUSDCAD/json?recent=1')
  const obs = json?.observations?.[0]
  const value = Number(obs?.FXMUSDCAD?.v)
  if (!Number.isFinite(value)) throw new Error('Bank of Canada FXMUSDCAD: no data')
  return {
    value: round(value, 4),
    unit: 'C$ per US$',
    asOf: monthOf(obs.d),
    label: 'USD/CAD (monthly average)',
    source: 'Bank of Canada, Valet API series FXMUSDCAD',
    sourceUrl: 'https://www.bankofcanada.ca/rates/exchange/monthly-exchange-rates/',
  }
}

async function wcsQuality() {
  const url = 'https://www.crudemonitor.ca/crudes/crude.php?acr=WCS'
  const html = await get(url, { type: 'text' })
  const text = html
    .replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/g, '')
    .replace(/<[^>]+>/g, '|')
    .replace(/&[a-z#0-9]+;/gi, ' ')
    .replace(/\s*\|[\s|]*/g, '|')
  // "Most Recent: 2026-10-01|6 Month Average|1 Year Average|5 Year Average|Density (kg/m³)|929.8|…"
  const date = text.match(/Most Recent:\s*(\d{4}-\d{2}-\d{2})/)?.[1]
  const grab = (label) => {
    const m = text.match(new RegExp(`${label}[^|]*\\|([0-9.]+)\\|([0-9.]+)\\|([0-9.]+)\\|([0-9.]+)`))
    return m ? { recent: Number(m[1]), avg5y: Number(m[4]) } : null
  }
  const gravity = grab('Gravity')
  const sulphur = grab('Sulphur')
  const density = grab('Density')
  if (!date || !gravity || !sulphur) throw new Error('CrudeMonitor: could not parse WCS table')
  return {
    apiGravity: gravity.recent,
    apiGravity5y: gravity.avg5y,
    sulphurPct: sulphur.recent,
    sulphurPct5y: sulphur.avg5y,
    densityKgM3: density?.recent ?? null,
    densityKgM35y: density?.avg5y ?? null,
    asOf: date,
    label: 'Western Canadian Select — most recent sample',
    source: 'Crude Quality Inc., CrudeMonitor.ca',
    sourceUrl: url,
  }
}

async function cerThroughput(kind) {
  const file =
    kind === 'mainline'
      ? 'enbridge-mainline-throughput-and-capacity.csv'
      : 'trans-mountain-throughput-and-capacity.csv'
  const url = `https://www.cer-rec.gc.ca/open/energy/throughput-capacity/${file}`
  const rows = parseCsv(await get(url, { type: 'text' }))
  const num = (s) => (s === '' || s == null ? NaN : Number(s))
  const byMonth = new Map()

  if (kind === 'mainline') {
    // Egress out of Canada: all products crossing at the ex-Gretna key point.
    for (const r of rows.filter((r) => r['Key Point'] === 'ex-Gretna')) {
      const m = monthOf(r.Date)
      const e = byMonth.get(m) ?? { throughput: 0, capacity: NaN }
      e.throughput += num(r['Throughput (1000 m3/d)']) || 0
      e.capacity = num(r['Available Capacity (1000 m3/d)'])
      byMonth.set(m, e)
    }
  } else {
    // System total = committed + uncommitted volumes, vs available capacity.
    for (const r of rows.filter((r) => r['Key Point'] === 'system')) {
      const t = num(r['Committed Volumes (1000 m3/d)']) + num(r['Uncommitted Volumes (1000 m3/d)'])
      const c = num(r['Available Capacity (1000 m3/d)'])
      if (Number.isFinite(t) && Number.isFinite(c)) byMonth.set(monthOf(r.Date), { throughput: t, capacity: c })
    }
  }
  const history = [...byMonth.entries()]
    .filter(([, e]) => Number.isFinite(e.capacity) && e.capacity > 0 && e.throughput > 0)
    .sort(([a], [b]) => (a < b ? -1 : 1))
    .slice(-36)
    .map(([month, e]) => ({
      month,
      throughputKbd: Math.round(e.throughput * M3_TO_BBL),
      capacityKbd: Math.round(e.capacity * M3_TO_BBL),
    }))
  if (history.length < 6) throw new Error(`CER ${kind}: too few usable months`)
  return {
    history,
    asOf: history.at(-1).month,
    label:
      kind === 'mainline'
        ? 'Enbridge Mainline, ex-Gretna (all products) vs available capacity'
        : 'Trans Mountain, system throughput vs available capacity',
    source: 'Canada Energy Regulator, Pipeline Throughput and Capacity open data',
    sourceUrl: url,
  }
}

// ── main ───────────────────────────────────────────────────────────────────
/**
 * Brent − WTI from *daily* EIA prices: the current month-to-date average once it
 * has ≥5 paired trading days, otherwise the last full month. Monthly averages
 * can lag a fast-moving spread badly (Oct 2026 averaged +$21.86; by mid-Nov it
 * was back near +$3), so the spread tracks the most recent data instead.
 */
async function brentWtiDaily() {
  const key = process.env.EIA_API_KEY
  if (!key) throw new Error('EIA_API_KEY not set')
  const now = new Date()
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1)).toISOString().slice(0, 10)
  const url =
    `https://api.eia.gov/v2/petroleum/pri/spt/data/?api_key=${key}&frequency=daily&data[0]=value` +
    `&facets[series][]=RBRTE&facets[series][]=RWTC&start=${start}&sort[0][column]=period&sort[0][direction]=asc&length=200`
  const rows = (await get(url))?.response?.data ?? []
  const byDay = new Map()
  for (const r of rows) {
    const v = Number(r.value)
    if (!Number.isFinite(v)) continue
    byDay.set(r.period, { ...byDay.get(r.period), [r.series]: v })
  }
  const pairs = [...byDay.entries()]
    .filter(([, v]) => v.RBRTE != null && v.RWTC != null)
    .map(([day, v]) => ({ day, spread: v.RBRTE - v.RWTC }))
  if (!pairs.length) throw new Error('EIA daily Brent/WTI: no paired days')
  const months = [...new Set(pairs.map((p) => p.day.slice(0, 7)))].sort()
  const latest = months.at(-1)
  const pick = pairs.filter((p) => p.day.startsWith(latest)).length >= 5 ? latest : months.at(-2) ?? latest
  const sel = pairs.filter((p) => p.day.startsWith(pick))
  const avg = sel.reduce((s, p) => s + p.spread, 0) / sel.length
  return {
    value: round(avg),
    unit: 'US$/bbl',
    asOf: sel.at(-1).day,
    from: sel[0].day,
    to: sel.at(-1).day,
    days: sel.length,
    label: `Brent − WTI, average of ${sel.length} daily spreads ${sel[0].day} to ${sel.at(-1).day}`,
    source: 'U.S. EIA daily spot prices, series RBRTE − RWTC',
    sourceUrl: 'https://www.eia.gov/dnav/pet/pet_pri_spt_s1_d.htm',
  }
}

/**
 * Annual crude imports by PADD of processing: from Canada vs from everywhere.
 * EIA route petroleum/move/impcp; series MCRIPP{n}CA2 (Canada) and MCRIPP{n}2 (total), kb/d.
 */
async function paddImports() {
  const key = process.env.EIA_API_KEY
  if (!key) throw new Error('EIA_API_KEY not set')
  const series = [2, 3, 4, 5].flatMap((n) => [`MCRIPP${n}CA2`, `MCRIPP${n}2`])
  const url =
    `https://api.eia.gov/v2/petroleum/move/impcp/data/?api_key=${key}&frequency=annual&data[0]=value` +
    series.map((s) => `&facets[series][]=${s}`).join('') +
    `&sort[0][column]=period&sort[0][direction]=desc&length=40`
  const rows = (await get(url))?.response?.data ?? []
  const latest = (s) => rows.find((r) => r.series === s)
  const padds = {}
  let year = ''
  for (const n of [2, 3, 4, 5]) {
    const can = latest(`MCRIPP${n}CA2`)
    const tot = latest(`MCRIPP${n}2`)
    if (!can || !tot) throw new Error(`EIA imports: missing PADD ${n}`)
    padds[n] = { canadaKbd: Number(can.value), totalKbd: Number(tot.value) }
    year = can.period
  }
  return {
    padds,
    asOf: year,
    label: 'Crude oil imports by PADD of processing, annual (from Canada vs all countries)',
    source: 'U.S. EIA, PAD District Imports by Country of Origin',
    sourceUrl: '',
  }
}

/**
 * Recent headlines for each proposed egress project, from Bing News RSS search.
 * Each project's `keywords` drive the search and its `match` regex filters titles,
 * so only stories that are actually about the project are kept.
 */
async function projectNews(projects) {
  if (!projects?.length) throw new Error('no projects in data.json')
  const cutoff = Date.now() - 120 * 86_400_000
  const seen = new Set()
  const items = []
  const decode = (s) =>
    s
      .replace(/<!\[CDATA\[(.*?)\]\]>/gs, '$1')
      .replace(/&amp;/g, '&')
      .replace(/&quot;/g, '"')
      .replace(/&#39;|&apos;/g, "'")
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .trim()
  for (const p of projects) {
    const re = new RegExp(p.match, 'i')
    let kept = 0
    for (const q of p.keywords ?? []) {
      const xml = await get(`https://www.bing.com/news/search?q=${encodeURIComponent(q)}&format=rss`, { type: 'text' })
      for (const raw of xml.match(/<item>[\s\S]*?<\/item>/g) ?? []) {
        const field = (k) => decode(raw.match(new RegExp(`<${k}[^>]*>([\\s\\S]*?)</${k}>`))?.[1] ?? '')
        const title = field('title')
        const date = new Date(field('pubDate'))
        const key = title.toLowerCase().replace(/\W+/g, ' ').trim()
        if (!title || !re.test(title) || !(date.getTime() > cutoff) || seen.has(key)) continue
        seen.add(key)
        items.push({
          projectId: p.id,
          title,
          outlet: field('News:Source').replace(/ on MSN$/, '') || 'News',
          date: date.toISOString().slice(0, 10),
        })
        kept++
      }
      if (kept >= 4) break
    }
  }
  if (!items.length) throw new Error('news: no matching headlines')
  items.sort((a, b) => (a.date < b.date ? 1 : -1))
  return {
    items: items.slice(0, 24),
    asOf: new Date().toISOString().slice(0, 10),
    label: 'Recent headlines about proposed egress projects',
    source: 'Bing News search, filtered by project',
    sourceUrl: '',
  }
}

const JOBS = {
  'prices.wti': () => eiaMonthly('pri/spt', 'RWTC', 'WTI Cushing spot (monthly average)'),
  'spreads.brentWti': brentWtiDaily,
  'prices.imports': paddImports,
  'prices.brent': () => eiaMonthly('pri/spt', 'RBRTE', 'Brent spot (monthly average)'),
  'prices.ans': () => eiaMonthly('pri/dfp1', 'F005071__3', 'Alaska North Slope first purchase price'),
  wcsDiff: albertaDiff,
  fx: usdCad,
  quality: wcsQuality,
  'throughput.mainline': () => cerThroughput('mainline'),
  'throughput.tmx': () => cerThroughput('tmx'),
  news: () => projectNews(data.projects?.items),
}

// The Alberta API refuses requests from cloud CI runners (HTTP 403), so the
// differential is refreshed from a local machine (`npm run refresh`) and the
// CI job leaves it alone instead of hammering a service that blocks it.
const LOCAL_ONLY = new Set(['wcsDiff'])
const IN_CI = process.env.GITHUB_ACTIONS === 'true'
/** Whole months between a "YYYY-MM" period and today. */
const monthsOld = (ym) => {
  const [y, m] = String(ym).split('-').map(Number)
  const d = new Date()
  return (d.getUTCFullYear() - y) * 12 + (d.getUTCMonth() + 1 - m)
}

const getPath = (o, p) => p.split('.').reduce((a, k) => a?.[k], o)
function setPath(o, p, v) {
  const ks = p.split('.')
  const last = ks.pop()
  const target = ks.reduce((a, k) => (a[k] ??= {}), o)
  target[last] = v
}

const data = existsSync(DATA_PATH) ? JSON.parse(await readFile(DATA_PATH, 'utf8')) : {}
const now = new Date().toISOString()
let failures = 0

// EIA rate-limits bursts, so its calls are chained one after another;
// every other source runs in parallel alongside that chain.
const settle = (fn) => fn().then((value) => ({ status: 'fulfilled', value }), (reason) => ({ status: 'rejected', reason }))
let eiaQueue = Promise.resolve()
const results = await Promise.all(
  Object.entries(JOBS).map(([path, fn]) => {
    if (IN_CI && LOCAL_ONLY.has(path)) return { status: 'skipped' }
    if (!path.startsWith('prices.') && !path.startsWith('spreads.')) return settle(fn)
    const run = eiaQueue.then(() => settle(fn))
    eiaQueue = run
    return run
  }),
)
Object.keys(JOBS).forEach((path, i) => {
  const r = results[i]
  const prev = getPath(data, path)
  if (r.status === 'skipped') {
    // Monthly series: the previous month is normally published by mid-month,
    // so anything older than two months means nobody has refreshed it locally.
    if (prev) setPath(data, path, { ...prev, stale: monthsOld(prev.asOf) > 2 })
    console.log(`– ${path}: refreshed locally only (as of ${prev?.asOf ?? 'never'})`)
  } else if (r.status === 'fulfilled') {
    const extra = LOCAL_ONLY.has(path) ? { updatedLocally: true } : {}
    setPath(data, path, { ...r.value, ...extra, fetchedAt: now, stale: false })
    console.log(`✓ ${path}  (as of ${r.value.asOf})`)
  } else {
    failures++
    const error = String(r.reason?.message ?? r.reason)
    if (prev) setPath(data, path, { ...prev, stale: true, error, lastAttempt: now })
    console.warn(`✗ ${path}: ${error}${prev ? ' — keeping last good value' : ' — no previous value!'}`)
  }
})

// Benchmarks are applied as spreads to WTI so the WTI slider moves them all.
// The spread uses WTI from the *same month* as the benchmark — ANS first-purchase
// prices lag WTI by ~2 months, so comparing latest-to-latest would be wrong.
const wti = data.prices?.wti
for (const key of ['brent', 'ans']) {
  const b = data.prices?.[key]
  const w = wti?.history?.find((h) => h.month === b?.asOf)
  if (b && w) {
    b.spreadToWti = round(b.value - w.value)
    b.spreadMonth = b.asOf
  }
}
// Brent uses the recent daily spread (see brentWtiDaily) when available.
if (data.prices?.brent && data.spreads?.brentWti) {
  data.prices.brent.spreadToWti = data.spreads.brentWti.value
  data.prices.brent.spreadMonth = `${data.spreads.brentWti.from}..${data.spreads.brentWti.to}`
}

data.generatedAt = now
await writeFile(DATA_PATH, JSON.stringify(data, null, 2) + '\n')
const attempted = results.filter((r) => r.status !== 'skipped').length
console.log(`\nWrote public/data.json (${attempted - failures}/${attempted} fetched sources fresh)`)
// A partial failure is not fatal: the site still deploys with stale markers.
process.exitCode = failures === attempted ? 1 : 0
