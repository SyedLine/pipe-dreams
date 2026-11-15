import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react'

export function useMedia(query: string) {
  return useSyncExternalStore(
    (cb) => {
      const m = window.matchMedia(query)
      m.addEventListener('change', cb)
      return () => m.removeEventListener('change', cb)
    },
    () => window.matchMedia(query).matches,
  )
}

export const useReducedMotion = () => useMedia('(prefers-reduced-motion: reduce)')

// ── Theme: dark by default; an explicit light/dark choice is remembered ─────
export type Theme = 'light' | 'dark'
const THEME_KEY = 'pd-theme'

function storedTheme(): Theme | null {
  try {
    const v = localStorage.getItem(THEME_KEY)
    return v === 'light' || v === 'dark' ? v : null
  } catch {
    return null
  }
}

export function useTheme(): [Theme, () => void] {
  const [explicit, setExplicit] = useState<Theme | null>(storedTheme)
  // Dark by default; an explicit choice is remembered.
  const theme: Theme = explicit ?? 'dark'
  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark')
  }, [theme])
  const toggle = useCallback(() => {
    const next: Theme = theme === 'dark' ? 'light' : 'dark'
    setExplicit(next)
    try {
      localStorage.setItem(THEME_KEY, next)
    } catch {
      /* private mode: the choice just won't persist */
    }
  }, [theme])
  return [theme, toggle]
}

// ── Tabs live in the URL path (/pipe-dreams/netbacks, …) ───────────────────
const BASE = import.meta.env.BASE_URL // '/pipe-dreams/'

/** URL for a tab: the first tab is the site root, others are /<tab>. */
export function tabHref<T extends string>(t: T, fallback: T): string {
  return t === fallback ? BASE : `${BASE}${t}`
}

export function usePathTab<T extends string>(tabs: readonly T[], fallback: T): [T, (t: T) => void] {
  const read = (): T => {
    const seg = window.location.pathname.slice(BASE.length).replace(/\.html$/, '').replace(/\/+$/, '') as T
    if (tabs.includes(seg)) return seg
    // Old links used the hash (#map, #netbacks…)
    const h = window.location.hash.slice(1) as T
    return tabs.includes(h) ? h : fallback
  }
  const [tab, setTab] = useState<T>(read)
  useEffect(() => {
    // Rewrite legacy #tab links (and /map.html, trailing slashes) to the clean path.
    const clean = tabHref(read(), fallback)
    if (window.location.pathname + window.location.hash !== clean) {
      window.history.replaceState(null, '', clean + window.location.search)
    }
    const on = () => setTab(read())
    window.addEventListener('popstate', on)
    return () => window.removeEventListener('popstate', on)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  const go = useCallback(
    (t: T) => {
      const href = tabHref(t, fallback)
      if (window.location.pathname !== href) window.history.pushState(null, '', href)
      setTab(t)
    },
    [fallback],
  )
  return [tab, go]
}

// ── Numbers tick toward their new value (instant under reduced motion) ──────
export function useTween(value: number, ms = 280): number {
  const reduce = useReducedMotion()
  const [shown, setShown] = useState(value)
  const from = useRef(value)
  const raf = useRef(0)
  useEffect(() => {
    if (reduce || !Number.isFinite(value)) {
      from.current = value
      setShown(value)
      return
    }
    const start = performance.now()
    const a = from.current
    const step = (t: number) => {
      const k = Math.min(1, (t - start) / ms)
      const e = 1 - (1 - k) ** 3
      const v = a + (value - a) * e
      from.current = v
      setShown(v)
      if (k < 1) raf.current = requestAnimationFrame(step)
    }
    cancelAnimationFrame(raf.current)
    raf.current = requestAnimationFrame(step)
    return () => cancelAnimationFrame(raf.current)
  }, [value, ms, reduce])
  return shown
}
