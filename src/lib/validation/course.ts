import { z } from 'zod'
import { courseStatusEnum, dayOfWeekEnum, subjectColorEnum } from '@/db/schema'

/**
 * Zod schemas for course/schedule server actions (plan Fase 1 · A).
 * Every schema is a `strictObject` — explicit column whitelist, rejects
 * unknown keys — so a client can never mass-assign `id`, `userId`,
 * `createdAt`, etc. (plan finding H17).
 */

export const dayOfWeekSchema = z.enum(dayOfWeekEnum.enumValues)
export const courseStatusSchema = z.enum(courseStatusEnum.enumValues)
export const subjectColorSchema = z.enum(subjectColorEnum.enumValues)

const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/

export const scheduleInputSchema = z
  .strictObject({
    day: dayOfWeekSchema,
    startTime: z.string().regex(HHMM, 'Hora inválida (usa HH:MM).'),
    endTime: z.string().regex(HHMM, 'Hora inválida (usa HH:MM).'),
    room: z.string().trim().max(100).optional(),
  })
  .refine((s) => s.endTime > s.startTime, {
    message: 'La hora de fin debe ser posterior a la de inicio.',
    path: ['endTime'],
  })

/** An existing schedule row being updated (has `id`) vs. a new one (no `id`) — used for diffing in `updateCourse`. */
export const scheduleUpsertSchema = z.intersection(
  scheduleInputSchema,
  z.strictObject({ id: z.uuid().optional() })
)

function timeToMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number)
  return (h ?? 0) * 60 + (m ?? 0)
}

/** Same-course overlap guard (defense in depth — the UI also checks this, plan H12). */
function findScheduleOverlap(items: { day: string; startTime: string; endTime: string }[]): boolean {
  const byDay = new Map<string, { start: number; end: number }[]>()
  for (const item of items) {
    const list = byDay.get(item.day) ?? []
    list.push({ start: timeToMinutes(item.startTime), end: timeToMinutes(item.endTime) })
    byDay.set(item.day, list)
  }
  for (const list of byDay.values()) {
    list.sort((a, b) => a.start - b.start)
    for (let i = 1; i < list.length; i++) {
      const prev = list[i - 1]!
      const curr = list[i]!
      if (curr.start < prev.end) return true
    }
  }
  return false
}

export const courseInputSchema = z.strictObject({
  code: z
    .string()
    .trim()
    .min(1, 'El código es obligatorio.')
    .max(16, 'Máximo 16 caracteres.'),
  name: z.string().trim().min(1, 'El nombre es obligatorio.').max(200),
  professor: z.string().trim().max(200).optional(),
  email: z.email('Correo inválido.').max(200).optional().or(z.literal('')),
  faculty: z.string().trim().max(200).optional(),
  semester: z.string().trim().max(50).optional(),
  credits: z.number().int().min(0).max(12).optional(),
  status: courseStatusSchema.optional(),
  notes: z.string().max(4000).optional(),
  color: subjectColorSchema.optional(),
})

export const createCourseSchema = z
  .strictObject({
    course: courseInputSchema,
    schedules: z.array(scheduleInputSchema).max(30).optional().default([]),
  })
  .refine((v) => !findScheduleOverlap(v.schedules), {
    message: 'Hay bloques de horario que se solapan entre sí.',
    path: ['schedules'],
  })

export const updateCourseSchema = z
  .strictObject({
    id: z.uuid(),
    course: courseInputSchema.partial(),
    schedules: z.array(scheduleUpsertSchema).max(30).optional(),
  })
  .refine((v) => !v.schedules || !findScheduleOverlap(v.schedules), {
    message: 'Hay bloques de horario que se solapan entre sí.',
    path: ['schedules'],
  })

export const courseIdSchema = z.strictObject({ id: z.uuid() })
