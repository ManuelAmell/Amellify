import type { PartialGrade } from '@/types/domain'

type GradedInput = Pick<PartialGrade, 'grade' | 'percent'>

function toFiniteNumber(value: unknown): number | null {
  const n = Number(value)
  return Number.isFinite(n) ? n : null
}

function round2(n: number): number {
  return Math.round(n * 100) / 100
}

/** A partial is "graded" when it has a real numeric grade — `0` counts, `null`/`undefined`/NaN don't. */
function isGraded(p: GradedInput): boolean {
  return p.grade !== null && p.grade !== undefined && toFiniteNumber(p.grade) !== null
}

export interface WeightedAverageResult {
  /**
   * Weighted average of graded partials, normalized over the percent that
   * has actually been graded (not assumed to sum to 100). `0` when nothing
   * is graded yet.
   */
  average: number
  /** Sum of `percent` among graded partials, rounded to 2 decimals. */
  gradedPercent: number
  /** Compatibility alias for legacy Phase 2 views. */
  completedPercent: number
}

/**
 * Current weighted average, normalized by the percent actually graded.
 *
 * Plan finding C8: previously this normalized by graded %, while the
 * "required grade" calculation assumed percentages summed to 100 — the two
 * disagreed whenever a course's partials didn't add up to 100%. Both
 * functions in this module now share the same underlying model: raw
 * points are `grade * (percent / 100)`, and both "average so far" and
 * "grade needed" divide by the REAL percent involved (graded or pending),
 * never by an assumed 100.
 */
export function computeWeightedAverage(
  partials: GradedInput[],
  _maxGrade?: number
): WeightedAverageResult {
  const graded = partials.filter(isGraded)
  const gradedPercent = graded.reduce((sum, p) => sum + Number(p.percent), 0)
  if (gradedPercent <= 0) {
    const res = { average: 0, gradedPercent: 0 } as WeightedAverageResult
    Object.defineProperty(res, 'completedPercent', { value: 0, enumerable: false, configurable: true })
    return res
  }

  const weightedSum = graded.reduce((sum, p) => sum + Number(p.grade) * Number(p.percent), 0)
  const avg = round2(weightedSum / gradedPercent)
  const roundedGraded = round2(gradedPercent)
  const res = {
    average: avg,
    gradedPercent: roundedGraded,
  } as WeightedAverageResult
  Object.defineProperty(res, 'completedPercent', { value: roundedGraded, enumerable: false, configurable: true })
  return res
}

export interface NeededGradeResult {
  /** Grade required on the pending percent to reach `passingGrade`. Floored at 0. */
  value: number
  /** `false` when `value` exceeds `maxGrade` — i.e. passing is no longer mathematically possible. */
  achievable: boolean
}

/**
 * Grade needed on the remaining (pending) percent to reach `passingGrade`,
 * computed over the REAL pending percent — not `100 - gradedPercent`'s
 * complement assuming a full 100% plan, which is what let the old
 * `computeRequiredGrade` silently disagree with `computeWeightedAverage`.
 *
 * Returns `null` when there is nothing pending (nothing left to grade —
 * plan finding: "ya aprobado" / fully graded course; check `computeWeightedAverage`
 * for the final outcome in that case instead).
 */
export function computeNeededGrade(
  partials: GradedInput[],
  passingGrade: number,
  maxGrade: number
): NeededGradeResult | null {
  const graded = partials.filter(isGraded)
  const pending = partials.filter((p) => !isGraded(p))

  const pendingPercent = pending.reduce((sum, p) => sum + Number(p.percent), 0)
  if (pendingPercent <= 0) return null

  // Points already secured, expressed on the same 0..maxGrade scale as
  // `passingGrade` (each partial's grade contributes grade * percent/100 —
  // percentages are treated as real weights, not forced to sum to 100).
  const securedPoints = graded.reduce((sum, p) => sum + Number(p.grade) * Number(p.percent), 0) / 100

  const neededPoints = passingGrade - securedPoints
  const pendingFraction = pendingPercent / 100
  const rawRequired = neededPoints / pendingFraction

  const value = round2(Math.max(0, rawRequired))
  return {
    value,
    achievable: value <= maxGrade,
  }
}

export interface PartialPercentValidation {
  total: number
  isValid: boolean
  remaining: number
}

/**
 * Validates whether partial percentages add up to (at most) 100%.
 */
export function validatePartialPercentages(
  partials: Pick<PartialGrade, 'percent'>[]
): PartialPercentValidation {
  const total = partials.reduce((sum, p) => sum + Number(p.percent || 0), 0)
  return {
    total: round2(total),
    isValid: Math.abs(total - 100) < 0.01,
    remaining: Math.max(0, round2(100 - total)),
  }
}

/** Compatibility alias for legacy Phase 2 calculator view. */
export function computeRequiredGrade(
  partials: GradedInput[],
  passingGrade: number,
  maxGrade: number
): number | null {
  const result = computeNeededGrade(partials, passingGrade, maxGrade)
  return result ? result.value : null
}
