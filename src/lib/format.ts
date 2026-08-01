/** エンジン内部は円。表示・入力は万円。 */
export const YEN_PER_MAN = 10_000

export function yenToMan(yen: number): number {
  if (!Number.isFinite(yen)) return NaN
  return yen / YEN_PER_MAN
}

export function manToYen(man: number): number {
  if (!Number.isFinite(man)) return NaN
  return Math.round(man * YEN_PER_MAN)
}

/** 金額（円）を万円単位で表示 */
export function formatYen(value: number, compact = false): string {
  if (!Number.isFinite(value)) return '—'
  const man = value / YEN_PER_MAN
  const abs = Math.abs(man)
  const sign = man < 0 ? '-' : ''

  if (compact) {
    if (abs >= 10_000) {
      return `${sign}${(abs / 10_000).toFixed(2)}億円`
    }
    const rounded = abs >= 100 ? Math.round(abs) : Math.round(abs * 10) / 10
    return `${sign}${rounded.toLocaleString('ja-JP')}万円`
  }

  const rounded = Number.isInteger(man) ? man : Math.round(man * 10) / 10
  return `${sign}${rounded.toLocaleString('ja-JP')}万円`
}

export function formatPercent(rate: number, digits = 1): string {
  if (!Number.isFinite(rate)) return '—'
  return `${(rate * 100).toFixed(digits)}%`
}

export function parseNumberInput(raw: string): number {
  const cleaned = raw.replace(/[,，\s円万億%]/g, '')
  const n = Number(cleaned)
  return Number.isFinite(n) ? n : NaN
}
