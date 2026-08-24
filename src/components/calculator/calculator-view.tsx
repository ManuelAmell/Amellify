'use client'

import * as React from 'react'
import type { CourseWithDetails, PartialGrade } from '@/types/database'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
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
  Sparkles,
  AlertTriangle,
  CheckCircle2,
  TrendingUp,
  Target,
} from 'lucide-react'
import {
  computeWeightedAverage,
  computeRequiredGrade,
  validatePartialPercentages,
} from '@/lib/utils/grades'
import { savePartials } from '@/lib/actions/partials'
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

export function CalculatorView({
  courses,
  passingGrade = 3.0,
  maxGrade = 5.0,
}: CalculatorViewProps) {
  const [selectedCourseId, setSelectedCourseId] = React.useState<string>(
    courses[0]?.id || ''
  )
  const [partials, setPartials] = React.useState<WorkingPartial[]>([])
  const [targetGrade, setTargetGrade] = React.useState<string>(passingGrade.toString())
  const [saving, setSaving] = React.useState(false)

  const selectedCourse = courses.find((c) => c.id === selectedCourseId)

  // Populate working partials when selected course changes
  React.useEffect(() => {
    if (selectedCourse) {
      if (selectedCourse.partials && selectedCourse.partials.length > 0) {
        setPartials(
          selectedCourse.partials.map((p) => ({
            id: p.id,
            name: p.name,
            grade: p.grade !== null ? p.grade.toString() : '',
            percent: p.percent.toString(),
          }))
        )
      } else {
        // Default 3 partials preset (30%, 30%, 40%)
        setPartials([
          { name: 'Parcial 1', grade: '', percent: '30' },
          { name: 'Parcial 2', grade: '', percent: '30' },
          { name: 'Examen Final', grade: '', percent: '40' },
        ])
      }
    }
  }, [selectedCourseId, courses])

  const handleAddPartial = () => {
    setPartials((prev) => [
      ...prev,
      {
        name: `Parcial ${prev.length + 1}`,
        grade: '',
        percent: '20',
      },
    ])
  }

  const handleRemovePartial = (index: number) => {
    setPartials((prev) => prev.filter((_, i) => i !== index))
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
      return updated
    })
  }

  // Presets
  const applyPreset = (preset: '30-30-40' | '50-50' | '33-33-34' | '25-25-25-25') => {
    if (preset === '30-30-40') {
      setPartials([
        { name: 'Corte 1', grade: partials[0]?.grade || '', percent: '30' },
        { name: 'Corte 2', grade: partials[1]?.grade || '', percent: '30' },
        { name: 'Corte 3 / Final', grade: partials[2]?.grade || '', percent: '40' },
      ])
    } else if (preset === '50-50') {
      setPartials([
        { name: 'Parcial 1', grade: partials[0]?.grade || '', percent: '50' },
        { name: 'Parcial 2', grade: partials[1]?.grade || '', percent: '50' },
      ])
    } else if (preset === '33-33-34') {
      setPartials([
        { name: 'Parcial 1', grade: partials[0]?.grade || '', percent: '33.3' },
        { name: 'Parcial 2', grade: partials[1]?.grade || '', percent: '33.3' },
        { name: 'Parcial 3', grade: partials[2]?.grade || '', percent: '33.4' },
      ])
    } else if (preset === '25-25-25-25') {
      setPartials([
        { name: 'Parcial 1', grade: partials[0]?.grade || '', percent: '25' },
        { name: 'Parcial 2', grade: partials[1]?.grade || '', percent: '25' },
        { name: 'Parcial 3', grade: partials[2]?.grade || '', percent: '25' },
        { name: 'Examen Final', grade: partials[3]?.grade || '', percent: '25' },
      ])
    }
    toast.info('Plantilla de porcentajes aplicada')
  }

  // Calculations
  const numericPartials = partials.map((p) => ({
    grade: p.grade.trim() !== '' && !isNaN(Number(p.grade)) ? Number(p.grade) : null,
    percent: Number(p.percent) || 0,
  }))

  const { average, completedPercent } = computeWeightedAverage(numericPartials, maxGrade)
  const validation = validatePartialPercentages(numericPartials)
  const targetNum = Number(targetGrade) || passingGrade
  const requiredGrade = computeRequiredGrade(numericPartials, targetNum, maxGrade)

  const isPassing = average >= passingGrade

  const handleSave = async () => {
    if (!selectedCourseId) return
    try {
      setSaving(true)
      const toSave = partials.map((p, idx) => ({
        name: p.name || `P${idx + 1}`,
        grade: p.grade.trim() !== '' ? Number(p.grade) : null,
        percent: Number(p.percent) || 0,
        sort_order: idx,
      }))
      await savePartials(selectedCourseId, toSave)
      toast.success('Notas guardadas en la nube')
    } catch (err: any) {
      toast.error(err.message || 'Error al guardar notas')
    } finally {
      setSaving(false)
    }
  }

  if (courses.length === 0) {
    return (
      <Card className="glass-panel border-dashed p-10 text-center">
        <CardContent className="space-y-3 p-0">
          <Calculator className="h-10 w-10 text-muted-foreground mx-auto opacity-50" />
          <p className="text-sm font-semibold">No tienes materias registradas</p>
          <p className="text-xs text-muted-foreground">
            Crea primero tus materias en la sección de Materias para calcular tus notas.
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <Calculator className="h-6 w-6 text-primary" />
            Calculadora de Notas & Simulador
          </h2>
          <p className="text-xs text-muted-foreground mt-1">
            Calcula promedios ponderados, simula notas y descubre la calificación mínima para pasar.
          </p>
        </div>

        {/* Course Picker */}
        <div className="w-full sm:w-72">
          <Select value={selectedCourseId} onValueChange={setSelectedCourseId}>
            <SelectTrigger className="h-10 text-xs font-medium">
              <SelectValue placeholder="Selecciona una materia" />
            </SelectTrigger>
            <SelectContent>
              {courses.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  <span className="font-mono text-muted-foreground mr-1.5">[{c.code}]</span>
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Current Weighted Average */}
        <Card className="glass-panel border-border/70 shadow-xs relative overflow-hidden">
          <CardHeader className="p-4 pb-2">
            <CardDescription className="text-xs font-semibold uppercase">
              Promedio Acumulado Actual
            </CardDescription>
            <div className="flex items-baseline gap-2 pt-1">
              <CardTitle className="text-3xl font-bold text-primary tracking-tight">
                {completedPercent > 0 ? average.toFixed(2) : '0.00'}
              </CardTitle>
              <span className="text-xs text-muted-foreground font-mono">/ {maxGrade}</span>
              {completedPercent > 0 && (
                <Badge
                  variant={isPassing ? 'success' : 'destructive'}
                  className="ml-auto text-[10px]"
                >
                  {isPassing ? 'Aprobando' : 'En riesgo'}
                </Badge>
              )}
            </div>
          </CardHeader>
          <CardContent className="p-4 pt-1 space-y-1.5">
            <div className="flex justify-between text-[11px] text-muted-foreground">
              <span>Porcentaje evaluado:</span>
              <span className="font-semibold text-foreground">{completedPercent.toFixed(1)}%</span>
            </div>
            <Progress value={completedPercent} className="h-2" />
          </CardContent>
        </Card>

        {/* Required Grade for Target */}
        <Card className="glass-panel border-border/70 shadow-xs">
          <CardHeader className="p-4 pb-2">
            <CardDescription className="text-xs font-semibold uppercase flex items-center justify-between">
              <span>¿Qué nota necesito?</span>
              <Target className="h-4 w-4 text-accent" />
            </CardDescription>
            <div className="flex items-baseline gap-2 pt-1">
              <CardTitle className="text-3xl font-bold text-accent tracking-tight">
                {requiredGrade !== null ? (
                  requiredGrade > maxGrade ? (
                    <span className="text-destructive text-xl">Inalcanzable ({requiredGrade.toFixed(2)})</span>
                  ) : (
                    requiredGrade.toFixed(2)
                  )
                ) : (
                  <span className="text-emerald-500 text-xl">¡Aprobada!</span>
                )}
              </CardTitle>
              {requiredGrade !== null && requiredGrade <= maxGrade && (
                <span className="text-xs text-muted-foreground font-mono">/ {maxGrade}</span>
              )}
            </div>
          </CardHeader>
          <CardContent className="p-4 pt-1 space-y-1 text-xs text-muted-foreground">
            <div className="flex items-center gap-2">
              <span>Objetivo:</span>
              <Input
                type="number"
                step="0.1"
                min="0"
                max={maxGrade}
                value={targetGrade}
                onChange={(e) => setTargetGrade(e.target.value)}
                className="h-6 w-16 text-xs text-center font-mono py-0"
              />
              <span>para pasar</span>
            </div>
          </CardContent>
        </Card>

        {/* Percentage Validation */}
        <Card className="glass-panel border-border/70 shadow-xs">
          <CardHeader className="p-4 pb-2">
            <CardDescription className="text-xs font-semibold uppercase">
              Total de Porcentajes
            </CardDescription>
            <div className="flex items-baseline gap-2 pt-1">
              <CardTitle
                className={`text-3xl font-bold tracking-tight ${
                  validation.isValid ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-500'
                }`}
              >
                {validation.total}%
              </CardTitle>
              <span className="text-xs text-muted-foreground font-mono">/ 100%</span>
            </div>
          </CardHeader>
          <CardContent className="p-4 pt-1 text-xs text-muted-foreground">
            {validation.isValid ? (
              <p className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-medium">
                <CheckCircle2 className="h-3.5 w-3.5" />
                Los porcentajes suman exactamente 100%
              </p>
            ) : (
              <p className="flex items-center gap-1 text-amber-500 font-medium">
                <AlertTriangle className="h-3.5 w-3.5" />
                {validation.total < 100
                  ? `Falta asignar ${validation.remaining}%`
                  : `Se excede por ${(validation.total - 100).toFixed(1)}%`}
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Partials Editor Card */}
      <Card className="glass-panel border-border/80 shadow-sm">
        <CardHeader className="p-5 pb-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <CardTitle className="text-lg font-bold">
                Notas Parciales · {selectedCourse?.name}
              </CardTitle>
              <CardDescription className="text-xs">
                Ingresa tus notas obtenidas (deja vacío lo pendiente para simular).
              </CardDescription>
            </div>

            {/* Presets buttons */}
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-[11px] text-muted-foreground mr-1">Presets:</span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => applyPreset('30-30-40')}
                className="h-7 text-[11px] px-2"
              >
                30 / 30 / 40
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => applyPreset('50-50')}
                className="h-7 text-[11px] px-2"
              >
                50 / 50
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => applyPreset('33-33-34')}
                className="h-7 text-[11px] px-2"
              >
                3 × 33.3%
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => applyPreset('25-25-25-25')}
                className="h-7 text-[11px] px-2"
              >
                4 × 25%
              </Button>
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-5 pt-2 space-y-4">
          <div className="space-y-2">
            {partials.map((partial, idx) => (
              <div
                key={idx}
                className="flex items-center gap-3 p-2.5 rounded-lg border bg-muted/20 hover:bg-muted/40 transition-colors"
              >
                {/* Name */}
                <div className="flex-1 min-w-[140px]">
                  <Input
                    placeholder="Nombre del corte (ej: Parcial 1)"
                    value={partial.name}
                    onChange={(e) => handleUpdatePartial(idx, 'name', e.target.value)}
                    className="h-9 text-xs"
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
                    className="h-9 text-xs pr-6 text-right font-mono"
                  />
                  <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground pointer-events-none">
                    %
                  </span>
                </div>

                {/* Grade */}
                <div className="w-32 relative">
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    max={maxGrade}
                    placeholder="Nota (vacío=simular)"
                    value={partial.grade}
                    onChange={(e) => handleUpdatePartial(idx, 'grade', e.target.value)}
                    className="h-9 text-xs font-mono text-right pr-2"
                  />
                </div>

                {/* Remove Row */}
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => handleRemovePartial(idx)}
                  className="h-9 w-9 text-destructive hover:text-destructive hover:bg-destructive/10 shrink-0"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>

          <div className="flex items-center justify-between pt-3 border-t">
            <Button
              variant="outline"
              size="sm"
              onClick={handleAddPartial}
              className="text-xs flex items-center gap-1.5"
            >
              <Plus className="h-4 w-4" />
              Agregar Parcial / Nota
            </Button>

            <Button
              onClick={handleSave}
              disabled={saving}
              className="text-xs flex items-center gap-1.5 shadow-sm"
            >
              <Save className="h-4 w-4" />
              {saving ? 'Guardando...' : 'Guardar Notas en Cloud'}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
