'use server'

import { and, eq, inArray } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { cache } from 'react'
import { db } from '@/db'
import {
  assertCourseOwnership,
  codeExists,
  getCourseWithDetails,
  getCoursesForUser,
  getNextSortOrder,
} from '@/db/queries/courses'
import { courses, schedules } from '@/db/schema'
import { requireUser } from '@/lib/auth/session'
import { createCourseSchema, updateCourseSchema } from '@/lib/validation/course'
import type { ActionResult, CourseWithDetails } from '@/types/domain'
import { failure, success, toActionError } from './utils'

/** Deduped per-request read (plan finding H8: was fetched twice per navigation). */
export const getCourses = cache(async (): Promise<ActionResult<CourseWithDetails[]>> => {
  try {
    const user = await requireUser()
    const data = await getCoursesForUser(user.id)
    return success(data)
  } catch (error) {
    return toActionError(error)
  }
})

/** Builds a unique `CODE-2`, `CODE-3`, … code (≤16 chars) for `duplicateCourse` (plan finding H15). */
async function buildDuplicateCode(userId: string, baseCode: string, semester: string): Promise<string> {
  for (let n = 2; n < 1000; n++) {
    const suffix = `-${n}`
    const truncatedBase = baseCode.slice(0, Math.max(1, 16 - suffix.length))
    const candidate = `${truncatedBase}${suffix}`
    if (!(await codeExists(userId, candidate, semester))) return candidate
  }
  throw new Error('No fue posible generar un código único.')
}

export async function createCourse(
  rawInput: unknown,
  legacySchedules?: unknown
): Promise<ActionResult<CourseWithDetails>> {
  try {
    const user = await requireUser()
    const inputToParse =
      legacySchedules !== undefined
        ? { course: rawInput, schedules: legacySchedules }
        : rawInput
    const parsed = createCourseSchema.parse(inputToParse)
    const semester = parsed.course.semester ?? ''

    if (await codeExists(user.id, parsed.course.code, semester)) {
      return failure('Ya existe una materia con ese código en este semestre.', {
        code: ['Ya existe una materia con ese código en este semestre.'],
      })
    }

    const courseId = await db.transaction(async (tx) => {
      const sortOrder = await getNextSortOrder(user.id, tx)
      const [row] = await tx
        .insert(courses)
        .values({
          userId: user.id,
          code: parsed.course.code,
          name: parsed.course.name,
          professor: parsed.course.professor ?? '',
          email: parsed.course.email ?? '',
          faculty: parsed.course.faculty ?? '',
          semester,
          credits: parsed.course.credits ?? 3,
          status: parsed.course.status ?? 'active',
          notes: parsed.course.notes ?? '',
          color: parsed.course.color ?? 'blue',
          sortOrder,
        })
        .returning({ id: courses.id })

      if (!row) throw new Error('No fue posible crear la materia.')

      if (parsed.schedules.length > 0) {
        await tx.insert(schedules).values(
          parsed.schedules.map((s) => ({
            courseId: row.id,
            day: s.day,
            startTime: s.startTime,
            endTime: s.endTime,
            room: s.room ?? '',
          }))
        )
      }

      return row.id
    })

    const created = await getCourseWithDetails(courseId, user.id)
    if (!created) throw new Error('La materia se creó pero no se pudo recuperar.')

    revalidatePath('/dashboard')
    revalidatePath('/courses')
    return success(created)
  } catch (error) {
    return toActionError(error)
  }
}

export async function updateCourse(
  rawInput: unknown,
  legacyCourse?: unknown,
  legacySchedules?: unknown
): Promise<ActionResult<CourseWithDetails>> {
  try {
    const user = await requireUser()
    const inputToParse =
      legacyCourse !== undefined
        ? { id: rawInput, course: legacyCourse, schedules: legacySchedules }
        : rawInput
    const parsed = updateCourseSchema.parse(inputToParse)
    await assertCourseOwnership(parsed.id, user.id)

    if (parsed.course.code !== undefined || parsed.course.semester !== undefined) {
      const existing = await getCourseWithDetails(parsed.id, user.id)
      const nextCode = parsed.course.code ?? existing?.code ?? ''
      const nextSemester = parsed.course.semester ?? existing?.semester ?? ''
      const clash = await codeExists(user.id, nextCode, nextSemester)
      const isSameCourse = existing?.code === nextCode && existing?.semester === nextSemester
      if (clash && !isSameCourse) {
        return failure('Ya existe una materia con ese código en este semestre.', {
          code: ['Ya existe una materia con ese código en este semestre.'],
        })
      }
    }

    await db.transaction(async (tx) => {
      if (Object.keys(parsed.course).length > 0) {
        await tx
          .update(courses)
          .set({ ...parsed.course, updatedAt: new Date() })
          .where(and(eq(courses.id, parsed.id), eq(courses.userId, user.id)))
      }

      // Diff-based schedule sync (plan finding C7: no more delete-all-then-insert).
      if (parsed.schedules) {
        const current = await tx
          .select({ id: schedules.id })
          .from(schedules)
          .where(eq(schedules.courseId, parsed.id))
        const currentIds = new Set(current.map((s) => s.id))
        const incomingIds = new Set(parsed.schedules.filter((s) => s.id).map((s) => s.id!))

        const toDelete = [...currentIds].filter((id) => !incomingIds.has(id))
        if (toDelete.length > 0) {
          await tx.delete(schedules).where(inArray(schedules.id, toDelete))
        }

        for (const s of parsed.schedules) {
          if (s.id && currentIds.has(s.id)) {
            await tx
              .update(schedules)
              .set({ day: s.day, startTime: s.startTime, endTime: s.endTime, room: s.room ?? '' })
              .where(eq(schedules.id, s.id))
          } else {
            await tx.insert(schedules).values({
              courseId: parsed.id,
              day: s.day,
              startTime: s.startTime,
              endTime: s.endTime,
              room: s.room ?? '',
            })
          }
        }
      }
    })

    const updated = await getCourseWithDetails(parsed.id, user.id)
    if (!updated) return failure('La materia ya no existe.')

    revalidatePath('/dashboard')
    revalidatePath('/courses')
    return success(updated)
  } catch (error) {
    return toActionError(error)
  }
}

export async function deleteCourse(rawId: unknown): Promise<ActionResult<{ id: string }>> {
  try {
    const user = await requireUser()
    const id = String(rawId)
    await assertCourseOwnership(id, user.id)

    await db.delete(courses).where(and(eq(courses.id, id), eq(courses.userId, user.id)))

    revalidatePath('/dashboard')
    revalidatePath('/courses')
    return success({ id })
  } catch (error) {
    return toActionError(error)
  }
}

export async function duplicateCourse(rawId: unknown): Promise<ActionResult<CourseWithDetails>> {
  try {
    const user = await requireUser()
    const id = String(rawId)
    const source = await getCourseWithDetails(id, user.id)
    if (!source) return failure('La materia no existe.')

    const newCode = await buildDuplicateCode(user.id, source.code, source.semester)

    const newId = await db.transaction(async (tx) => {
      const sortOrder = await getNextSortOrder(user.id, tx)
      const [row] = await tx
        .insert(courses)
        .values({
          userId: user.id,
          code: newCode,
          name: source.name,
          professor: source.professor,
          email: source.email,
          faculty: source.faculty,
          semester: source.semester,
          credits: source.credits,
          status: source.status,
          notes: source.notes,
          color: source.color,
          sortOrder,
        })
        .returning({ id: courses.id })
      if (!row) throw new Error('No fue posible duplicar la materia.')

      // Copy schedules; partials are intentionally NOT copied (a duplicated
      // course starts a fresh grade sheet — plan Fase 1 · A decision, H15).
      if (source.schedules.length > 0) {
        await tx.insert(schedules).values(
          source.schedules.map((s) => ({
            courseId: row.id,
            day: s.day,
            startTime: s.startTime,
            endTime: s.endTime,
            room: s.room,
          }))
        )
      }

      return row.id
    })

    const created = await getCourseWithDetails(newId, user.id)
    if (!created) throw new Error('La materia se duplicó pero no se pudo recuperar.')

    revalidatePath('/dashboard')
    revalidatePath('/courses')
    return success(created)
  } catch (error) {
    return toActionError(error)
  }
}
