import { sql } from 'drizzle-orm'
import {
  boolean,
  check,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  text,
  time,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core'

/**
 * Shared data contract for Amellify v3 (self-hosted Postgres, Drizzle ORM).
 * Owned by Fase 1 · Agent A (Datos + Auth) — see plan section 1.2.
 *
 * Better Auth's own tables (`user`, `session`, `account`, `verification`)
 * are NOT hand-written here: Agent A generates them with
 *   `pnpm auth:generate`
 * into `src/db/auth-schema.ts` and re-exports them from this file once
 * `src/lib/auth/auth.ts` is configured. The `user` table below is a
 * PLACEHOLDER matching Better Auth's default shape plus the profile
 * fields this app needs (plan 1.2: "user se extiende con campos de
 * perfil ... desaparece profiles"). Replace/reconcile at that point —
 * do not keep both a generated `user` table and this one.
 */

// ---------------------------------------------------------------------------
// Enums
// ---------------------------------------------------------------------------

export const dayOfWeekEnum = pgEnum('day_of_week', [
  'Lunes',
  'Martes',
  'Miércoles',
  'Jueves',
  'Viernes',
  'Sábado',
  'Domingo',
])

export const courseStatusEnum = pgEnum('course_status', [
  'active',
  'paused',
  'completed',
  'dropped',
])

export const subjectColorEnum = pgEnum('subject_color', [
  'blue',
  'red',
  'green',
  'orange',
  'purple',
  'teal',
])

// ---------------------------------------------------------------------------
// User / profile
// (placeholder shape — reconcile with Better Auth generated schema, see note above)
// ---------------------------------------------------------------------------

export const user = pgTable('user', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  email: text('email').notNull().unique(),
  emailVerified: boolean('email_verified').notNull().default(false),
  image: text('image'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),

  // --- Amellify profile fields (plan 1.2) ---
  university: text('university').notNull().default(''),
  faculty: text('faculty').notNull().default(''),
  currentSemester: text('current_semester').notNull().default(''),
  passingGrade: numeric('passing_grade', { precision: 5, scale: 2 }).notNull().default('3.00'),
  maxGrade: numeric('max_grade', { precision: 5, scale: 2 }).notNull().default('5.00'),
  preferences: jsonb('preferences')
    .$type<{
      theme: 'light' | 'dark' | 'system'
      fontSize: 'small' | 'normal' | 'large'
      gridCompact: boolean
      weekStartsOn: 'monday' | 'sunday'
      timeFormat24h: boolean
      defaultView: 'grid' | 'week' | 'list' | 'calc' | 'stats'
      timezone: string
      semesterEndDate: string | null
    }>()
    .notNull()
    .default({
      theme: 'system',
      fontSize: 'normal',
      gridCompact: false,
      weekStartsOn: 'monday',
      timeFormat24h: true,
      defaultView: 'grid',
      timezone: 'America/Bogota',
      semesterEndDate: null,
    }),
}, (table) => [
  check('passing_grade_lt_max', sql`${table.passingGrade} >= 0 AND ${table.passingGrade} < ${table.maxGrade}`),
  check('max_grade_positive', sql`${table.maxGrade} > 0 AND ${table.maxGrade} <= 100`),
])

// ---------------------------------------------------------------------------
// Courses
// ---------------------------------------------------------------------------

export const courses = pgTable('courses', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: text('user_id')
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' }),
  code: text('code').notNull(),
  name: text('name').notNull(),
  professor: text('professor').notNull().default(''),
  email: text('email').notNull().default(''),
  faculty: text('faculty').notNull().default(''),
  semester: text('semester').notNull().default(''),
  credits: integer('credits').notNull().default(3),
  status: courseStatusEnum('status').notNull().default('active'),
  notes: text('notes').notNull().default(''),
  color: subjectColorEnum('color').notNull().default('blue'),
  sortOrder: integer('sort_order').notNull().default(0),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
}, (table) => [
  uniqueIndex('courses_user_code_semester_idx').on(table.userId, table.code, table.semester),
  check('credits_range', sql`${table.credits} BETWEEN 0 AND 12`),
  check('code_length', sql`char_length(${table.code}) BETWEEN 1 AND 16`),
])

// ---------------------------------------------------------------------------
// Schedule blocks
// (no denormalized user_id — ownership resolved via courses.userId, plan 1.2)
// ---------------------------------------------------------------------------

export const schedules = pgTable('schedules', {
  id: uuid('id').primaryKey().defaultRandom(),
  courseId: uuid('course_id')
    .notNull()
    .references(() => courses.id, { onDelete: 'cascade' }),
  day: dayOfWeekEnum('day').notNull(),
  startTime: time('start_time').notNull(),
  endTime: time('end_time').notNull(),
  room: text('room').notNull().default(''),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  check('valid_time_range', sql`${table.endTime} > ${table.startTime}`),
])

// ---------------------------------------------------------------------------
// Partial grades
// ---------------------------------------------------------------------------

export const partials = pgTable('partials', {
  id: uuid('id').primaryKey().defaultRandom(),
  courseId: uuid('course_id')
    .notNull()
    .references(() => courses.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  grade: numeric('grade', { precision: 5, scale: 2 }),
  percent: numeric('percent', { precision: 5, scale: 2 }).notNull(),
  sortOrder: integer('sort_order').notNull().default(0),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  check('grade_range', sql`${table.grade} IS NULL OR (${table.grade} >= 0 AND ${table.grade} <= 100)`),
  check('percent_range', sql`${table.percent} >= 0 AND ${table.percent} <= 100`),
])

export type User = typeof user.$inferSelect
export type Course = typeof courses.$inferSelect
export type NewCourse = typeof courses.$inferInsert
export type Schedule = typeof schedules.$inferSelect
export type NewSchedule = typeof schedules.$inferInsert
export type PartialGrade = typeof partials.$inferSelect
export type NewPartialGrade = typeof partials.$inferInsert
