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
