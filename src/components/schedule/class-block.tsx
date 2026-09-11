'use client'

import * as React from 'react'
import type { CourseWithDetails, Schedule } from '@/types/database'
import type { SubjectColor } from '@/types/domain'
import { formatDisplayTime } from '@/lib/utils/time'
import { SUBJECT_COLOR_CLASSES } from '@/config/subject-colors'
import { MapPin, User } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface ClassBlockProps {
  course: CourseWithDetails
  schedule: Schedule
  topPx: number
  heightPx: number
  lane?: number
  laneCount?: number
  timeFormat24h?: boolean
  onClick?: () => void
}

export function ClassBlock({
  course,
  schedule,
  topPx,
  heightPx,
  lane = 0,
  laneCount = 1,
  timeFormat24h = true,
  onClick,
}: ClassBlockProps) {
  const colorKey = (course.color || 'blue') as SubjectColor
  const colorClass = SUBJECT_COLOR_CLASSES[colorKey] || 'subject-blue'

  const startTime = schedule.startTime ?? schedule.start_time ?? ''
  const endTime = schedule.endTime ?? schedule.end_time ?? ''
  const startStr = formatDisplayTime(startTime, timeFormat24h)
  const endStr = formatDisplayTime(endTime, timeFormat24h)
  const roomStr = schedule.room ? `, Salón ${schedule.room}` : ''
  const ariaLabel = `${course.name}, ${schedule.day} ${startStr} a ${endStr}${roomStr}`

  const isMultiLane = laneCount > 1
  const widthPercent = 100 / laneCount
  const leftPercent = lane * widthPercent

  const isCompact = heightPx < 50
  const isVeryCompact = heightPx < 38
  // A lane shared with another overlapping block (plan H2 packing) only
  // gets ~50%/33%/... of the column's width — room+professor icons and
  // text sliced down to 1-2 characters there read as broken, not compact,
  // so drop the footer row entirely rather than truncate it further.
  const isNarrow = laneCount > 1

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={ariaLabel}
      style={{
        top: `${topPx}px`,
        height: `${Math.max(28, heightPx)}px`,
        left: isMultiLane ? `calc(${leftPercent}% + 2px)` : '4px',
        width: isMultiLane ? `calc(${widthPercent}% - 4px)` : 'calc(100% - 8px)',
        background: 'color-mix(in oklch, var(--subject, var(--primary)) 20%, var(--glass-bg, rgba(255, 255, 255, 0.75)))',
        borderColor: 'color-mix(in oklch, var(--subject, var(--primary)) 45%, transparent)',
        boxShadow:
          'inset 0 1px 0 color-mix(in oklch, var(--subject, var(--primary)) 30%, white), 0 2px 8px -2px color-mix(in oklch, var(--subject, var(--primary)) 25%, transparent)',
      }}
      className={cn(
        'absolute z-10 group text-left rounded-xl border p-2 overflow-hidden transition-all duration-150 select-none cursor-pointer',
        'backdrop-blur-md hover:brightness-105 active:scale-[0.99]',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1',
        colorClass
      )}
    >
      <div className="flex flex-col h-full justify-between overflow-hidden">
        {/* Header: Code & Time. Narrow lanes stack instead of sharing one
            row — "ESTDAT" + "14:00" side by side has nowhere to truncate
            gracefully at 50%/33% column width. */}
        <div
          className={cn(
            'min-w-0 leading-tight',
            isNarrow ? 'flex flex-col items-start' : 'flex items-center justify-between gap-1'
          )}
        >
          <span className="w-full font-bold text-[11px] truncate tracking-tight text-foreground">
            {course.code}
          </span>
          <span className="shrink-0 font-medium font-mono text-[10px] text-foreground opacity-80">
            {startStr}
          </span>
        </div>

        {/* Title */}
        {!isVeryCompact && (
          <p
            className={cn(
              'font-semibold text-xs leading-snug text-foreground',
              isCompact ? 'truncate' : 'line-clamp-2 mt-0.5'
            )}
          >
            {course.name}
          </p>
        )}

        {/* Footer info: Room & Professor */}
        {!isCompact && !isNarrow && heightPx >= 68 && (
          <div className="flex items-center justify-between gap-1 text-[10px] text-muted-foreground pt-1 border-t border-current/15 mt-auto">
            {schedule.room ? (
              <span className="flex items-center gap-0.5 truncate font-medium text-foreground">
                <MapPin className="h-3 w-3 shrink-0 opacity-80" />
                {schedule.room}
              </span>
            ) : (
              <span />
            )}

            {course.professor && (
              <span className="flex items-center gap-0.5 truncate opacity-85">
                <User className="h-3 w-3 shrink-0" />
                {course.professor.split(' ')[0]}
              </span>
            )}
          </div>
        )}
      </div>
    </button>
  )
}
