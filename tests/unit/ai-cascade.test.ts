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

function fakeProvider(id: string, supportsPdf = false): AiProviderEntry {
  return {
    id,
    label: id,
    model: { modelId: id } as unknown as AiProviderEntry['model'],
    modelId: id,
    supportsPdf,
  }
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

  // Regression coverage for a real bug found by manually testing the AI
  // import flow against the live Google Generative Language API: sending
  // an image as the AI SDK's deprecated `{ type: 'image', image }` content
  // part produced an HTTP 400 "Unable to process input image" as soon as
  // structured output (this module's generateObject + responseSchema) was
  // involved - confirmed by sending the exact same image bytes directly to
  // Google's REST endpoint, which succeeded. The fix is the SDK's current
  // `{ type: 'file', data, mediaType }` shape.
  describe('image content parts sent to the model', () => {
    function messageContentOf(callIndex = 0) {
      const callArgs = generateObjectMock.mock.calls[callIndex]?.[0] as {
        messages: Array<{ role: string; content: unknown }>
      }
      return callArgs.messages[0]?.content as Array<Record<string, unknown>>
    }

    it('sends a single image as a file part with mediaType and bare base64 data, not a deprecated image part', async () => {
      generateObjectMock.mockResolvedValueOnce(okResult())

      const pngBase64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII='
      await extractSchedule(
        { images: [`data:image/png;base64,${pngBase64}`] },
        { providers: [fakeProvider('a')] }
      )

      const content = messageContentOf()
      expect(content).toEqual([{ type: 'file', mediaType: 'image/png', data: pngBase64 }])
    })

    it('sends each image in a multi-image upload as its own file part with its own mediaType', async () => {
      generateObjectMock.mockResolvedValueOnce(okResult())

      await extractSchedule(
        {
          images: ['data:image/png;base64,AAAA', 'data:image/jpeg;base64,BBBB'],
        },
        { providers: [fakeProvider('a')] }
      )

      const content = messageContentOf()
      expect(content).toEqual([
        { type: 'file', mediaType: 'image/png', data: 'AAAA' },
        { type: 'file', mediaType: 'image/jpeg', data: 'BBBB' },
      ])
    })

    it('keeps a text part alongside the file part when both text and an image are provided', async () => {
      generateObjectMock.mockResolvedValueOnce(okResult())

      await extractSchedule(
        { text: 'Horario del segundo semestre', images: ['data:image/webp;base64,CCCC'] },
        { providers: [fakeProvider('a')] }
      )

      const content = messageContentOf()
      expect(content).toEqual([
        { type: 'text', text: 'Horario del segundo semestre' },
        { type: 'file', mediaType: 'image/webp', data: 'CCCC' },
      ])
    })

    it('ignores a malformed data URL instead of sending a corrupt content part', async () => {
      generateObjectMock.mockResolvedValueOnce(okResult())

      await extractSchedule(
        { images: ['not-a-data-url', 'data:image/png;base64,VALID'] },
        { providers: [fakeProvider('a')] }
      )

      const content = messageContentOf()
      expect(content).toEqual([{ type: 'file', mediaType: 'image/png', data: 'VALID' }])
    })
  })

  // PDF support: only Google (the sole provider with `supportsPdf: true`)
  // ever sees a PDF - no cascade fallback to vision-only providers.
  describe('PDF uploads restrict the cascade to PDF-capable providers', () => {
    it('only tries the provider marked supportsPdf when the upload is a PDF, skipping the rest entirely', async () => {
      generateObjectMock.mockResolvedValueOnce(okResult())

      const noPdf = fakeProvider('groq', false)
      const withPdf = fakeProvider('google', true)
      const result = await extractSchedule(
        { images: ['data:application/pdf;base64,AAAA'] },
        { providers: [noPdf, withPdf] }
      )

      expect(result.ok).toBe(true)
      if (!result.ok) throw new Error('expected ok result')
      expect(result.provider).toBe('google')
      // 'groq' never appears in attempts because it was filtered out before
      // the loop, not tried-and-skipped.
      expect(result.attempts).toEqual([])
      expect(generateObjectMock).toHaveBeenCalledTimes(1)
    })

    it('returns ok:false with no attempts when no active provider supports PDF', async () => {
      const result = await extractSchedule(
        { images: ['data:application/pdf;base64,AAAA'] },
        { providers: [fakeProvider('groq', false), fakeProvider('openrouter', false)] }
      )

      expect(result.ok).toBe(false)
      if (result.ok) throw new Error('expected failure result')
      expect(result.attempts).toEqual([])
      expect(generateObjectMock).not.toHaveBeenCalled()
    })

    it('treats a mixed image+PDF upload as a PDF request (restricted to PDF-capable providers)', async () => {
      generateObjectMock.mockResolvedValueOnce(okResult())

      const result = await extractSchedule(
        { images: ['data:image/png;base64,AAAA', 'data:application/pdf;base64,BBBB'] },
        { providers: [fakeProvider('groq', false), fakeProvider('google', true)] }
      )

      expect(result.ok).toBe(true)
      if (!result.ok) throw new Error('expected ok result')
      expect(result.provider).toBe('google')
    })
  })

  // Regression coverage for a real bug found by manually testing the AI
  // extraction cascade against the live Groq API: our schema has fields
  // with `.default(...)` (e.g. `room`), which are omitted from the
  // generated JSON Schema's `required` array. Groq's `strict` response-
  // format mode (the OpenAI-compatible default) rejects that with a 400
  // ("required is required to be supplied and to be an array including
  // every key in properties"). Disabling strict mode via `providerOptions`
  // fixed it end-to-end against the real API.
  describe('strict JSON schema validation is disabled for OpenAI-compatible providers', () => {
    it('calls generateObject with strictJsonSchema:false for groq, openrouter, mistral and ai-gateway', async () => {
      generateObjectMock.mockResolvedValueOnce(okResult())

      await extractSchedule({ text: 'x' }, { providers: [fakeProvider('a')] })

      const callArgs = generateObjectMock.mock.calls[0]?.[0] as {
        providerOptions?: Record<string, { strictJsonSchema?: boolean }>
      }
      expect(callArgs.providerOptions).toMatchObject({
        groq: { strictJsonSchema: false },
        openrouter: { strictJsonSchema: false },
        mistral: { strictJsonSchema: false },
        'ai-gateway': { strictJsonSchema: false },
      })
    })
  })
})
