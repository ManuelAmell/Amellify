import { z } from 'zod'

/**
 * Shared contract between the AI extraction cascade (Fase 1 · Agent C) and
 * the import UI (Fase 2 · Agent E). Keep field names aligned with
 * `src/types/domain.ts` (CourseInput/ScheduleInput) so the import dialog
 * can feed extracted rows straight into `createCourse` after user review.
 */

export const extractedScheduleSchema = z
  .object({
    day: z.enum(['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo']),
    startTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Formato HH:MM requerido'),
    endTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Formato HH:MM requerido'),
    room: z.string().max(64).default(''),
  })
  .refine((s) => s.endTime > s.startTime, {
    message: 'La hora de fin debe ser posterior a la hora de inicio',
    path: ['endTime'],
  })

export const extractedCourseSchema = z.object({
  code: z.string().min(1).max(16),
  name: z.string().min(1).max(200),
  professor: z.string().max(200).default(''),
  email: z.string().email().nullable().optional().transform((v) => v ?? ''),
  faculty: z.string().max(200).default(''),
  semester: z.string().max(20).default(''),
  credits: z.number().int().min(0).max(12).default(3),
  color: z.enum(['blue', 'red', 'green', 'orange', 'purple', 'teal']).default('blue'),
  schedules: z.array(extractedScheduleSchema).default([]),
})

export const extractedScheduleResponseSchema = z.object({
  courses: z.array(extractedCourseSchema),
})

export type ExtractedCourse = z.infer<typeof extractedCourseSchema>
export type ExtractedScheduleResponse = z.infer<typeof extractedScheduleResponseSchema>

/** What the `/api/ai/extract-schedule` route returns to the client. */
export interface AiExtractionResult {
  courses: ExtractedCourse[]
  provider: string
  model: string
}
