import { describe, expect, it } from 'vitest'
import {
  computeNeededGrade,
  computeWeightedAverage,
  validatePartialPercentages,
} from '@/lib/utils/grades'

describe('computeWeightedAverage', () => {
  it('computes a normal weighted average when percentages sum to 100', () => {
    const result = computeWeightedAverage([
      { grade: 4.0, percent: 30 },
      { grade: 3.0, percent: 30 },
      { grade: null, percent: 40 },
    ])
    // (4*30 + 3*30) / 60 = 3.5
    expect(result.average).toBe(3.5)
    expect(result.gradedPercent).toBe(60)
  })

  it('normalizes correctly even when percentages do not sum to 100', () => {
    const result = computeWeightedAverage([
      { grade: 5.0, percent: 20 },
      { grade: 3.0, percent: 10 },
    ])
    // (5*20 + 3*10) / 30 = 4.333...
    expect(result.average).toBe(4.33)
    expect(result.gradedPercent).toBe(30)
  })

  it('returns 0/0 when nothing is graded yet', () => {
    const result = computeWeightedAverage([{ grade: null, percent: 100 }])
    expect(result).toEqual({ average: 0, gradedPercent: 0 })
  })

  it('treats a grade of 0 as graded (not pending)', () => {
    const result = computeWeightedAverage([
      { grade: 0, percent: 50 },
      { grade: null, percent: 50 },
    ])
    expect(result.average).toBe(0)
    expect(result.gradedPercent).toBe(50)
  })
})

describe('computeNeededGrade', () => {
  it('matches computeWeightedAverage\'s model when percentages sum to 100', () => {
    // 30% done at 4.0, 30% done at 3.0 -> secured = 1.2 + 0.9 = 2.1 on a 0-5 scale.
    // Pending 40%, need 3.0 overall -> (3.0 - 2.1) / 0.4 = 2.25.
    const partials = [
      { grade: 4.0, percent: 30 },
      { grade: 3.0, percent: 30 },
      { grade: null, percent: 40 },
    ]
    const result = computeNeededGrade(partials, 3.0, 5.0)
    expect(result).toEqual({ value: 2.25, achievable: true })
  })

  it('computes over the REAL pending percent when percentages do not sum to 100', () => {
    // Only 30% graded (at 5.0 => secured 1.5), 20% pending, remaining 50% never entered.
    // pendingPercent here is just the 20% with grade=null, not "100 - 30".
    const partials = [
      { grade: 5.0, percent: 30 },
      { grade: null, percent: 20 },
    ]
    const result = computeNeededGrade(partials, 3.0, 5.0)
    // secured = 5*30/100 = 1.5; needed = 3.0 - 1.5 = 1.5; pendingFraction = 0.2 => 7.5
    expect(result?.value).toBe(7.5)
    expect(result?.achievable).toBe(false) // 7.5 > maxGrade(5.0): impossible
  })

  it('flags an impossible-to-pass scenario as not achievable', () => {
    const partials = [
      { grade: 1.0, percent: 50 },
      { grade: null, percent: 50 },
    ]
    const result = computeNeededGrade(partials, 4.5, 5.0)
    expect(result?.achievable).toBe(false)
    expect(result!.value).toBeGreaterThan(5.0)
  })

  it('returns null when nothing is pending (already fully graded)', () => {
    const partials = [
      { grade: 4.0, percent: 60 },
      { grade: 3.0, percent: 40 },
    ]
    expect(computeNeededGrade(partials, 3.0, 5.0)).toBeNull()
  })

  it('clamps the needed grade at 0 when passing is already secured', () => {
    const partials = [
      { grade: 5.0, percent: 80 },
      { grade: null, percent: 20 },
    ]
    const result = computeNeededGrade(partials, 3.0, 5.0)
    expect(result).toEqual({ value: 0, achievable: true })
  })
})

describe('validatePartialPercentages', () => {
  it('flags totals that sum to exactly 100 as valid', () => {
    const result = validatePartialPercentages([{ percent: 60 }, { percent: 40 }])
    expect(result).toEqual({ total: 100, isValid: true, remaining: 0 })
  })

  it('reports the remaining percent when under 100', () => {
    const result = validatePartialPercentages([{ percent: 30 }, { percent: 20 }])
    expect(result).toEqual({ total: 50, isValid: false, remaining: 50 })
  })

  it('reports zero remaining (not negative) when over 100', () => {
    const result = validatePartialPercentages([{ percent: 70 }, { percent: 50 }])
    expect(result.total).toBe(120)
    expect(result.isValid).toBe(false)
    expect(result.remaining).toBe(0)
  })
})
