/** 設定ファイルのスキーマバージョン */
export const SCHEMA_VERSION = 1 as const

/** ライフイベントの種類 */
export type LifeEventType =
  | 'one_time' // 一時的な支出・収入
  | 'recurring' // 継続的な月次収支変化
  | 'retire' // 退職（FIRE）

export interface LifeEvent {
  id: string
  name: string
  /** 発生年齢（年） */
  ageYears: number
  type: LifeEventType
  /**
   * one_time: その年の一時金（正=収入, 負=支出）
   * recurring: 月次収支の増減（正=収入増/支出減, 負=支出増）
   * retire: 金額は未使用（退職年齢の上書き）
   */
  amount: number
  /** recurring の終了年齢（省略時はシミュレーション終了まで） */
  endAgeYears?: number
}

export interface Child {
  id: string
  /** 現在の年齢（未誕生は負の値で「何年後に誕生」を表す） */
  currentAge: number
  /** 大学進学を想定するか */
  planUniversity: boolean
}

export interface PlanInput {
  /** 現在の年齢 */
  currentAge: number
  /** 現在の金融資産（円） */
  currentAssets: number
  /** 毎月の生活費（円、現在価値） */
  monthlyLivingCost: number
  /** 毎月の就労収入（手取り想定、円、現在価値） */
  monthlyIncome: number
  /**
   * 退職後の月次収入（手取り想定、円、現在価値）。
   * サイドFIRE・副業・パート等。0 なら退職後は収入なし
   */
  monthlyPostRetireIncome: number
  /** 退職（FIRE）予定年齢 */
  retireAge: number
  /** シミュレーション終了年齢 */
  endAge: number
  /** 年間期待リターン（例: 0.05 = 5%） */
  annualReturnRate: number
  /** 年間インフレ率（生活費・収入の名目上昇、例: 0.02 = 2%） */
  annualInflationRate: number
  /** 配偶者あり */
  hasSpouse: boolean
  /** 配偶者の現在年齢 */
  spouseAge?: number
  /** 子供 */
  children: Child[]
  /** ライフイベント */
  lifeEvents: LifeEvent[]
  /**
   * FIRE 判定の安全取出率（例: 0.04 = 4%ルール）
   * 年間生活費 / 取出率 ≦ 資産 で FIRE 達成とみなす
   */
  safeWithdrawalRate: number
  /**
   * 運用益にかかる税率（例: 0.20315 = 20.315%）
   * 正の運用益に対して課税し、税引き後リターンを資産に残す
   */
  investmentTaxRate: number
}

export interface YearSnapshot {
  age: number
  yearIndex: number
  assets: number
  /** その年の生活費合計（インフレ後） */
  livingCost: number
  /** その年の就労収入合計 */
  income: number
  /** その年の純キャッシュフロー（収入−支出＋一時イベント等、投資リターン除く） */
  netCashFlow: number
  /** 投資リターン（税引き後） */
  investmentReturn: number
  /** 運用益にかかる税金 */
  investmentTax: number
  retired: boolean
  depleted: boolean
  fireAchieved: boolean
}

export interface SimulationResult {
  yearly: YearSnapshot[]
  /** 資産が初めて 0 以下になった年齢（なければ null） */
  depletionAge: number | null
  /** FIRE 達成年齢（なければ null） */
  fireAge: number | null
  /** 最終年齢時点の資産 */
  finalAssets: number
  /** ピーク資産 */
  peakAssets: number
  peakAge: number
}

export interface PlanDocument {
  schemaVersion: typeof SCHEMA_VERSION
  exportedAt: string
  plan: PlanInput
}

export interface ScenarioOverride {
  id: string
  label: string
  /** 上書きするフィールド（部分） */
  overrides: Partial<
    Pick<
      PlanInput,
      | 'retireAge'
      | 'monthlyLivingCost'
      | 'monthlyIncome'
      | 'monthlyPostRetireIncome'
      | 'annualReturnRate'
      | 'annualInflationRate'
      | 'investmentTaxRate'
      | 'currentAssets'
    >
  >
}
