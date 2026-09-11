import type { Course, PartialGrade, Schedule, User } from '@/db/schema'
import type {
  Course as DomainCourse,
  CourseWithDetails,
  PartialGrade as DomainPartialGrade,
  Schedule as DomainSchedule,
  UserProfile,
} from '@/types/domain'

/**
 * Converts Drizzle rows (numeric-as-string, Postgres TIME "HH:MM:SS",
 * Date objects) into the camelCase, JSON-serializable shapes declared in
 * `src/types/domain.ts` that every server action must return.
 */

export function toHHMM(pgTime: string): string {
  // Postgres `time` comes back as "HH:MM:SS" (or with fractional seconds).
  return pgTime.slice(0, 5)
}

export function toDomainSchedule(row: Schedule): DomainSchedule & { start_time: string; end_time: string; course_id: string } {
  const startTime = toHHMM(row.startTime)
  const endTime = toHHMM(row.endTime)
  return {
    id: row.id,
    courseId: row.courseId,
    course_id: row.courseId,
    day: row.day,
    startTime,
    endTime,
    start_time: startTime,
    end_time: endTime,
    room: row.room,
    createdAt: row.createdAt.toISOString(),
  }
}

export function toDomainPartial(row: PartialGrade): DomainPartialGrade & { course_id: string; sort_order: number } {
  return {
    id: row.id,
    courseId: row.courseId,
    course_id: row.courseId,
    name: row.name,
    grade: row.grade === null ? null : Number(row.grade),
    percent: Number(row.percent),
    sortOrder: row.sortOrder,
    sort_order: row.sortOrder,
    createdAt: row.createdAt.toISOString(),
  }
}

export function toDomainCourse(row: Course): DomainCourse & { user_id: string; sort_order: number; created_at: string; updated_at: string } {
  const createdAt = row.createdAt.toISOString()
  const updatedAt = row.updatedAt.toISOString()
  return {
    id: row.id,
    userId: row.userId,
    user_id: row.userId,
    code: row.code,
    name: row.name,
    professor: row.professor,
    email: row.email,
    faculty: row.faculty,
    semester: row.semester,
    credits: row.credits,
    status: row.status,
    notes: row.notes,
    color: row.color,
    sortOrder: row.sortOrder,
    sort_order: row.sortOrder,
    createdAt,
    created_at: createdAt,
    updatedAt,
    updated_at: updatedAt,
  }
}

export function toDomainCourseWithDetails(
  row: Course & { schedules: Schedule[]; partials: PartialGrade[] }
): CourseWithDetails {
  return {
    ...toDomainCourse(row),
    schedules: row.schedules.map(toDomainSchedule),
    partials: row.partials.map(toDomainPartial),
  }
}

export function toDomainProfile(row: User): UserProfile & {
  display_name: string | null
  avatar_url: string | null
  current_semester: string
  passing_grade: number
  max_grade: number
  created_at: string
  updated_at: string
} {
  const createdAt = row.createdAt.toISOString()
  const updatedAt = row.updatedAt.toISOString()
  const passingGrade = Number(row.passingGrade)
  const maxGrade = Number(row.maxGrade)
  return {
    id: row.id,
    displayName: row.name || null,
    display_name: row.name || null,
    avatarUrl: row.image ?? null,
    avatar_url: row.image ?? null,
    email: row.email,
    university: row.university,
    faculty: row.faculty,
    currentSemester: row.currentSemester,
    current_semester: row.currentSemester,
    passingGrade,
    passing_grade: passingGrade,
    maxGrade,
    max_grade: maxGrade,
    preferences: row.preferences,
    createdAt,
    created_at: createdAt,
    updatedAt,
    updated_at: updatedAt,
  }
}
