import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import * as schema from './schema'

const isBuildPhase =
  process.env.NEXT_PHASE === 'phase-production-build' ||
  process.env.npm_lifecycle_event === 'build'

const connectionString =
  process.env.DATABASE_URL ||
  (isBuildPhase ? 'postgresql://build:build@localhost:5432/build' : undefined)

if (!connectionString) {
  // Fail fast — no silent fallback to a placeholder connection at runtime (plan finding C5).
  throw new Error(
    'DATABASE_URL is not set. Copy .env.example to .env and configure your Postgres connection.'
  )
}

// One pooled connection per process; see docs/DEPLOY.md for pool sizing on
// a single self-hosted instance.
const client = postgres(connectionString, { max: 10 })

export const db = drizzle(client, { schema })
export type Database = typeof db
