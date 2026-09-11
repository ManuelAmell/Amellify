import { z } from 'zod'

/**
 * `savePartials` validation (plan finding C7/C8): the raw shape check
 * lives here; `SUM(percent) <= 100` and `grade <= maxGrade` depend on the
 * caller's profile, so `createSavePartialsSchema(maxGrade)` builds a
 * schema closed over that value — call it fresh per request, never cache
 * the returned schema across users.
 */

export const partialInputSchema = z.strictObject({
  name: z.string().trim().min(1, 'El nombre es obligatorio.').max(200),
  grade: z.number().min(0).max(1000).nullable().optional(),
  percent: z.number().min(0).max(100),
})

/** Same as `partialInputSchema` but allows an `id` for existing rows (used by the diff/upsert in `savePartials`). */
export const partialUpsertSchema = z.intersection(
  partialInputSchema,
  z.strictObject({ id: z.uuid().optional() })
)

export function createSavePartialsSchema(maxGrade: number) {
  return z
    .strictObject({
      courseId: z.uuid(),
      partials: z.array(partialUpsertSchema).max(50),
    })
    .refine((v) => v.partials.reduce((sum, p) => sum + p.percent, 0) <= 100.001, {
      message: 'La suma de los porcentajes no puede superar 100%.',
      path: ['partials'],
    })
    .refine((v) => v.partials.every((p) => p.grade === null || p.grade === undefined || p.grade <= maxGrade), {
      message: `Ninguna nota puede superar el máximo de la escala (${maxGrade}).`,
      path: ['partials'],
    })
}
