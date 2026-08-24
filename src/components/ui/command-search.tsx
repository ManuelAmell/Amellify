'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Search, Calendar, BookOpen, Calculator, BarChart3, Settings, Clock, MapPin, User } from 'lucide-react'
import type { CourseWithDetails } from '@/types/database'

interface CommandSearchProps {
  courses: CourseWithDetails[]
}

export function CommandSearch({ courses }: CommandSearchProps) {
  const [open, setOpen] = React.useState(false)
  const [query, setQuery] = React.useState('')
  const router = useRouter()

  React.useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        setOpen((open) => !open)
      }
    }
    document.addEventListener('keydown', down)
    return () => document.removeEventListener('keydown', down)
  }, [])

  const filteredCourses = React.useMemo(() => {
    if (!query.trim()) return courses.slice(0, 5)
    const q = query.toLowerCase()
    return courses.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.code.toLowerCase().includes(q) ||
        c.professor.toLowerCase().includes(q) ||
        c.faculty.toLowerCase().includes(q) ||
        c.schedules.some((s) => s.room.toLowerCase().includes(q) || s.day.toLowerCase().includes(q))
    )
  }, [courses, query])

  const navigateTo = (href: string) => {
    setOpen(false)
    setQuery('')
    router.push(href)
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 rounded-lg border border-input bg-card/60 px-3 py-1.5 text-xs text-muted-foreground shadow-sm hover:bg-muted/80 transition-colors cursor-pointer w-48 sm:w-64 justify-between"
      >
        <div className="flex items-center gap-2">
          <Search className="h-3.5 w-3.5" />
          <span>Buscar materia, profesor...</span>
        </div>
        <kbd className="pointer-events-none hidden sm:inline-flex h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground opacity-100">
          <span className="text-xs">⌘</span>K
        </kbd>
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="p-0 overflow-hidden max-w-xl">
          <DialogTitle className="sr-only">Búsqueda rápida</DialogTitle>
          <DialogDescription className="sr-only">Busca materias, docentes y aulas</DialogDescription>
          <div className="flex items-center border-b px-3">
            <Search className="h-4 w-4 text-muted-foreground mr-2 shrink-0" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Escribe el nombre de la materia, código, docente o aula..."
              className="border-0 shadow-none focus-visible:ring-0 h-12 text-sm bg-transparent"
              autoFocus
            />
          </div>

          <div className="max-h-80 overflow-y-auto p-2 space-y-4">
            {/* Quick Navigation Pages */}
            {!query && (
              <div className="space-y-1">
                <p className="px-2 text-[11px] font-semibold text-muted-foreground uppercase">
                  Navegación
                </p>
                <div className="grid grid-cols-2 gap-1">
                  <button
                    onClick={() => navigateTo('/dashboard')}
                    className="flex items-center gap-2 w-full p-2 rounded-md hover:bg-muted text-xs text-left cursor-pointer"
                  >
                    <Calendar className="h-3.5 w-3.5 text-primary" />
                    <span>Horario Semanal</span>
                  </button>
                  <button
                    onClick={() => navigateTo('/courses')}
                    className="flex items-center gap-2 w-full p-2 rounded-md hover:bg-muted text-xs text-left cursor-pointer"
                  >
                    <BookOpen className="h-3.5 w-3.5 text-primary" />
                    <span>Lista de Materias</span>
                  </button>
                  <button
                    onClick={() => navigateTo('/calculator')}
                    className="flex items-center gap-2 w-full p-2 rounded-md hover:bg-muted text-xs text-left cursor-pointer"
                  >
                    <Calculator className="h-3.5 w-3.5 text-primary" />
                    <span>Calculadora de Notas</span>
                  </button>
                  <button
                    onClick={() => navigateTo('/stats')}
                    className="flex items-center gap-2 w-full p-2 rounded-md hover:bg-muted text-xs text-left cursor-pointer"
                  >
                    <BarChart3 className="h-3.5 w-3.5 text-primary" />
                    <span>Estadísticas</span>
                  </button>
                </div>
              </div>
            )}

            {/* Matching Courses */}
            <div className="space-y-1">
              <p className="px-2 text-[11px] font-semibold text-muted-foreground uppercase">
                {query ? 'Resultados' : 'Materias Recientes'}
              </p>
              {filteredCourses.length === 0 ? (
                <p className="p-4 text-center text-xs text-muted-foreground">
                  No se encontraron materias con "{query}"
                </p>
              ) : (
                filteredCourses.map((course) => (
                  <button
                    key={course.id}
                    onClick={() => navigateTo('/courses')}
                    className="flex items-center justify-between w-full p-2 rounded-md hover:bg-muted text-left transition-colors cursor-pointer group"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className={`h-2.5 w-2.5 rounded-full bg-subject-${course.color}-border shrink-0`} />
                      <div className="truncate">
                        <p className="text-xs font-semibold group-hover:text-primary transition-colors truncate">
                          <span className="font-mono text-muted-foreground mr-1.5">[{course.code}]</span>
                          {course.name}
                        </p>
                        <div className="flex items-center gap-3 text-[11px] text-muted-foreground mt-0.5">
                          {course.professor && (
                            <span className="flex items-center gap-1 truncate">
                              <User className="h-3 w-3" />
                              {course.professor}
                            </span>
                          )}
                          {course.schedules[0] && (
                            <span className="flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              {course.schedules[0].day} {course.schedules[0].start_time.substring(0, 5)}
                            </span>
                          )}
                          {course.schedules[0]?.room && (
                            <span className="flex items-center gap-1">
                              <MapPin className="h-3 w-3" />
                              {course.schedules[0].room}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
