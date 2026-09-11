import { z } from 'zod'
import type { ActionResult } from '@/types/domain'
import { OwnershipError } from '@/db/queries/courses'

/** Turns a Zod validation failure into the shared `ActionResult` shape. */
export function zodFailure<T>(error: z.ZodError): ActionResult<T> {
  const { formErrors, fieldErrors } = z.flattenError(error)
  return {
    ok: false,
    error: formErrors[0] ?? 'Los datos enviados no son válidos.',
    fieldErrors: fieldErrors as Record<string, string[]>,
  }
}

export function failure<T>(message: string, fieldErrors?: Record<string, string[]>): ActionResult<T> {
  return { ok: false, error: message, fieldErrors }
}

export function success<T>(data: T): ActionResult<T> {
  return { ok: true, data }
}

/**
 * Never let a raw Postgres error reach the client (plan finding C7/H17:
 * "nunca deja que un error crudo de Postgres llegue al cliente"). Maps
 * the handful of error shapes actions can realistically hit to a Spanish
 * message and logs the original server-side for debugging.
 */
export function toActionError<T>(error: unknown): ActionResult<T> {
  if (error instanceof OwnershipError) {
    return failure(error.message)
  }
  if (error instanceof z.ZodError) {
    return zodFailure(error)
  }

  console.error('[action error]', error)

  const code = (error as { code?: string } | undefined)?.code
  if (code === '23505') return failure('Ya existe un registro con esos datos.')
  if (code === '23503') return failure('El recurso referenciado no existe o ya fue eliminado.')
  if (code === '23514') return failure('Los datos no cumplen las reglas de validación.')

  return failure('Ocurrió un error inesperado. Intenta de nuevo.')
}
