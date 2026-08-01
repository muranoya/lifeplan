import type { PlanInput, LifeEvent, Child } from './types'

function id(): string {
  return crypto.randomUUID()
}

export function createDefaultPlan(): PlanInput {
  return {
    currentAge: 30,
    currentAssets: 5_000_000,
    monthlyLivingCost: 250_000,
    monthlyIncome: 400_000,
    monthlyInvestment: 100_000,
    retireAge: 45,
    endAge: 90,
    annualReturnRate: 0.05,
    annualInflationRate: 0.02,
    /** 上場株式等の申告分離課税（所得税15.315%+住民税5%）相当 */
    investmentTaxRate: 0.20315,
    hasSpouse: false,
    spouseAge: undefined,
    children: [],
    lifeEvents: [],
    safeWithdrawalRate: 0.04,
  }
}

export function createLifeEvent(
  partial: Partial<LifeEvent> & Pick<LifeEvent, 'name' | 'ageYears' | 'type'>,
): LifeEvent {
  return {
    id: id(),
    amount: 0,
    ...partial,
  }
}

export function createChild(partial?: Partial<Child>): Child {
  return {
    id: id(),
    currentAge: 0,
    planUniversity: true,
    ...partial,
  }
}

/** 大学費用のデフォルト（4年間・総額、現在価値） */
export const DEFAULT_UNIVERSITY_TOTAL = 4_000_000
/** 大学入学想定年齢 */
export const UNIVERSITY_START_AGE = 18
