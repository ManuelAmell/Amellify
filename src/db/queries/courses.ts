import { and, asc, eq, sql } from 'drizzle-orm'
import { db, type Database } from '@/db'
import { courses, partials, schedules } from '@/db/schema'
import type { CourseWithDetails } from '@/types/domain'
import { toDomainCourseWithDetails } from './mappers'

/** Drizzle transaction handle — same query surface as `db` (select/insert/.../query). */
export type DbOrTx = Database | Parameters<Parameters<Database['transaction']>[0]>[0]

export class OwnershipError extends Error {
  constructor(message = 'No tienes permiso sobre este recurso.') {
    super(message)
    this.name = 'OwnershipError'
  }
}

const withDetails = {
  schedules: { orderBy: [asc(schedules.day), asc(schedules.startTime)] },
  partials: { orderBy: [asc(partials.sortOrder), asc(partials.createdAt)] },
}

export async function getCoursesForUser(
  userId: string,
  executor: DbOrTx = db
): Promise<CourseWithDetails[]> {
  const rows = await executor.query.courses.findMany({
    where: eq(courses.userId, userId),
    orderBy: [asc(courses.sortOrder), asc(courses.createdAt), asc(courses.id)],
    with: withDetails,
  })
  return rows.map(toDomainCourseWithDetails)
}

export async function getCourseWithDetails(
  courseId: string,
  userId: string,
  executor: DbOrTx = db
): Promise<CourseWithDetails | null> {
  const row = await executor.query.courses.findFirst({
    where: and(eq(courses.id, courseId), eq(courses.userId, userId)),
    with: withDetails,
  })
  return row ? toDomainCourseWithDetails(row) : null
}

export async function getNextSortOrder(userId: string, executor: DbOrTx = db): Promise<number> {
  const [row] = await executor
    .select({ max: sql<number>`coalesce(max(${courses.sortOrder}), 0)` })
    .from(courses)
    .where(eq(courses.userId, userId))
  return (row?.max ?? 0) + 1
}

/**
 * Verifies that `courseId` belongs to `userId` before any write to
 * `schedules`/`partials` (plan finding H17: never trust a client-supplied
 * `course_id`). Throws `OwnershipError` (caller translates to a
 * user-facing `ActionResult` error) instead of returning a boolean, so
 * call sites can't accidentally ignore the check.
 */
export async function assertCourseOwnership(
  courseId: string,
  userId: string,
  executor: DbOrTx = db
): Promise<void> {
  const [row] = await executor
    .select({ id: courses.id })
    .from(courses)
    .where(and(eq(courses.id, courseId), eq(courses.userId, userId)))
    .limit(1)
  if (!row) throw new OwnershipError()
}

export async function codeExists(
  userId: string,
  code: string,
  semester: string,
  executor: DbOrTx = db
): Promise<boolean> {
  const [row] = await executor
    .select({ id: courses.id })
    .from(courses)
    .where(and(eq(courses.userId, userId), eq(courses.code, code), eq(courses.semester, semester)))
    .limit(1)
  return Boolean(row)
}
