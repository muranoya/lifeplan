import { useCallback, useMemo, useRef, useState } from 'react'
import {
  applyOverrides,
  createChild,
  createDefaultPlan,
  createLifeEvent,
  downloadPlanJson,
  importPlanJson,
  simulate,
  validatePlan,
  type PlanInput,
  type ScenarioOverride,
} from './engine'
import { formatPercent, formatYen } from './lib/format'
import { InputPanel } from './components/InputPanel'
import { ResultPanel } from './components/ResultPanel'
import { ComparePanel } from './components/ComparePanel'
import { AssetChart } from './components/AssetChart'

type Tab = 'result' | 'compare'

function createInitialScenarios(plan: PlanInput): ScenarioOverride[] {
  return [
    { id: 'base', label: 'ベース', overrides: {} },
    {
      id: crypto.randomUUID(),
      label: '5年早く退職',
      overrides: { retireAge: Math.max(plan.currentAge, plan.retireAge - 5) },
    },
    {
      id: crypto.randomUUID(),
      label: '生活費 -20%',
      overrides: { monthlyLivingCost: Math.round(plan.monthlyLivingCost * 0.8) },
    },
  ]
}

export default function App() {
  const [plan, setPlan] = useState<PlanInput>(() => createDefaultPlan())
  const [scenarios, setScenarios] = useState<ScenarioOverride[]>(() =>
    createInitialScenarios(createDefaultPlan()),
  )
  const [tab, setTab] = useState<Tab>('result')
  const [importMsg, setImportMsg] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const issues = useMemo(() => validatePlan(plan), [plan])
  const result = useMemo(() => (issues.length === 0 ? simulate(plan) : null), [plan, issues])
  const scenarioResults = useMemo(() => {
    if (issues.length > 0) return []
    return scenarios.map((s) => ({
      scenario: s,
      result: simulate(applyOverrides(plan, s.overrides)),
    }))
  }, [plan, scenarios, issues])

  const update = useCallback((patch: Partial<PlanInput>) => {
    setPlan((p) => ({ ...p, ...patch }))
    setImportMsg(null)
  }, [])

  const addScenario = () => {
    setScenarios((list) => [
      ...list,
      {
        id: crypto.randomUUID(),
        label: `シナリオ ${list.length}`,
        overrides: { retireAge: plan.retireAge },
      },
    ])
  }

  const onImportFile = async (file: File) => {
    const text = await file.text()
    const res = importPlanJson(text)
    if (res.ok === false) {
      setImportMsg(res.message)
      return
    }
    setPlan(res.plan)
    setImportMsg(
      res.warnings.length > 0
        ? `読み込みました（注意: ${res.warnings.join(' / ')}）`
        : '設定を読み込みました',
    )
  }

  return (
    <div className="app">
      <header className="site-header">
        <div className="brand">
          <p className="brand-kicker">Life Plan Simulator</p>
          <h1>資産の行方を、先に描く</h1>
          <p className="brand-lead">
            収入・支出・退職年齢を変えながら、FIRE 到達と資産枯渇のタイミングを試算します。データはブラウザ内のみで処理され、外部へ送信されません。
          </p>
        </div>
        <div className="header-actions">
          <button type="button" className="btn ghost" onClick={() => downloadPlanJson(plan)}>
            JSON エクスポート
          </button>
          <button type="button" className="btn ghost" onClick={() => fileRef.current?.click()}>
            JSON インポート
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="application/json,.json"
            hidden
            onChange={(e) => {
              const f = e.target.files?.[0]
              if (f) void onImportFile(f)
              e.target.value = ''
            }}
          />
          <button
            type="button"
            className="btn quiet"
            onClick={() => {
              const next = createDefaultPlan()
              setPlan(next)
              setScenarios(createInitialScenarios(next))
              setImportMsg('デフォルトに戻しました')
            }}
          >
            リセット
          </button>
        </div>
        {importMsg && <p className="import-msg">{importMsg}</p>}
      </header>

      <div className="layout">
        <aside className="sidebar">
          <InputPanel
            plan={plan}
            issues={issues}
            onChange={update}
            onAddEvent={() =>
              update({
                lifeEvents: [
                  ...plan.lifeEvents,
                  createLifeEvent({
                    name: '新しいイベント',
                    ageYears: plan.currentAge + 5,
                    type: 'one_time',
                    amount: -1_000_000,
                  }),
                ],
              })
            }
            onAddChild={() =>
              update({
                children: [...plan.children, createChild({ currentAge: 0 })],
              })
            }
          />
        </aside>

        <main className="main">
          <div className="tabs" role="tablist">
            <button
              type="button"
              role="tab"
              aria-selected={tab === 'result'}
              className={tab === 'result' ? 'tab active' : 'tab'}
              onClick={() => setTab('result')}
            >
              シミュレーション
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={tab === 'compare'}
              className={tab === 'compare' ? 'tab active' : 'tab'}
              onClick={() => setTab('compare')}
            >
              シナリオ比較
            </button>
          </div>

          {issues.length > 0 && (
            <div className="banner warn" role="alert">
              <strong>入力を確認してください</strong>
              <ul>
                {issues.map((i) => (
                  <li key={i.path + i.message}>{i.message}</li>
                ))}
              </ul>
            </div>
          )}

          {result && tab === 'result' && (
            <>
              <section className="hero-metrics">
                <Metric
                  label="FIRE 到達"
                  value={result.fireAge !== null ? `${result.fireAge}歳` : '未到達'}
                  hint={
                    result.fireAge !== null
                      ? `安全取出率 ${formatPercent(plan.safeWithdrawalRate)} で生活費を賄える資産額に到達`
                      : `年間生活費 ÷ ${formatPercent(plan.safeWithdrawalRate)} に資産が届いていません`
                  }
                  tone={result.fireAge !== null ? 'good' : 'neutral'}
                />
                <Metric
                  label="資産枯渇"
                  value={result.depletionAge !== null ? `${result.depletionAge}歳` : 'なし'}
                  hint={
                    result.depletionAge !== null
                      ? '資産残高がゼロになる最初の年齢'
                      : `${plan.endAge}歳まで資産は維持`
                  }
                  tone={result.depletionAge !== null ? 'bad' : 'good'}
                />
                <Metric
                  label="ピーク資産"
                  value={formatYen(result.peakAssets, true)}
                  hint={`${result.peakAge}歳時点`}
                  tone="neutral"
                />
                <Metric
                  label={`${plan.endAge}歳時点`}
                  value={formatYen(result.finalAssets, true)}
                  hint="シミュレーション終了時の残高"
                  tone="neutral"
                />
              </section>

              <section className="panel chart-panel">
                <div className="panel-head">
                  <h2>資産推移</h2>
                  <p>
                    年次投影 · リターン年率 {formatPercent(plan.annualReturnRate)} · インフレ{' '}
                    {formatPercent(plan.annualInflationRate)}
                  </p>
                </div>
                <AssetChart
                  series={[
                    { id: 'base', label: 'ベース', yearly: result.yearly, color: 'var(--ink-accent)' },
                  ]}
                  retireAge={plan.retireAge}
                  fireAge={result.fireAge}
                  depletionAge={result.depletionAge}
                />
              </section>

              <ResultPanel plan={plan} result={result} />
            </>
          )}

          {result && tab === 'compare' && (
            <>
              <section className="panel chart-panel">
                <div className="panel-head">
                  <h2>シナリオ重ね描き</h2>
                  <p>設定したシナリオの資産推移を重ねて表示</p>
                </div>
                <AssetChart
                  series={scenarioResults.map((s, i) => ({
                    id: s.scenario.id,
                    label: s.scenario.label,
                    yearly: s.result.yearly,
                    color: COMPARE_COLORS[i % COMPARE_COLORS.length],
                  }))}
                  retireAge={plan.retireAge}
                />
              </section>
              <ComparePanel
                items={scenarioResults}
                basePlan={plan}
                scenarios={scenarios}
                onChange={setScenarios}
                onAdd={addScenario}
              />
            </>
          )}
        </main>
      </div>

      <footer className="site-footer">
        <p>
          FIRE 定義: 期末資産 ≧ その年の年間生活費 ÷ 安全取出率（既定 4%）。運用益には設定税率（既定 20.315%）を課税。給与所得税・社会保険・公的年金は含みません。投資リターンは固定率の月次複利。生活費・収入は年次インフレで名目上昇します（退職後収入も同様）。
        </p>
      </footer>
    </div>
  )
}

const COMPARE_COLORS = [
  'var(--ink-accent)',
  'var(--coral)',
  'var(--teal)',
  'var(--amber)',
  'var(--plum)',
]

function Metric({
  label,
  value,
  hint,
  tone,
}: {
  label: string
  value: string
  hint: string
  tone: 'good' | 'bad' | 'neutral'
}) {
  return (
    <article className={`metric tone-${tone}`}>
      <p className="metric-label">{label}</p>
      <p className="metric-value">{value}</p>
      <p className="metric-hint">{hint}</p>
    </article>
  )
}
