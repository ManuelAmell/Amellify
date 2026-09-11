import type {
  Course as DomainCourse,
  CourseStatus,
  CourseWithDetails as DomainCourseWithDetails,
  DayOfWeek,
  PartialGrade as DomainPartialGrade,
  Schedule as DomainSchedule,
  SubjectColor,
  UserPreferences,
  UserProfile,
} from './domain'

export type { CourseStatus, DayOfWeek, SubjectColor, UserPreferences }

export interface Profile extends UserProfile {
  display_name?: string | null
  avatar_url?: string | null
  current_semester?: string
  passing_grade?: number
  max_grade?: number
}

export interface Schedule extends DomainSchedule {
  start_time?: string
  end_time?: string
  course_id?: string
  user_id?: string
}

export interface PartialGrade extends DomainPartialGrade {
  course_id?: string
  user_id?: string
  sort_order?: number
}

export interface Course extends DomainCourse {
  user_id?: string
  sort_order?: number
  created_at?: string
  updated_at?: string
}

export interface CourseWithDetails extends DomainCourseWithDetails {
  user_id?: string
  sort_order?: number
  created_at?: string
  updated_at?: string
  schedules: any[]
  partials: any[]
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
  course_id?: string
  courseId?: string
  day: DayOfWeek
  start_time: string
  startTime?: string
  end_time: string
  endTime?: string
  room?: string
}

export interface PartialInsert {
  course_id?: string
  courseId?: string
  name: string
  grade?: number | null
  percent: number
  sort_order?: number
  sortOrder?: number
}
