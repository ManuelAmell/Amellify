'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import type { DayOfWeek } from '@/types/database'

export async function updateScheduleSlot(
  scheduleId: string,
  updates: {
    day?: DayOfWeek
    start_time?: string
    end_time?: string
    room?: string
  }
) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) throw new Error('No estás autenticado')

  const { error } = await supabase
    .from('schedules')
    .update(updates)
    .eq('id', scheduleId)
    .eq('user_id', user.id)

  if (error) {
    throw new Error(error.message)
  }

  revalidatePath('/dashboard')
  revalidatePath('/courses')
}

export async function addScheduleSlot(
  courseId: string,
  slot: {
    day: DayOfWeek
    start_time: string
    end_time: string
    room?: string
  }
) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) throw new Error('No estás autenticado')

  const { data, error } = await supabase
    .from('schedules')
    .insert({
      course_id: courseId,
      user_id: user.id,
      day: slot.day,
      start_time: slot.start_time,
      end_time: slot.end_time,
      room: slot.room || '',
    })
    .select()
    .single()

  if (error) throw new Error(error.message)

  revalidatePath('/dashboard')
  revalidatePath('/courses')
  return data
}

export async function deleteScheduleSlot(scheduleId: string) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) throw new Error('No estás autenticado')

  const { error } = await supabase
    .from('schedules')
    .delete()
    .eq('id', scheduleId)
    .eq('user_id', user.id)

  if (error) throw new Error(error.message)

  revalidatePath('/dashboard')
  revalidatePath('/courses')
}
