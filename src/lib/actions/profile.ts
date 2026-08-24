'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { MOCK_PROFILE } from '@/lib/mock-data'
import type { Profile, UserPreferences } from '@/types/database'

export async function getProfile(): Promise<Profile | null> {
  const isSupabaseConfigured =
    Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL) &&
    !process.env.NEXT_PUBLIC_SUPABASE_URL?.includes('placeholder.supabase.co')

  if (!isSupabaseConfigured) {
    return MOCK_PROFILE
  }

  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) return MOCK_PROFILE

    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single()

    if (error) {
      console.error('Error getting profile:', error)
      return MOCK_PROFILE
    }

    return data as Profile
  } catch (err) {
    console.warn('Fallback to mock profile:', err)
    return MOCK_PROFILE
  }
}

export async function updateProfile(updates: Partial<Profile>) {
  const isSupabaseConfigured =
    Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL) &&
    !process.env.NEXT_PUBLIC_SUPABASE_URL?.includes('placeholder.supabase.co')

  if (!isSupabaseConfigured) {
    Object.assign(MOCK_PROFILE, updates)
    revalidatePath('/dashboard')
    revalidatePath('/settings')
    revalidatePath('/calculator')
    return
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) throw new Error('No estás autenticado')

  const { error } = await supabase
    .from('profiles')
    .update(updates)
    .eq('id', user.id)

  if (error) throw new Error(error.message)

  revalidatePath('/dashboard')
  revalidatePath('/settings')
  revalidatePath('/calculator')
}

export async function updatePreferences(preferences: Partial<UserPreferences>) {
  const isSupabaseConfigured =
    Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL) &&
    !process.env.NEXT_PUBLIC_SUPABASE_URL?.includes('placeholder.supabase.co')

  if (!isSupabaseConfigured) {
    MOCK_PROFILE.preferences = {
      ...MOCK_PROFILE.preferences,
      ...preferences,
    }
    revalidatePath('/dashboard')
    revalidatePath('/settings')
    return
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) throw new Error('No estás autenticado')

  const { data: currentProfile } = await supabase
    .from('profiles')
    .select('preferences')
    .eq('id', user.id)
    .single()

  const currentPrefs = currentProfile?.preferences || {}
  const merged = { ...currentPrefs, ...preferences }

  const { error } = await supabase
    .from('profiles')
    .update({ preferences: merged })
    .eq('id', user.id)

  if (error) throw new Error(error.message)

  revalidatePath('/dashboard')
  revalidatePath('/settings')
}
