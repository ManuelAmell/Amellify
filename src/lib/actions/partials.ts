'use server'

import { eq, inArray } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { db } from '@/db'
import { assertCourseOwnership, getCourseWithDetails } from '@/db/queries/courses'
import { getUserProfile } from '@/db/queries/profile'
import { partials } from '@/db/schema'
import { requireUser } from '@/lib/auth/session'
import { createSavePartialsSchema } from '@/lib/validation/partial'
import type { ActionResult, CourseWithDetails } from '@/types/domain'
import { failure, success, toActionError } from './utils'

/**
 * Replaces a course's partial grades in ONE transaction (plan finding C7:
 * the old version did delete-then-insert with no transaction and didn't
 * check the delete's result — an invalid insert after a successful
 * delete silently wiped every grade while the UI reported success).
 * Diffs by `id` instead of delete-all-then-insert so untouched rows keep
 * their `createdAt`.
 */
export async function savePartials(
  rawInput: unknown,
  legacyPartials?: unknown
): Promise<ActionResult<CourseWithDetails>> {
  try {
    const user = await requireUser()
    const profile = await getUserProfile(user.id)
    if (!profile) return failure('No se encontró tu perfil.')

    const inputToParse =
      legacyPartials !== undefined
        ? { courseId: rawInput, partials: legacyPartials }
        : rawInput
    const parsed = createSavePartialsSchema(profile.maxGrade).parse(inputToParse)
    await assertCourseOwnership(parsed.courseId, user.id)

    await db.transaction(async (tx) => {
      const current = await tx
        .select({ id: partials.id })
        .from(partials)
        .where(eq(partials.courseId, parsed.courseId))
      const currentIds = new Set(current.map((p) => p.id))
      const incomingIds = new Set(parsed.partials.filter((p) => p.id).map((p) => p.id!))

      const toDelete = [...currentIds].filter((id) => !incomingIds.has(id))
      if (toDelete.length > 0) {
        await tx.delete(partials).where(inArray(partials.id, toDelete))
      }

      for (const [index, p] of parsed.partials.entries()) {
        const grade = p.grade === null || p.grade === undefined ? null : String(p.grade)
        const percent = String(p.percent)
        if (p.id && currentIds.has(p.id)) {
          await tx
            .update(partials)
            .set({ name: p.name, grade, percent, sortOrder: index })
            .where(eq(partials.id, p.id))
        } else {
          await tx.insert(partials).values({
            courseId: parsed.courseId,
            name: p.name,
            grade,
            percent,
            sortOrder: index,
          })
        }
      }
    })

    const updated = await getCourseWithDetails(parsed.courseId, user.id)
    if (!updated) return failure('La materia ya no existe.')

    revalidatePath('/dashboard')
    revalidatePath('/calculator')
    return success(updated)
  } catch (error) {
    return toActionError(error)
  }
}
