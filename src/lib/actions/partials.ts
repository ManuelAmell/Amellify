'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { MOCK_COURSES } from '@/lib/mock-data'
import type { PartialInsert } from '@/types/database'

export async function savePartials(
  courseId: string,
  partialsList: Omit<PartialInsert, 'course_id'>[]
) {
  const isSupabaseConfigured =
    Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL) &&
    !process.env.NEXT_PUBLIC_SUPABASE_URL?.includes('placeholder.supabase.co')

  if (!isSupabaseConfigured) {
    const course = MOCK_COURSES.find((c) => c.id === courseId)
    if (course) {
      course.partials = partialsList.map((p, idx) => ({
        id: `p-${idx}-${Date.now()}`,
        course_id: courseId,
        user_id: 'demo-user-id',
        name: p.name || `P${idx + 1}`,
        grade: p.grade !== undefined && p.grade !== null && !isNaN(Number(p.grade)) ? Number(p.grade) : null,
        percent: Number(p.percent) || 0,
        sort_order: p.sort_order ?? idx,
        created_at: new Date().toISOString(),
      }))
    }
    revalidatePath('/calculator')
    revalidatePath('/courses')
    revalidatePath('/stats')
    return
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) throw new Error('No estás autenticado')

  // Remove existing partials for this course
  await supabase
    .from('partials')
    .delete()
    .eq('course_id', courseId)
    .eq('user_id', user.id)

  if (partialsList.length > 0) {
    const toInsert = partialsList.map((p, idx) => ({
      course_id: courseId,
      user_id: user.id,
      name: p.name || `P${idx + 1}`,
      grade: p.grade !== undefined && p.grade !== null && !isNaN(Number(p.grade)) ? Number(p.grade) : null,
      percent: Number(p.percent) || 0,
      sort_order: p.sort_order ?? idx,
    }))

    const { error } = await supabase.from('partials').insert(toInsert)
    if (error) throw new Error(error.message)
  }

  revalidatePath('/calculator')
  revalidatePath('/courses')
  revalidatePath('/stats')
}

export async function updateSinglePartial(
  partialId: string,
  updates: {
    name?: string
    grade?: number | null
    percent?: number
  }
) {
  const isSupabaseConfigured =
    Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL) &&
    !process.env.NEXT_PUBLIC_SUPABASE_URL?.includes('placeholder.supabase.co')

  if (!isSupabaseConfigured) {
    for (const course of MOCK_COURSES) {
      const p = course.partials.find((part) => part.id === partialId)
      if (p) {
        Object.assign(p, updates)
        break
      }
    }
    revalidatePath('/calculator')
    revalidatePath('/courses')
    revalidatePath('/stats')
    return
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) throw new Error('No estás autenticado')

  const { error } = await supabase
    .from('partials')
    .update(updates)
    .eq('id', partialId)
    .eq('user_id', user.id)

  if (error) throw new Error(error.message)

  revalidatePath('/calculator')
  revalidatePath('/courses')
  revalidatePath('/stats')
}
