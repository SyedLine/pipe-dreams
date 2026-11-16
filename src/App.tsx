import { useEffect, useMemo, useState } from 'react'
import DrawerContent from './components/Drawer'
import AppFooter, { SourceList } from './components/Footer'
import { Delta, Money } from './components/ui'
import { loadData, type Data } from './data'
import { tabHref, useMedia, usePathTab, useTheme } from './hooks'
import { bestLane, breakevens, computeAll, defaultInputs, ranked, type Inputs } from './netback'
import type { LaneId } from './lanes'
import { matchPreset, PRESETS, type PresetId } from './presets'
import MapTab from './tabs/MapTab'
import NetbacksTab from './tabs/NetbacksTab'
import RankingsTab from './tabs/RankingsTab'
import EgressTab from './tabs/EgressTab'
import FeedbackDialog from './components/Feedback'
import MethodTab from './tabs/MethodTab'
import OutlookTab from './tabs/OutlookTab'

const TABS = ['map', 'netbacks', 'rankings', 'egress', 'outlook', 'method'] as const
type Tab = (typeof TABS)[number]
const TAB_LABEL: Record<Tab, string> = { map: 'Map', netbacks: 'Netbacks', rankings: 'Rankings', egress: 'Egress', outlook: 'Outlook', method: 'Method' }

export default function App() {
  const [data, setData] = useState<Data | null>(null)
  const [error, setError] = useState<string | null>(null)
  useEffect(() => {
    loadData().then(setData, (e) => setError(String(e)))
  }, [])
  if (error) return <div className="grid h-full place-items-center p-6 text-center text-sm text-muted">Couldn&rsquo;t load data: {error}</div>
  if (!data) return <div className="grid h-full place-items-center text-sm text-subtle">Loading…</div>
  return <Shell data={data} />
}

function Icon({ d, size = 18 }: { d: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d={d} />
    </svg>
  )
}
const SUN = 'M12 4V2m0 20v-2m8-8h2M2 12h2m13.66-5.66 1.41-1.41M4.93 19.07l1.41-1.41m0-11.32L4.93 4.93m14.14 14.14-1.41-1.41M16 12a4 4 0 1 1-8 0 4 4 0 0 1 8 0Z'
const MOON = 'M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8Z'
const SLIDERS = 'M4 6h10M18 6h2M4 12h4M12 12h8M4 18h12M14 4v4M8 10v4M16 16v4'
const CLOSE = 'M6 6l12 12M18 6L6 18'

function Shell({ data }: { data: Data }) {
  const [theme, toggleTheme] = useTheme()
  const [tab, setTab] = usePathTab(TABS, 'map')
  const defaults = useMemo(() => defaultInputs(data), [data])
  const [inputs, setInputs] = useState<Inputs>(defaults)
  const isPhone = useMedia('(max-width: 767px)')
  const isWide = useMedia('(min-width: 1024px)')
  const isTouch = useMedia('(hover: none)')
  const [drawerOpen, setDrawerOpen] = useState(isWide)
  const [sourcesOpen, setSourcesOpen] = useState(false)
  const [feedbackOpen, setFeedbackOpen] = useState(false)

  const results = useMemo(() => computeAll(data, inputs), [data, inputs])
  const best = bestLane(results)
  const { pipeParity, railParity } = breakevens(results, inputs)
  const preset = matchPreset(data, inputs)
  const applyPreset = (id: PresetId) => setInputs(PRESETS.find((p) => p.id === id)!.apply(data))
  const bestR = results[best]
  // Today's ranking: the reference for ▲▼ rank moves and $ deltas
  const todayRank = useMemo(() => {
    const out: Partial<Record<LaneId, number>> = {}
    ranked(computeAll(data, defaults)).forEach((r, i) => (out[r.lane.id] = i + 1))
    return out
  }, [data, defaults])

  // Drawer: docked column on wide screens, overlay at tablet size, bottom sheet on phones.
  useEffect(() => setDrawerOpen(isWide), [isWide])
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      setSourcesOpen(false)
      setFeedbackOpen(false)
      if (!isWide) setDrawerOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [isWide])

  const drawer = (
    <DrawerContent
      data={data}
      inputs={inputs}
      defaults={defaults}
      setInputs={setInputs}
      preset={preset}
      applyPreset={applyPreset}
      pipeParity={pipeParity}
      railParity={railParity}
    />
  )

  const tabsNav = (
    <nav aria-label="Views" className="no-scrollbar -mx-1 flex overflow-x-auto px-1">
      <div role="tablist" className="flex gap-1">
        {TABS.map((t) => (
          <a
            key={t}
            href={tabHref(t, 'map')}
            role="tab"
            aria-selected={tab === t}
            onClick={(e) => {
              e.preventDefault()
              setTab(t)
            }}
            className={`whitespace-nowrap border-b-2 px-3 py-2 text-[13px] font-medium transition-colors ${
              tab === t ? 'border-accent text-fg' : 'border-transparent text-muted hover:text-fg'
            }`}
          >
            {TAB_LABEL[t]}
          </a>
        ))}
      </div>
    </nav>
  )

  const iconBtn = 'grid h-9 w-9 place-items-center rounded-lg text-muted hover:bg-sunken hover:text-fg'

  return (
    <div className="flex h-dvh flex-col bg-bg pt-[env(safe-area-inset-top)]">
      {/* ── Top bar ── */}
      <header className="z-30 border-b border-line bg-surface">
        <div className="flex h-14 items-center gap-2 px-3 md:px-4">
          <div className="flex min-w-0 flex-1 items-center gap-1">
            {!isPhone && (
              <button type="button" onClick={() => setDrawerOpen((o) => !o)} aria-label="Toggle inputs" aria-expanded={drawerOpen} className={iconBtn}>
                <Icon d={SLIDERS} />
              </button>
            )}
            <span className="flex min-w-0 flex-col leading-tight">
              <span className="truncate text-[16px] font-bold uppercase tracking-[0.06em] text-accent">Pipe Dreams</span>
              <span className="truncate text-[11px] text-muted">{isPhone ? 'Best netback for a Hardisty barrel' : 'Where a Hardisty WCS barrel earns the best netback'}</span>
            </span>
          </div>
          {!isPhone && <div className="flex shrink-0 justify-center">{tabsNav}</div>}
          <div className="flex flex-1 items-center justify-end gap-1">
            <button type="button" onClick={toggleTheme} aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`} className={iconBtn}>
              <Icon d={theme === 'dark' ? SUN : MOON} />
            </button>
            <button type="button" onClick={() => setSourcesOpen(true)} className="rounded-lg px-3 py-1.5 text-[13px] font-medium text-muted hover:bg-sunken hover:text-fg">
              Sources
            </button>
          </div>
        </div>
        {isPhone && <div className="px-3 pb-2">{tabsNav}</div>}
      </header>

      {/* Answer strip: the one line the whole app exists to answer */}
      <div className="border-b border-line bg-surface px-4 py-2 text-[13px] text-muted">
        Best now: <span className="font-semibold text-fg">{bestR.lane.name}</span>
        {bestR.dests.length > 1 && <> ({bestR.best.dest.name})</>} at{' '}
        <Money value={bestR.best.netback} className="font-semibold text-accent" extra="Best netback to Hardisty, US$/bbl" tipPos="below" />
        /bbl, <Delta value={bestR.best.uplift} extra="vs selling WCS at Hardisty (WTI − diff)" tipPos="below" /> vs Hardisty
      </div>

      {/* ── Body: drawer + view ── */}
      <div className="relative flex min-h-0 flex-1">
        {!isPhone && drawerOpen && (
          <aside
            aria-label="Inputs"
            className={`z-20 w-[320px] shrink-0 overflow-y-auto border-r border-line bg-surface p-5 ${isWide ? '' : 'absolute inset-y-0 left-0 shadow-2xl'}`}
          >
            {drawer}
          </aside>
        )}
        <main className="relative min-w-0 flex-1">
          {tab === 'map' && (
            <MapTab data={data} theme={theme} results={results} todayRank={todayRank} best={best} inputs={inputs} setInputs={setInputs} isTouch={isTouch} isPhone={isPhone} />
          )}
          {tab === 'netbacks' && <NetbacksTab results={results} inputs={inputs} theme={theme} />}
          {tab === 'rankings' && <RankingsTab data={data} results={results} theme={theme} />}
          {tab === 'egress' && <EgressTab data={data} theme={theme} inputs={inputs} pipeParity={pipeParity} railParity={railParity} />}
          {tab === 'outlook' && <OutlookTab data={data} theme={theme} />}
          {tab === 'method' && <MethodTab data={data} inputs={inputs} bestR={bestR} />}
        </main>

        {/* Phone: inputs as a bottom sheet */}
        {isPhone && !drawerOpen && (
          <button
            type="button"
            onClick={() => setDrawerOpen(true)}
            className={`absolute ${tab === 'map' ? 'top-3' : 'bottom-4'} right-3 z-20 flex items-center gap-1.5 rounded-full bg-accent px-4 py-2.5 text-[13px] font-medium text-on-accent shadow-lg`}
          >
            <Icon d={SLIDERS} size={16} /> Inputs
          </button>
        )}
        {isPhone && drawerOpen && (
          <>
            <div className="absolute inset-0 z-40 bg-scrim" onClick={() => setDrawerOpen(false)} />
            <section aria-label="Inputs" className="absolute inset-x-0 bottom-0 z-50 flex max-h-[85%] flex-col rounded-t-2xl border-t border-line bg-surface">
              <span className="mx-auto mt-2.5 h-1 w-9 rounded-full bg-line-strong" aria-hidden />
              <div className="flex items-center justify-between px-5 pb-1 pt-1">
                <h2 className="text-[15px] font-semibold">Inputs</h2>
                <button type="button" onClick={() => setDrawerOpen(false)} aria-label="Close inputs" className={iconBtn}>
                  <Icon d={CLOSE} />
                </button>
              </div>
              <div className="overflow-y-auto px-5 pb-5">{drawer}</div>
            </section>
          </>
        )}
      </div>

      <AppFooter onFeedback={() => setFeedbackOpen(true)} />
      {feedbackOpen && <FeedbackDialog onClose={() => setFeedbackOpen(false)} />}

      {/* Sources sheet */}
      {sourcesOpen && (
        <div className="fixed inset-0 z-[70] flex items-end justify-center bg-scrim md:items-center" onClick={() => setSourcesOpen(false)}>
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Sources"
            onClick={(e) => e.stopPropagation()}
            className="max-h-[85dvh] w-full overflow-y-auto rounded-t-2xl border border-line bg-surface p-5 md:max-w-lg md:rounded-2xl"
          >
            <div className="mb-2 flex items-center justify-between">
              <h2 className="text-[17px] font-semibold">Sources &amp; as-of dates</h2>
              <button type="button" onClick={() => setSourcesOpen(false)} aria-label="Close sources" className={iconBtn}>
                <Icon d={CLOSE} />
              </button>
            </div>
            <SourceList data={data} />
          </div>
        </div>
      )}
    </div>
  )
}
