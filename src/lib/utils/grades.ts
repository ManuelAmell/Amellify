import type { PartialGrade } from '@/types/database'

export interface GradeCalculationResult {
  currentAverage: number
  gradedPercentage: number
  isPassing: boolean
  neededForPassing: number | null
  projectedAverage: number
}

/**
 * Calculates current weighted average based on graded partials
 */
export function computeWeightedAverage(
  partials: Pick<PartialGrade, 'grade' | 'percent'>[],
  maxGrade: number = 5
): { average: number; completedPercent: number } {
  const graded = partials.filter((p) => p.grade !== null && !isNaN(Number(p.grade)))
  if (graded.length === 0) return { average: 0, completedPercent: 0 }

  const totalPercent = graded.reduce((sum, p) => sum + Number(p.percent), 0)
  if (totalPercent === 0) return { average: 0, completedPercent: 0 }

  const weightedSum = graded.reduce((sum, p) => sum + Number(p.grade) * Number(p.percent), 0)

  return {
    average: Math.round((weightedSum / totalPercent) * 100) / 100,
    completedPercent: totalPercent,
  }
}

/**
 * Calculates the required minimum grade on remaining partials to pass
 */
export function computeRequiredGrade(
  partials: Pick<PartialGrade, 'grade' | 'percent'>[],
  passingGrade: number = 3.0,
  maxGrade: number = 5.0
): number | null {
  const graded = partials.filter((p) => p.grade !== null && !isNaN(Number(p.grade)))
  const pending = partials.filter((p) => p.grade === null || isNaN(Number(p.grade)))

  if (pending.length === 0) return null

  const currentPoints = graded.reduce(
    (sum, p) => sum + Number(p.grade) * (Number(p.percent) / 100),
    0
  )
  const pendingPercent = pending.reduce((sum, p) => sum + Number(p.percent), 0) / 100

  if (pendingPercent <= 0) return null

  const neededPoints = passingGrade - currentPoints
  const required = neededPoints / pendingPercent

  if (required <= 0) return 0
  if (required > maxGrade) return Math.round(required * 100) / 100

  return Math.round(required * 100) / 100
}

/**
 * Validates whether the partial percentages add up to 100%
 */
export function validatePartialPercentages(partials: Pick<PartialGrade, 'percent'>[]): {
  total: number
  isValid: boolean
  remaining: number
} {
  const total = partials.reduce((sum, p) => sum + Number(p.percent || 0), 0)
  return {
    total: Math.round(total * 100) / 100,
    isValid: Math.abs(total - 100) < 0.01,
    remaining: Math.max(0, Math.round((100 - total) * 100) / 100),
  }
}
