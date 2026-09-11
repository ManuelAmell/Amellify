import { defineConfig } from 'drizzle-kit'

// `drizzle-kit generate` only introspects src/db/schema.ts and does not
// need a live connection, so DATABASE_URL is optional here (unlike
// src/db/index.ts, which fails fast at app runtime — plan finding C5).
// `db:migrate` / `db:push` / `db:studio` DO need a real DATABASE_URL.
const databaseUrl =
  process.env.DATABASE_URL ?? 'postgresql://placeholder:placeholder@localhost:5432/placeholder'

export default defineConfig({
  schema: './src/db/schema.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    url: databaseUrl,
  },
  strict: true,
  verbose: true,
})
