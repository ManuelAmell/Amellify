import { NextResponse } from 'next/server'
import { getAuthFeatureFlags } from '@/lib/auth/auth'

/**
 * Tells the login page which optional auth features are actually usable
 * (plan Fase 1 · A: "el login muestre solo botones funcionales"). Reads
 * only server-side env vars — never exposes secrets, just booleans.
 */
export async function GET() {
  return NextResponse.json(getAuthFeatureFlags())
}
