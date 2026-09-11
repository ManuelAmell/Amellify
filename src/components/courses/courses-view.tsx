'use client'

import * as React from 'react'
import { useSearchParams } from 'next/navigation'
import type { CourseWithDetails, CourseStatus, SubjectColor } from '@/types/database'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { CourseDialog } from '@/components/courses/course-dialog'
import {
  Plus,
  Search,
  BookOpen,
  User,
  Clock,
  MapPin,
  Copy,
  Edit2,
  Trash2,
  Download,
  Filter,
  Layers,
} from 'lucide-react'
import { duplicateCourse, deleteCourse } from '@/lib/actions/courses'
import { generateICS } from '@/lib/ics-export'
import { formatDisplayTime } from '@/lib/utils/time'
import { SUBJECT_COLOR_CLASSES } from '@/config/subject-colors'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'

interface CoursesViewProps {
  initialCourses: CourseWithDetails[]
  timeFormat24h?: boolean
}

export function CoursesView({ initialCourses, timeFormat24h = true }: CoursesViewProps) {
  const searchParams = useSearchParams()
  const deepLinkCourseId = searchParams.get('course')

  const [courses, setCourses] = React.useState<CourseWithDetails[]>(initialCourses)
  const [searchQuery, setSearchQuery] = React.useState('')
  const [statusFilter, setStatusFilter] = React.useState<string>('all')
  const [semesterFilter, setSemesterFilter] = React.useState<string>('all')
  const [selectedCourse, setSelectedCourse] = React.useState<CourseWithDetails | null>(null)
  const [dialogOpen, setDialogOpen] = React.useState(false)

  // State for delete confirmation alert dialog
  const [courseToDelete, setCourseToDelete] = React.useState<CourseWithDetails | null>(null)
  const [isDeleting, setIsDeleting] = React.useState(false)
  const [isDuplicating, setIsDuplicating] = React.useState<string | null>(null)

  // Highlighted course from deep-link
  const [highlightedId, setHighlightedId] = React.useState<string | null>(null)

  React.useEffect(() => {
    setCourses(initialCourses)
  }, [initialCourses])

  // Handle deep link ?course=id on mount / param change
  React.useEffect(() => {
    if (!deepLinkCourseId) return

    const matched = courses.find((c) => c.id === deepLinkCourseId)
    if (matched) {
      setHighlightedId(matched.id)
      setSelectedCourse(matched)
      setDialogOpen(true)

      // Smooth scroll to card
      setTimeout(() => {
        const el = document.getElementById(`course-card-${matched.id}`)
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'center' })
        }
      }, 300)
    }
  }, [deepLinkCourseId, courses])

  // Extract unique semesters for filter
  const availableSemesters = React.useMemo(() => {
    const sems = new Set<string>()
    for (const c of courses) {
      if (c.semester && c.semester.trim() !== '') {
        sems.add(c.semester.trim())
      }
    }
    return Array.from(sems).sort()
  }, [courses])

  const filteredCourses = React.useMemo(() => {
    return courses.filter((c) => {
      const q = searchQuery.toLowerCase().trim()
      const matchesSearch =
        !q ||
        c.name.toLowerCase().includes(q) ||
        c.code.toLowerCase().includes(q) ||
        (c.professor && c.professor.toLowerCase().includes(q)) ||
        (c.faculty && c.faculty.toLowerCase().includes(q)) ||
        (c.semester && c.semester.toLowerCase().includes(q))

      const matchesStatus = statusFilter === 'all' || c.status === statusFilter
      const matchesSemester = semesterFilter === 'all' || c.semester === semesterFilter

      return matchesSearch && matchesStatus && matchesSemester
    })
  }, [courses, searchQuery, statusFilter, semesterFilter])

  // Optimistic duplication
  const handleDuplicate = async (courseId: string) => {
    try {
      setIsDuplicating(courseId)
      const res = await duplicateCourse(courseId)
      if (!res.ok) {
        toast.error(res.error || 'Error al duplicar la materia')
        return
      }

      setCourses((prev) => [res.data, ...prev])
      toast.success('Materia duplicada con éxito')
    } catch (err: any) {
      toast.error(err.message || 'Error al duplicar la materia')
    } finally {
      setIsDuplicating(null)
    }
  }

  // Trigger delete alert dialog
  const promptDelete = (course: CourseWithDetails) => {
    setCourseToDelete(course)
  }

  // Confirm delete with optimistic state update
  const confirmDelete = async () => {
    if (!courseToDelete) return

    const targetCourse = courseToDelete
    setCourseToDelete(null)
    setIsDeleting(true)

    // Optimistic removal
    const previousCourses = courses
    setCourses((prev) => prev.filter((c) => c.id !== targetCourse.id))

    try {
      const res = await deleteCourse(targetCourse.id)
      if (!res.ok) {
        // Revert on error
        setCourses(previousCourses)
        toast.error(res.error || 'No fue posible eliminar la materia')
        return
      }
      toast.success(`Materia "${targetCourse.name}" eliminada`)
    } catch (err: any) {
      setCourses(previousCourses)
      toast.error(err.message || 'Error al eliminar la materia')
    } finally {
      setIsDeleting(false)
    }
  }

  const handleExportICS = () => {
    try {
      const icsData = generateICS(courses)
      const blob = new Blob([icsData], { type: 'text/calendar;charset=utf-8' })
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.setAttribute('download', 'horario_amellify.ics')
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      toast.success('Horario exportado en formato .ics')
    } catch {
      toast.error('Error al generar el archivo de calendario')
    }
  }

  const statusConfig: Record<
    CourseStatus,
    { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' | 'success' | 'warning' }
  > = {
    active: { label: 'Activa', variant: 'success' },
    paused: { label: 'Pausada', variant: 'warning' },
    completed: { label: 'Completada', variant: 'secondary' },
    dropped: { label: 'Retirada', variant: 'destructive' },
  }

  return (
    <div className="space-y-6">
      {/* Header & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <BookOpen className="h-6 w-6 text-primary" />
            Lista de Materias
          </h2>
          <p className="text-xs text-muted-foreground mt-1">
            Administra tus asignaturas, créditos, docentes y horarios semanales con Liquid Glass.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleExportICS}
            className="glass-inset flex items-center gap-1.5 text-xs cursor-pointer"
          >
            <Download className="h-4 w-4 text-primary" />
            Exportar ICS
          </Button>

          <Button
            size="sm"
            onClick={() => {
              setSelectedCourse(null)
              setDialogOpen(true)
            }}
            className="flex items-center gap-1.5 text-xs shadow-sm cursor-pointer"
          >
            <Plus className="h-4 w-4" />
            Nueva Materia
          </Button>
        </div>
      </div>

      {/* Filters Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
        <div className="relative sm:col-span-6 lg:col-span-7">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por nombre, código, profesor o facultad..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 h-9 text-xs glass-inset"
          />
        </div>

        {/* Status Filter */}
        <div className="sm:col-span-3 lg:col-span-3">
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="h-9 text-xs glass-inset">
              <Filter className="h-3.5 w-3.5 mr-1.5 text-muted-foreground" />
              <SelectValue placeholder="Estado" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos los estados</SelectItem>
              <SelectItem value="active">Activas</SelectItem>
              <SelectItem value="paused">Pausadas</SelectItem>
              <SelectItem value="completed">Completadas</SelectItem>
              <SelectItem value="dropped">Retiradas</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Semester Filter */}
        <div className="sm:col-span-3 lg:col-span-2">
          <Select value={semesterFilter} onValueChange={setSemesterFilter}>
            <SelectTrigger className="h-9 text-xs glass-inset">
              <Layers className="h-3.5 w-3.5 mr-1.5 text-muted-foreground" />
              <SelectValue placeholder="Semestre" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos los semestres</SelectItem>
              {availableSemesters.map((sem) => (
                <SelectItem key={sem} value={sem}>
                  {sem}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Courses Cards Grid */}
      {filteredCourses.length === 0 ? (
        <Card className="glass-card border-dashed p-10 text-center">
          <CardContent className="space-y-3 p-0">
            <BookOpen className="h-10 w-10 text-muted-foreground mx-auto opacity-50" />
            <p className="text-sm font-semibold">No se encontraron materias</p>
            <p className="text-xs text-muted-foreground max-w-sm mx-auto">
              {searchQuery || statusFilter !== 'all' || semesterFilter !== 'all'
                ? 'Intenta con otro término de búsqueda o restablece los filtros.'
                : 'Empieza agregando tu primera materia o importa tu horario con IA.'}
            </p>
            <Button
              onClick={() => {
                setSelectedCourse(null)
                setDialogOpen(true)
              }}
              size="sm"
              className="mt-2 text-xs"
            >
              <Plus className="h-4 w-4 mr-1" />
              Agregar Materia
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredCourses.map((course) => {
            const colorKey = (course.color as SubjectColor) || 'blue'
            const colorClass = SUBJECT_COLOR_CLASSES[colorKey] || 'subject-blue'
            const isHighlighted = highlightedId === course.id
            const statusInfo = statusConfig[course.status] || {
              label: course.status,
              variant: 'default',
            }

            return (
              <div
                key={course.id}
                id={`course-card-${course.id}`}
                className={cn(
                  'glass-card rounded-2xl transition-all duration-200 overflow-hidden flex flex-col justify-between',
                  isHighlighted &&
                    'ring-2 ring-primary ring-offset-2 ring-offset-background shadow-lg scale-[1.01]'
                )}
              >
                <CardHeader className="p-4 pb-2 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    {/* Tinted-glass subject chip with code */}
                    <div
                      className={cn(
                        'subject-chip flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-mono font-bold tracking-tight',
                        colorClass
                      )}
                    >
                      <span className={cn('subject-dot h-2 w-2 rounded-full', colorClass)} />
                      <span>{course.code}</span>
                    </div>

                    <Badge variant={statusInfo.variant} className="text-[10px] capitalize">
                      {statusInfo.label}
                    </Badge>
                  </div>

                  <div>
                    <CardTitle className="text-base font-bold line-clamp-1 text-foreground">
                      {course.name}
                    </CardTitle>
                    {(course.faculty || course.semester) && (
                      <CardDescription className="text-[11px] truncate mt-0.5">
                        {course.faculty}
                        {course.faculty && course.semester ? ' · ' : ''}
                        {course.semester ? `Semestre ${course.semester}` : ''}
                      </CardDescription>
                    )}
                  </div>
                </CardHeader>

                <CardContent className="p-4 pt-1 space-y-3 flex-1">
                  {/* Professor */}
                  {course.professor ? (
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <User className="h-3.5 w-3.5 text-primary shrink-0" />
                      <span className="truncate">{course.professor}</span>
                    </div>
                  ) : (
                    <div className="text-[11px] text-muted-foreground/60 italic">
                      Sin docente asignado
                    </div>
                  )}

                  {/* Schedules list */}
                  <div className="space-y-1 pt-1 border-t border-border/40">
                    <span className="text-[10px] font-semibold uppercase text-muted-foreground block">
                      Horarios ({course.schedules.length})
                    </span>
                    {course.schedules.length === 0 ? (
                      <span className="text-xs text-muted-foreground/70 italic">
                        Sin horario registrado
                      </span>
                    ) : (
                      course.schedules.map((s, idx) => (
                        <div
                          key={s.id || idx}
                          className="flex items-center justify-between text-xs text-muted-foreground glass-inset px-2.5 py-1 rounded-lg"
                        >
                          <span className="font-medium text-foreground">{s.day}</span>
                          <span className="font-mono text-[11px]">
                            {formatDisplayTime(s.start_time ?? s.startTime, timeFormat24h)} -{' '}
                            {formatDisplayTime(s.end_time ?? s.endTime, timeFormat24h)}
                          </span>
                          {s.room ? (
                            <span className="flex items-center gap-0.5 text-accent font-medium text-[11px]">
                              <MapPin className="h-3 w-3" />
                              {s.room}
                            </span>
                          ) : null}
                        </div>
                      ))
                    )}
                  </div>
                </CardContent>

                {/* Actions Footer */}
                <div className="p-3 glass-inset border-t border-border/40 flex items-center justify-between">
                  <span className="text-xs text-muted-foreground font-medium">
                    {course.credits} {course.credits === 1 ? 'crédito' : 'créditos'}
                  </span>

                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      disabled={isDuplicating === course.id}
                      onClick={() => handleDuplicate(course.id)}
                      className="h-7 w-7 text-muted-foreground hover:text-foreground cursor-pointer"
                      title="Duplicar materia"
                    >
                      <Copy className="h-3.5 w-3.5" />
                    </Button>

                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => {
                        setSelectedCourse(course)
                        setDialogOpen(true)
                      }}
                      className="h-7 w-7 text-primary hover:text-primary hover:bg-primary/10 cursor-pointer"
                      title="Editar materia"
                    >
                      <Edit2 className="h-3.5 w-3.5" />
                    </Button>

                    <Button
                      variant="ghost"
                      size="icon"
                      disabled={isDeleting}
                      onClick={() => promptDelete(course)}
                      className="h-7 w-7 text-destructive hover:text-destructive hover:bg-destructive/10 cursor-pointer"
                      title="Eliminar materia"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Course Create/Edit Modal */}
      <CourseDialog
        open={dialogOpen}
        onOpenChange={(open) => {
          setDialogOpen(open)
          if (!open) {
            setHighlightedId(null)
          }
        }}
        initialCourse={selectedCourse}
      />

      {/* Accessible AlertDialog for Course Deletion */}
      <AlertDialog
        open={courseToDelete !== null}
        onOpenChange={(open) => {
          if (!open) setCourseToDelete(null)
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-destructive">
              <Trash2 className="h-5 w-5" />
              ¿Eliminar materia?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-xs leading-relaxed">
              Estás a punto de eliminar definitivamente la materia{' '}
              <strong className="text-foreground">{courseToDelete?.name}</strong>{' '}
              ({courseToDelete?.code}). Esto también eliminará permanentemente todos sus horarios y
              notas parciales asociadas. Esta acción no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Sí, eliminar materia
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
