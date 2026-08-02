import { describe, expect, it } from 'vitest'
import { createDefaultPlan, createLifeEvent, createChild } from './defaults'
import { simulate } from './simulate'
import { validatePlan } from './validate'
import { exportPlan, importPlanJson } from './serialize'

describe('simulate', () => {
  it('produces yearly snapshots from current to end age', () => {
    const plan = createDefaultPlan()
    plan.currentAge = 30
    plan.endAge = 40
    const result = simulate(plan)
    expect(result.yearly).toHaveLength(11)
    expect(result.yearly[0].age).toBe(30)
    expect(result.yearly[10].age).toBe(40)
  })

  it('grows assets while saving before retirement', () => {
    const plan = createDefaultPlan()
    plan.currentAge = 30
    plan.retireAge = 60
    plan.endAge = 40
    plan.currentAssets = 1_000_000
    plan.monthlyIncome = 500_000
    plan.monthlyLivingCost = 200_000
    plan.annualReturnRate = 0.05
    plan.annualInflationRate = 0
    const result = simulate(plan)
    expect(result.yearly[result.yearly.length - 1].assets).toBeGreaterThan(plan.currentAssets)
    expect(result.depletionAge).toBeNull()
  })

  it('detects depletion when spending without income or assets', () => {
    const plan = createDefaultPlan()
    plan.currentAge = 60
    plan.retireAge = 60
    plan.endAge = 80
    plan.currentAssets = 1_000_000
    plan.monthlyIncome = 0
    plan.monthlyLivingCost = 200_000
    plan.annualReturnRate = 0
    plan.annualInflationRate = 0
    const result = simulate(plan)
    expect(result.depletionAge).not.toBeNull()
    expect(result.depletionAge!).toBeLessThanOrEqual(70)
  })

  it('detects FIRE when assets cover expenses by SWR', () => {
    const plan = createDefaultPlan()
    plan.currentAge = 40
    plan.retireAge = 65
    plan.endAge = 50
    plan.currentAssets = 100_000_000
    plan.monthlyLivingCost = 200_000 // 年 240 万、4% なら必要 6000 万
    plan.monthlyIncome = 0
    plan.annualReturnRate = 0.05
    plan.annualInflationRate = 0
    plan.safeWithdrawalRate = 0.04
    const result = simulate(plan)
    expect(result.fireAge).toBe(40)
  })

  it('applies one-time life events', () => {
    const plan = createDefaultPlan()
    plan.currentAge = 30
    plan.endAge = 32
    plan.retireAge = 65
    plan.currentAssets = 0
    plan.monthlyIncome = 0
    plan.monthlyLivingCost = 0
    plan.annualReturnRate = 0
    plan.annualInflationRate = 0
    plan.lifeEvents = [
      createLifeEvent({ name: 'ボーナス', ageYears: 31, type: 'one_time', amount: 1_000_000 }),
    ]
    const result = simulate(plan)
    const y31 = result.yearly.find((y) => y.age === 31)!
    expect(y31.assets).toBeGreaterThanOrEqual(1_000_000)
  })

  it('applies university costs for children', () => {
    const plan = createDefaultPlan()
    plan.currentAge = 40
    plan.endAge = 45
    plan.retireAge = 65
    plan.currentAssets = 10_000_000
    plan.monthlyIncome = 0
    plan.monthlyLivingCost = 0
    plan.annualReturnRate = 0
    plan.annualInflationRate = 0
    plan.children = [createChild({ currentAge: 17, planUniversity: true })]
    const withEdu = simulate(plan)
    plan.children = [createChild({ currentAge: 17, planUniversity: false })]
    const without = simulate(plan)
    expect(withEdu.finalAssets).toBeLessThan(without.finalAssets)
  })

  it('respects retire life event age', () => {
    const plan = createDefaultPlan()
    plan.currentAge = 30
    plan.retireAge = 60
    plan.endAge = 45
    plan.monthlyIncome = 500_000
    plan.monthlyPostRetireIncome = 0
    plan.monthlyLivingCost = 100_000
    plan.annualInflationRate = 0
    plan.lifeEvents = [
      createLifeEvent({ name: '早期退職', ageYears: 35, type: 'retire', amount: 0 }),
    ]
    const result = simulate(plan)
    const at34 = result.yearly.find((y) => y.age === 34)!
    const at35 = result.yearly.find((y) => y.age === 35)!
    expect(at34.retired).toBe(false)
    expect(at35.retired).toBe(true)
    expect(at35.income).toBe(0)
  })

  it('applies post-retire side income after retirement', () => {
    const plan = createDefaultPlan()
    plan.currentAge = 50
    plan.retireAge = 50
    plan.endAge = 52
    plan.currentAssets = 0
    plan.monthlyIncome = 500_000
    plan.monthlyPostRetireIncome = 100_000
    plan.monthlyLivingCost = 0
    plan.annualReturnRate = 0
    plan.annualInflationRate = 0
    const result = simulate(plan)
    const y50 = result.yearly.find((y) => y.age === 50)!
    expect(y50.retired).toBe(true)
    expect(y50.income).toBe(100_000 * 12)
    expect(y50.assets).toBe(100_000 * 12)
  })

  it('inflates income with annual inflation rate', () => {
    const plan = createDefaultPlan()
    plan.currentAge = 30
    plan.retireAge = 65
    plan.endAge = 32
    plan.currentAssets = 0
    plan.monthlyIncome = 100_000
    plan.monthlyLivingCost = 0
    plan.annualReturnRate = 0
    plan.annualInflationRate = 0.1
    const result = simulate(plan)
    const y0 = result.yearly.find((y) => y.age === 30)!
    const y1 = result.yearly.find((y) => y.age === 31)!
    expect(y0.income).toBe(100_000 * 12)
    expect(y1.income).toBe(Math.round(100_000 * 1.1 * 12))
  })

  it('taxes positive investment returns', () => {
    const base = createDefaultPlan()
    base.currentAge = 40
    base.endAge = 42
    base.retireAge = 65
    base.currentAssets = 10_000_000
    base.monthlyIncome = 0
    base.monthlyLivingCost = 0
    base.annualReturnRate = 0.12
    base.annualInflationRate = 0
    base.investmentTaxRate = 0

    const noTax = simulate(base)
    base.investmentTaxRate = 0.2
    const taxed = simulate(base)

    expect(taxed.finalAssets).toBeLessThan(noTax.finalAssets)
    expect(taxed.yearly[0].investmentTax).toBeGreaterThan(0)
    expect(taxed.yearly[0].investmentReturn).toBeLessThan(noTax.yearly[0].investmentReturn)
  })
})

describe('validatePlan', () => {
  it('flags retire age before current age', () => {
    const plan = createDefaultPlan()
    plan.currentAge = 40
    plan.retireAge = 30
    const issues = validatePlan(plan)
    expect(issues.some((i) => i.path === 'retireAge')).toBe(true)
  })

  it('accepts default plan', () => {
    expect(validatePlan(createDefaultPlan())).toHaveLength(0)
  })
})

describe('serialize', () => {
  it('round-trips export and import', () => {
    const plan = createDefaultPlan()
    plan.monthlyLivingCost = 333_000
    plan.monthlyPostRetireIncome = 80_000
    plan.children = [createChild({ currentAge: 5 })]
    const json = exportPlan(plan)
    const result = importPlanJson(json)
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.plan.monthlyLivingCost).toBe(333_000)
      expect(result.plan.monthlyPostRetireIncome).toBe(80_000)
      expect(result.plan.children).toHaveLength(1)
      expect(result.plan.children[0].currentAge).toBe(5)
    }
  })

  it('defaults missing post-retire income on import', () => {
    const result = importPlanJson(
      JSON.stringify({
        schemaVersion: 1,
        plan: {
          currentAge: 30,
          currentAssets: 1_000_000,
          monthlyLivingCost: 200_000,
          monthlyIncome: 400_000,
          retireAge: 45,
          endAge: 90,
          annualReturnRate: 0.05,
          annualInflationRate: 0.02,
          hasSpouse: false,
          children: [],
          lifeEvents: [],
          safeWithdrawalRate: 0.04,
          investmentTaxRate: 0.20315,
        },
      }),
    )
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.plan.monthlyPostRetireIncome).toBe(0)
    }
  })

  it('rejects invalid json', () => {
    const result = importPlanJson('not json')
    expect(result.ok).toBe(false)
  })
})
