'use server'

import { eq, sql } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { headers } from 'next/headers'
import { cache } from 'react'
import { db } from '@/db'
import { codeExists, getCoursesForUser, getNextSortOrder } from '@/db/queries/courses'
import { getUserProfile } from '@/db/queries/profile'
import { courses, partials, schedules, user as userTable } from '@/db/schema'
import { auth } from '@/lib/auth/auth'
import { requireUser } from '@/lib/auth/session'
import {
  changePasswordSchema,
  deleteAccountSchema,
  gradeScaleRelationSchema,
  preferencesInputSchema,
  updateProfileSchema,
} from '@/lib/validation/profile'
import { importDataSchema, type ImportData } from '@/lib/validation/data'
import type { ActionResult, UserPreferences, UserProfile } from '@/types/domain'
import { z } from 'zod'
import { failure, success, toActionError, zodFailure } from './utils'

/** Deduped per-request read (plan finding H8). */
export const getProfile = cache(async (): Promise<ActionResult<UserProfile>> => {
  try {
    const authUser = await requireUser()
    const profile = await getUserProfile(authUser.id)
    if (!profile) return failure('No se encontró tu perfil.')
    return success(profile)
  } catch (error) {
    return toActionError(error)
  }
})

export async function updateProfile(rawInput: unknown): Promise<ActionResult<UserProfile>> {
  try {
    const authUser = await requireUser()
    const parsed = updateProfileSchema.parse(rawInput)

    const current = await getUserProfile(authUser.id)
    if (!current) return failure('No se encontró tu perfil.')

    // Validate the grade-scale relation against the MERGED profile, not
    // just the partial input — a request touching only `university` must
    // not fail because it didn't also resend `maxGrade`.
    const mergedGrades = gradeScaleRelationSchema.parse({
      passingGrade: parsed.passingGrade ?? current.passingGrade,
      maxGrade: parsed.maxGrade ?? current.maxGrade,
    })

    const { displayName, passingGrade: _pg, maxGrade: _mg, ...rest } = parsed

    await db
      .update(userTable)
      .set({
        ...rest,
        ...(displayName !== undefined ? { name: displayName } : {}),
        passingGrade: String(mergedGrades.passingGrade),
        maxGrade: String(mergedGrades.maxGrade),
        updatedAt: new Date(),
      })
      .where(eq(userTable.id, authUser.id))

    const updated = await getUserProfile(authUser.id)
    if (!updated) return failure('No se encontró tu perfil.')

    revalidatePath('/dashboard')
    revalidatePath('/settings')
    return success(updated)
  } catch (error) {
    return toActionError(error)
  }
}

/**
 * Merges into the `preferences` JSONB column with a single atomic
 * `preferences || $partial::jsonb` UPDATE instead of a read-modify-write
 * round trip (plan finding: "read-modify-write sin lock y acepta claves
 * arbitrarias" — the Zod `strictObject` also closes the arbitrary-keys
 * part of that finding).
 */
export async function updatePreferences(rawInput: unknown): Promise<ActionResult<UserProfile>> {
  try {
    const authUser = await requireUser()
    const parsed: Partial<UserPreferences> = preferencesInputSchema.parse(rawInput)

    await db
      .update(userTable)
      .set({
        preferences: sql`${userTable.preferences} || ${JSON.stringify(parsed)}::jsonb`,
        updatedAt: new Date(),
      })
      .where(eq(userTable.id, authUser.id))

    const updated = await getUserProfile(authUser.id)
    if (!updated) return failure('No se encontró tu perfil.')

    revalidatePath('/dashboard')
    revalidatePath('/settings')
    return success(updated)
  } catch (error) {
    return toActionError(error)
  }
}

export async function changePassword(rawInput: unknown): Promise<ActionResult<{ success: true }>> {
  try {
    await requireUser()
    const parsed = changePasswordSchema.parse(rawInput)

    await auth.api.changePassword({
      body: {
        currentPassword: parsed.currentPassword,
        newPassword: parsed.newPassword,
        revokeOtherSessions: true,
      },
      headers: await headers(),
    })

    return success({ success: true })
  } catch (error) {
    if (error instanceof z.ZodError) return zodFailure(error)
    console.error('[changePassword]', error)
    return failure('No fue posible cambiar la contraseña. Verifica tu contraseña actual.')
  }
}

export async function deleteAccount(rawInput: unknown): Promise<ActionResult<{ success: true }>> {
  try {
    await requireUser()
    deleteAccountSchema.parse(rawInput)

    // `courses` (and, transitively, `schedules`/`partials`) cascade on
    // `user` deletion via the FK `onDelete: 'cascade'` in schema.ts.
    await auth.api.deleteUser({
      body: {},
      headers: await headers(),
    })

    return success({ success: true })
  } catch (error) {
    if (error instanceof z.ZodError) return zodFailure(error)
    console.error('[deleteAccount]', error)
    return failure('No fue posible eliminar tu cuenta. Intenta de nuevo.')
  }
}

export async function exportData(): Promise<ActionResult<ImportData>> {
  try {
    const authUser = await requireUser()
    const data = await getCoursesForUser(authUser.id)

    return success({
      version: 1,
      courses: data.map((c) => ({
        course: {
          code: c.code,
          name: c.name,
          professor: c.professor,
          email: c.email,
          faculty: c.faculty,
          semester: c.semester,
          credits: c.credits,
          status: c.status,
          notes: c.notes,
          color: c.color,
        },
        schedules: c.schedules.map((s) => ({
          day: s.day,
          startTime: s.startTime,
          endTime: s.endTime,
          room: s.room,
        })),
        partials: c.partials.map((p) => ({ name: p.name, grade: p.grade, percent: p.percent })),
      })),
    })
  } catch (error) {
    return toActionError(error)
  }
}

/** Imports courses in one transaction; a course whose code already exists for this user/semester is skipped, not overwritten. */
export async function importData(rawInput: unknown): Promise<ActionResult<{ imported: number; skipped: number }>> {
  try {
    const authUser = await requireUser()
    const parsed = importDataSchema.parse(rawInput)

    let imported = 0
    let skipped = 0

    await db.transaction(async (tx) => {
      let nextSortOrder = await getNextSortOrder(authUser.id, tx)

      for (const item of parsed.courses) {
        const semester = item.course.semester ?? ''
        if (await codeExists(authUser.id, item.course.code, semester, tx)) {
          skipped++
          continue
        }

        const [row] = await tx
          .insert(courses)
          .values({
            userId: authUser.id,
            code: item.course.code,
            name: item.course.name,
            professor: item.course.professor ?? '',
            email: item.course.email ?? '',
            faculty: item.course.faculty ?? '',
            semester,
            credits: item.course.credits ?? 3,
            status: item.course.status ?? 'active',
            notes: item.course.notes ?? '',
            color: item.course.color ?? 'blue',
            sortOrder: nextSortOrder++,
          })
          .returning({ id: courses.id })

        if (!row) {
          skipped++
          continue
        }

        if (item.schedules.length > 0) {
          await tx.insert(schedules).values(
            item.schedules.map((s) => ({
              courseId: row.id,
              day: s.day,
              startTime: s.startTime,
              endTime: s.endTime,
              room: s.room ?? '',
            }))
          )
        }

        if (item.partials.length > 0) {
          await tx.insert(partials).values(
            item.partials.map((p, index) => ({
              courseId: row.id,
              name: p.name,
              grade: p.grade === null || p.grade === undefined ? null : String(p.grade),
              percent: String(p.percent),
              sortOrder: index,
            }))
          )
        }

        imported++
      }
    })

    revalidatePath('/dashboard')
    revalidatePath('/courses')
    return success({ imported, skipped })
  } catch (error) {
    return toActionError(error)
  }
}
