import type { PlanInput, ScenarioOverride, SimulationResult } from '../engine'
import { formatYen, manToYen, yenToMan } from '../lib/format'

export type OverrideKey = keyof ScenarioOverride['overrides']

interface Item {
  scenario: ScenarioOverride
  result: SimulationResult
}

interface Props {
  items: Item[]
  basePlan: PlanInput
  scenarios: ScenarioOverride[]
  onChange: (scenarios: ScenarioOverride[]) => void
  onAdd: () => void
}

const OVERRIDE_FIELDS: {
  key: OverrideKey
  label: string
  kind: 'age' | 'man' | 'percent'
}[] = [
  { key: 'retireAge', label: '退職年齢', kind: 'age' },
  { key: 'monthlyLivingCost', label: '生活費（月）', kind: 'man' },
  { key: 'monthlyIncome', label: '就労収入（月）', kind: 'man' },
  { key: 'monthlyPostRetireIncome', label: '退職後収入（月）', kind: 'man' },
  { key: 'currentAssets', label: '金融資産', kind: 'man' },
  { key: 'annualReturnRate', label: 'リターン', kind: 'percent' },
  { key: 'annualInflationRate', label: 'インフレ', kind: 'percent' },
  { key: 'investmentTaxRate', label: '運用益税率', kind: 'percent' },
]

export function ComparePanel({ items, basePlan, scenarios, onChange, onAdd }: Props) {
  const updateScenario = (id: string, next: ScenarioOverride) => {
    onChange(scenarios.map((s) => (s.id === id ? next : s)))
  }

  const removeScenario = (id: string) => {
    onChange(scenarios.filter((s) => s.id !== id))
  }

  return (
    <>
      <section className="panel">
        <div className="panel-head">
          <h2>シナリオ設定</h2>
          <p>チェックした項目だけベースから上書きします</p>
        </div>
        <div className="scenario-actions">
          <button type="button" className="btn ghost" onClick={onAdd}>
            シナリオを追加
          </button>
        </div>
        <div className="scenario-list">
          {scenarios.map((s) => (
            <ScenarioEditor
              key={s.id}
              scenario={s}
              basePlan={basePlan}
              onChange={(next) => updateScenario(s.id, next)}
              onRemove={s.id === 'base' ? undefined : () => removeScenario(s.id)}
            />
          ))}
        </div>
      </section>

      <section className="panel">
        <div className="panel-head">
          <h2>比較表</h2>
          <p>
            ベース（退職 {basePlan.retireAge}歳 / 生活費 {formatYen(basePlan.monthlyLivingCost)}/月）
          </p>
        </div>
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>シナリオ</th>
                <th>FIRE</th>
                <th>枯渇</th>
                <th>ピーク資産</th>
                <th>最終資産</th>
              </tr>
            </thead>
            <tbody>
              {items.map(({ scenario, result }) => (
                <tr key={scenario.id}>
                  <td>
                    <strong>{scenario.label}</strong>
                    <OverrideHint scenario={scenario} />
                  </td>
                  <td>{result.fireAge !== null ? `${result.fireAge}歳` : '—'}</td>
                  <td className={result.depletionAge !== null ? 'text-bad' : 'text-good'}>
                    {result.depletionAge !== null ? `${result.depletionAge}歳` : 'なし'}
                  </td>
                  <td className="num">{formatYen(result.peakAssets, true)}</td>
                  <td className="num">{formatYen(result.finalAssets, true)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </>
  )
}

function ScenarioEditor({
  scenario,
  basePlan,
  onChange,
  onRemove,
}: {
  scenario: ScenarioOverride
  basePlan: PlanInput
  onChange: (s: ScenarioOverride) => void
  onRemove?: () => void
}) {
  const isBase = scenario.id === 'base'

  const setOverride = (key: OverrideKey, enabled: boolean, value?: number) => {
    const overrides = { ...scenario.overrides }
    if (!enabled) {
      delete overrides[key]
    } else {
      overrides[key] = value ?? defaultOverrideValue(key, basePlan)
    }
    onChange({ ...scenario, overrides })
  }

  return (
    <div className={isBase ? 'scenario-card is-base' : 'scenario-card'}>
      <div className="scenario-card-head">
        {isBase ? (
          <strong>{scenario.label}</strong>
        ) : (
          <input
            className="text-input"
            value={scenario.label}
            onChange={(e) => onChange({ ...scenario, label: e.target.value })}
            aria-label="シナリオ名"
          />
        )}
        {onRemove && (
          <button type="button" className="btn tiny quiet" onClick={onRemove}>
            削除
          </button>
        )}
      </div>
      {isBase ? (
        <p className="empty-hint">左の入力パネルの前提そのもの。比較の基準になります。</p>
      ) : (
        <div className="scenario-fields">
          {OVERRIDE_FIELDS.map((f) => {
            const enabled = scenario.overrides[f.key] !== undefined
            const raw = scenario.overrides[f.key]
            return (
              <label key={f.key} className="field">
                <span className="scenario-toggle">
                  <input
                    type="checkbox"
                    checked={enabled}
                    onChange={(e) => setOverride(f.key, e.target.checked)}
                  />
                  {f.label}
                </span>
                <OverrideInput
                  kind={f.kind}
                  disabled={!enabled}
                  valueYenOrRate={raw ?? defaultOverrideValue(f.key, basePlan)}
                  onChange={(v) => setOverride(f.key, true, v)}
                />
              </label>
            )
          })}
        </div>
      )}
    </div>
  )
}

function OverrideInput({
  kind,
  disabled,
  valueYenOrRate,
  onChange,
}: {
  kind: 'age' | 'man' | 'percent'
  disabled: boolean
  valueYenOrRate: number
  onChange: (v: number) => void
}) {
  const display =
    kind === 'man'
      ? round2(yenToMan(valueYenOrRate))
      : kind === 'percent'
        ? round1(valueYenOrRate * 100)
        : valueYenOrRate
  const suffix = kind === 'man' ? '万円' : kind === 'percent' ? '%' : '歳'
  const step = kind === 'percent' ? 0.1 : kind === 'man' ? 1 : 1

  return (
    <span className="num-wrap">
      <input
        type="number"
        className="num-input"
        disabled={disabled}
        value={Number.isFinite(display) ? display : ''}
        step={step}
        onChange={(e) => {
          const v = e.target.value === '' ? NaN : Number(e.target.value)
          if (!Number.isFinite(v)) return
          if (kind === 'man') onChange(manToYen(v))
          else if (kind === 'percent') onChange(v / 100)
          else onChange(v)
        }}
      />
      <span className="num-suffix">{suffix}</span>
    </span>
  )
}

function defaultOverrideValue(key: OverrideKey, base: PlanInput): number {
  const v = base[key]
  return typeof v === 'number' ? v : 0
}

function OverrideHint({ scenario }: { scenario: ScenarioOverride }) {
  const o = scenario.overrides
  const parts: string[] = []
  if (o.retireAge !== undefined) parts.push(`退職 ${o.retireAge}歳`)
  if (o.monthlyLivingCost !== undefined) parts.push(`生活費 ${formatYen(o.monthlyLivingCost)}`)
  if (o.monthlyIncome !== undefined) parts.push(`就労収入 ${formatYen(o.monthlyIncome)}`)
  if (o.monthlyPostRetireIncome !== undefined)
    parts.push(`退職後収入 ${formatYen(o.monthlyPostRetireIncome)}`)
  if (o.currentAssets !== undefined) parts.push(`資産 ${formatYen(o.currentAssets)}`)
  if (o.annualReturnRate !== undefined) parts.push(`リターン ${(o.annualReturnRate * 100).toFixed(1)}%`)
  if (o.annualInflationRate !== undefined) parts.push(`インフレ ${(o.annualInflationRate * 100).toFixed(1)}%`)
  if (o.investmentTaxRate !== undefined) parts.push(`税率 ${(o.investmentTaxRate * 100).toFixed(2)}%`)
  if (parts.length === 0) return null
  return <div className="override-hint">{parts.join(' · ')}</div>
}

function round1(n: number): number {
  return Math.round(n * 10) / 10
}

function round2(n: number): number {
  return Math.round(n * 100) / 100
}
