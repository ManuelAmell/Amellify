'use client'

import * as React from 'react'
import type { CourseWithDetails, CourseStatus } from '@/types/database'
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
import { CourseDialog } from '@/components/courses/course-dialog'
import {
  Plus,
  Search,
  BookOpen,
  User,
  Clock,
  MapPin,
  Mail,
  Copy,
  Edit2,
  Trash2,
  Download,
  Filter,
} from 'lucide-react'
import { duplicateCourse, deleteCourse } from '@/lib/actions/courses'
import { generateICS } from '@/lib/ics-export'
import { formatDisplayTime } from '@/lib/utils/time'
import { toast } from 'sonner'

interface CoursesViewProps {
  initialCourses: CourseWithDetails[]
  timeFormat24h?: boolean
}

export function CoursesView({ initialCourses, timeFormat24h = true }: CoursesViewProps) {
  const [courses, setCourses] = React.useState<CourseWithDetails[]>(initialCourses)
  const [searchQuery, setSearchQuery] = React.useState('')
  const [statusFilter, setStatusFilter] = React.useState<string>('all')
  const [selectedCourse, setSelectedCourse] = React.useState<CourseWithDetails | null>(null)
  const [dialogOpen, setDialogOpen] = React.useState(false)

  React.useEffect(() => {
    setCourses(initialCourses)
  }, [initialCourses])

  const filteredCourses = React.useMemo(() => {
    return courses.filter((c) => {
      const matchesSearch =
        c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.professor.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.faculty.toLowerCase().includes(searchQuery.toLowerCase())

      const matchesStatus = statusFilter === 'all' || c.status === statusFilter

      return matchesSearch && matchesStatus
    })
  }, [courses, searchQuery, statusFilter])

  const handleDuplicate = async (courseId: string) => {
    try {
      await duplicateCourse(courseId)
      toast.success('Materia duplicada')
    } catch (err: any) {
      toast.error(err.message || 'Error al duplicar')
    }
  }

  const handleDelete = async (course: CourseWithDetails) => {
    if (confirm(`¿Eliminar definitivamente la materia ${course.name}?`)) {
      try {
        await deleteCourse(course.id)
        toast.success('Materia eliminada')
      } catch (err: any) {
        toast.error(err.message || 'Error al eliminar')
      }
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
    } catch (err: any) {
      toast.error('Error al generar el archivo de calendario')
    }
  }

  const statusLabels: Record<CourseStatus, { label: string; variant: any }> = {
    active: { label: 'Activa', variant: 'success' },
    paused: { label: 'En pausa', variant: 'outline' },
    completed: { label: 'Completada', variant: 'secondary' },
    dropped: { label: 'Cancelada', variant: 'destructive' },
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
            Administra tus asignaturas, profesores, salones y horarios semanales.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleExportICS}
            className="flex items-center gap-1.5 text-xs cursor-pointer"
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
            className="flex items-center gap-1.5 text-xs shadow-sm"
          >
            <Plus className="h-4 w-4" />
            Nueva Materia
          </Button>
        </div>
      </div>

      {/* Filters Bar */}
      <div className="flex flex-col sm:flex-row items-center gap-3">
        <div className="relative flex-1 w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por nombre, código, profesor o facultad..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 h-9 text-xs"
          />
        </div>

        <div className="w-full sm:w-44">
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="h-9 text-xs">
              <Filter className="h-3.5 w-3.5 mr-1.5 text-muted-foreground" />
              <SelectValue placeholder="Estado" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos los estados</SelectItem>
              <SelectItem value="active">Activas</SelectItem>
              <SelectItem value="paused">En pausa</SelectItem>
              <SelectItem value="completed">Completadas</SelectItem>
              <SelectItem value="dropped">Canceladas</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Courses Cards Grid */}
      {filteredCourses.length === 0 ? (
        <Card className="glass-panel border-dashed p-10 text-center">
          <CardContent className="space-y-3 p-0">
            <BookOpen className="h-10 w-10 text-muted-foreground mx-auto opacity-50" />
            <p className="text-sm font-semibold">No se encontraron materias</p>
            <p className="text-xs text-muted-foreground max-w-sm mx-auto">
              {searchQuery
                ? 'Intenta con otro término de búsqueda o limpia los filtros.'
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
          {filteredCourses.map((course) => (
            <Card
              key={course.id}
              className="glass-panel border-border/70 shadow-xs hover:shadow-md transition-all duration-200 overflow-hidden flex flex-col justify-between"
            >
              <CardHeader className="p-4 pb-2 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-mono text-xs font-bold px-2 py-0.5 rounded-md bg-muted text-muted-foreground">
                    {course.code}
                  </span>
                  <Badge variant={statusLabels[course.status]?.variant || 'default'} className="text-[10px]">
                    {statusLabels[course.status]?.label || course.status}
                  </Badge>
                </div>

                <div>
                  <CardTitle className="text-base font-bold line-clamp-1">
                    {course.name}
                  </CardTitle>
                  {course.faculty && (
                    <CardDescription className="text-[11px] truncate mt-0.5">
                      {course.faculty} {course.semester ? `· ${course.semester}` : ''}
                    </CardDescription>
                  )}
                </div>
              </CardHeader>

              <CardContent className="p-4 pt-1 space-y-3 flex-1">
                {/* Professor */}
                {course.professor && (
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <User className="h-3.5 w-3.5 text-primary shrink-0" />
                    <span className="truncate">{course.professor}</span>
                  </div>
                )}

                {/* Schedules list */}
                <div className="space-y-1 pt-1 border-t border-border/40">
                  <span className="text-[10px] font-semibold uppercase text-muted-foreground block">
                    Horarios ({course.schedules.length})
                  </span>
                  {course.schedules.length === 0 ? (
                    <span className="text-xs text-muted-foreground italic">Sin horario</span>
                  ) : (
                    course.schedules.map((s, idx) => (
                      <div
                        key={idx}
                        className="flex items-center justify-between text-xs text-muted-foreground bg-muted/30 px-2 py-1 rounded"
                      >
                        <span className="font-medium text-foreground">{s.day}</span>
                        <span>
                          {formatDisplayTime(s.start_time, timeFormat24h)} -{' '}
                          {formatDisplayTime(s.end_time, timeFormat24h)}
                        </span>
                        {s.room && (
                          <span className="flex items-center gap-0.5 text-accent font-medium">
                            <MapPin className="h-3 w-3" />
                            {s.room}
                          </span>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </CardContent>

              {/* Actions Footer */}
              <div className="p-3 bg-muted/20 border-t border-border/50 flex items-center justify-between">
                <span className="text-xs text-muted-foreground font-medium">
                  {course.credits} {course.credits === 1 ? 'crédito' : 'créditos'}
                </span>

                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
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
                    onClick={() => handleDelete(course)}
                    className="h-7 w-7 text-destructive hover:text-destructive hover:bg-destructive/10 cursor-pointer"
                    title="Eliminar materia"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Course Create/Edit Modal */}
      <CourseDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        initialCourse={selectedCourse}
      />
    </div>
  )
}
