import { z } from 'zod'
import { courseInputSchema, scheduleInputSchema } from './course'
import { partialInputSchema } from './partial'

/** One course + its schedules + its partials, round-trippable via export/import. */
export const importCourseSchema = z.strictObject({
  course: courseInputSchema,
  schedules: z.array(scheduleInputSchema).max(30).default([]),
  partials: z.array(partialInputSchema).max(50).default([]),
})

export const importDataSchema = z.strictObject({
  version: z.literal(1).optional(),
  courses: z.array(importCourseSchema).max(500, 'Demasiadas materias en un solo archivo.'),
})

export type ImportCourse = z.infer<typeof importCourseSchema>
export type ImportData = z.infer<typeof importDataSchema>
