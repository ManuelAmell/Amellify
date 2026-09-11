import { createGoogleGenerativeAI } from '@ai-sdk/google'
import { createGroq } from '@ai-sdk/groq'
import { createOpenAICompatible } from '@ai-sdk/openai-compatible'
import type { LanguageModel } from 'ai'

/**
 * Free-tier AI provider cascade (plan 1.3 / user requirement: "APIs
 * gratuitas con rotación automática ... estilo OmniRoute/LiteLLM").
 *
 * Each provider is included ONLY when its required env var(s) are set, so
 * an operator can run with just one free key (or none — the cascade then
 * has zero entries and the route returns 503) and add more later without
 * code changes. `cascade.ts` walks this list in order and fails over on
 * 429/402/408/5xx/timeout/schema-validation-failure.
 *
 * Model IDs are intentionally NOT surfaced in any UI — they're read from
 * env with defaults here, because free-tier model names/availability
 * change often upstream. Defaults below were checked via web search in
 * September 2026 (see per-provider comments); operators should still
 * verify before relying on them long-term, and override via env if a
 * default stops working.
 */

export interface AiProviderEntry {
  /**
   * Stable id used for cooldown tracking and server logs ONLY. For
   * OpenRouter this includes the model slug (`openrouter:vendor/model:free`)
   * because each free model needs its own cooldown — never surface `id`
   * itself in the UI, use `label` instead.
   */
  id: string
  /** Generic, model-slug-free name for the "Analizado con {label}" UI badge. */
  label: string
  model: LanguageModel
  /** Model id string, kept alongside `model` so callers don't need to introspect the SDK object. */
  modelId: string
}

function envModelList(name: string, fallback: string[]): string[] {
  const raw = process.env[name]
  if (!raw) return fallback
  const parsed = raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
  return parsed.length > 0 ? parsed : fallback
}

/**
 * Builds the ordered list of active providers from current env vars.
 * Called per-request (cheap — just reads env and constructs SDK clients)
 * so tests can freely mutate `process.env` between cases.
 */
export function getActiveProviders(): AiProviderEntry[] {
  const providers: AiProviderEntry[] = []

  // 1. User-hosted OpenAI-compatible gateway (OmniRoute / LiteLLM / their
  //    own router). Goes first when configured — the user explicitly wants
  //    requests routed through their own multi-provider setup.
  const gatewayUrl = process.env.AI_GATEWAY_URL
  const gatewayKey = process.env.AI_GATEWAY_KEY
  if (gatewayUrl && gatewayKey) {
    const gateway = createOpenAICompatible({
      name: 'ai-gateway',
      baseURL: gatewayUrl,
      apiKey: gatewayKey,
    })
    const modelId = process.env.AI_GATEWAY_MODEL || 'gpt-4o-mini'
    providers.push({ id: 'ai-gateway', label: 'tu gateway', model: gateway.chatModel(modelId), modelId })
  }

  // 2. Google AI Studio free tier. Default `gemini-2.5-flash`: confirmed
  //    still a valid, actively-served free-tier vision model as of
  //    Sep 2026 (Flash/Flash-Lite remain free; Pro models do not).
  const googleKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY
  if (googleKey) {
    const google = createGoogleGenerativeAI({ apiKey: googleKey })
    const modelId = process.env.GOOGLE_MODEL || 'gemini-2.5-flash'
    providers.push({ id: 'google', label: 'Google AI', model: google(modelId), modelId })
  }

  // 3. Groq free tier. Default `qwen/qwen3.6-27b`: Groq deprecated its
  //    previous vision defaults (llama-4-scout in Jun 2026, llama-4-maverick
  //    in Mar 2026) and points users at this model for multimodal input as
  //    of Sep 2026 — verify at console.groq.com/docs/vision, it changes often.
  const groqKey = process.env.GROQ_API_KEY
  if (groqKey) {
    const groq = createGroq({ apiKey: groqKey })
    const modelId = process.env.GROQ_MODEL || 'qwen/qwen3.6-27b'
    providers.push({ id: 'groq', label: 'Groq', model: groq(modelId), modelId })
  }

  // 4. OpenRouter free-tier (":free") models — a LIST, tried in order as
  //    separate cascade entries, since any individual free slug can
  //    disappear or get rate-limited independently of the others. Defaults
  //    below were live on OpenRouter's free-models collection as of
  //    Sep 2026; the roster "changes constantly" per OpenRouter's own docs.
  const openrouterKey = process.env.OPENROUTER_API_KEY
  if (openrouterKey) {
    const openrouter = createOpenAICompatible({
      name: 'openrouter',
      baseURL: 'https://openrouter.ai/api/v1',
      apiKey: openrouterKey,
    })
    const modelIds = envModelList('OPENROUTER_FREE_MODELS', [
      'google/gemma-3-27b-it:free',
      'meta-llama/llama-3.2-11b-vision-instruct:free',
      'qwen/qwen2.5-vl-32b-instruct:free',
    ])
    for (const modelId of modelIds) {
      providers.push({ id: `openrouter:${modelId}`, label: 'OpenRouter', model: openrouter.chatModel(modelId), modelId })
    }
  }

  // 5. Mistral. No `@ai-sdk/mistral` package is installed (see Fase 1
  //    instructions: don't add new dependencies) — Mistral's API is
  //    OpenAI-compatible enough for chat + vision, so we point
  //    `@ai-sdk/openai-compatible` at it instead. Default `pixtral-12b-2409`
  //    is Mistral's known vision model id; NOT re-verified via web search
  //    (best effort) — confirm at docs.mistral.ai before relying on it.
  const mistralKey = process.env.MISTRAL_API_KEY
  if (mistralKey) {
    const mistral = createOpenAICompatible({
      name: 'mistral',
      baseURL: 'https://api.mistral.ai/v1',
      apiKey: mistralKey,
    })
    const modelId = process.env.MISTRAL_MODEL || 'pixtral-12b-2409'
    providers.push({ id: 'mistral', label: 'Mistral', model: mistral.chatModel(modelId), modelId })
  }

  return providers
}
