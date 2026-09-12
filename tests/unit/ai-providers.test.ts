import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { getActiveProviders } from '@/lib/ai/providers'

const ENV_KEYS = [
  'AI_GATEWAY_URL',
  'AI_GATEWAY_KEY',
  'AI_GATEWAY_MODEL',
  'GOOGLE_GENERATIVE_AI_API_KEY',
  'GOOGLE_MODEL',
  'GROQ_API_KEY',
  'GROQ_MODEL',
  'OPENROUTER_API_KEY',
  'OPENROUTER_FREE_MODELS',
  'MISTRAL_API_KEY',
  'MISTRAL_MODEL',
] as const

const originalEnv: Record<string, string | undefined> = {}

beforeEach(() => {
  for (const key of ENV_KEYS) {
    originalEnv[key] = process.env[key]
    delete process.env[key]
  }
})

afterEach(() => {
  for (const key of ENV_KEYS) {
    if (originalEnv[key] === undefined) delete process.env[key]
    else process.env[key] = originalEnv[key]
  }
})

// Regression coverage for a real bug found by manually testing the AI
// extraction cascade against the live OpenRouter API: the previous default
// free-model slugs (google/gemma-3-27b-it:free,
// meta-llama/llama-3.2-11b-vision-instruct:free,
// qwen/qwen2.5-vl-32b-instruct:free) all responded 404 "unavailable for
// free" - none of them exist in OpenRouter's free tier anymore. Replaced
// with slugs confirmed live (they responded 429 "temporarily
// rate-limited", not 404) against openrouter.ai/api/v1/models in this
// session.
describe('getActiveProviders OpenRouter default free models', () => {
  it('falls back to live free vision model slugs when OPENROUTER_FREE_MODELS is not set', () => {
    process.env.OPENROUTER_API_KEY = 'test-key'

    const providers = getActiveProviders()
    const openrouterModelIds = providers
      .filter((p) => p.id.startsWith('openrouter:'))
      .map((p) => p.modelId)

    expect(openrouterModelIds).toEqual(['google/gemma-4-31b-it:free', 'google/gemma-4-26b-a4b-it:free'])
  })

  it('none of the default slugs are the dead ones previously confirmed 404 on OpenRouter', () => {
    process.env.OPENROUTER_API_KEY = 'test-key'

    const providers = getActiveProviders()
    const openrouterModelIds = providers
      .filter((p) => p.id.startsWith('openrouter:'))
      .map((p) => p.modelId)

    expect(openrouterModelIds).not.toContain('google/gemma-3-27b-it:free')
    expect(openrouterModelIds).not.toContain('meta-llama/llama-3.2-11b-vision-instruct:free')
    expect(openrouterModelIds).not.toContain('qwen/qwen2.5-vl-32b-instruct:free')
  })
})
