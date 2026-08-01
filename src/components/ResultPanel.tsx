import type { PlanInput, SimulationResult } from '../engine'
import { formatYen } from '../lib/format'

interface Props {
  plan: PlanInput
  result: SimulationResult
}

export function ResultPanel({ plan, result }: Props) {
  return (
    <section className="panel">
      <div className="panel-head">
        <h2>年次サマリー</h2>
        <p>1年ごと · 全 {result.yearly.length} 年</p>
      </div>
      <div className="table-wrap max-h">
        <table className="data-table">
          <thead>
            <tr>
              <th>年齢</th>
              <th>資産</th>
              <th>生活費（年）</th>
              <th>収入（年）</th>
              <th>運用益（税後）</th>
              <th>運用税</th>
              <th>状態</th>
            </tr>
          </thead>
          <tbody>
            {result.yearly.map((y) => {
              const isFireYear = result.fireAge !== null && y.age === result.fireAge
              const isDepleteYear = result.depletionAge !== null && y.age === result.depletionAge
              return (
                <tr
                  key={y.age}
                  className={
                    isDepleteYear || y.depleted
                      ? 'row-bad'
                      : isFireYear
                        ? 'row-good'
                        : y.retired
                          ? 'row-muted'
                          : undefined
                  }
                >
                  <td>{y.age}</td>
                  <td className="num">{formatYen(y.assets)}</td>
                  <td className="num">{formatYen(y.livingCost)}</td>
                  <td className="num">{formatYen(y.income)}</td>
                  <td className="num">{formatYen(y.investmentReturn)}</td>
                  <td className="num">{formatYen(y.investmentTax)}</td>
                  <td>{statusLabel(y.depleted, y.retired, isFireYear)}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      <p className="panel-foot">
        退職年齢 {plan.retireAge}歳 · 安全取出率 {(plan.safeWithdrawalRate * 100).toFixed(1)}% ·
        必要FIRE資産（現在の生活費ベース）約{' '}
        {formatYen((plan.monthlyLivingCost * 12) / plan.safeWithdrawalRate, true)}
      </p>
    </section>
  )
}

function statusLabel(depleted: boolean, retired: boolean, isFireYear: boolean): string {
  if (depleted) return '枯渇'
  if (isFireYear) return retired ? 'FIRE達成（退職後）' : 'FIRE達成'
  if (retired) return '退職後'
  return '就労中'
}
