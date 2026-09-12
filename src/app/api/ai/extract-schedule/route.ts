import { NextResponse, type NextRequest } from 'next/server'
import pino from 'pino'
import { z } from 'zod'
import { getApiUser } from '@/lib/auth/session'
import { extractSchedule } from '@/lib/ai/cascade'
import { checkRateLimit } from '@/lib/rate-limit'

/**
 * POST /api/ai/extract-schedule — rebuilt from scratch (plan C4/H16: the
 * old `/api/generate-schedule` sent the Gemini API key in the query
 * string, had no rate limit, no body size limit, let the client pick any
 * model, and accepted any MIME type including `application/pdf`/`image/svg+xml`).
 *
 * Fixes applied here:
 * - Requires an authenticated session (`requireUser()`).
 * - 5 requests/minute/user via the in-memory token bucket.
 * - Body capped at 6 MB (checked both via `Content-Length` and the actual
 *   decoded payload, since the header can be absent).
 * - Zod-validated `{ images?: string[], text?: string }` shape; each image
 *   must be a `data:` URL whose declared MIME type is in an allowlist
 *   (PNG/JPEG/WebP only).
 * - No `model` field accepted from the client — the provider/model is
 *   entirely decided by the server-side cascade (`src/lib/ai/cascade.ts`).
 * - Structured logging of which provider/model served the request, never
 *   API keys or raw provider error bodies.
 */

import {
  isAllowedFileDataUrl,
  isPdfDataUrl,
  maxBodyBytesFor,
  MAX_PDF_BODY_BYTES,
} from '@/lib/ai/validation'

const logger = pino({ name: 'ai-extract-schedule' })

const MAX_IMAGES = 5
const MAX_TEXT_LENGTH = 20_000

const requestSchema = z
  .object({
    images: z.array(z.string()).max(MAX_IMAGES).optional(),
    text: z.string().max(MAX_TEXT_LENGTH).optional(),
  })
  .refine(
    (body) => (body.images && body.images.length > 0) || Boolean(body.text?.trim()),
    { message: 'Envía al menos una imagen o texto para analizar.' }
  )

export async function POST(request: NextRequest) {
  const user = await getApiUser()
  if (!user) {
    return NextResponse.json({ error: 'Sesión expirada. Inicia sesión de nuevo.' }, { status: 401 })
  }

  const rateLimit = checkRateLimit(`ai-extract-schedule:${user.id}`, { limit: 5, windowMs: 60_000 })
  if (!rateLimit.allowed) {
    const headers: Record<string, string> = {}
    if (rateLimit.retryAfterMs) {
      headers['Retry-After'] = Math.ceil(rateLimit.retryAfterMs / 1000).toString()
    }
    return NextResponse.json(
      { error: 'Demasiadas solicitudes. Espera un momento e intenta de nuevo.' },
      { status: 429, headers }
    )
  }

  const contentLength = request.headers.get('content-length')
  if (contentLength && Number(contentLength) > MAX_PDF_BODY_BYTES) {
    return NextResponse.json({ error: 'La solicitud supera el límite de 15 MB.' }, { status: 413 })
  }

  let rawText: string
  try {
    rawText = await request.text()
  } catch {
    return NextResponse.json({ error: 'No se pudo leer el cuerpo de la solicitud.' }, { status: 400 })
  }

  const rawBytes = new TextEncoder().encode(rawText).length
  if (rawBytes > MAX_PDF_BODY_BYTES) {
    return NextResponse.json({ error: 'La solicitud supera el límite de 15 MB.' }, { status: 413 })
  }

  let rawBody: unknown
  try {
    rawBody = JSON.parse(rawText)
  } catch {
    return NextResponse.json({ error: 'JSON inválido.' }, { status: 400 })
  }

  const parsed = requestSchema.safeParse(rawBody)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Datos inválidos.', fieldErrors: z.flattenError(parsed.error).fieldErrors },
      { status: 400 }
    )
  }

  const { images = [], text } = parsed.data

  for (const image of images) {
    if (!isAllowedFileDataUrl(image)) {
      return NextResponse.json(
        { error: 'Formato de archivo no permitido. Usa PNG, JPEG, WebP o PDF.' },
        { status: 415 }
      )
    }
  }

  const maxAllowedBytes = maxBodyBytesFor(images)
  if (rawBytes > maxAllowedBytes) {
    return NextResponse.json({ error: 'La solicitud supera el límite de 6 MB.' }, { status: 413 })
  }

  const hasPdf = images.some((img) => isPdfDataUrl(img))
  const result = await extractSchedule({ images, text })

  if (!result.ok) {
    logger.warn({ userId: user.id, attempts: result.attempts }, 'ai_extract_schedule_exhausted')
    const errorMessage =
      hasPdf && result.attempts.length === 0
        ? 'No hay un proveedor de IA con soporte de PDF configurado en el servidor.'
        : 'No fue posible analizar el horario en este momento (ningún proveedor de IA disponible respondió). Intenta de nuevo más tarde.'
    return NextResponse.json(
      {
        error: errorMessage,
        attempts: result.attempts,
      },
      { status: 503 }
    )
  }

  logger.info(
    {
      userId: user.id,
      provider: result.provider,
      model: result.model,
      courseCount: result.courses.length,
    },
    'ai_extract_schedule_succeeded'
  )

  return NextResponse.json({
    courses: result.courses,
    provider: result.provider,
    model: result.model,
  })
}
