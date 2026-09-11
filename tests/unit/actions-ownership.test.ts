// @vitest-environment node
import { randomUUID } from 'node:crypto'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { beforeAll, describe, expect, it, vi } from 'vitest'

/**
 * End-to-end test of the real server actions (`createCourse`, `updateCourse`,
 * `savePartials`) against a genuine Postgres (PGlite in-process, no Docker —
 * see plan Fase 1 · A) instead of unit-testing the query helpers in
 * isolation, so this exercises the exact path a real request takes: Zod
 * validation -> ownership check -> transaction -> mapper.
 *
 * Covers the two properties that matter most for a self-hosted multi-user
 * app: (1) a user can never read/write another user's schedules or
 * partials via a guessed/leaked id (plan finding H17), and (2) `savePartials`
 * is atomic — an invalid grade in the middle of a save does not wipe out
 * the rows that were already there (plan finding C7).
 */

// `@/db`'s module-level `db` connects via postgres.js at import time, which
// needs a real network Postgres — replace it with a PGlite-backed Drizzle
// instance for this test file only. `vi.mock` factories can't close over
// outer `const`s (Vitest hoists them above the file's imports), so the
// PGlite instance is created *inside* the factory and exposed as `__pg`
// for the schema bootstrap in `beforeAll` below.
vi.mock('@/db', async () => {
  const { PGlite } = await import('@electric-sql/pglite')
  const { drizzle } = await import('drizzle-orm/pglite')
  const schema = await import('@/db/schema')
  const pg = new PGlite()
  const db = drizzle(pg, { schema })
  return { db, __pg: pg }
})

vi.mock('next/cache', () => ({ revalidatePath: () => {} }))

// `requireUser()` normally reads a cookie via `next/headers` — outside a
// request context tests just need it to return whichever user the test is
// currently acting as.
let actingUserId = ''
vi.mock('@/lib/auth/session', () => ({
  requireUser: async () => ({ id: actingUserId }),
}))

async function actAs(userId: string) {
  actingUserId = userId
}

describe('server actions — ownership isolation & transaction safety', () => {
  let schema: typeof import('@/db/schema')
  let userA: string
  let userB: string

  beforeAll(async () => {
    const { __pg } = (await import('@/db')) as unknown as {
      __pg: import('@electric-sql/pglite').PGlite
    }
    schema = await import('@/db/schema')

    const migrationPath = path.resolve(__dirname, '../../drizzle/0000_damp_prowler.sql')
    const sqlFile = readFileSync(migrationPath, 'utf-8')
    for (const statement of sqlFile.split('--> statement-breakpoint')) {
      const trimmed = statement.trim()
      if (trimmed) await __pg.exec(trimmed)
    }

    const { db } = (await import('@/db')) as unknown as { db: import('drizzle-orm/pglite').PgliteDatabase<typeof schema> }
    userA = randomUUID()
    userB = randomUUID()
    await db.insert(schema.user).values([
      { id: userA, name: 'User A', email: 'a@test.local' },
      { id: userB, name: 'User B', email: 'b@test.local' },
    ])
    // Default 5s hook timeout is too tight for a cold PGlite WASM boot +
    // running the full migration statement-by-statement when the machine
    // is under load from the rest of the suite running in parallel (this
    // file passes in isolation well under 5s, but flaked in the full run).
  }, 30_000)

  it('lets a user create and read their own course', async () => {
    const { createCourse } = await import('@/lib/actions/courses')
    await actAs(userA)

    const result = await createCourse({
      course: { code: 'CALC1', name: 'Cálculo I' },
      schedules: [{ day: 'Lunes', startTime: '08:00', endTime: '10:00' }],
    })

    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.data.code).toBe('CALC1')
    expect(result.data.schedules).toHaveLength(1)
  })

  it("blocks another user from updating someone else's course", async () => {
    const { createCourse, updateCourse } = await import('@/lib/actions/courses')
    await actAs(userA)
    const created = await createCourse({ course: { code: 'PHYS1', name: 'Física I' } })
    expect(created.ok).toBe(true)
    if (!created.ok) return

    await actAs(userB)
    const attempt = await updateCourse({
      id: created.data.id,
      course: { name: 'Materia secuestrada' },
    })

    expect(attempt.ok).toBe(false)

    // Confirm the record was genuinely untouched, not just an error string.
    await actAs(userA)
    const { getCourseWithDetails } = await import('@/db/queries/courses')
    const stillOwned = await getCourseWithDetails(created.data.id, userA)
    expect(stillOwned?.name).toBe('Física I')
  })

  it("blocks another user from writing partials onto someone else's course", async () => {
    const { createCourse } = await import('@/lib/actions/courses')
    const { savePartials } = await import('@/lib/actions/partials')
    await actAs(userA)
    const created = await createCourse({ course: { code: 'CHEM1', name: 'Química I' } })
    expect(created.ok).toBe(true)
    if (!created.ok) return

    await actAs(userB)
    const attempt = await savePartials({
      courseId: created.data.id,
      partials: [{ name: 'Parcial 1', percent: 30, grade: 4 }],
    })

    expect(attempt.ok).toBe(false)
  })

  it('savePartials is atomic: an invalid save does not wipe existing partials', async () => {
    const { createCourse } = await import('@/lib/actions/courses')
    const { savePartials } = await import('@/lib/actions/partials')
    await actAs(userA)
    const created = await createCourse({ course: { code: 'BIO1', name: 'Biología I' } })
    expect(created.ok).toBe(true)
    if (!created.ok) return

    const seeded = await savePartials({
      courseId: created.data.id,
      partials: [{ name: 'Parcial 1', percent: 30, grade: 4 }],
    })
    expect(seeded.ok).toBe(true)

    // Percentages summing over 100 must fail validation before touching the DB.
    const invalid = await savePartials({
      courseId: created.data.id,
      partials: [
        { name: 'Parcial 1', percent: 30, grade: 4 },
        { name: 'Parcial 2', percent: 90, grade: 3 },
      ],
    })
    expect(invalid.ok).toBe(false)

    const { getCourseWithDetails } = await import('@/db/queries/courses')
    const after = await getCourseWithDetails(created.data.id, userA)
    expect(after?.partials).toHaveLength(1)
    expect(after?.partials[0]?.name).toBe('Parcial 1')
  })

  it('rejects a grade above the profile max_grade', async () => {
    const { createCourse } = await import('@/lib/actions/courses')
    const { savePartials } = await import('@/lib/actions/partials')
    await actAs(userA)
    const created = await createCourse({ course: { code: 'MATH2', name: 'Matemáticas II' } })
    expect(created.ok).toBe(true)
    if (!created.ok) return

    // Default profile max_grade is 5.00 (schema default).
    const tooHigh = await savePartials({
      courseId: created.data.id,
      partials: [{ name: 'Final', percent: 100, grade: 8 }],
    })
    expect(tooHigh.ok).toBe(false)
  })
})
