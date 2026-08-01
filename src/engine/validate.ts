import type { PlanInput } from './types'

export interface ValidationIssue {
  path: string
  message: string
}

export function validatePlan(plan: PlanInput): ValidationIssue[] {
  const issues: ValidationIssue[] = []

  if (!Number.isFinite(plan.currentAge) || plan.currentAge < 0 || plan.currentAge > 120) {
    issues.push({ path: 'currentAge', message: '現在の年齢は 0〜120 の範囲で入力してください' })
  }
  if (!Number.isFinite(plan.currentAssets) || plan.currentAssets < 0) {
    issues.push({ path: 'currentAssets', message: '現在の資産は 0 以上で入力してください' })
  }
  if (!Number.isFinite(plan.monthlyLivingCost) || plan.monthlyLivingCost < 0) {
    issues.push({ path: 'monthlyLivingCost', message: '生活費は 0 以上で入力してください' })
  }
  if (!Number.isFinite(plan.monthlyIncome) || plan.monthlyIncome < 0) {
    issues.push({ path: 'monthlyIncome', message: '収入は 0 以上で入力してください' })
  }
  if (!Number.isFinite(plan.monthlyInvestment) || plan.monthlyInvestment < 0) {
    issues.push({ path: 'monthlyInvestment', message: '積立額は 0 以上で入力してください' })
  }
  if (!Number.isFinite(plan.retireAge) || plan.retireAge < plan.currentAge) {
    issues.push({ path: 'retireAge', message: '退職年齢は現在の年齢以上にしてください' })
  }
  if (!Number.isFinite(plan.endAge) || plan.endAge <= plan.currentAge) {
    issues.push({ path: 'endAge', message: '終了年齢は現在の年齢より大きくしてください' })
  }
  if (plan.retireAge > plan.endAge) {
    issues.push({ path: 'retireAge', message: '退職年齢は終了年齢以下にしてください' })
  }
  if (!Number.isFinite(plan.annualReturnRate) || plan.annualReturnRate < -0.5 || plan.annualReturnRate > 0.5) {
    issues.push({ path: 'annualReturnRate', message: 'リターンは -50%〜50% の範囲で入力してください' })
  }
  if (
    !Number.isFinite(plan.annualInflationRate) ||
    plan.annualInflationRate < -0.2 ||
    plan.annualInflationRate > 0.3
  ) {
    issues.push({ path: 'annualInflationRate', message: 'インフレ率は -20%〜30% の範囲で入力してください' })
  }
  if (
    !Number.isFinite(plan.safeWithdrawalRate) ||
    plan.safeWithdrawalRate <= 0 ||
    plan.safeWithdrawalRate > 0.2
  ) {
    issues.push({
      path: 'safeWithdrawalRate',
      message: '安全取出率は 0% より大きく 20% 以下で入力してください',
    })
  }
  if (
    !Number.isFinite(plan.investmentTaxRate) ||
    plan.investmentTaxRate < 0 ||
    plan.investmentTaxRate > 0.55
  ) {
    issues.push({
      path: 'investmentTaxRate',
      message: '運用益税率は 0%〜55% の範囲で入力してください',
    })
  }
  if (plan.hasSpouse && plan.spouseAge !== undefined) {
    if (!Number.isFinite(plan.spouseAge) || plan.spouseAge < 0 || plan.spouseAge > 120) {
      issues.push({ path: 'spouseAge', message: '配偶者の年齢は 0〜120 の範囲で入力してください' })
    }
  }
  for (const child of plan.children) {
    if (!Number.isFinite(child.currentAge) || child.currentAge < -20 || child.currentAge > 40) {
      issues.push({
        path: `children.${child.id}`,
        message: '子供の年齢は -20（20年後誕生）〜40 の範囲で入力してください',
      })
    }
  }
  for (const ev of plan.lifeEvents) {
    if (!Number.isFinite(ev.ageYears) || ev.ageYears < plan.currentAge || ev.ageYears > plan.endAge) {
      issues.push({
        path: `lifeEvents.${ev.id}`,
        message: `「${ev.name || 'イベント'}」の年齢がシミュレーション範囲外です`,
      })
    }
    if (
      ev.endAgeYears !== undefined &&
      (!Number.isFinite(ev.endAgeYears) || ev.endAgeYears < ev.ageYears)
    ) {
      issues.push({
        path: `lifeEvents.${ev.id}.end`,
        message: `「${ev.name || 'イベント'}」の終了年齢は開始以上にしてください`,
      })
    }
  }

  return issues
}
