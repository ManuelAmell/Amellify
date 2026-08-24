'use client'

import * as React from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Plus, Trash2, Clock, MapPin, AlertCircle } from 'lucide-react'
import { toast } from 'sonner'
import { createCourse, updateCourse, deleteCourse } from '@/lib/actions/courses'
import { DAYS_OF_WEEK } from '@/lib/utils/time'
import type { CourseWithDetails, SubjectColor, DayOfWeek, CourseStatus } from '@/types/database'

const COLOR_OPTIONS: { value: SubjectColor; label: string; bg: string }[] = [
  { value: 'blue', label: 'Azul', bg: '#3B82F6' },
  { value: 'teal', label: 'Teal', bg: '#0D9488' },
  { value: 'green', label: 'Verde', bg: '#10B981' },
  { value: 'orange', label: 'Naranja', bg: '#F97316' },
  { value: 'purple', label: 'Púrpura', bg: '#A855F7' },
  { value: 'red', label: 'Rojo', bg: '#EF4444' },
]

interface ScheduleSlotDraft {
  id?: string
  day: DayOfWeek
  start_time: string
  end_time: string
  room: string
}

interface CourseDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  initialCourse?: CourseWithDetails | null
  defaultDay?: DayOfWeek
  defaultStartTime?: string
  defaultEndTime?: string
}

export function CourseDialog({
  open,
  onOpenChange,
  initialCourse,
  defaultDay,
  defaultStartTime,
  defaultEndTime,
}: CourseDialogProps) {
  const [loading, setLoading] = React.useState(false)
  const [code, setCode] = React.useState('')
  const [name, setName] = React.useState('')
  const [professor, setProfessor] = React.useState('')
  const [email, setEmail] = React.useState('')
  const [faculty, setFaculty] = React.useState('')
  const [semester, setSemester] = React.useState('')
  const [credits, setCredits] = React.useState(3)
  const [color, setColor] = React.useState<SubjectColor>('blue')
  const [status, setStatus] = React.useState<CourseStatus>('active')
  const [notes, setNotes] = React.useState('')
  const [schedules, setSchedules] = React.useState<ScheduleSlotDraft[]>([])

  // Reset or populate fields when opened
  React.useEffect(() => {
    if (open) {
      if (initialCourse) {
        setCode(initialCourse.code)
        setName(initialCourse.name)
        setProfessor(initialCourse.professor || '')
        setEmail(initialCourse.email || '')
        setFaculty(initialCourse.faculty || '')
        setSemester(initialCourse.semester || '')
        setCredits(initialCourse.credits || 3)
        setColor(initialCourse.color || 'blue')
        setStatus(initialCourse.status || 'active')
        setNotes(initialCourse.notes || '')
        setSchedules(
          initialCourse.schedules.map((s) => ({
            id: s.id,
            day: s.day,
            start_time: s.start_time.substring(0, 5),
            end_time: s.end_time.substring(0, 5),
            room: s.room || '',
          }))
        )
      } else {
        setCode('')
        setName('')
        setProfessor('')
        setEmail('')
        setFaculty('')
        setSemester('')
        setCredits(3)
        setColor('blue')
        setStatus('active')
        setNotes('')
        setSchedules([
          {
            day: defaultDay || 'Lunes',
            start_time: defaultStartTime || '08:00',
            end_time: defaultEndTime || '10:00',
            room: '',
          },
        ])
      }
    }
  }, [open, initialCourse, defaultDay, defaultStartTime, defaultEndTime])

  const handleAddScheduleSlot = () => {
    setSchedules((prev) => [
      ...prev,
      {
        day: 'Lunes',
        start_time: '08:00',
        end_time: '10:00',
        room: '',
      },
    ])
  }

  const handleRemoveScheduleSlot = (index: number) => {
    setSchedules((prev) => prev.filter((_, i) => i !== index))
  }

  const handleUpdateScheduleSlot = (
    index: number,
    field: keyof ScheduleSlotDraft,
    value: string
  ) => {
    setSchedules((prev) => {
      const updated = [...prev]
      const target = updated[index]
      if (target) {
        updated[index] = { ...target, [field]: value }
      }
      return updated
    })
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!code.trim()) {
      toast.error('El código de la materia es obligatorio')
      return
    }
    if (!name.trim()) {
      toast.error('El nombre de la materia es obligatorio')
      return
    }

    // Validate schedules
    for (const slot of schedules) {
      if (slot.start_time >= slot.end_time) {
        toast.error(`La hora de inicio (${slot.start_time}) debe ser anterior a la hora fin (${slot.end_time})`)
        return
      }
    }

    try {
      setLoading(true)

      const courseData = {
        code: code.trim().toUpperCase(),
        name: name.trim(),
        professor: professor.trim(),
        email: email.trim(),
        faculty: faculty.trim(),
        semester: semester.trim(),
        credits: Number(credits) || 3,
        color,
        status,
        notes: notes.trim(),
      }

      const schedulePayload = schedules.map((s) => ({
        day: s.day,
        start_time: s.start_time,
        end_time: s.end_time,
        room: s.room.trim(),
      }))

      if (initialCourse) {
        await updateCourse(initialCourse.id, courseData, schedulePayload)
        toast.success('Materia actualizada con éxito')
      } else {
        await createCourse(courseData, schedulePayload)
        toast.success('Materia creada con éxito')
      }

      onOpenChange(false)
    } catch (err: any) {
      toast.error(err.message || 'Error al guardar la materia')
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async () => {
    if (!initialCourse) return
    if (confirm(`¿Estás seguro de eliminar la materia ${initialCourse.name}?`)) {
      try {
        setLoading(true)
        await deleteCourse(initialCourse.id)
        toast.success('Materia eliminada')
        onOpenChange(false)
      } catch (err: any) {
        toast.error(err.message || 'Error al eliminar')
      } finally {
        setLoading(false)
      }
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <form onSubmit={handleSubmit} className="space-y-5">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold">
              {initialCourse ? 'Editar Materia' : 'Nueva Materia'}
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Define los datos académicos, color y bloques de horario para tu horario semanal.
            </DialogDescription>
          </DialogHeader>

          {/* Primary Info */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="code" className="text-xs">Código *</Label>
              <Input
                id="code"
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                placeholder="CALCVEC"
                maxLength={8}
                className="font-mono uppercase"
                required
              />
            </div>
            <div className="sm:col-span-2 space-y-1.5">
              <Label htmlFor="name" className="text-xs">Nombre de la materia *</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Cálculo Vectorial"
                required
              />
            </div>
          </div>

          {/* Professor & Faculty */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="professor" className="text-xs">Profesor / Docente</Label>
              <Input
                id="professor"
                value={professor}
                onChange={(e) => setProfessor(e.target.value)}
                placeholder="Gabriel Chanchi"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="email" className="text-xs">Email del Profesor</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="profesor@universidad.edu"
              />
            </div>
          </div>

          {/* Academic Details */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="credits" className="text-xs">Créditos</Label>
              <Input
                id="credits"
                type="number"
                min={1}
                max={10}
                value={credits}
                onChange={(e) => setCredits(parseInt(e.target.value, 10) || 1)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="semester" className="text-xs">Semestre</Label>
              <Input
                id="semester"
                value={semester}
                onChange={(e) => setSemester(e.target.value)}
                placeholder="2026-1"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="faculty" className="text-xs">Facultad</Label>
              <Input
                id="faculty"
                value={faculty}
                onChange={(e) => setFaculty(e.target.value)}
                placeholder="Ingeniería"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Estado</Label>
              <Select value={status} onValueChange={(val) => setStatus(val as CourseStatus)}>
                <SelectTrigger className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Activa</SelectItem>
                  <SelectItem value="paused">En pausa</SelectItem>
                  <SelectItem value="completed">Completada</SelectItem>
                  <SelectItem value="dropped">Cancelada</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Color Selection */}
          <div className="space-y-2">
            <Label className="text-xs font-semibold">Color de la Materia</Label>
            <div className="flex items-center gap-2">
              {COLOR_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setColor(opt.value)}
                  style={{ backgroundColor: opt.bg }}
                  className={`h-7 w-7 rounded-full transition-transform cursor-pointer flex items-center justify-center text-white ${
                    color === opt.value
                      ? 'ring-2 ring-primary ring-offset-2 scale-110'
                      : 'opacity-80 hover:opacity-100 hover:scale-105'
                  }`}
                  title={opt.label}
                >
                  {color === opt.value && <span className="text-xs font-bold">✓</span>}
                </button>
              ))}
            </div>
          </div>

          {/* Schedules Section */}
          <div className="space-y-3 pt-2 border-t">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-semibold flex items-center gap-1.5">
                <Clock className="h-3.5 w-3.5 text-primary" />
                Horarios y Aulas
              </Label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleAddScheduleSlot}
                className="h-7 text-xs flex items-center gap-1"
              >
                <Plus className="h-3.5 w-3.5" />
                Agregar Bloque
              </Button>
            </div>

            {schedules.length === 0 ? (
              <div className="rounded-lg border border-dashed p-4 text-center text-xs text-muted-foreground">
                No hay bloques horarios asignados. Haz clic en "Agregar Bloque".
              </div>
            ) : (
              <div className="space-y-2">
                {schedules.map((slot, idx) => (
                  <div
                    key={idx}
                    className="flex flex-wrap items-center gap-2 rounded-lg border bg-muted/20 p-2.5"
                  >
                    {/* Day */}
                    <div className="w-32">
                      <Select
                        value={slot.day}
                        onValueChange={(val) =>
                          handleUpdateScheduleSlot(idx, 'day', val)
                        }
                      >
                        <SelectTrigger className="h-8 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {DAYS_OF_WEEK.map((d) => (
                            <SelectItem key={d} value={d}>
                              {d}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Start Time */}
                    <div className="w-24">
                      <Input
                        type="time"
                        value={slot.start_time}
                        onChange={(e) =>
                          handleUpdateScheduleSlot(idx, 'start_time', e.target.value)
                        }
                        className="h-8 text-xs font-mono"
                        required
                      />
                    </div>

                    <span className="text-xs text-muted-foreground">-</span>

                    {/* End Time */}
                    <div className="w-24">
                      <Input
                        type="time"
                        value={slot.end_time}
                        onChange={(e) =>
                          handleUpdateScheduleSlot(idx, 'end_time', e.target.value)
                        }
                        className="h-8 text-xs font-mono"
                        required
                      />
                    </div>

                    {/* Room */}
                    <div className="flex-1 min-w-[120px]">
                      <Input
                        placeholder="Salón / Aula (ej: A-301)"
                        value={slot.room}
                        onChange={(e) =>
                          handleUpdateScheduleSlot(idx, 'room', e.target.value)
                        }
                        className="h-8 text-xs"
                      />
                    </div>

                    {/* Delete Slot Button */}
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => handleRemoveScheduleSlot(idx)}
                      className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Notes */}
          <div className="space-y-1.5">
            <Label htmlFor="notes" className="text-xs">Notas adicionales</Label>
            <Input
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Grupo B1, enlace de Teams, observaciones..."
            />
          </div>

          <DialogFooter className="flex items-center justify-between sm:justify-between pt-3 border-t">
            {initialCourse ? (
              <Button
                type="button"
                variant="destructive"
                onClick={handleDelete}
                disabled={loading}
                className="text-xs"
              >
                Eliminar Materia
              </Button>
            ) : <span />}

            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={loading}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={loading}>
                {loading ? 'Guardando...' : initialCourse ? 'Guardar Cambios' : 'Crear Materia'}
              </Button>
            </div>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
