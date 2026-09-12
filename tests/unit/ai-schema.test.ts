import { describe, expect, it } from 'vitest'
import { toJSONSchema } from 'zod/v4/core'
import { extractedCourseSchema, extractedScheduleResponseSchema } from '@/lib/ai/schema'

function validCourseInput(overrides: Record<string, unknown> = {}) {
  return {
    code: 'CS101',
    name: 'Algoritmos',
    professor: 'Juan Perez',
    faculty: 'Ingeniería',
    semester: '2026-II',
    credits: 3,
    color: 'blue',
    schedules: [],
    ...overrides,
  }
}

// Regression coverage for a real bug found by manually testing the AI import
// flow against the live Google Generative Language API: `email:
// z.string().email().or(z.literal(''))` compiles to an `enum: [""]` in the
// JSON Schema sent as Gemini's `response_schema`, and Gemini rejects that
// with HTTP 400 ("response_schema...email.any_of[1].enum[0]: cannot be
// empty") - confirmed against the real endpoint with the real PDF fixture in
// `.artifacts/verification/horario-real-udc.pdf`.
describe('extractedCourseSchema email field', () => {
  it('normalizes a null email (what Gemini actually returns for an absent email) into an empty string', () => {
    const result = extractedCourseSchema.safeParse(validCourseInput({ email: null }))

    expect(result.success).toBe(true)
    if (!result.success) throw new Error('expected successful parse')
    expect(result.data.email).toBe('')
  })

  it('normalizes a missing (omitted) email into an empty string', () => {
    const input = validCourseInput()
    delete (input as Record<string, unknown>).email
    const result = extractedCourseSchema.safeParse(input)

    expect(result.success).toBe(true)
    if (!result.success) throw new Error('expected successful parse')
    expect(result.data.email).toBe('')
  })

  it('keeps a valid email as-is', () => {
    const result = extractedCourseSchema.safeParse(validCourseInput({ email: 'profesor@universidad.edu' }))

    expect(result.success).toBe(true)
    if (!result.success) throw new Error('expected successful parse')
    expect(result.data.email).toBe('profesor@universidad.edu')
  })

  it('rejects a malformed, non-empty email', () => {
    const result = extractedCourseSchema.safeParse(validCourseInput({ email: 'not-an-email' }))

    expect(result.success).toBe(false)
  })
})

describe('extractedScheduleResponseSchema JSON Schema (provider response_schema compatibility)', () => {
  it('never generates an enum containing an empty string anywhere in the schema tree', () => {
    // Same conversion path @ai-sdk/provider-utils uses internally
    // (`zodSchema()` -> `toJSONSchema(schema, { target: 'draft-7', io: 'input' })`)
    // before handing the result to Google as `response_schema`.
    const jsonSchema = toJSONSchema(extractedScheduleResponseSchema, {
      target: 'draft-7',
      io: 'input',
    }) as Record<string, unknown>

    const emptyStringEnums: unknown[] = []

    function walk(node: unknown): void {
      if (node === null || typeof node !== 'object') return
      if (Array.isArray(node)) {
        for (const item of node) walk(item)
        return
      }
      const obj = node as Record<string, unknown>
      if (Array.isArray(obj.enum) && obj.enum.includes('')) {
        emptyStringEnums.push(obj)
      }
      for (const value of Object.values(obj)) walk(value)
    }

    walk(jsonSchema)

    expect(emptyStringEnums).toEqual([])
  })
})
