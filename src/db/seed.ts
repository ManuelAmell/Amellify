/**
 * Dev/E2E-only seed (plan 1.2: "nunca en producción"). Requires
 * `DATABASE_URL` already set in the environment (same contract as
 * `src/db/index.ts` — no dotenv loading here since that dependency isn't
 * installed; export it in your shell or use `docker compose run` which
 * already injects `.env`).
 *
 * Run with: pnpm db:seed
 */
import { eq } from 'drizzle-orm'
import { auth } from '@/lib/auth/auth'
import { db } from './index'
import { courses, partials, schedules, user } from './schema'

async function main() {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('Seeding is disabled in production (NODE_ENV=production).')
  }

  const email = 'demo@amellify.local'
  const password = 'Demo12345!'

  const existing = await db.query.user.findFirst({ where: eq(user.email, email) })
  const userId = existing
    ? existing.id
    : (
        await auth.api.signUpEmail({
          body: { email, password, name: 'Estudiante Demo' },
        })
      ).user.id

  await db
    .update(user)
    .set({
      university: 'Universidad Demo',
      faculty: 'Ingeniería',
      currentSemester: '2026-1',
      passingGrade: '3.00',
      maxGrade: '5.00',
    })
    .where(eq(user.id, userId))

  const [course] = await db
    .insert(courses)
    .values({
      userId,
      code: 'CALC1',
      name: 'Cálculo I',
      professor: 'Prof. Ejemplo',
      faculty: 'Ingeniería',
      semester: '2026-1',
      credits: 4,
      color: 'blue',
      sortOrder: 1,
    })
    .onConflictDoNothing()
    .returning({ id: courses.id })

  if (course) {
    await db.insert(schedules).values([
      { courseId: course.id, day: 'Lunes', startTime: '08:00', endTime: '10:00', room: 'A-101' },
      { courseId: course.id, day: 'Miércoles', startTime: '08:00', endTime: '10:00', room: 'A-101' },
    ])
    await db.insert(partials).values([
      { courseId: course.id, name: 'Parcial 1', grade: '4.20', percent: '30', sortOrder: 0 },
      { courseId: course.id, name: 'Parcial 2', percent: '30', sortOrder: 1 },
      { courseId: course.id, name: 'Final', percent: '40', sortOrder: 2 },
    ])
  }

  console.log(`Seed complete. Sign in with ${email} / ${password}`)
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err)
    process.exit(1)
  })
