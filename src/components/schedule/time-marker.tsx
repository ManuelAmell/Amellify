'use client'

import * as React from 'react'
import { SPANISH_DAY_TO_INDEX, JS_DAY_TO_SPANISH } from '@/lib/utils/time'
import type { DayOfWeek } from '@/types/database'

interface TimeMarkerProps {
  startHour?: number
  endHour?: number
  slotHeightPx?: number
  activeDays: DayOfWeek[]
}

export function TimeMarker({
  startHour = 6,
  endHour = 22,
  slotHeightPx = 48,
  activeDays,
}: TimeMarkerProps) {
  const [position, setPosition] = React.useState<{ top: number; dayIndex: number } | null>(null)

  React.useEffect(() => {
    const update = () => {
      const now = new Date()
      const currentDay = JS_DAY_TO_SPANISH[now.getDay()]
      if (!currentDay) {
        setPosition(null)
        return
      }

      const dayColIndex = activeDays.indexOf(currentDay)
      if (dayColIndex === -1) {
        setPosition(null)
        return
      }

      const hours = now.getHours()
      const minutes = now.getMinutes()
      const totalMinutes = hours * 60 + minutes
      const startMinutes = startHour * 60
      const endMinutes = endHour * 60

      if (totalMinutes < startMinutes || totalMinutes > endMinutes) {
        setPosition(null)
        return
      }

      const fraction = (totalMinutes - startMinutes) / 60
      const top = fraction * slotHeightPx

      setPosition({ top, dayIndex: dayColIndex })
    }

    update()
    const interval = setInterval(update, 60000)
    return () => clearInterval(interval)
  }, [startHour, endHour, slotHeightPx, activeDays])

  if (!position) return null

  return (
    <div
      style={{ top: `${position.top}px` }}
      className="absolute left-0 right-0 z-20 pointer-events-none flex items-center"
    >
      <div className="h-2 w-2 rounded-full bg-destructive shadow-sm -ml-1" />
      <div className="h-[2px] flex-1 bg-destructive/80 shadow-xs" />
    </div>
  )
}
