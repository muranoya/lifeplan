import {
  DEFAULT_UNIVERSITY_TOTAL,
  UNIVERSITY_START_AGE,
} from './defaults'
import type { PlanInput, SimulationResult, YearSnapshot } from './types'

/**
 * 年次シミュレーション。
 *
 * 前提:
 * - 内部は月次で投影し、年次スナップショットに集約する
 * - 各月: 資産 += 収入 − 生活費 + イベント → 正の残高に月次リターンを適用
 * - 正の運用益に investmentTaxRate を課税し、税引き後を資産に加算
 * - 生活費・収入は毎年インフレ率で名目上昇（複利、実質一定）
 * - 就労中: monthlyIncome、退職後: monthlyPostRetireIncome（いずれも現在価値×インフレ）
 * - 貯蓄 = 収入 − 生活費 + イベント
 * - FIRE: 期末資産 ≧ その年の年間生活費 / safeWithdrawalRate の最初の年齢
 * - 所得税（給与）・社会保険・公的年金は考慮しない
 */
export function simulate(plan: PlanInput): SimulationResult {
  const years = Math.max(0, Math.floor(plan.endAge - plan.currentAge))
  const retireAge = resolveRetireAge(plan)
  const monthlyReturn = Math.pow(1 + plan.annualReturnRate, 1 / 12) - 1
  const taxRate = Math.min(1, Math.max(0, plan.investmentTaxRate))

  let assets = plan.currentAssets
  let fireAge: number | null = null
  let peakAssets = assets
  let peakAge = plan.currentAge

  const yearly: YearSnapshot[] = []

  for (let i = 0; i <= years; i++) {
    const age = plan.currentAge + i
    const retired = age >= retireAge
    const inflationFactor = Math.pow(1 + plan.annualInflationRate, i)
    const monthlyLiving = plan.monthlyLivingCost * inflationFactor
    const annualLiving = monthlyLiving * 12

    const oneTime = sumOneTimeEvents(plan, age, inflationFactor)
    const education = sumEducationCost(plan, age, inflationFactor)
    const monthlyRecurring = sumRecurringEvents(plan, age, inflationFactor)

    let yearIncome = 0
    let yearLiving = 0
    let yearNet = 0
    let yearReturnNet = 0
    let yearTax = 0

    for (let m = 0; m < 12; m++) {
      const baseIncome = retired ? plan.monthlyPostRetireIncome : plan.monthlyIncome
      const mIncome = baseIncome * inflationFactor
      const mOneTime = m === 0 ? oneTime : 0
      const mEducation = m === 0 ? education : 0

      const cashFlow = mIncome - monthlyLiving + mOneTime + monthlyRecurring - mEducation
      assets += cashFlow

      const grossRet = assets > 0 ? assets * monthlyReturn : 0
      const tax = grossRet > 0 ? grossRet * taxRate : 0
      const netRet = grossRet - tax
      assets += netRet
      if (assets < 0) assets = 0

      yearIncome += mIncome
      yearLiving += monthlyLiving
      yearNet += cashFlow
      yearReturnNet += netRet
      yearTax += tax
    }

    const fireTarget = annualLiving / plan.safeWithdrawalRate
    const fireAchieved = annualLiving > 0 && assets >= fireTarget
    if (fireAchieved && fireAge === null) {
      fireAge = age
    }

    if (assets > peakAssets) {
      peakAssets = assets
      peakAge = age
    }

    const snap: YearSnapshot = {
      age,
      yearIndex: i,
      assets: roundYen(assets),
      livingCost: roundYen(yearLiving),
      income: roundYen(yearIncome),
      netCashFlow: roundYen(yearNet),
      investmentReturn: roundYen(yearReturnNet),
      investmentTax: roundYen(yearTax),
      retired,
      depleted: assets <= 0,
      fireAchieved,
    }
    yearly.push(snap)
  }

  const depletionAge = resolveDepletionAge(yearly, plan.currentAssets)

  const last = yearly[yearly.length - 1]

  return {
    yearly,
    depletionAge,
    fireAge,
    finalAssets: last ? last.assets : roundYen(plan.currentAssets),
    peakAssets: roundYen(peakAssets),
    peakAge,
  }
}

function resolveDepletionAge(
  yearly: YearSnapshot[],
  startingAssets: number,
): number | null {
  const hit = yearly.find((y) => y.assets <= 0)
  if (!hit) return null
  if (hit.yearIndex === 0 && startingAssets > 0) {
    return hit.age
  }
  return hit.age
}

function resolveRetireAge(plan: PlanInput): number {
  const retireEvents = plan.lifeEvents.filter((e) => e.type === 'retire')
  if (retireEvents.length === 0) return plan.retireAge
  return Math.min(plan.retireAge, ...retireEvents.map((e) => e.ageYears))
}

function sumOneTimeEvents(plan: PlanInput, age: number, inflationFactor: number): number {
  return plan.lifeEvents
    .filter((e) => e.type === 'one_time' && Math.floor(e.ageYears) === age)
    .reduce((s, e) => s + e.amount * inflationFactor, 0)
}

function sumRecurringEvents(plan: PlanInput, age: number, inflationFactor: number): number {
  return plan.lifeEvents
    .filter((e) => {
      if (e.type !== 'recurring') return false
      if (age < Math.floor(e.ageYears)) return false
      if (e.endAgeYears !== undefined && age > Math.floor(e.endAgeYears)) return false
      return true
    })
    .reduce((s, e) => s + e.amount * inflationFactor, 0)
}

function sumEducationCost(plan: PlanInput, age: number, inflationFactor: number): number {
  let total = 0
  for (const child of plan.children) {
    if (!child.planUniversity) continue
    const childAge = child.currentAge + (age - plan.currentAge)
    if (childAge >= UNIVERSITY_START_AGE && childAge < UNIVERSITY_START_AGE + 4) {
      total += (DEFAULT_UNIVERSITY_TOTAL / 4) * inflationFactor
    }
  }
  return total
}

function roundYen(n: number): number {
  if (!Number.isFinite(n)) return 0
  return Math.round(n)
}

export function applyOverrides(base: PlanInput, overrides: Partial<PlanInput>): PlanInput {
  return {
    ...base,
    ...overrides,
    children: overrides.children ?? base.children,
    lifeEvents: overrides.lifeEvents ?? base.lifeEvents,
  }
}
