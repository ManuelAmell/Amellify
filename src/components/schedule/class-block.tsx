'use client'

import * as React from 'react'
import type { CourseWithDetails, Schedule } from '@/types/database'
import { formatDisplayTime } from '@/lib/utils/time'
import { MapPin, User } from 'lucide-react'
import { cn } from '@/lib/utils'

interface ClassBlockProps {
  course: CourseWithDetails
  schedule: Schedule
  topPx: number
  heightPx: number
  timeFormat24h?: boolean
  onClick?: () => void
}

export function ClassBlock({
  course,
  schedule,
  topPx,
  heightPx,
  timeFormat24h = true,
  onClick,
}: ClassBlockProps) {
  const colorKey = course.color || 'blue'

  const colorStyles: Record<string, string> = {
    blue: 'bg-[var(--sub-blue-bg)] text-[var(--sub-blue-text)] border-[var(--sub-blue-border)]',
    red: 'bg-[var(--sub-red-bg)] text-[var(--sub-red-text)] border-[var(--sub-red-border)]',
    green: 'bg-[var(--sub-green-bg)] text-[var(--sub-green-text)] border-[var(--sub-green-border)]',
    orange: 'bg-[var(--sub-orange-bg)] text-[var(--sub-orange-text)] border-[var(--sub-orange-border)]',
    purple: 'bg-[var(--sub-purple-bg)] text-[var(--sub-purple-text)] border-[var(--sub-purple-border)]',
    teal: 'bg-[var(--sub-teal-bg)] text-[var(--sub-teal-text)] border-[var(--sub-teal-border)]',
  }

  const isCompact = heightPx < 50

  return (
    <div
      onClick={onClick}
      style={{
        top: `${topPx}px`,
        height: `${Math.max(28, heightPx)}px`,
      }}
      className={cn(
        'absolute left-1 right-1 z-10 rounded-lg border p-2 overflow-hidden cursor-pointer transition-all duration-150',
        'shadow-xs hover:shadow-md hover:brightness-105 active:scale-[0.99] select-none',
        colorStyles[colorKey] || colorStyles.blue
      )}
    >
      <div className="flex flex-col h-full justify-between overflow-hidden">
        {/* Header: Code & Time */}
        <div className="flex items-center justify-between gap-1 leading-tight">
          <span className="font-bold text-[11px] truncate tracking-tight">
            {course.code}
          </span>
          <span className="text-[10px] opacity-80 shrink-0 font-medium font-mono">
            {formatDisplayTime(schedule.start_time ?? schedule.startTime ?? '', timeFormat24h)}
          </span>
        </div>

        {/* Title */}
        {!isCompact && (
          <p className="font-semibold text-xs leading-snug line-clamp-2 mt-0.5">
            {course.name}
          </p>
        )}

        {/* Footer info: Room & Professor */}
        {!isCompact && heightPx >= 70 && (
          <div className="flex items-center justify-between gap-1 text-[10px] opacity-85 pt-1 border-t border-current/15 mt-auto">
            {schedule.room ? (
              <span className="flex items-center gap-0.5 truncate font-medium">
                <MapPin className="h-3 w-3 shrink-0" />
                {schedule.room}
              </span>
            ) : <span />}

            {course.professor && (
              <span className="flex items-center gap-0.5 truncate opacity-75">
                <User className="h-3 w-3 shrink-0" />
                {course.professor.split(' ')[0]}
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
