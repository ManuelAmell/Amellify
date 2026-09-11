import { beforeEach, describe, expect, it, vi } from 'vitest'
import { APICallError, NoObjectGeneratedError } from 'ai'
import { extractSchedule, resetCooldowns } from '@/lib/ai/cascade'
import type { AiProviderEntry } from '@/lib/ai/providers'

const generateObjectMock = vi.fn()

// Only `generateObject` is faked — `APICallError`/`NoObjectGeneratedError` stay real so
// `cascade.ts`'s `classifyError` (which uses `APICallError.isInstance(...)`) is exercised
// for real. This satisfies the "no real network calls in tests" constraint by injecting a
// fake provider call instead of hitting Google/Groq/OpenRouter/Mistral.
vi.mock('ai', async (importOriginal) => {
  const actual = await importOriginal<typeof import('ai')>()
  return {
    ...actual,
    generateObject: (...args: unknown[]) => generateObjectMock(...args),
  }
})

function fakeProvider(id: string): AiProviderEntry {
  return { id, label: id, model: { modelId: id } as unknown as AiProviderEntry['model'], modelId: id }
}

function okResult(courses: unknown[] = []) {
  return { object: { courses } }
}

beforeEach(() => {
  generateObjectMock.mockReset()
  resetCooldowns()
})

describe('extractSchedule', () => {
  it('returns courses from the first provider on success, with user content as a separate message', async () => {
    generateObjectMock.mockResolvedValueOnce(
      okResult([
        {
          code: 'CS101',
          name: 'Algoritmos',
          professor: '',
          email: '',
          faculty: '',
          semester: '',
          credits: 3,
          color: 'blue',
          schedules: [],
        },
      ])
    )

    const result = await extractSchedule({ text: 'hola mundo' }, { providers: [fakeProvider('a')] })

    expect(result.ok).toBe(true)
    if (!result.ok) throw new Error('expected ok result')
    expect(result.provider).toBe('a')
    expect(result.model).toBe('a')
    expect(result.courses).toHaveLength(1)
    expect(result.attempts).toEqual([])

    expect(generateObjectMock).toHaveBeenCalledTimes(1)
    const callArgs = generateObjectMock.mock.calls[0]?.[0] as {
      instructions: string
      messages: Array<{ role: string; content: unknown }>
    }
    expect(callArgs.messages).toHaveLength(1)
    expect(callArgs.messages[0]?.role).toBe('user')
    // Prompt-injection mitigation: user content must never be folded into instructions.
    expect(callArgs.instructions).not.toContain('hola mundo')
  })

  it('fails over to the next provider on a 429 and records the attempt', async () => {
    const rateLimitError = new APICallError({
      message: 'rate limited',
      url: 'https://example.test',
      requestBodyValues: {},
      statusCode: 429,
      responseHeaders: { 'retry-after': '30' },
    })
    generateObjectMock.mockRejectedValueOnce(rateLimitError)
    generateObjectMock.mockResolvedValueOnce(okResult())

    const result = await extractSchedule(
      { text: 'x' },
      { providers: [fakeProvider('a'), fakeProvider('b')] }
    )

    expect(result.ok).toBe(true)
    if (!result.ok) throw new Error('expected ok result')
    expect(result.provider).toBe('b')
    expect(result.attempts).toEqual([{ provider: 'a', error: 'api_error_429' }])
  })

  it('treats a schema-validation failure (NoObjectGeneratedError) as a retryable skip', async () => {
    generateObjectMock.mockRejectedValueOnce(
      new NoObjectGeneratedError({
        message: 'bad json',
      } as ConstructorParameters<typeof NoObjectGeneratedError>[0])
    )
    generateObjectMock.mockResolvedValueOnce(okResult())

    const result = await extractSchedule(
      { text: 'x' },
      { providers: [fakeProvider('a'), fakeProvider('b')] }
    )

    expect(result.ok).toBe(true)
    if (!result.ok) throw new Error('expected ok result')
    expect(result.attempts).toEqual([{ provider: 'a', error: 'invalid_schema_output' }])
  })

  it('does not retry a provider still on cooldown from a previous call', async () => {
    const serverError = new APICallError({
      message: 'server error',
      url: 'https://example.test',
      requestBodyValues: {},
      statusCode: 500,
    })
    generateObjectMock.mockRejectedValueOnce(serverError)
    generateObjectMock.mockResolvedValueOnce(okResult())

    const providers = [fakeProvider('a'), fakeProvider('b')]
    await extractSchedule({ text: 'first' }, { providers })

    generateObjectMock.mockResolvedValueOnce(okResult())
    const second = await extractSchedule({ text: 'second' }, { providers })

    expect(second.ok).toBe(true)
    if (!second.ok) throw new Error('expected ok result')
    expect(second.attempts).toEqual([{ provider: 'a', error: 'cooldown_active' }])
    // Only one real call happened for round two (provider b) — 'a' was skipped, not retried.
    expect(generateObjectMock).toHaveBeenCalledTimes(3)
  })

  it('returns ok:false with the attempt list when every provider fails', async () => {
    generateObjectMock.mockRejectedValue(new Error('boom'))

    const result = await extractSchedule({ text: 'x' }, { providers: [fakeProvider('a')] })

    expect(result.ok).toBe(false)
    if (result.ok) throw new Error('expected failure result')
    expect(result.attempts).toEqual([{ provider: 'a', error: 'unknown_error' }])
  })

  it('never leaks raw error details (e.g. embedded secrets) to the caller', async () => {
    generateObjectMock.mockRejectedValue(new Error('leaked key sk-super-secret-abc123'))

    const result = await extractSchedule({ text: 'x' }, { providers: [fakeProvider('a')] })

    expect(JSON.stringify(result)).not.toContain('sk-super-secret')
  })
})
