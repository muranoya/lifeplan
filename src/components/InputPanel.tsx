import type { ReactNode } from 'react'
import type { LifeEvent, PlanInput, ValidationIssue } from '../engine'
import { formatYen, manToYen, yenToMan } from '../lib/format'

interface Props {
  plan: PlanInput
  issues: ValidationIssue[]
  onChange: (patch: Partial<PlanInput>) => void
  onAddEvent: () => void
  onAddChild: () => void
}

export function InputPanel({ plan, issues, onChange, onAddEvent, onAddChild }: Props) {
  const err = (path: string) => issues.some((i) => i.path === path || i.path.startsWith(path + '.'))

  return (
    <div className="input-panel">
      <Section title="基本">
        <Field label="現在の年齢" error={err('currentAge')}>
          <Num value={plan.currentAge} onChange={(v) => onChange({ currentAge: v })} suffix="歳" />
        </Field>
        <Field label="現在の金融資産" error={err('currentAssets')}>
          <ManYen valueYen={plan.currentAssets} onChangeYen={(v) => onChange({ currentAssets: v })} step={10} />
        </Field>
        <Field label="退職（FIRE）年齢" error={err('retireAge')}>
          <Num value={plan.retireAge} onChange={(v) => onChange({ retireAge: v })} suffix="歳" />
        </Field>
        <Field label="シミュレーション終了" error={err('endAge')}>
          <Num value={plan.endAge} onChange={(v) => onChange({ endAge: v })} suffix="歳" />
        </Field>
      </Section>

      <Section title="収支（月額・現在価値）">
        <Field label="就労中の手取り収入" error={err('monthlyIncome')}>
          <ManYen valueYen={plan.monthlyIncome} onChangeYen={(v) => onChange({ monthlyIncome: v })} step={1} />
        </Field>
        <Field label="生活費" error={err('monthlyLivingCost')}>
          <ManYen valueYen={plan.monthlyLivingCost} onChangeYen={(v) => onChange({ monthlyLivingCost: v })} step={1} />
        </Field>
        <Field label="うち積立投資（参考）" error={err('monthlyInvestment')} hint="計算は収入−生活費を貯蓄として扱います">
          <ManYen valueYen={plan.monthlyInvestment} onChangeYen={(v) => onChange({ monthlyInvestment: v })} step={1} />
        </Field>
        <p className="field-note">
          毎月の貯蓄目安:{' '}
          <strong>{formatYen(plan.monthlyIncome - plan.monthlyLivingCost)}</strong>
        </p>
      </Section>

      <Section title="運用前提">
        <Field label="期待リターン（年率）" error={err('annualReturnRate')}>
          <Num
            value={round1(plan.annualReturnRate * 100)}
            onChange={(v) => onChange({ annualReturnRate: v / 100 })}
            suffix="%"
            step={0.1}
          />
        </Field>
        <Field label="インフレ率（年率）" error={err('annualInflationRate')}>
          <Num
            value={round1(plan.annualInflationRate * 100)}
            onChange={(v) => onChange({ annualInflationRate: v / 100 })}
            suffix="%"
            step={0.1}
          />
        </Field>
        <Field label="安全取出率（FIRE）" error={err('safeWithdrawalRate')} hint="4% ルール相当">
          <Num
            value={round1(plan.safeWithdrawalRate * 100)}
            onChange={(v) => onChange({ safeWithdrawalRate: v / 100 })}
            suffix="%"
            step={0.1}
          />
        </Field>
        <Field
          label="運用益税率"
          error={err('investmentTaxRate')}
          hint="上場株式等の申告分離課税相当（20.315%）。0 で非課税"
        >
          <Num
            value={round3(plan.investmentTaxRate * 100)}
            onChange={(v) => onChange({ investmentTaxRate: v / 100 })}
            suffix="%"
            step={0.001}
          />
        </Field>
      </Section>

      <Section title="家族">
        <label className="check-row">
          <input
            type="checkbox"
            checked={plan.hasSpouse}
            onChange={(e) =>
              onChange({
                hasSpouse: e.target.checked,
                spouseAge: e.target.checked ? (plan.spouseAge ?? plan.currentAge) : undefined,
              })
            }
          />
          配偶者あり
        </label>
        {plan.hasSpouse && (
          <Field label="配偶者の年齢" error={err('spouseAge')}>
            <Num
              value={plan.spouseAge ?? plan.currentAge}
              onChange={(v) => onChange({ spouseAge: v })}
              suffix="歳"
            />
          </Field>
        )}

        <div className="list-head">
          <h3>子供</h3>
          <button type="button" className="btn tiny" onClick={onAddChild}>
            追加
          </button>
        </div>
        {plan.children.length === 0 && <p className="empty-hint">未登録。大学費用の自動計上に使います。</p>}
        {plan.children.map((c, idx) => (
          <div key={c.id} className="mini-card">
            <div className="mini-card-top">
              <span>子供 {idx + 1}</span>
              <button
                type="button"
                className="btn tiny quiet"
                onClick={() => onChange({ children: plan.children.filter((x) => x.id !== c.id) })}
              >
                削除
              </button>
            </div>
            <Field label="現在の年齢（未誕生は負）">
              <Num
                value={c.currentAge}
                onChange={(v) =>
                  onChange({
                    children: plan.children.map((x) => (x.id === c.id ? { ...x, currentAge: v } : x)),
                  })
                }
                suffix="歳"
              />
            </Field>
            <label className="check-row">
              <input
                type="checkbox"
                checked={c.planUniversity}
                onChange={(e) =>
                  onChange({
                    children: plan.children.map((x) =>
                      x.id === c.id ? { ...x, planUniversity: e.target.checked } : x,
                    ),
                  })
                }
              />
              大学進学を想定（18歳から4年・総額400万円）
            </label>
          </div>
        ))}
      </Section>

      <Section title="ライフイベント">
        <div className="list-head">
          <h3>イベント</h3>
          <button type="button" className="btn tiny" onClick={onAddEvent}>
            追加
          </button>
        </div>
        {plan.lifeEvents.length === 0 && (
          <p className="empty-hint">住宅購入・退職・一時支出などを追加できます。</p>
        )}
        {plan.lifeEvents.map((ev) => (
          <EventEditor
            key={ev.id}
            event={ev}
            onChange={(next) =>
              onChange({
                lifeEvents: plan.lifeEvents.map((x) => (x.id === ev.id ? next : x)),
              })
            }
            onRemove={() =>
              onChange({ lifeEvents: plan.lifeEvents.filter((x) => x.id !== ev.id) })
            }
          />
        ))}
      </Section>
    </div>
  )
}

function EventEditor({
  event,
  onChange,
  onRemove,
}: {
  event: LifeEvent
  onChange: (e: LifeEvent) => void
  onRemove: () => void
}) {
  return (
    <div className="mini-card">
      <div className="mini-card-top">
        <input
          className="text-input"
          value={event.name}
          onChange={(e) => onChange({ ...event, name: e.target.value })}
          aria-label="イベント名"
        />
        <button type="button" className="btn tiny quiet" onClick={onRemove}>
          削除
        </button>
      </div>
      <Field label="種類">
        <select
          className="select-input"
          value={event.type}
          onChange={(e) =>
            onChange({ ...event, type: e.target.value as LifeEvent['type'] })
          }
        >
          <option value="one_time">一時金（正=収入 / 負=支出）</option>
          <option value="recurring">継続（月次の増減）</option>
          <option value="retire">退職年齢の上書き</option>
        </select>
      </Field>
      <Field label="発生年齢">
        <Num value={event.ageYears} onChange={(v) => onChange({ ...event, ageYears: v })} suffix="歳" />
      </Field>
      {event.type !== 'retire' && (
        <Field label={event.type === 'recurring' ? '月額' : '金額'}>
          <ManYen valueYen={event.amount} onChangeYen={(v) => onChange({ ...event, amount: v })} step={10} />
        </Field>
      )}
      {event.type === 'recurring' && (
        <Field label="終了年齢（任意）">
          <Num
            value={event.endAgeYears ?? event.ageYears + 10}
            onChange={(v) => onChange({ ...event, endAgeYears: v })}
            suffix="歳"
          />
        </Field>
      )}
    </div>
  )
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="form-section">
      <h2>{title}</h2>
      <div className="form-grid">{children}</div>
    </section>
  )
}

function Field({
  label,
  children,
  error,
  hint,
}: {
  label: string
  children: ReactNode
  error?: boolean
  hint?: string
}) {
  return (
    <label className={error ? 'field error' : 'field'}>
      <span className="field-label">{label}</span>
      {children}
      {hint && <span className="field-hint">{hint}</span>}
    </label>
  )
}

function Num({
  value,
  onChange,
  suffix,
  step = 1,
}: {
  value: number
  onChange: (v: number) => void
  suffix?: string
  step?: number
}) {
  return (
    <span className="num-wrap">
      <input
        type="number"
        className="num-input"
        value={Number.isFinite(value) ? value : ''}
        step={step}
        onChange={(e) => {
          const v = e.target.value === '' ? NaN : Number(e.target.value)
          onChange(v)
        }}
      />
      {suffix && <span className="num-suffix">{suffix}</span>}
    </span>
  )
}

/** 内部は円、表示・入力は万円 */
function ManYen({
  valueYen,
  onChangeYen,
  step = 1,
}: {
  valueYen: number
  onChangeYen: (yen: number) => void
  step?: number
}) {
  const man = yenToMan(valueYen)
  const display = Number.isFinite(man) ? roundMan(man) : NaN
  return (
    <Num
      value={display}
      onChange={(v) => onChangeYen(manToYen(v))}
      suffix="万円"
      step={step}
    />
  )
}

function round1(n: number): number {
  return Math.round(n * 10) / 10
}

function round3(n: number): number {
  return Math.round(n * 1000) / 1000
}

function roundMan(n: number): number {
  return Math.round(n * 100) / 100
}
