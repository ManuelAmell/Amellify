import { sql } from 'drizzle-orm'
import { NextResponse } from 'next/server'
import { db } from '@/db'

// Used by docker-compose healthchecks and uptime monitoring (plan 1.4).
export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    await db.execute(sql`SELECT 1`)
    return NextResponse.json({ ok: true, db: 'up' })
  } catch (error) {
    return NextResponse.json(
      { ok: false, db: 'down', error: error instanceof Error ? error.message : 'unknown' },
      { status: 503 }
    )
  }
}
