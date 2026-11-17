/**
 * Ticker-style badges for refinery operators (a terminal convention, used in place
 * of company logos, which are trademarks). Listed companies use their ticker;
 * private ones a short code.
 */
const TICKERS: [RegExp, string][] = [
  [/WRB/, 'WRB'],
  [/^BP/, 'BP'],
  [/Flint Hills/, 'FHR'],
  [/ExxonMobil/, 'XOM'],
  [/Marathon/, 'MPC'],
  [/Motiva/, 'MOT'],
  [/HF Sinclair/, 'DINO'],
  [/Phillips 66/, 'PSX'],
  [/^CHS/, 'CHS'],
  [/Par Pacific/, 'PARR'],
  [/Chevron/, 'CVX'],
  [/PBF/, 'PBF'],
  [/Rongsheng/, 'RS'],
  [/Sinopec/, 'SNP'],
]

export function ticker(operator: string): string {
  return TICKERS.find(([re]) => re.test(operator))?.[1] ?? operator.slice(0, 3).toUpperCase()
}

/** Logo files in public/logos/ (Wikimedia Commons / Wikipedia), keyed by ticker. */
const LOGOS: Record<string, string> = {
  XOM: 'XOM.svg',
  MPC: 'MPC.svg',
  CVX: 'CVX.svg',
  PSX: 'PSX.svg',
  PBF: 'PBF.svg',
  MOT: 'MOT.svg',
  CHS: 'CHS.svg',
  BP: 'BP.svg',
  SNP: 'SNP.svg',
  FHR: 'FHR.svg', // Koch logo: Flint Hills is a Koch company
  DINO: 'DINO.png',
  PARR: 'PARR.png', // from parpacific.com
}
/** WRB is operated by Phillips 66 */
const LOGO_ALIAS: Record<string, string> = { WRB: 'PSX' }

/** Logo URL for an operator, or null when no logo is available (ticker badge instead). */
export function logoFor(operator: string): string | null {
  const t = ticker(operator)
  const file = LOGOS[LOGO_ALIAS[t] ?? t]
  return file ? `${import.meta.env.BASE_URL}logos/${file}` : null
}
