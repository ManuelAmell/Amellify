'use client'

import * as React from 'react'
import { JS_DAY_TO_SPANISH, DEFAULT_TIMEZONE, getZonedParts } from '@/lib/utils/time'
import type { DayOfWeek } from '@/types/database'

export interface TimeMarkerProps {
  startHour: number
  endHour: number
  slotHeightPx: number
  activeDays: DayOfWeek[]
  timezone?: string
}

export function TimeMarker({
  startHour = 6,
  endHour = 22,
  slotHeightPx = 56,
  activeDays,
  timezone = DEFAULT_TIMEZONE,
}: TimeMarkerProps) {
  const [markerState, setMarkerState] = React.useState<{
    top: number
    dayColIndex: number
  } | null>(null)

  React.useEffect(() => {
    const update = () => {
      const now = new Date()
      const { dayIndex, secondsOfDay } = getZonedParts(now, timezone)
      const currentSpanishDay = JS_DAY_TO_SPANISH[dayIndex]

      if (!currentSpanishDay) {
        setMarkerState(null)
        return
      }

      const dayColIndex = activeDays.indexOf(currentSpanishDay)
      if (dayColIndex === -1) {
        setMarkerState(null)
        return
      }

      const startSeconds = startHour * 3600
      const endSeconds = endHour * 3600

      if (secondsOfDay < startSeconds || secondsOfDay > endSeconds) {
        setMarkerState(null)
        return
      }

      const top = ((secondsOfDay - startSeconds) / 3600) * slotHeightPx
      setMarkerState({ top, dayColIndex })
    }

    update()
    const interval = setInterval(update, 30000)
    return () => clearInterval(interval)
  }, [startHour, endHour, slotHeightPx, activeDays, timezone])

  if (!markerState || activeDays.length === 0) return null

  const colWidthPercent = 100 / activeDays.length
  const leftPercent = markerState.dayColIndex * colWidthPercent

  return (
    <div
      style={{
        top: `${markerState.top}px`,
        left: `${leftPercent}%`,
        width: `${colWidthPercent}%`,
      }}
      className="absolute z-30 pointer-events-none flex items-center transition-all duration-300"
      aria-hidden="true"
    >
      {/* Glowing Pulsing Origin Dot */}
      <div className="relative flex items-center justify-center -ml-1.5 shrink-0">
        <span className="absolute h-3 w-3 rounded-full bg-rose-500/50 animate-ping" />
        <span className="h-2.5 w-2.5 rounded-full bg-rose-500 shadow-sm shadow-rose-500/80" />
      </div>

      {/* Laser line across the current day column */}
      <div className="h-[2px] flex-1 bg-gradient-to-r from-rose-500 via-rose-500/90 to-rose-500/40 shadow-xs" />
    </div>
  )
}
