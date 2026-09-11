import { relations, sql } from 'drizzle-orm'
import {
  boolean,
  check,
  index,
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
 * Single source of truth for the whole schema, including Better Auth's own
 * tables (`user`, `session`, `account`, `verification`). Those were
 * originally scaffolded with `pnpm auth:generate` into
 * `src/db/auth-schema.ts` (kept in the repo only as a regeneration
 * reference — nothing imports it). Their fields are reproduced here by
 * hand, with `user` extended with Amellify's profile columns (plan 1.2:
 * "user se extiende con campos de perfil ... desaparece profiles") so
 * there is exactly ONE `user` table, never two competing definitions.
 * `src/lib/auth/auth.ts` passes this file's exports to `drizzleAdapter`
 * explicitly (`schema: { user, session, account, verification }`).
 *
 * If you re-run `pnpm auth:generate`, diff the regenerated
 * `auth-schema.ts` against the `user`/`session`/`account`/`verification`
 * tables below and port over any new fields by hand — do not start
 * importing the generated file directly (it would create a second `user`
 * table object pointing at the same physical table).
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
// User / profile (Better Auth core shape + Amellify profile fields)
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
// Better Auth: session / account / verification
// (field shapes mirror what `pnpm auth:generate` produces — see module doc)
// ---------------------------------------------------------------------------

export const session = pgTable('session', {
  id: text('id').primaryKey(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  token: text('token').notNull().unique(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
  ipAddress: text('ip_address'),
  userAgent: text('user_agent'),
  userId: text('user_id')
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' }),
}, (table) => [index('session_user_id_idx').on(table.userId)])

export const account = pgTable('account', {
  id: text('id').primaryKey(),
  accountId: text('account_id').notNull(),
  providerId: text('provider_id').notNull(),
  userId: text('user_id')
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' }),
  accessToken: text('access_token'),
  refreshToken: text('refresh_token'),
  idToken: text('id_token'),
  accessTokenExpiresAt: timestamp('access_token_expires_at', { withTimezone: true }),
  refreshTokenExpiresAt: timestamp('refresh_token_expires_at', { withTimezone: true }),
  scope: text('scope'),
  password: text('password'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
}, (table) => [index('account_user_id_idx').on(table.userId)])

export const verification = pgTable('verification', {
  id: text('id').primaryKey(),
  identifier: text('identifier').notNull(),
  value: text('value').notNull(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
}, (table) => [index('verification_identifier_idx').on(table.identifier)])

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
  // Deterministic ordering: sort_order first, then created_at/id as tiebreakers (plan H).
  index('courses_user_sort_idx').on(table.userId, table.sortOrder, table.createdAt),
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
  index('schedules_course_day_start_idx').on(table.courseId, table.day, table.startTime),
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
  index('partials_course_sort_idx').on(table.courseId, table.sortOrder),
  check('grade_range', sql`${table.grade} IS NULL OR (${table.grade} >= 0 AND ${table.grade} <= 100)`),
  check('percent_range', sql`${table.percent} >= 0 AND ${table.percent} <= 100`),
])

// ---------------------------------------------------------------------------
// Relations (enables `db.query.courses.findMany({ with: { schedules, partials } })`)
// ---------------------------------------------------------------------------

export const userRelations = relations(user, ({ many }) => ({
  sessions: many(session),
  accounts: many(account),
  courses: many(courses),
}))

export const sessionRelations = relations(session, ({ one }) => ({
  user: one(user, { fields: [session.userId], references: [user.id] }),
}))

export const accountRelations = relations(account, ({ one }) => ({
  user: one(user, { fields: [account.userId], references: [user.id] }),
}))

export const coursesRelations = relations(courses, ({ one, many }) => ({
  user: one(user, { fields: [courses.userId], references: [user.id] }),
  schedules: many(schedules),
  partials: many(partials),
}))

export const schedulesRelations = relations(schedules, ({ one }) => ({
  course: one(courses, { fields: [schedules.courseId], references: [courses.id] }),
}))

export const partialsRelations = relations(partials, ({ one }) => ({
  course: one(courses, { fields: [partials.courseId], references: [courses.id] }),
}))

// ---------------------------------------------------------------------------
// Inferred types
// ---------------------------------------------------------------------------

export type User = typeof user.$inferSelect
export type Session = typeof session.$inferSelect
export type Account = typeof account.$inferSelect
export type Verification = typeof verification.$inferSelect
export type Course = typeof courses.$inferSelect
export type NewCourse = typeof courses.$inferInsert
export type Schedule = typeof schedules.$inferSelect
export type NewSchedule = typeof schedules.$inferInsert
export type PartialGrade = typeof partials.$inferSelect
export type NewPartialGrade = typeof partials.$inferInsert
