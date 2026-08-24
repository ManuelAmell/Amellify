'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { MOCK_COURSES } from '@/lib/mock-data'
import type { CourseInsert, ScheduleInsert, CourseWithDetails } from '@/types/database'

export async function getCourses(): Promise<CourseWithDetails[]> {
  const isSupabaseConfigured =
    Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL) &&
    !process.env.NEXT_PUBLIC_SUPABASE_URL?.includes('placeholder.supabase.co')

  if (!isSupabaseConfigured) {
    return MOCK_COURSES
  }

  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return MOCK_COURSES

    const { data, error } = await supabase
      .from('courses')
      .select(`
        *,
        schedules (*),
        partials (*)
      `)
      .eq('user_id', user.id)
      .order('sort_order', { ascending: true })

    if (error) {
      console.error('Error fetching courses:', error)
      return MOCK_COURSES
    }

    return (data as CourseWithDetails[]).map((course) => ({
      ...course,
      partials: (course.partials || []).sort((a, b) => a.sort_order - b.sort_order),
      schedules: course.schedules || [],
    }))
  } catch (err) {
    console.warn('Fallback to mock courses:', err)
    return MOCK_COURSES
  }
}

export async function createCourse(
  courseData: CourseInsert,
  schedules: Omit<ScheduleInsert, 'course_id'>[] = []
) {
  const isSupabaseConfigured =
    Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL) &&
    !process.env.NEXT_PUBLIC_SUPABASE_URL?.includes('placeholder.supabase.co')

  if (!isSupabaseConfigured) {
    // In preview mode, add to mock
    const newCourse: CourseWithDetails = {
      id: `local-${Date.now()}`,
      user_id: 'demo-user-id',
      code: courseData.code,
      name: courseData.name,
      professor: courseData.professor || '',
      email: courseData.email || '',
      faculty: courseData.faculty || '',
      semester: courseData.semester || '',
      credits: courseData.credits || 3,
      status: courseData.status || 'active',
      notes: courseData.notes || '',
      color: courseData.color || 'blue',
      sort_order: courseData.sort_order || 0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      schedules: schedules.map((s, idx) => ({
        id: `s-${idx}-${Date.now()}`,
        course_id: `local-${Date.now()}`,
        user_id: 'demo-user-id',
        day: s.day,
        start_time: s.start_time,
        end_time: s.end_time,
        room: s.room || '',
        created_at: new Date().toISOString(),
      })),
      partials: [],
    }
    MOCK_COURSES.push(newCourse)
    revalidatePath('/dashboard')
    revalidatePath('/courses')
    return newCourse
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) throw new Error('No estás autenticado')

  const { data: course, error: courseError } = await supabase
    .from('courses')
    .insert({
      ...courseData,
      user_id: user.id,
    })
    .select()
    .single()

  if (courseError) {
    throw new Error(courseError.message)
  }

  if (schedules.length > 0) {
    const schedulesToInsert = schedules.map((s) => ({
      course_id: course.id,
      user_id: user.id,
      day: s.day,
      start_time: s.start_time,
      end_time: s.end_time,
      room: s.room || '',
    }))

    const { error: schedError } = await supabase
      .from('schedules')
      .insert(schedulesToInsert)

    if (schedError) {
      console.error('Error inserting schedules:', schedError)
    }
  }

  revalidatePath('/dashboard')
  revalidatePath('/courses')
  revalidatePath('/calculator')
  revalidatePath('/stats')

  return course
}

export async function updateCourse(
  courseId: string,
  courseData: Partial<CourseInsert>,
  schedules?: Omit<ScheduleInsert, 'course_id'>[]
) {
  const isSupabaseConfigured =
    Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL) &&
    !process.env.NEXT_PUBLIC_SUPABASE_URL?.includes('placeholder.supabase.co')

  if (!isSupabaseConfigured) {
    const idx = MOCK_COURSES.findIndex((c) => c.id === courseId)
    if (idx !== -1 && MOCK_COURSES[idx]) {
      MOCK_COURSES[idx] = {
        ...MOCK_COURSES[idx],
        ...courseData,
        schedules: schedules
          ? schedules.map((s, sIdx) => ({
              id: `s-${sIdx}-${Date.now()}`,
              course_id: courseId,
              user_id: 'demo-user-id',
              day: s.day,
              start_time: s.start_time,
              end_time: s.end_time,
              room: s.room || '',
              created_at: new Date().toISOString(),
            }))
          : MOCK_COURSES[idx].schedules,
      }
    }
    revalidatePath('/dashboard')
    revalidatePath('/courses')
    return
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) throw new Error('No estás autenticado')

  const { error: courseError } = await supabase
    .from('courses')
    .update(courseData)
    .eq('id', courseId)
    .eq('user_id', user.id)

  if (courseError) {
    throw new Error(courseError.message)
  }

  if (schedules !== undefined) {
    await supabase.from('schedules').delete().eq('course_id', courseId).eq('user_id', user.id)

    if (schedules.length > 0) {
      const schedulesToInsert = schedules.map((s) => ({
        course_id: courseId,
        user_id: user.id,
        day: s.day,
        start_time: s.start_time,
        end_time: s.end_time,
        room: s.room || '',
      }))

      await supabase.from('schedules').insert(schedulesToInsert)
    }
  }

  revalidatePath('/dashboard')
  revalidatePath('/courses')
  revalidatePath('/calculator')
  revalidatePath('/stats')
}

export async function deleteCourse(courseId: string) {
  const isSupabaseConfigured =
    Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL) &&
    !process.env.NEXT_PUBLIC_SUPABASE_URL?.includes('placeholder.supabase.co')

  if (!isSupabaseConfigured) {
    const idx = MOCK_COURSES.findIndex((c) => c.id === courseId)
    if (idx !== -1) {
      MOCK_COURSES.splice(idx, 1)
    }
    revalidatePath('/dashboard')
    revalidatePath('/courses')
    return
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) throw new Error('No estás autenticado')

  const { error } = await supabase
    .from('courses')
    .delete()
    .eq('id', courseId)
    .eq('user_id', user.id)

  if (error) {
    throw new Error(error.message)
  }

  revalidatePath('/dashboard')
  revalidatePath('/courses')
  revalidatePath('/calculator')
  revalidatePath('/stats')
}

export async function duplicateCourse(courseId: string) {
  const isSupabaseConfigured =
    Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL) &&
    !process.env.NEXT_PUBLIC_SUPABASE_URL?.includes('placeholder.supabase.co')

  if (!isSupabaseConfigured) {
    const original = MOCK_COURSES.find((c) => c.id === courseId)
    if (!original) return null
    const dup: CourseWithDetails = {
      ...original,
      id: `local-${Date.now()}`,
      code: `${original.code}C`,
      name: `${original.name} (Copia)`,
      partials: [],
    }
    MOCK_COURSES.push(dup)
    revalidatePath('/dashboard')
    revalidatePath('/courses')
    return dup
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) throw new Error('No estás autenticado')

  const { data: original } = await supabase
    .from('courses')
    .select('*, schedules(*), partials(*)')
    .eq('id', courseId)
    .eq('user_id', user.id)
    .single()

  if (!original) throw new Error('Materia no encontrada')

  const { data: newCourse, error: createError } = await supabase
    .from('courses')
    .insert({
      user_id: user.id,
      code: `${original.code}C`,
      name: `${original.name} (Copia)`,
      professor: original.professor,
      email: original.email,
      faculty: original.faculty,
      semester: original.semester,
      credits: original.credits,
      status: original.status,
      notes: original.notes,
      color: original.color,
    })
    .select()
    .single()

  if (createError) throw new Error(createError.message)

  if (original.schedules && original.schedules.length > 0) {
    await supabase.from('schedules').insert(
      original.schedules.map((s: any) => ({
        course_id: newCourse.id,
        user_id: user.id,
        day: s.day,
        start_time: s.start_time,
        end_time: s.end_time,
        room: s.room,
      }))
    )
  }

  revalidatePath('/dashboard')
  revalidatePath('/courses')
  return newCourse
}
