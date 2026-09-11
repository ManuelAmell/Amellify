import { eq } from 'drizzle-orm'
import { db } from '@/db'
import { user } from '@/db/schema'
import type { UserProfile } from '@/types/domain'
import type { DbOrTx } from './courses'
import { toDomainProfile } from './mappers'

export async function getUserProfile(userId: string, executor: DbOrTx = db): Promise<UserProfile | null> {
  const row = await executor.query.user.findFirst({ where: eq(user.id, userId) })
  return row ? toDomainProfile(row) : null
}
