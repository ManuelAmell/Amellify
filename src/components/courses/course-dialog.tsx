'use client'

import * as React from 'react'
import { useForm, useFieldArray, useWatch, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
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
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Plus,
  Trash2,
  Clock,
  AlertCircle,
  AlertTriangle,
  Check,
} from 'lucide-react'
import { toast } from 'sonner'
import { createCourse, updateCourse, deleteCourse, getCourses } from '@/lib/actions/courses'
import { DAYS_OF_WEEK } from '@/lib/utils/time'
import { schedulesOverlap } from '@/lib/utils/overlap'
import {
  dayOfWeekSchema,
  courseStatusSchema,
  subjectColorSchema,
} from '@/lib/validation/course'
import {
  SUBJECT_COLORS,
  SUBJECT_COLOR_LABELS,
  SUBJECT_COLOR_CLASSES,
} from '@/config/subject-colors'
import type {
  CourseWithDetails,
  SubjectColor,
  DayOfWeek,
} from '@/types/database'
import { cn } from '@/lib/utils'

const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/

const courseFormSchema = z
  .object({
    code: z
      .string()
      .trim()
      .min(1, 'El código es obligatorio.')
      .max(16, 'Máximo 16 caracteres.'),
    name: z
      .string()
      .trim()
      .min(1, 'El nombre es obligatorio.')
      .max(200, 'Máximo 200 caracteres.'),
    professor: z.string().max(200, 'Máximo 200 caracteres.').optional(),
    email: z
      .string()
      .trim()
      .email('Correo electrónico inválido.')
      .max(200)
      .optional()
      .or(z.literal('')),
    faculty: z.string().max(200, 'Máximo 200 caracteres.').optional(),
    semester: z.string().max(50, 'Máximo 50 caracteres.').optional(),
    credits: z.number().int().min(0, 'Mínimo 0.').max(12, 'Máximo 12.'),
    status: courseStatusSchema,
    color: subjectColorSchema,
    notes: z.string().max(4000, 'Máximo 4000 caracteres.').optional(),
    schedules: z.array(
      z
        .object({
          id: z.string().optional(),
          day: dayOfWeekSchema,
          startTime: z.string().regex(HHMM, 'Hora inválida (HH:MM).'),
          endTime: z.string().regex(HHMM, 'Hora inválida (HH:MM).'),
          room: z.string().max(100).optional(),
        })
        .refine((s) => s.endTime > s.startTime, {
          message: 'La hora de fin debe ser posterior a la de inicio.',
          path: ['endTime'],
        })
    ),
  })
  .refine(
    (data) => {
      // Check internal overlaps
      for (let i = 0; i < data.schedules.length; i++) {
        for (let j = i + 1; j < data.schedules.length; j++) {
          const a = data.schedules[i]!
          const b = data.schedules[j]!
          if (schedulesOverlap(a, b)) {
            return false
          }
        }
      }
      return true
    },
    {
      message: 'Hay bloques de horario que se solapan entre sí.',
      path: ['schedules'],
    }
  )

type CourseFormData = z.infer<typeof courseFormSchema>

export interface CourseDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  initialCourse?: CourseWithDetails | null
  existingCourses?: CourseWithDetails[]
  defaultDay?: DayOfWeek
  defaultStartTime?: string
  defaultEndTime?: string
}

interface ConflictDetail {
  type: 'internal' | 'external'
  message: string
}

export function CourseDialog({
  open,
  onOpenChange,
  initialCourse,
  existingCourses,
  defaultDay,
  defaultStartTime,
  defaultEndTime,
}: CourseDialogProps) {
  const [fetchedCourses, setFetchedCourses] = React.useState<CourseWithDetails[]>([])
  const effectiveCourses = existingCourses ?? fetchedCourses

  const [loading, setLoading] = React.useState(false)

  const form = useForm<CourseFormData>({
    resolver: zodResolver(courseFormSchema),
    defaultValues: {
      code: '',
      name: '',
      professor: '',
      email: '',
      faculty: '',
      semester: '',
      credits: 3,
      status: 'active',
      color: 'blue',
      notes: '',
      schedules: [
        {
          day: defaultDay || 'Lunes',
          startTime: defaultStartTime || '08:00',
          endTime: defaultEndTime || '10:00',
          room: '',
        },
      ],
    },
  })

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: 'schedules',
  })

  const watchedSchedules = useWatch({
    control: form.control,
    name: 'schedules',
  })

  const selectedColor = useWatch({
    control: form.control,
    name: 'color',
  })

  // Load existing courses if not passed as prop
  React.useEffect(() => {
    if (!existingCourses && open) {
      getCourses().then((res) => {
        if (res.ok) setFetchedCourses(res.data)
      })
    }
  }, [open, existingCourses])

  // Populate/Reset form when opened
  React.useEffect(() => {
    if (open) {
      if (initialCourse) {
        form.reset({
          code: initialCourse.code,
          name: initialCourse.name,
          professor: initialCourse.professor || '',
          email: initialCourse.email || '',
          faculty: initialCourse.faculty || '',
          semester: initialCourse.semester || '',
          credits: initialCourse.credits ?? 3,
          status: initialCourse.status || 'active',
          color: (initialCourse.color as SubjectColor) || 'blue',
          notes: initialCourse.notes || '',
          schedules: initialCourse.schedules.map((s) => ({
            id: s.id,
            day: s.day,
            startTime: (s.startTime ?? s.start_time ?? '08:00').substring(0, 5),
            endTime: (s.endTime ?? s.end_time ?? '10:00').substring(0, 5),
            room: s.room || '',
          })),
        })
      } else {
        form.reset({
          code: '',
          name: '',
          professor: '',
          email: '',
          faculty: '',
          semester: '',
          credits: 3,
          status: 'active',
          color: 'blue',
          notes: '',
          schedules: [
            {
              day: defaultDay || 'Lunes',
              startTime: defaultStartTime || '08:00',
              endTime: defaultEndTime || '10:00',
              room: '',
            },
          ],
        })
      }
    }
  }, [open, initialCourse, defaultDay, defaultStartTime, defaultEndTime, form])

  // Real-time conflict detector for a given slot
  const getSlotConflicts = React.useCallback(
    (slotIndex: number): ConflictDetail[] => {
      const slot = watchedSchedules?.[slotIndex]
      if (!slot || !slot.startTime || !slot.endTime || slot.startTime >= slot.endTime) {
        return []
      }

      const conflicts: ConflictDetail[] = []

      // 1. Check internal overlaps with other slots in this form
      if (watchedSchedules) {
        for (let j = 0; j < watchedSchedules.length; j++) {
          if (j === slotIndex) continue
          const other = watchedSchedules[j]
          if (
            other &&
            other.startTime &&
            other.endTime &&
            other.startTime < other.endTime &&
            schedulesOverlap(slot, other)
          ) {
            conflicts.push({
              type: 'internal',
              message: `Solape interno con el bloque #${j + 1} (${other.day} ${other.startTime} - ${other.endTime}).`,
            })
          }
        }
      }

      // 2. Check external overlaps with other registered active courses (bug H12)
      for (const course of effectiveCourses) {
        if (course.id === initialCourse?.id) continue
        if (course.status !== 'active') continue
        for (const s of course.schedules) {
          const sStart = (s.startTime ?? s.start_time ?? '').substring(0, 5)
          const sEnd = (s.endTime ?? s.end_time ?? '').substring(0, 5)
          if (!sStart || !sEnd || sStart >= sEnd) continue

          if (schedulesOverlap(slot, { day: s.day, startTime: sStart, endTime: sEnd })) {
            conflicts.push({
              type: 'external',
              message: `Coincide con "${course.name}" [${course.code}]: ${s.day} ${sStart} a ${sEnd}${s.room ? ` (Salón ${s.room})` : ''}.`,
            })
          }
        }
      }

      return conflicts
    },
    [watchedSchedules, effectiveCourses, initialCourse]
  )

  const onSubmit = async (data: CourseFormData) => {
    try {
      setLoading(true)

      const courseData = {
        code: data.code.trim().toUpperCase(),
        name: data.name.trim(),
        professor: data.professor?.trim() || undefined,
        email: data.email?.trim() || undefined,
        faculty: data.faculty?.trim() || undefined,
        semester: data.semester?.trim() || undefined,
        credits: data.credits,
        status: data.status,
        notes: data.notes?.trim() || undefined,
        color: data.color,
      }

      const schedulesPayload = data.schedules.map((s) => ({
        ...(s.id ? { id: s.id } : {}),
        day: s.day,
        startTime: s.startTime,
        endTime: s.endTime,
        room: s.room?.trim() || undefined,
      }))

      if (initialCourse) {
        const res = await updateCourse({
          id: initialCourse.id,
          course: courseData,
          schedules: schedulesPayload,
        })
        if (!res.ok) {
          toast.error(res.error || 'Error al actualizar la materia')
          return
        }
        toast.success('Materia actualizada con éxito')
      } else {
        const res = await createCourse({
          course: courseData,
          schedules: schedulesPayload,
        })
        if (!res.ok) {
          toast.error(res.error || 'Error al crear la materia')
          return
        }
        toast.success('Materia creada con éxito')
      }

      onOpenChange(false)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Error al guardar la materia'
      toast.error(message)
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async () => {
    if (!initialCourse) return
    if (confirm(`¿Estás seguro de eliminar la materia "${initialCourse.name}"?`)) {
      try {
        setLoading(true)
        const res = await deleteCourse(initialCourse.id)
        if (!res.ok) {
          toast.error(res.error || 'Error al eliminar')
          return
        }
        toast.success('Materia eliminada con éxito')
        onOpenChange(false)
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Error al eliminar'
        toast.error(message)
      } finally {
        setLoading(false)
      }
    }
  }

  const hasGlobalScheduleOverlapError = !!form.formState.errors.schedules?.root?.message

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold tracking-tight">
              {initialCourse ? 'Editar Materia' : 'Nueva Materia'}
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Define los datos académicos, color y bloques de horario para tu horario semanal.
            </DialogDescription>
          </DialogHeader>

          {/* Primary Info */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="code" className="text-xs font-semibold">
                Código *
              </Label>
              <Input
                id="code"
                placeholder="CALCVEC"
                maxLength={16}
                className="font-mono uppercase"
                {...form.register('code', {
                  onChange: (e) => {
                    e.target.value = e.target.value.toUpperCase()
                  },
                })}
              />
              {form.formState.errors.code && (
                <p className="text-[11px] text-destructive font-medium">
                  {form.formState.errors.code.message}
                </p>
              )}
            </div>

            <div className="sm:col-span-2 space-y-1.5">
              <Label htmlFor="name" className="text-xs font-semibold">
                Nombre de la materia *
              </Label>
              <Input
                id="name"
                placeholder="Cálculo Vectorial"
                {...form.register('name')}
              />
              {form.formState.errors.name && (
                <p className="text-[11px] text-destructive font-medium">
                  {form.formState.errors.name.message}
                </p>
              )}
            </div>
          </div>

          {/* Professor & Email */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="professor" className="text-xs">
                Profesor / Docente
              </Label>
              <Input
                id="professor"
                placeholder="Gabriel Chanchi"
                {...form.register('professor')}
              />
              {form.formState.errors.professor && (
                <p className="text-[11px] text-destructive font-medium">
                  {form.formState.errors.professor.message}
                </p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="email" className="text-xs">
                Email del Profesor
              </Label>
              <Input
                id="email"
                type="email"
                placeholder="profesor@universidad.edu"
                {...form.register('email')}
              />
              {form.formState.errors.email && (
                <p className="text-[11px] text-destructive font-medium">
                  {form.formState.errors.email.message}
                </p>
              )}
            </div>
          </div>

          {/* Academic Details */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="credits" className="text-xs">
                Créditos
              </Label>
              <Input
                id="credits"
                type="number"
                min={0}
                max={12}
                {...form.register('credits', { valueAsNumber: true })}
              />
              {form.formState.errors.credits && (
                <p className="text-[11px] text-destructive font-medium">
                  {form.formState.errors.credits.message}
                </p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="semester" className="text-xs">
                Semestre
              </Label>
              <Input
                id="semester"
                placeholder="2026-1"
                {...form.register('semester')}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="faculty" className="text-xs">
                Facultad
              </Label>
              <Input
                id="faculty"
                placeholder="Ingeniería"
                {...form.register('faculty')}
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Estado</Label>
              <Controller
                control={form.control}
                name="status"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
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
                )}
              />
            </div>
          </div>

          {/* Color Selection (role="radiogroup") */}
          <div className="space-y-2">
            <Label className="text-xs font-semibold">Color de la Materia</Label>
            <div
              role="radiogroup"
              aria-label="Color de la materia"
              className="flex items-center gap-2.5 pt-0.5"
            >
              {SUBJECT_COLORS.map((colorOption) => {
                const isSelected = selectedColor === colorOption
                const label = SUBJECT_COLOR_LABELS[colorOption]
                const colorClass = SUBJECT_COLOR_CLASSES[colorOption]
                return (
                  <button
                    key={colorOption}
                    type="button"
                    role="radio"
                    aria-checked={isSelected}
                    aria-label={label}
                    tabIndex={isSelected ? 0 : -1}
                    onClick={() =>
                      form.setValue('color', colorOption, {
                        shouldDirty: true,
                        shouldValidate: true,
                      })
                    }
                    className={cn(
                      'relative h-8 w-8 rounded-full transition-all duration-150 cursor-pointer flex items-center justify-center',
                      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
                      colorClass,
                      isSelected
                        ? 'scale-110 ring-2 ring-primary ring-offset-2 shadow-sm'
                        : 'opacity-75 hover:opacity-100 hover:scale-105'
                    )}
                    style={{
                      background: 'var(--subject, var(--primary))',
                    }}
                    title={label}
                  >
                    {isSelected && <Check className="h-4 w-4 text-white drop-shadow-xs" />}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Schedules Section */}
          <div className="space-y-3 pt-2 border-t">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label className="text-xs font-semibold flex items-center gap-1.5">
                  <Clock className="h-3.5 w-3.5 text-primary" />
                  Horarios y Aulas
                </Label>
                <p className="text-[11px] text-muted-foreground">
                  Detección en tiempo real de solapes y cruces horarios.
                </p>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() =>
                  append({
                    day: 'Lunes',
                    startTime: '08:00',
                    endTime: '10:00',
                    room: '',
                  })
                }
                className="h-7 text-xs flex items-center gap-1 cursor-pointer"
              >
                <Plus className="h-3.5 w-3.5" />
                Agregar Bloque
              </Button>
            </div>

            {hasGlobalScheduleOverlapError && (
              <div className="flex items-center gap-2 p-2 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-xs">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>{form.formState.errors.schedules?.root?.message}</span>
              </div>
            )}

            {fields.length === 0 ? (
              <div className="rounded-xl border border-dashed p-4 text-center text-xs text-muted-foreground">
                No hay bloques horarios asignados. Haz clic en &quot;Agregar Bloque&quot; para definir tu horario.
              </div>
            ) : (
              <div className="space-y-2.5">
                {fields.map((field, idx) => {
                  const conflicts = getSlotConflicts(idx)
                  const hasInternal = conflicts.some((c) => c.type === 'internal')
                  const hasExternal = conflicts.some((c) => c.type === 'external')
                  const slotError = form.formState.errors.schedules?.[idx]

                  return (
                    <div
                      key={field.id}
                      className={cn(
                        'flex flex-col gap-2 rounded-xl border p-3 transition-colors',
                        hasInternal
                          ? 'border-destructive/60 bg-destructive/5'
                          : hasExternal
                            ? 'border-amber-500/50 bg-amber-500/5'
                            : 'bg-muted/20 border-border/50'
                      )}
                    >
                      <div className="flex flex-wrap items-center gap-2">
                        {/* Day Selector */}
                        <div className="w-32">
                          <Controller
                            control={form.control}
                            name={`schedules.${idx}.day`}
                            render={({ field: dayField }) => (
                              <Select
                                value={dayField.value}
                                onValueChange={dayField.onChange}
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
                            )}
                          />
                        </div>

                        {/* Start Time */}
                        <div className="w-24">
                          <Input
                            type="time"
                            className="h-8 text-xs font-mono"
                            {...form.register(`schedules.${idx}.startTime`)}
                          />
                        </div>

                        <span className="text-xs text-muted-foreground">-</span>

                        {/* End Time */}
                        <div className="w-24">
                          <Input
                            type="time"
                            className="h-8 text-xs font-mono"
                            {...form.register(`schedules.${idx}.endTime`)}
                          />
                        </div>

                        {/* Room */}
                        <div className="flex-1 min-w-[120px]">
                          <Input
                            placeholder="Salón / Aula (ej: A-301)"
                            className="h-8 text-xs"
                            {...form.register(`schedules.${idx}.room`)}
                          />
                        </div>

                        {/* Remove Button */}
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => remove(idx)}
                          className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10 cursor-pointer shrink-0"
                          title="Eliminar este bloque"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>

                      {/* Error if start >= end */}
                      {slotError?.endTime && (
                        <p className="text-[11px] text-destructive font-medium flex items-center gap-1">
                          <AlertCircle className="h-3 w-3 shrink-0" />
                          {slotError.endTime.message}
                        </p>
                      )}

                      {/* Overlap Conflicts Warning / Alert (bug H12) */}
                      {conflicts.length > 0 && (
                        <div className="space-y-1 pt-1">
                          {conflicts.map((conflict, cIdx) => (
                            <div
                              key={cIdx}
                              className={cn(
                                'flex items-start gap-1.5 text-xs rounded-md p-1.5 border',
                                conflict.type === 'internal'
                                  ? 'bg-destructive/10 border-destructive/20 text-destructive font-medium'
                                  : 'bg-amber-500/10 border-amber-500/20 text-amber-700 dark:text-amber-400 font-medium'
                              )}
                            >
                              {conflict.type === 'internal' ? (
                                <AlertCircle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                              ) : (
                                <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                              )}
                              <span>{conflict.message}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* Notes (Textarea) */}
          <div className="space-y-1.5">
            <Label htmlFor="notes" className="text-xs">
              Notas adicionales
            </Label>
            <Textarea
              id="notes"
              placeholder="Grupo B1, enlace de Teams, observaciones del semestre..."
              className="resize-none min-h-[70px]"
              {...form.register('notes')}
            />
            {form.formState.errors.notes && (
              <p className="text-[11px] text-destructive font-medium">
                {form.formState.errors.notes.message}
              </p>
            )}
          </div>

          <DialogFooter className="flex items-center justify-between sm:justify-between pt-3 border-t">
            {initialCourse ? (
              <Button
                type="button"
                variant="destructive"
                onClick={handleDelete}
                disabled={loading}
                className="text-xs cursor-pointer"
              >
                Eliminar Materia
              </Button>
            ) : (
              <span />
            )}

            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={loading}
                className="cursor-pointer"
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={loading} className="cursor-pointer">
                {loading
                  ? 'Guardando...'
                  : initialCourse
                    ? 'Guardar Cambios'
                    : 'Crear Materia'}
              </Button>
            </div>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
