'use client'

import * as React from 'react'
import type { CourseWithDetails, SubjectColor } from '@/types/database'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Progress } from '@/components/ui/progress'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Calculator,
  Plus,
  Trash2,
  Save,
  AlertTriangle,
  CheckCircle2,
  Target,
  AlertCircle,
  RotateCcw,
} from 'lucide-react'
import {
  computeWeightedAverage,
  computeNeededGrade,
  validatePartialPercentages,
} from '@/lib/utils/grades'
import { savePartials } from '@/lib/actions/partials'
import { SUBJECT_COLOR_CLASSES } from '@/config/subject-colors'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'

interface CalculatorViewProps {
  courses: CourseWithDetails[]
  passingGrade?: number
  maxGrade?: number
}

interface WorkingPartial {
  id?: string
  name: string
  grade: string // string for input handling
  percent: string
}

function getDefaultPartials(): WorkingPartial[] {
  return [
    { name: 'Corte 1', grade: '', percent: '30' },
    { name: 'Corte 2', grade: '', percent: '30' },
    { name: 'Corte 3 / Final', grade: '', percent: '40' },
  ]
}

export function CalculatorView({
  courses,
  passingGrade = 3.0,
  maxGrade = 5.0,
}: CalculatorViewProps) {
  const [selectedCourseId, setSelectedCourseId] = React.useState<string>(
    courses[0]?.id || ''
  )

  // Drafts stored in-memory per courseId to prevent losing unsaved edits on re-renders (Bug H14)
  const draftsRef = React.useRef<Record<string, WorkingPartial[]>>({})
  const [partials, setPartials] = React.useState<WorkingPartial[]>([])
  const [isDirty, setIsDirty] = React.useState(false)
  const [targetGrade, setTargetGrade] = React.useState<string>(passingGrade.toString())
  const [saving, setSaving] = React.useState(false)

  // Track previous courseId to save drafts when switching
  const prevCourseIdRef = React.useRef<string>(selectedCourseId)

  // Find currently selected course
  const selectedCourse = React.useMemo(() => {
    return courses.find((c) => c.id === selectedCourseId) || courses[0] || null
  }, [courses, selectedCourseId])

  // Function to extract initial partials from a course
  const getCourseInitialPartials = React.useCallback(
    (c: CourseWithDetails | null): WorkingPartial[] => {
      if (!c) return []
      if (c.partials && c.partials.length > 0) {
        return c.partials.map((p) => ({
          id: p.id,
          name: p.name,
          grade: p.grade !== null && p.grade !== undefined ? p.grade.toString() : '',
          percent: p.percent.toString(),
        }))
      }
      return getDefaultPartials()
    },
    []
  )

  if (!selectedCourseId && courses.length > 0 && courses[0]) {
    setSelectedCourseId(courses[0].id)
  }

  // Handle course switching while preserving dirty drafts (Bug H14 fix)
  React.useEffect(() => {
    const prevId = prevCourseIdRef.current
    if (prevId !== selectedCourseId) {
      // No need to save `partials` into `draftsRef.current[prevId]` here:
      // every mutation (handleAddPartial/handleRemovePartial/handleUpdatePartial/
      // applyPreset/handleResetDraft) already writes its own result straight
      // into draftsRef as it happens, so the ref is already current.
      prevCourseIdRef.current = selectedCourseId

      // Load draft if exists, otherwise load from DB course
      const existingDraft = draftsRef.current[selectedCourseId]
      if (existingDraft) {
        setPartials(existingDraft)
      } else {
        const initial = getCourseInitialPartials(selectedCourse)
        setPartials(initial)
        draftsRef.current[selectedCourseId] = initial
      }
      setIsDirty(false)
    } else if (!isDirty && selectedCourse) {
      // Same course, but `courses` (the server-fetched prop) changed —
      // only overwrite the working draft if the user has no local dirty
      // edits. Deliberately NOT depending on `partials` here: this branch
      // itself calls setPartials with a fresh array reference every run,
      // so listing `partials` as a dependency would make the effect
      // re-fire on its own write and loop forever.
      const fromServer = getCourseInitialPartials(selectedCourse)
      setPartials(fromServer)
      draftsRef.current[selectedCourseId] = fromServer
    }
  }, [selectedCourseId, courses, getCourseInitialPartials, selectedCourse, isDirty])

  const handleAddPartial = () => {
    setPartials((prev) => {
      const next = [
        ...prev,
        {
          name: `Parcial ${prev.length + 1}`,
          grade: '',
          percent: '20',
        },
      ]
      draftsRef.current[selectedCourseId] = next
      return next
    })
    setIsDirty(true)
  }

  const handleRemovePartial = (index: number) => {
    setPartials((prev) => {
      const next = prev.filter((_, i) => i !== index)
      draftsRef.current[selectedCourseId] = next
      return next
    })
    setIsDirty(true)
  }

  const handleUpdatePartial = (
    index: number,
    field: keyof WorkingPartial,
    value: string
  ) => {
    setPartials((prev) => {
      const updated = [...prev]
      const target = updated[index]
      if (target) {
        updated[index] = { ...target, [field]: value }
      }
      draftsRef.current[selectedCourseId] = updated
      return updated
    })
    setIsDirty(true)
  }

  // Presets
  const applyPreset = (preset: '30-30-40' | '50-50' | '33-33-34' | '25-25-25-25') => {
    let next: WorkingPartial[] = []
    if (preset === '30-30-40') {
      next = [
        { name: 'Corte 1', grade: partials[0]?.grade || '', percent: '30' },
        { name: 'Corte 2', grade: partials[1]?.grade || '', percent: '30' },
        { name: 'Corte 3 / Final', grade: partials[2]?.grade || '', percent: '40' },
      ]
    } else if (preset === '50-50') {
      next = [
        { name: 'Parcial 1', grade: partials[0]?.grade || '', percent: '50' },
        { name: 'Parcial 2', grade: partials[1]?.grade || '', percent: '50' },
      ]
    } else if (preset === '33-33-34') {
      next = [
        { name: 'Parcial 1', grade: partials[0]?.grade || '', percent: '33.3' },
        { name: 'Parcial 2', grade: partials[1]?.grade || '', percent: '33.3' },
        { name: 'Parcial 3', grade: partials[2]?.grade || '', percent: '33.4' },
      ]
    } else if (preset === '25-25-25-25') {
      next = [
        { name: 'Parcial 1', grade: partials[0]?.grade || '', percent: '25' },
        { name: 'Parcial 2', grade: partials[1]?.grade || '', percent: '25' },
        { name: 'Parcial 3', grade: partials[2]?.grade || '', percent: '25' },
        { name: 'Examen Final', grade: partials[3]?.grade || '', percent: '25' },
      ]
    }
    setPartials(next)
    draftsRef.current[selectedCourseId] = next
    setIsDirty(true)
    toast.info('Plantilla de porcentajes aplicada')
  }

  const handleResetDraft = () => {
    const original = getCourseInitialPartials(selectedCourse)
    setPartials(original)
    draftsRef.current[selectedCourseId] = original
    setIsDirty(false)
    toast.info('Cambios locales revertidos')
  }

  // Calculations
  const numericPartials = React.useMemo(() => {
    return partials.map((p) => {
      const trimmed = p.grade.trim()
      const parsedNum = trimmed !== '' && !isNaN(Number(trimmed)) ? Number(trimmed) : null
      return {
        grade: parsedNum,
        percent: Number(p.percent) || 0,
      }
    })
  }, [partials])

  const { average, completedPercent } = computeWeightedAverage(numericPartials, maxGrade)
  const validation = validatePartialPercentages(numericPartials)
  const targetNum = Number(targetGrade) > 0 ? Number(targetGrade) : passingGrade
  const neededResult = computeNeededGrade(numericPartials, targetNum, maxGrade)

  const isPassing = average >= passingGrade

  const handleSave = async () => {
    if (!selectedCourseId) return
    try {
      setSaving(true)
      const toSave = partials.map((p, idx) => ({
        id: p.id,
        name: p.name.trim() || `Parcial ${idx + 1}`,
        grade: p.grade.trim() !== '' && !isNaN(Number(p.grade)) ? Number(p.grade) : null,
        percent: Number(p.percent) || 0,
      }))

      const res = await savePartials(selectedCourseId, toSave)
      if (!res.ok) {
        toast.error(res.error || 'Error al guardar notas')
        return
      }

      setIsDirty(false)
      draftsRef.current[selectedCourseId] = partials
      toast.success('Notas guardadas en la nube correctamente')
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Error al guardar notas'
      toast.error(message)
    } finally {
      setSaving(false)
    }
  }

  if (courses.length === 0) {
    return (
      <Card className="glass-card border-dashed p-10 text-center">
        <CardContent className="space-y-3 p-0">
          <Calculator className="h-10 w-10 text-muted-foreground mx-auto opacity-50" />
          <p className="text-sm font-semibold">No tienes materias registradas</p>
          <p className="text-xs text-muted-foreground">
            Crea primero tus materias en la sección de Materias para calcular tus notas y simular
            parciales.
          </p>
        </CardContent>
      </Card>
    )
  }

  const selectedColorKey = (selectedCourse?.color as SubjectColor) || 'blue'
  const selectedColorClass = SUBJECT_COLOR_CLASSES[selectedColorKey] || 'subject-blue'

  return (
    <div className="space-y-6">
      {/* Header & Course Selector */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <Calculator className="h-6 w-6 text-primary" />
            Calculadora & Simulador de Notas
          </h2>
          <p className="text-xs text-muted-foreground mt-1">
            Calcula promedios ponderados en tiempo real, simula notas y proyecta lo requerido para
            aprobar.
          </p>
        </div>

        {/* Course Picker in GlassCard */}
        <div className="glass-card rounded-2xl p-2 min-w-[280px] max-w-sm flex items-center gap-2.5">
          <span className={cn('subject-dot h-3 w-3 rounded-full shrink-0 ml-1.5', selectedColorClass)} />
          <div className="flex-1">
            <Select value={selectedCourseId} onValueChange={setSelectedCourseId}>
              <SelectTrigger className="h-9 text-xs font-semibold glass-inset border-none shadow-none">
                <SelectValue placeholder="Selecciona una materia" />
              </SelectTrigger>
              <SelectContent>
                {courses.map((c) => {
                  const colorKey = (c.color as SubjectColor) || 'blue'
                  const colorCls = SUBJECT_COLOR_CLASSES[colorKey] || 'subject-blue'
                  return (
                    <SelectItem key={c.id} value={c.id} className="cursor-pointer">
                      <div className="flex items-center gap-2">
                        <span className={cn('subject-dot h-2 w-2 rounded-full', colorCls)} />
                        <span className="font-mono text-xs text-muted-foreground">[{c.code}]</span>
                        <span className="truncate">{c.name}</span>
                      </div>
                    </SelectItem>
                  )
                })}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* Summary Cards Row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Card 1: Current Weighted Average */}
        <div className="glass-card rounded-2xl p-4 flex flex-col justify-between space-y-3">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase text-muted-foreground">
                Promedio Acumulado
              </span>
              {completedPercent > 0 && (
                <Badge
                  variant={isPassing ? 'success' : 'destructive'}
                  className="text-[10px] px-2 py-0.5 font-bold"
                >
                  {isPassing ? 'Aprobando' : 'En riesgo'}
                </Badge>
              )}
            </div>

            <div className="flex items-baseline gap-2 pt-2">
              <span className="text-3xl font-black text-primary tracking-tight font-mono">
                {completedPercent > 0 ? average.toFixed(2) : '0.00'}
              </span>
              <span className="text-xs text-muted-foreground font-mono">/ {maxGrade}</span>
            </div>
          </div>

          <div className="space-y-1.5 pt-2 border-t border-border/40">
            <div className="flex justify-between text-[11px] text-muted-foreground">
              <span>Porcentaje evaluado:</span>
              <span className="font-semibold text-foreground">{completedPercent.toFixed(1)}%</span>
            </div>
            <Progress value={completedPercent} className="h-2" />
          </div>
        </div>

        {/* Card 2: Needed Grade (¿Qué nota necesito?) */}
        <div
          className={cn(
            'glass-card rounded-2xl p-4 flex flex-col justify-between transition-all duration-200',
            neededResult !== null &&
              !neededResult.achievable &&
              'border-destructive/60 bg-destructive/5'
          )}
        >
          <div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase text-muted-foreground flex items-center gap-1.5">
                <Target className="h-3.5 w-3.5 text-accent" />
                ¿Qué nota necesito?
              </span>
              {neededResult !== null && !neededResult.achievable && (
                <Badge variant="destructive" className="text-[10px] animate-pulse">
                  Inalcanzable
                </Badge>
              )}
            </div>

            <div className="pt-2">
              {neededResult === null ? (
                <div>
                  <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
                    {average >= targetNum ? '¡Materia Aprobada!' : 'Evaluaciones Finalizadas'}
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    {average >= targetNum
                      ? `Has superado tu nota objetivo (${targetNum}) con promedio ${average.toFixed(2)}.`
                      : `Completaste todos los parciales. Promedio final: ${average.toFixed(2)}.`}
                  </p>
                </div>
              ) : !neededResult.achievable ? (
                <div>
                  <div className="text-2xl font-bold text-destructive font-mono">
                    {neededResult.value.toFixed(2)}{' '}
                    <span className="text-xs font-normal text-muted-foreground">/ {maxGrade}</span>
                  </div>
                  <p className="text-[11px] text-destructive/90 font-medium flex items-center gap-1 mt-1">
                    <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                    Inalcanzable: supera la calificación máxima ({maxGrade}).
                  </p>
                </div>
              ) : (
                <div className="flex items-baseline gap-2">
                  <span className="text-3xl font-black text-accent tracking-tight font-mono">
                    {neededResult.value.toFixed(2)}
                  </span>
                  <span className="text-xs text-muted-foreground font-mono">/ {maxGrade}</span>
                </div>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2 pt-2 border-t border-border/40 text-xs text-muted-foreground">
            <span>Para pasar con:</span>
            <Input
              type="number"
              step="0.1"
              min="0"
              max={maxGrade}
              value={targetGrade}
              onChange={(e) => setTargetGrade(e.target.value)}
              className="h-6 w-16 text-xs text-center font-mono py-0 glass-inset"
            />
            <span className="truncate">o más</span>
          </div>
        </div>

        {/* Card 3: Percentage Validation */}
        <div className="glass-card rounded-2xl p-4 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase text-muted-foreground">
                Total de Porcentajes
              </span>
              <Badge
                variant={validation.isValid ? 'success' : 'warning'}
                className="text-[10px]"
              >
                {validation.isValid ? '100% Exacto' : `${validation.total}%`}
              </Badge>
            </div>

            <div className="flex items-baseline gap-2 pt-2">
              <span
                className={cn(
                  'text-3xl font-black tracking-tight font-mono',
                  validation.isValid
                    ? 'text-emerald-600 dark:text-emerald-400'
                    : 'text-amber-500'
                )}
              >
                {validation.total}%
              </span>
              <span className="text-xs text-muted-foreground font-mono">/ 100%</span>
            </div>
          </div>

          <div className="pt-2 border-t border-border/40 text-xs text-muted-foreground">
            {validation.isValid ? (
              <p className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-medium text-[11px]">
                <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
                La suma de los cortes es válida (100%).
              </p>
            ) : (
              <p className="flex items-center gap-1 text-amber-500 font-medium text-[11px]">
                <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                {validation.total < 100
                  ? `Falta asignar ${validation.remaining}% en los cortes.`
                  : `Se excede por ${(validation.total - 100).toFixed(1)}%.`}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Partials Editor Card */}
      <div className="glass-card rounded-2xl overflow-hidden">
        <div className="p-5 pb-3 border-b border-border/40 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base font-bold text-foreground">
                Notas Parciales · {selectedCourse?.name}
              </h3>
              {isDirty && (
                <Badge variant="warning" className="text-[10px] animate-pulse">
                  Cambios sin guardar
                </Badge>
              )}
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              Ingresa tus notas obtenidas. Deja vacío cualquier campo para que el simulador calcule
              lo necesario.
            </p>
          </div>

          {/* Presets buttons */}
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[11px] text-muted-foreground mr-1">Plantillas:</span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => applyPreset('30-30-40')}
              className="h-7 text-[11px] px-2 glass-inset"
            >
              30 / 30 / 40
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => applyPreset('50-50')}
              className="h-7 text-[11px] px-2 glass-inset"
            >
              50 / 50
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => applyPreset('33-33-34')}
              className="h-7 text-[11px] px-2 glass-inset"
            >
              3 × 33.3%
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => applyPreset('25-25-25-25')}
              className="h-7 text-[11px] px-2 glass-inset"
            >
              4 × 25%
            </Button>
          </div>
        </div>

        <div className="p-5 space-y-4">
          <div className="space-y-2">
            {partials.map((partial, idx) => (
              <div
                key={partial.id || idx}
                className="flex items-center gap-3 p-2.5 rounded-xl glass-inset transition-colors"
              >
                {/* Name */}
                <div className="flex-1 min-w-[140px]">
                  <Input
                    placeholder="Nombre del corte (ej: Corte 1)"
                    value={partial.name}
                    onChange={(e) => handleUpdatePartial(idx, 'name', e.target.value)}
                    className="h-9 text-xs glass-inset"
                  />
                </div>

                {/* Percentage */}
                <div className="w-28 relative">
                  <Input
                    type="number"
                    step="0.1"
                    min="0"
                    max="100"
                    placeholder="Peso"
                    value={partial.percent}
                    onChange={(e) => handleUpdatePartial(idx, 'percent', e.target.value)}
                    className="h-9 text-xs pr-6 text-right font-mono glass-inset"
                  />
                  <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground pointer-events-none">
                    %
                  </span>
                </div>

                {/* Grade */}
                <div className="w-36 relative">
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    max={maxGrade}
                    placeholder="Nota (vacío = simular)"
                    value={partial.grade}
                    onChange={(e) => handleUpdatePartial(idx, 'grade', e.target.value)}
                    className="h-9 text-xs font-mono text-right pr-2 glass-inset"
                  />
                </div>

                {/* Remove Row */}
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => handleRemovePartial(idx)}
                  className="h-9 w-9 text-destructive hover:text-destructive hover:bg-destructive/10 shrink-0 cursor-pointer"
                  title="Eliminar parcial"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-3 border-t border-border/40">
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <Button
                variant="outline"
                size="sm"
                onClick={handleAddPartial}
                className="text-xs flex items-center gap-1.5 glass-inset"
              >
                <Plus className="h-4 w-4" />
                Agregar Parcial
              </Button>

              {isDirty && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleResetDraft}
                  className="text-xs flex items-center gap-1 text-muted-foreground hover:text-foreground"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                  Descartar cambios
                </Button>
              )}
            </div>

            <Button
              onClick={handleSave}
              disabled={saving}
              className="text-xs flex items-center gap-1.5 shadow-sm w-full sm:w-auto cursor-pointer"
            >
              <Save className="h-4 w-4" />
              {saving ? 'Guardando...' : 'Guardar Notas en Cloud'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
