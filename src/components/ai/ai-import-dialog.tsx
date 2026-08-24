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
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Sparkles, Upload, FileText, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react'
import { createCourse } from '@/lib/actions/courses'
import { toast } from 'sonner'
import type { CourseInsert, ScheduleInsert } from '@/types/database'

interface AIImportDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function AIImportDialog({ open, onOpenChange }: AIImportDialogProps) {
  const [file, setFile] = React.useState<File | null>(null)
  const [previewImages, setPreviewImages] = React.useState<string[]>([])
  const [model, setModel] = React.useState<string>('gemini-2.0-flash')
  const [analyzing, setAnalyzing] = React.useState<boolean>(false)
  const [extractedCourses, setExtractedCourses] = React.useState<any[] | null>(null)
  const [importing, setImporting] = React.useState<boolean>(false)
  const fileInputRef = React.useRef<HTMLInputElement>(null)

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0]
    if (!selected) return

    setFile(selected)
    setExtractedCourses(null)

    // Convert image to base64 data URL
    if (selected.type.startsWith('image/')) {
      const reader = new FileReader()
      reader.onload = () => {
        setPreviewImages([reader.result as string])
      }
      reader.readAsDataURL(selected)
    } else {
      setPreviewImages([])
    }
  }

  const handleAnalyze = async () => {
    if (previewImages.length === 0 && !file) {
      toast.error('Selecciona una imagen o archivo de horario')
      return
    }

    try {
      setAnalyzing(true)
      setExtractedCourses(null)

      const response = await fetch('/api/generate-schedule', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          images: previewImages,
          model,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Error al procesar el horario')
      }

      if (data.courses && Array.isArray(data.courses)) {
        setExtractedCourses(data.courses)
        toast.success(`Se detectaron ${data.courses.length} materias con éxito`)
      } else {
        throw new Error('Formato de materias inválido')
      }
    } catch (err: any) {
      toast.error(err.message || 'Error en el análisis con IA')
    } finally {
      setAnalyzing(false)
    }
  }

  const handleConfirmImport = async () => {
    if (!extractedCourses || extractedCourses.length === 0) return

    try {
      setImporting(true)

      let importedCount = 0
      for (const item of extractedCourses) {
        const courseData: CourseInsert = {
          code: item.code || 'MATERIA',
          name: item.name || 'Materia sin nombre',
          professor: item.professor || '',
          email: item.email || '',
          faculty: item.faculty || '',
          semester: item.semester || '',
          credits: item.credits || 3,
          color: item.color || 'blue',
          status: 'active',
        }

        const schedules: Omit<ScheduleInsert, 'course_id'>[] = (item.schedules || []).map(
          (s: any) => ({
            day: s.day || 'Lunes',
            start_time: s.start_time || '08:00',
            end_time: s.end_time || '10:00',
            room: s.room || '',
          })
        )

        await createCourse(courseData, schedules)
        importedCount++
      }

      toast.success(`¡${importedCount} materias importadas a tu cuenta!`)
      onOpenChange(false)
      setExtractedCourses(null)
      setFile(null)
      setPreviewImages([])
    } catch (err: any) {
      toast.error(err.message || 'Error al guardar las materias importadas')
    } finally {
      setImporting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-accent" />
            Importar Horario con Inteligencia Artificial
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            Sube una foto (JPG, PNG, WebP) de tu horario de clases y la IA extraerá automáticamente las materias, docentes, salones y horarios.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* File Upload Zone */}
          <div
            onClick={() => fileInputRef.current?.click()}
            className="border-2 border-dashed rounded-xl p-6 text-center hover:bg-muted/40 cursor-pointer transition-colors space-y-2 border-border/80"
          >
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileChange}
              accept="image/png, image/jpeg, image/webp"
              className="hidden"
            />
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary mx-auto">
              <Upload className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm font-semibold">
                {file ? file.name : 'Haz clic para seleccionar una foto de tu horario'}
              </p>
              <p className="text-xs text-muted-foreground">
                Formatos soportados: JPG, PNG, WebP (máx. 10MB)
              </p>
            </div>
          </div>

          {/* Model selection */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-center">
            <div className="space-y-1">
              <Label className="text-xs">Modelo de Inteligencia Artificial</Label>
              <Select value={model} onValueChange={setModel}>
                <SelectTrigger className="h-9 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="gemini-2.0-flash">Gemini 2.0 Flash (Rápido y Preciso)</SelectItem>
                  <SelectItem value="gemini-1.5-pro">Gemini 1.5 Pro (Razonamiento Complejo)</SelectItem>
                  <SelectItem value="google/gemini-2.0-flash-001">OpenRouter / Gemini Flash</SelectItem>
                  <SelectItem value="anthropic/claude-3.5-sonnet">OpenRouter / Claude 3.5 Sonnet</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="sm:pt-5">
              <Button
                onClick={handleAnalyze}
                disabled={previewImages.length === 0 || analyzing}
                className="w-full h-9 text-xs flex items-center justify-center gap-2"
              >
                {analyzing ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Analizando con IA...
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4" />
                    Analizar Horario con IA
                  </>
                )}
              </Button>
            </div>
          </div>

          {/* Extracted Courses Preview */}
          {extractedCourses && (
            <div className="space-y-3 pt-3 border-t">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
                  <CheckCircle2 className="h-4 w-4" />
                  {extractedCourses.length} materias detectadas
                </span>
              </div>

              <div className="max-h-60 overflow-y-auto space-y-2 pr-1">
                {extractedCourses.map((c, idx) => (
                  <div
                    key={idx}
                    className="p-3 rounded-lg border bg-muted/20 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-muted-foreground">[{c.code}]</span>
                        <span className="font-semibold">{c.name}</span>
                      </div>
                      {c.professor && (
                        <p className="text-[11px] text-muted-foreground mt-0.5">
                          Profesor: {c.professor}
                        </p>
                      )}
                    </div>

                    <div className="text-[11px] text-muted-foreground shrink-0 space-y-0.5">
                      {c.schedules?.map((s: any, sIdx: number) => (
                        <div key={sIdx} className="font-mono">
                          {s.day} {s.start_time} - {s.end_time} {s.room ? `(${s.room})` : ''}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="flex items-center justify-between pt-3 border-t">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cerrar
          </Button>

          {extractedCourses && extractedCourses.length > 0 && (
            <Button
              onClick={handleConfirmImport}
              disabled={importing}
              className="text-xs flex items-center gap-1.5"
            >
              {importing ? 'Importando...' : 'Confirmar e Importar al Horario'}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
