export type SubjectColor = 'blue' | 'red' | 'green' | 'orange' | 'purple' | 'teal'
export type CourseStatus = 'active' | 'paused' | 'completed' | 'dropped'
export type DayOfWeek = 'Lunes' | 'Martes' | 'Miércoles' | 'Jueves' | 'Viernes' | 'Sábado' | 'Domingo'

export interface UserPreferences {
  theme: 'light' | 'dark' | 'system'
  fontSize: 'small' | 'normal' | 'large'
  gridCompact: boolean
  weekStartsOn: 'monday' | 'sunday'
  timeFormat24h: boolean
  defaultView: 'grid' | 'week' | 'list' | 'calc' | 'stats'
}

export interface Profile {
  id: string
  display_name: string | null
  avatar_url: string | null
  university: string
  faculty: string
  current_semester: string
  passing_grade: number
  max_grade: number
  preferences: UserPreferences
  created_at: string
  updated_at: string
}

export interface Course {
  id: string
  user_id: string
  code: string
  name: string
  professor: string
  email: string
  faculty: string
  semester: string
  credits: number
  status: CourseStatus
  notes: string
  color: SubjectColor
  sort_order: number
  created_at: string
  updated_at: string
}

export interface Schedule {
  id: string
  course_id: string
  user_id: string
  day: DayOfWeek
  start_time: string // HH:mm:ss or HH:mm
  end_time: string
  room: string
  created_at: string
}

export interface PartialGrade {
  id: string
  course_id: string
  user_id: string
  name: string
  grade: number | null
  percent: number
  sort_order: number
  created_at: string
}

export interface CourseWithDetails extends Course {
  schedules: Schedule[]
  partials: PartialGrade[]
}

export interface CourseInsert {
  code: string
  name: string
  professor?: string
  email?: string
  faculty?: string
  semester?: string
  credits?: number
  status?: CourseStatus
  notes?: string
  color?: SubjectColor
  sort_order?: number
}

export interface ScheduleInsert {
  course_id: string
  day: DayOfWeek
  start_time: string
  end_time: string
  room?: string
}

export interface PartialInsert {
  course_id: string
  name: string
  grade?: number | null
  percent: number
  sort_order?: number
}
