/**
 * Shared frontend domain contract for Amellify v3.
 *
 * This is the interface that Fase 1 (Agent A) and Fase 2 (Agents D/E)
 * build against in parallel — Agent A's server actions must return data
 * shaped like this (mapping from `src/db/schema.ts`'s Drizzle rows,
 * including numeric-string -> number conversions), and D/E's components
 * consume it. Keep it in sync with `src/db/schema.ts`; do not let the two
 * drift silently.
 */

export type SubjectColor = 'blue' | 'red' | 'green' | 'orange' | 'purple' | 'teal'
export type CourseStatus = 'active' | 'paused' | 'completed' | 'dropped'
export type DayOfWeek =
  | 'Lunes'
  | 'Martes'
  | 'Miércoles'
  | 'Jueves'
  | 'Viernes'
  | 'Sábado'
  | 'Domingo'

export interface UserPreferences {
  theme: 'light' | 'dark' | 'system'
  fontSize: 'small' | 'normal' | 'large'
  gridCompact: boolean
  weekStartsOn: 'monday' | 'sunday'
  timeFormat24h: boolean
  defaultView: 'grid' | 'week' | 'list' | 'calc' | 'stats'
  /** IANA timezone, e.g. "America/Bogota" — plan finding on tz-naive time math. */
  timezone: string
  /** ISO date (yyyy-mm-dd); used as ICS RRULE UNTIL bound (plan finding H18). */
  semesterEndDate: string | null
}

export interface UserProfile {
  id: string
  displayName: string | null
  avatarUrl: string | null
  email: string
  university: string
  faculty: string
  currentSemester: string
  /** Decimal number, e.g. 3.0 — NOT a numeric(3,2) DB string anymore (plan C8). */
  passingGrade: number
  maxGrade: number
  preferences: UserPreferences
  createdAt: string
  updatedAt: string
}

export interface Course {
  id: string
  userId: string
  code: string
  name: string
  professor: string
  email: string
  faculty: string
  semester: string
  credits: number
  status: CourseStatus
  notes: string
  color: SubjectColor
  sortOrder: number
  createdAt: string
  updatedAt: string
}

export interface Schedule {
  id: string
  courseId: string
  day: DayOfWeek
  /** "HH:MM" (24h), already normalized from Postgres TIME by the query layer. */
  startTime: string
  endTime: string
  room: string
  createdAt: string
}

export interface PartialGrade {
  id: string
  courseId: string
  name: string
  grade: number | null
  percent: number
  sortOrder: number
  createdAt: string
}

export interface CourseWithDetails extends Course {
  schedules: Schedule[]
  partials: PartialGrade[]
}

export interface CourseInput {
  code: string
  name: string
  professor?: string
  email?: string
  faculty?: string
  semester?: string
  credits?: number
  status?: CourseStatus
  notes?: string
  color?: SubjectColor
}

export interface ScheduleInput {
  day: DayOfWeek
  startTime: string
  endTime: string
  room?: string
}

export interface PartialInput {
  name: string
  grade?: number | null
  percent: number
}

/**
 * Standard server-action result shape (plan Fase 1 · A: "never raw Postgres
 * error text" — H17/C7 fixes). Every action in `src/lib/actions/*` should
 * return this instead of throwing for expected/validation failures.
 */
export type ActionResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string; fieldErrors?: Record<string, string[]> }
