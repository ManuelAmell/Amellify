'use client'

import * as React from 'react'
import { getNextClass, formatDisplayTime, type NextClassInfo } from '@/lib/utils/time'
import type { CourseWithDetails } from '@/types/database'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Clock, MapPin, User, Sparkles, CheckCircle2 } from 'lucide-react'

interface NextClassHeroProps {
  courses: CourseWithDetails[]
  timeFormat24h?: boolean
}

export function NextClassHero({ courses, timeFormat24h = true }: NextClassHeroProps) {
  const [nextInfo, setNextInfo] = React.useState<NextClassInfo | null>(null)
  const [countdownStr, setCountdownStr] = React.useState<string>('')

  React.useEffect(() => {
    const update = () => {
      const info = getNextClass(courses)
      setNextInfo(info)

      if (info) {
        const totalSeconds = Math.floor(info.timeUntilMs / 1000)
        const days = Math.floor(totalSeconds / (3600 * 24))
        const hours = Math.floor((totalSeconds % (3600 * 24)) / 3600)
        const minutes = Math.floor((totalSeconds % 3600) / 60)
        const seconds = totalSeconds % 60

        if (info.isLive) {
          setCountdownStr('¡En curso ahora!')
        } else if (days > 0) {
          setCountdownStr(`En ${days}d ${hours}h ${minutes}m`)
        } else if (hours > 0) {
          setCountdownStr(`En ${hours}h ${minutes}m ${seconds}s`)
        } else {
          setCountdownStr(`En ${minutes}m ${seconds}s`)
        }
      } else {
        setCountdownStr('')
      }
    }

    update()
    const interval = setInterval(update, 1000)
    return () => clearInterval(interval)
  }, [courses])

  if (!nextInfo) {
    return (
      <Card className="glass-panel border-border/60 shadow-sm overflow-hidden bg-gradient-to-r from-muted/30 via-background to-muted/30">
        <CardContent className="p-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm font-semibold">Sin clases pendientes</p>
              <p className="text-xs text-muted-foreground">
                No tienes más clases programadas para esta semana.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    )
  }

  const { course, schedule, isLive } = nextInfo

  return (
    <Card
      className={`glass-panel overflow-hidden border shadow-sm transition-all duration-200 ${
        isLive
          ? 'border-emerald-500/50 bg-emerald-500/5 shadow-emerald-500/10'
          : 'border-primary/30 bg-primary/5'
      }`}
    >
      <CardContent className="p-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Badge
                variant={isLive ? 'success' : 'default'}
                className="text-[11px] font-medium tracking-wide uppercase px-2 py-0.5 animate-pulse-subtle"
              >
                {isLive ? '🔴 Clase en Vivo' : 'Próxima Clase'}
              </Badge>
              <span className="text-xs font-mono text-muted-foreground font-semibold">
                [{course.code}]
              </span>
            </div>

            <h2 className="text-lg sm:text-xl font-bold tracking-tight text-foreground">
              {course.name}
            </h2>

            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground pt-1">
              <span className="flex items-center gap-1 font-medium text-foreground">
                <Clock className="h-3.5 w-3.5 text-primary" />
                {schedule.day}{' '}
                {formatDisplayTime(schedule.startTime, timeFormat24h)} -{' '}
                {formatDisplayTime(schedule.endTime, timeFormat24h)}
              </span>

              {schedule.room && (
                <span className="flex items-center gap-1 font-medium text-foreground">
                  <MapPin className="h-3.5 w-3.5 text-accent" />
                  Salón {schedule.room}
                </span>
              )}

              {course.professor && (
                <span className="flex items-center gap-1">
                  <User className="h-3.5 w-3.5" />
                  {course.professor}
                </span>
              )}
            </div>
          </div>

          {/* Countdown Display */}
          <div className="sm:text-right shrink-0 border-t sm:border-t-0 pt-2 sm:pt-0 border-border/40">
            <span className="text-[11px] text-muted-foreground block font-medium">
              {isLive ? 'Estado' : 'Comienza en'}
            </span>
            <span className="text-lg sm:text-xl font-mono font-bold text-primary tracking-tight">
              {countdownStr}
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
