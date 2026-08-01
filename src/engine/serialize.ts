import { SCHEMA_VERSION, type PlanDocument, type PlanInput } from './types'
import { createDefaultPlan } from './defaults'
import { validatePlan } from './validate'

export function exportPlan(plan: PlanInput): string {
  const doc: PlanDocument = {
    schemaVersion: SCHEMA_VERSION,
    exportedAt: new Date().toISOString(),
    plan: sanitizePlan(plan),
  }
  return JSON.stringify(doc, null, 2)
}

export function downloadPlanJson(plan: PlanInput, filename = 'lifeplan.json'): void {
  const blob = new Blob([exportPlan(plan)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

export interface ImportResult {
  ok: true
  plan: PlanInput
  warnings: string[]
}

export interface ImportError {
  ok: false
  message: string
}

export function importPlanJson(text: string): ImportResult | ImportError {
  let raw: unknown
  try {
    raw = JSON.parse(text)
  } catch {
    return { ok: false, message: 'JSON の解析に失敗しました' }
  }

  if (!raw || typeof raw !== 'object') {
    return { ok: false, message: '不正な形式です' }
  }

  const obj = raw as Record<string, unknown>
  const warnings: string[] = []

  // 直に PlanInput が来た場合も許容
  let planRaw: unknown
  if ('plan' in obj && obj.plan && typeof obj.plan === 'object') {
    const ver = obj.schemaVersion
    if (typeof ver === 'number' && ver > SCHEMA_VERSION) {
      warnings.push(`未対応のスキーマ v${ver} です。可能な範囲で読み込みます`)
    }
    planRaw = obj.plan
  } else if ('currentAge' in obj) {
    planRaw = obj
    warnings.push('スキーマラッパーなしの形式として読み込みました')
  } else {
    return { ok: false, message: 'plan オブジェクトが見つかりません' }
  }

  const defaults = createDefaultPlan()
  const p = planRaw as Partial<PlanInput>
  const plan: PlanInput = {
    ...defaults,
    ...pickDefined(p, [
      'currentAge',
      'currentAssets',
      'monthlyLivingCost',
      'monthlyIncome',
      'monthlyInvestment',
      'retireAge',
      'endAge',
      'annualReturnRate',
      'annualInflationRate',
      'hasSpouse',
      'spouseAge',
      'safeWithdrawalRate',
      'investmentTaxRate',
    ]),
    children: Array.isArray(p.children)
      ? p.children.map((c, i) => ({
          id: typeof c.id === 'string' ? c.id : `child-${i}`,
          currentAge: Number(c.currentAge) || 0,
          planUniversity: Boolean(c.planUniversity),
        }))
      : [],
    lifeEvents: Array.isArray(p.lifeEvents)
      ? p.lifeEvents.map((e, i) => ({
          id: typeof e.id === 'string' ? e.id : `event-${i}`,
          name: String(e.name ?? ''),
          ageYears: Number(e.ageYears) || defaults.currentAge,
          type:
            e.type === 'one_time' || e.type === 'recurring' || e.type === 'retire'
              ? e.type
              : 'one_time',
          amount: Number(e.amount) || 0,
          endAgeYears:
            e.endAgeYears !== undefined && e.endAgeYears !== null
              ? Number(e.endAgeYears)
              : undefined,
        }))
      : [],
  }

  const issues = validatePlan(plan)
  if (issues.length > 0) {
    warnings.push(...issues.map((x) => x.message))
  }

  return { ok: true, plan: sanitizePlan(plan), warnings }
}

function pickDefined<T extends object, K extends keyof T>(
  obj: Partial<T>,
  keys: K[],
): Partial<Pick<T, K>> {
  const out: Partial<Pick<T, K>> = {}
  for (const k of keys) {
    if (obj[k] !== undefined) {
      out[k] = obj[k]
    }
  }
  return out
}

function sanitizePlan(plan: PlanInput): PlanInput {
  return {
    ...plan,
    currentAge: Number(plan.currentAge),
    currentAssets: Number(plan.currentAssets),
    monthlyLivingCost: Number(plan.monthlyLivingCost),
    monthlyIncome: Number(plan.monthlyIncome),
    monthlyInvestment: Number(plan.monthlyInvestment),
    retireAge: Number(plan.retireAge),
    endAge: Number(plan.endAge),
    annualReturnRate: Number(plan.annualReturnRate),
    annualInflationRate: Number(plan.annualInflationRate),
    safeWithdrawalRate: Number(plan.safeWithdrawalRate),
    investmentTaxRate: Number(plan.investmentTaxRate),
    hasSpouse: Boolean(plan.hasSpouse),
    spouseAge: plan.spouseAge !== undefined ? Number(plan.spouseAge) : undefined,
    children: plan.children.map((c) => ({ ...c })),
    lifeEvents: plan.lifeEvents.map((e) => ({ ...e })),
  }
}
