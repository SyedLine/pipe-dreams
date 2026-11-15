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
const JOBS = {
  'prices.wti': () => eiaMonthly('pri/spt', 'RWTC', 'WTI Cushing spot (monthly average)'),
  'prices.brent': () => eiaMonthly('pri/spt', 'RBRTE', 'Brent spot (monthly average)'),
  'prices.ans': () => eiaMonthly('pri/dfp1', 'F005071__3', 'Alaska North Slope first purchase price'),
  wcsDiff: albertaDiff,
  fx: usdCad,
  quality: wcsQuality,
  'throughput.mainline': () => cerThroughput('mainline'),
  'throughput.tmx': () => cerThroughput('tmx'),
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
    if (!path.startsWith('prices.')) return settle(fn)
    const run = eiaQueue.then(() => settle(fn))
    eiaQueue = run
    return run
  }),
)
Object.keys(JOBS).forEach((path, i) => {
  const r = results[i]
  const prev = getPath(data, path)
  if (r.status === 'fulfilled') {
    setPath(data, path, { ...r.value, fetchedAt: now, stale: false })
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

data.generatedAt = now
await writeFile(DATA_PATH, JSON.stringify(data, null, 2) + '\n')
console.log(`\nWrote public/data.json (${Object.keys(JOBS).length - failures}/${Object.keys(JOBS).length} sources fresh)`)
// A partial failure is not fatal: the site still deploys with stale markers.
process.exitCode = failures === Object.keys(JOBS).length ? 1 : 0
