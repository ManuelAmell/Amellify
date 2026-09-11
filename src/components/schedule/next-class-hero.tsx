'use client'

import * as React from 'react'
import {
  getNextClass,
  formatDisplayTime,
  DEFAULT_TIMEZONE,
  type NextClassInfo,
} from '@/lib/utils/time'
import type { CourseWithDetails } from '@/types/database'
import type { SubjectColor } from '@/types/domain'
import { SUBJECT_COLOR_CLASSES } from '@/config/subject-colors'
import { Clock, MapPin, User, CheckCircle2 } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface NextClassHeroProps {
  courses: CourseWithDetails[]
  timeFormat24h?: boolean
  timezone?: string
}

function formatCountdown(info: NextClassInfo | null): string {
  if (!info) return ''
  if (info.isLive) return '¡En curso ahora!'

  const totalSeconds = Math.max(0, Math.floor(info.timeUntilMs / 1000))
  const days = Math.floor(totalSeconds / (3600 * 24))
  const hours = Math.floor((totalSeconds % (3600 * 24)) / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60

  if (days > 0) {
    return `En ${days}d ${hours}h ${minutes}m`
  }
  if (hours > 0) {
    return `En ${hours}h ${minutes}m ${seconds}s`
  }
  return `En ${minutes}m ${seconds}s`
}

export function NextClassHero({
  courses,
  timeFormat24h = true,
  timezone = DEFAULT_TIMEZONE,
}: NextClassHeroProps) {
  // Synchronous calculation during SSR to eliminate CLS (bug H3)
  const initialInfo = React.useMemo(() => getNextClass(courses, { timezone }), [courses, timezone])
  const [nextInfo, setNextInfo] = React.useState<NextClassInfo | null>(initialInfo)
  const [countdownStr, setCountdownStr] = React.useState<string>(() => formatCountdown(initialInfo))

  React.useEffect(() => {
    const update = () => {
      const info = getNextClass(courses, { timezone })
      setNextInfo(info)
      setCountdownStr(formatCountdown(info))
    }

    update()
    const interval = setInterval(update, 1000)
    return () => clearInterval(interval)
  }, [courses, timezone])

  if (!nextInfo) {
    return (
      <div className="glass-card rounded-2xl p-5 border border-border/50 shadow-xs relative overflow-hidden transition-all duration-300 min-h-[105px] flex items-center">
        <div className="flex items-center gap-4">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 shrink-0">
            <CheckCircle2 className="h-5 w-5" />
          </div>
          <div className="space-y-0.5">
            <h3 className="text-base font-semibold text-foreground tracking-tight">
              Sin clases pendientes
            </h3>
            <p className="text-xs text-muted-foreground">
              No tienes más clases programadas para esta semana. ¡Disfruta tu tiempo libre!
            </p>
          </div>
        </div>
      </div>
    )
  }

  const { course, schedule, isLive } = nextInfo
  const colorKey = (course.color || 'blue') as SubjectColor
  const colorClass = SUBJECT_COLOR_CLASSES[colorKey] || 'subject-blue'

  const startTime = schedule.startTime
  const endTime = schedule.endTime

  return (
    <div
      className={cn(
        'glass-card rounded-2xl p-5 border shadow-sm transition-all duration-300 relative overflow-hidden',
        colorClass
      )}
      style={{
        background: isLive
          ? 'color-mix(in oklch, var(--subject, var(--primary)) 16%, var(--glass-bg, rgba(255, 255, 255, 0.75)))'
          : 'color-mix(in oklch, var(--subject, var(--primary)) 10%, var(--glass-bg, rgba(255, 255, 255, 0.75)))',
        borderColor: 'color-mix(in oklch, var(--subject, var(--primary)) 40%, transparent)',
        boxShadow:
          'var(--glass-highlight), 0 12px 32px -10px color-mix(in oklch, var(--subject, var(--primary)) 25%, transparent)',
      }}
    >
      {/* Specular hairline reflection on top edge */}
      <div
        className="absolute top-0 left-0 right-0 h-[1.5px] pointer-events-none"
        style={{
          background:
            'linear-gradient(90deg, transparent, color-mix(in oklch, var(--subject, var(--primary)) 80%, white), transparent)',
        }}
      />

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1.5">
          <div className="flex items-center gap-2">
            {isLive ? (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold tracking-wide bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-500/30">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-rose-500" />
                </span>
                Clase en Vivo
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold tracking-wide subject-chip">
                <Clock className="h-3 w-3" />
                Próxima Clase
              </span>
            )}

            <span className="text-xs font-mono text-muted-foreground font-semibold">
              [{course.code}]
            </span>
          </div>

          <h2 className="text-lg sm:text-xl font-bold tracking-tight text-foreground">
            {course.name}
          </h2>

          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground pt-0.5">
            <span className="flex items-center gap-1 font-medium text-foreground">
              <Clock className="h-3.5 w-3.5 opacity-80" />
              {schedule.day} {formatDisplayTime(startTime, timeFormat24h)} -{' '}
              {formatDisplayTime(endTime, timeFormat24h)}
            </span>

            {schedule.room && (
              <span className="flex items-center gap-1 font-medium text-foreground">
                <MapPin className="h-3.5 w-3.5 opacity-80" />
                Salón {schedule.room}
              </span>
            )}

            {course.professor && (
              <span className="flex items-center gap-1">
                <User className="h-3.5 w-3.5 opacity-80" />
                {course.professor}
              </span>
            )}
          </div>
        </div>

        {/* Countdown Display */}
        <div className="sm:text-right shrink-0 border-t sm:border-t-0 pt-3 sm:pt-0 border-border/40">
          <span className="text-[11px] text-muted-foreground block font-medium">
            {isLive ? 'Estado' : 'Comienza en'}
          </span>
          <span
            suppressHydrationWarning
            className="text-lg sm:text-2xl font-mono font-bold tracking-tight"
            style={{ color: 'var(--subject, var(--primary))' }}
          >
            {countdownStr}
          </span>
        </div>
      </div>
    </div>
  )
}
