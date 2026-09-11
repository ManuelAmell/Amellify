import { z } from 'zod'

/**
 * Zod schemas for profile/preferences/account server actions (plan
 * Fase 1 · A). All `strictObject` — rejects unknown keys so a client can
 * never rewrite `id`/`createdAt`/etc. (plan finding H17).
 */

export const updateProfileSchema = z.strictObject({
  university: z.string().trim().max(200).optional(),
  faculty: z.string().trim().max(200).optional(),
  currentSemester: z.string().trim().max(50).optional(),
  passingGrade: z.number().min(0).max(1000).optional(),
  maxGrade: z.number().min(0).max(1000).optional(),
  displayName: z.string().trim().min(1).max(120).optional(),
})

/**
 * Validated against the MERGED (existing + incoming) profile in the
 * action, not the raw partial input — a request that only changes
 * `university` must not be rejected just because it omits `maxGrade`.
 */
export const gradeScaleRelationSchema = z
  .strictObject({
    passingGrade: z.number().min(0),
    maxGrade: z.number().min(0).max(1000),
  })
  .refine((v) => v.maxGrade > v.passingGrade, {
    message: 'La nota máxima debe ser mayor que la nota de aprobación.',
    path: ['maxGrade'],
  })

export const preferencesInputSchema = z.strictObject({
  theme: z.enum(['light', 'dark', 'system']).optional(),
  fontSize: z.enum(['small', 'normal', 'large']).optional(),
  gridCompact: z.boolean().optional(),
  weekStartsOn: z.enum(['monday', 'sunday']).optional(),
  timeFormat24h: z.boolean().optional(),
  defaultView: z.enum(['grid', 'week', 'list', 'calc', 'stats']).optional(),
  timezone: z.string().trim().min(1).max(100).optional(),
  semesterEndDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Fecha inválida (usa AAAA-MM-DD).')
    .nullable()
    .optional(),
})

export const changePasswordSchema = z.strictObject({
  currentPassword: z.string().min(1, 'Ingresa tu contraseña actual.'),
  newPassword: z.string().min(8, 'Mínimo 8 caracteres.').max(128),
})

export const deleteAccountSchema = z.strictObject({
  confirmation: z.literal('ELIMINAR', {
    error: 'Escribe ELIMINAR para confirmar.',
  }),
})
