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
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Sparkles,
  Upload,
  Image as ImageIcon,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Trash2,
  Plus,
  Bot,
} from 'lucide-react'
import { createCourse } from '@/lib/actions/courses'
import { DAYS_OF_WEEK } from '@/lib/utils/time'
import { SUBJECT_COLOR_CLASSES, SUBJECT_COLORS, SUBJECT_COLOR_LABELS } from '@/config/subject-colors'
import type { DayOfWeek, SubjectColor } from '@/types/database'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'

interface EditableSchedule {
  day: DayOfWeek
  start_time: string
  end_time: string
  room: string
}

interface EditableCourse {
  id: string // temporary client ID
  code: string
  name: string
  professor: string
  faculty: string
  semester: string
  credits: number
  color: SubjectColor
  schedules: EditableSchedule[]
}

interface AIImportDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

/**
 * Client-side image resizing helper (max 1600px, JPEG 0.85) to avoid
 * payload-size limits and optimize extraction response times.
 */
async function resizeImageToJpeg(file: File | Blob, maxDimension = 1600, quality = 0.85): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    const url = URL.createObjectURL(file)
    img.onload = () => {
      URL.revokeObjectURL(url)
      let { width, height } = img
      if (width > maxDimension || height > maxDimension) {
        if (width > height) {
          height = Math.round((height * maxDimension) / width)
          width = maxDimension
        } else {
          width = Math.round((width * maxDimension) / height)
          height = maxDimension
        }
      }
      const canvas = document.createElement('canvas')
      canvas.width = width
      canvas.height = height
      const ctx = canvas.getContext('2d')
      if (!ctx) {
        reject(new Error('No fue posible inicializar el canvas de procesamiento'))
        return
      }
      // Fill white background for transparency in PNGs
      ctx.fillStyle = '#FFFFFF'
      ctx.fillRect(0, 0, width, height)
      ctx.drawImage(img, 0, 0, width, height)
      const dataUrl = canvas.toDataURL('image/jpeg', quality)
      resolve(dataUrl)
    }
    img.onerror = (err) => {
      URL.revokeObjectURL(url)
      reject(err)
    }
    img.src = url
  })
}

export function AIImportDialog({ open, onOpenChange }: AIImportDialogProps) {
  const [selectedFile, setSelectedFile] = React.useState<File | null>(null)
  const [imageDataUrl, setImageDataUrl] = React.useState<string | null>(null)
  const [isDragging, setIsDragging] = React.useState<boolean>(false)
  const [analyzing, setAnalyzing] = React.useState<boolean>(false)

  // AI Response metadata
  const [aiProvider, setAiProvider] = React.useState<string | null>(null)
  const [aiModel, setAiModel] = React.useState<string | null>(null)

  // Fully editable extracted courses list
  const [extractedCourses, setExtractedCourses] = React.useState<EditableCourse[]>([])
  const [importing, setImporting] = React.useState<boolean>(false)

  const fileInputRef = React.useRef<HTMLInputElement>(null)

  // Process a selected or dropped/pasted image file
  const processImageFile = async (file: File | Blob) => {
    if (!file.type.startsWith('image/')) {
      toast.error('Solo se permiten archivos de imagen (PNG, JPEG, WebP)')
      return
    }

    try {
      if (file instanceof File) {
        setSelectedFile(file)
      } else {
        setSelectedFile(new File([file], 'imagen_pegada.jpg', { type: 'image/jpeg' }))
      }

      // Resize client-side to max 1600px JPEG 0.85
      const resized = await resizeImageToJpeg(file, 1600, 0.85)
      setImageDataUrl(resized)
      setExtractedCourses([])
      setAiProvider(null)
      setAiModel(null)
    } catch (err: any) {
      toast.error('Error al procesar la imagen: ' + (err.message || 'formato no soportado'))
    }
  }

  // Handle Clipboard Paste (Cmd+V / Ctrl+V)
  React.useEffect(() => {
    if (!open) return

    const handlePaste = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items
      if (!items) return

      for (let i = 0; i < items.length; i++) {
        const item = items[i]
        if (!item) continue
        if (item.type.startsWith('image/')) {
          const blob = item.getAsFile()
          if (blob) {
            processImageFile(blob)
            toast.success('Imagen pegada desde el portapapeles')
            break
          }
        }
      }
    }

    window.addEventListener('paste', handlePaste)
    return () => window.removeEventListener('paste', handlePaste)
  }, [open])

  // Drag and drop handlers
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }

  const handleDragLeave = () => {
    setIsDragging(false)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    const droppedFile = e.dataTransfer.files?.[0]
    if (droppedFile) {
      processImageFile(droppedFile)
    }
  }

  // Analyze schedule with server-side AI cascade
  const handleAnalyze = async () => {
    if (!imageDataUrl) {
      toast.error('Selecciona, arrastra o pega una imagen primero')
      return
    }

    try {
      setAnalyzing(true)
      setExtractedCourses([])
      setAiProvider(null)
      setAiModel(null)

      const response = await fetch('/api/ai/extract-schedule', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          images: [imageDataUrl],
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'No fue posible analizar la imagen con IA')
      }

      if (data.courses && Array.isArray(data.courses)) {
        setAiProvider(data.provider || 'AI')
        setAiModel(data.model || 'Cascade')

        // Transform into editable local state
        const editable: EditableCourse[] = data.courses.map((c: any, index: number) => ({
          id: `extracted-${index}-${Date.now()}`,
          code: c.code || `MAT-${index + 1}`,
          name: c.name || 'Materia sin nombre',
          professor: c.professor || '',
          faculty: c.faculty || '',
          semester: c.semester || '',
          credits: typeof c.credits === 'number' ? c.credits : 3,
          color: (c.color as SubjectColor) || SUBJECT_COLORS[index % SUBJECT_COLORS.length],
          schedules: (c.schedules || []).map((s: any) => ({
            day: (s.day as DayOfWeek) || 'Lunes',
            start_time: s.startTime || s.start_time || '08:00',
            end_time: s.endTime || s.end_time || '10:00',
            room: s.room || '',
          })),
        }))

        setExtractedCourses(editable)
        toast.success(`Se detectaron ${editable.length} materias con éxito`)
      } else {
        throw new Error('Formato de respuesta inesperado del analizador')
      }
    } catch (err: any) {
      toast.error(err.message || 'Error durante la extracción')
    } finally {
      setAnalyzing(false)
    }
  }

  // Edit course fields
  const handleUpdateCourse = (id: string, field: keyof EditableCourse, value: any) => {
    setExtractedCourses((prev) =>
      prev.map((c) => (c.id === id ? { ...c, [field]: value } : c))
    )
  }

  // Remove a course from preview
  const handleRemoveCourse = (id: string) => {
    setExtractedCourses((prev) => prev.filter((c) => c.id !== id))
  }

  // Add empty course manually to preview
  const handleAddManualCourse = () => {
    const newCourse: EditableCourse = {
      id: `manual-${Date.now()}`,
      code: 'COD101',
      name: 'Nueva Asignatura',
      professor: '',
      faculty: '',
      semester: '',
      credits: 3,
      color: 'blue',
      schedules: [
        {
          day: 'Lunes',
          start_time: '08:00',
          end_time: '10:00',
          room: '',
        },
      ],
    }
    setExtractedCourses((prev) => [...prev, newCourse])
  }

  // Schedule slot editing
  const handleUpdateSchedule = (
    courseId: string,
    schedIndex: number,
    field: keyof EditableSchedule,
    value: string
  ) => {
    setExtractedCourses((prev) =>
      prev.map((c) => {
        if (c.id !== courseId) return c
        const updatedSchedules = [...c.schedules]
        const currentSlot = updatedSchedules[schedIndex]
        if (currentSlot) {
          updatedSchedules[schedIndex] = { ...currentSlot, [field]: value }
        }
        return { ...c, schedules: updatedSchedules }
      })
    )
  }

  const handleAddScheduleSlot = (courseId: string) => {
    setExtractedCourses((prev) =>
      prev.map((c) => {
        if (c.id !== courseId) return c
        return {
          ...c,
          schedules: [
            ...c.schedules,
            { day: 'Miércoles', start_time: '10:00', end_time: '12:00', room: '' },
          ],
        }
      })
    )
  }

  const handleRemoveScheduleSlot = (courseId: string, schedIndex: number) => {
    setExtractedCourses((prev) =>
      prev.map((c) => {
        if (c.id !== courseId) return c
        return {
          ...c,
          schedules: c.schedules.filter((_, idx) => idx !== schedIndex),
        }
      })
    )
  }

  // Confirm and persist all courses
  const handleConfirmImport = async () => {
    if (extractedCourses.length === 0) return

    try {
      setImporting(true)
      let count = 0

      for (const course of extractedCourses) {
        const payloadCourse = {
          code: course.code.trim().toUpperCase(),
          name: course.name.trim(),
          professor: course.professor.trim(),
          faculty: course.faculty.trim(),
          semester: course.semester.trim(),
          credits: Number(course.credits) || 3,
          color: course.color,
          status: 'active' as const,
        }

        const payloadSchedules = course.schedules.map((s) => ({
          day: s.day,
          startTime: s.start_time,
          endTime: s.end_time,
          room: s.room.trim(),
        }))

        const res = await createCourse(payloadCourse, payloadSchedules)
        if (res.ok) {
          count++
        }
      }

      toast.success(`¡${count} materias importadas correctamente al horario!`)
      onOpenChange(false)
      // Reset state
      setSelectedFile(null)
      setImageDataUrl(null)
      setExtractedCourses([])
      setAiProvider(null)
      setAiModel(null)
    } catch (err: any) {
      toast.error(err.message || 'Error al guardar las materias importadas')
    } finally {
      setImporting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto glass-float rounded-2xl">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold flex items-center gap-2 text-foreground">
            <Sparkles className="h-5 w-5 text-accent" />
            Importar Horario con Inteligencia Artificial
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground leading-relaxed">
            Sube, arrastra o pega (Ctrl+V) una captura de tu horario institucional. La IA extraerá
            materias, salones y horarios para que los revises y edites antes de guardar.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Accessible Dropzone with Drag&Drop + Clipboard support */}
          <div
            role="button"
            tabIndex={0}
            aria-label="Subir, arrastrar o pegar imagen del horario"
            onClick={() => fileInputRef.current?.click()}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault()
                fileInputRef.current?.click()
              }
            }}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            className={cn(
              'border-2 border-dashed rounded-2xl p-6 text-center transition-all cursor-pointer space-y-2',
              isDragging
                ? 'border-primary bg-primary/10 scale-[1.01]'
                : 'border-border/80 glass-inset hover:border-primary/60'
            )}
          >
            <input
              type="file"
              ref={fileInputRef}
              onChange={(e) => {
                const file = e.target.files?.[0]
                if (file) processImageFile(file)
              }}
              accept="image/png, image/jpeg, image/webp"
              className="hidden"
            />
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary mx-auto">
              <Upload className="h-6 w-6" />
            </div>
            <div>
              <p className="text-sm font-semibold text-foreground">
                {selectedFile
                  ? selectedFile.name
                  : 'Arrastra tu imagen aquí, pega con Ctrl+V o haz clic'}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Formatos soportados: PNG, JPG, WebP. Se optimiza en tu navegador antes de enviar.
              </p>
            </div>
          </div>

          {/* Action Trigger & AI Provider Badge */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
            <div className="flex items-center gap-2">
              {aiProvider ? (
                <Badge
                  variant="success"
                  className="text-xs flex items-center gap-1.5 py-1 px-2.5 font-medium"
                >
                  <Bot className="h-3.5 w-3.5" />
                  <span>
                    IA: <strong>{aiProvider.toUpperCase()}</strong> ({aiModel})
                  </span>
                </Badge>
              ) : (
                <span className="text-xs text-muted-foreground">
                  Procesamiento multimodelo con cascada automática
                </span>
              )}
            </div>

            <Button
              onClick={handleAnalyze}
              disabled={!imageDataUrl || analyzing}
              className="h-9 text-xs flex items-center justify-center gap-2 shadow-sm cursor-pointer"
            >
              {analyzing ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Analizando horario con IA...
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4" />
                  Analizar Imagen
                </>
              )}
            </Button>
          </div>

          {/* Fully Editable Preview */}
          {extractedCourses.length > 0 && (
            <div className="space-y-3 pt-3 border-t border-border/40">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                  <span className="text-xs font-bold text-foreground">
                    {extractedCourses.length} materias detectadas · Vista previa editable
                  </span>
                </div>

                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleAddManualCourse}
                  className="h-7 text-xs text-primary hover:text-primary hover:bg-primary/10 flex items-center gap-1"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Agregar otra materia
                </Button>
              </div>

              <div className="space-y-4 max-h-[50vh] overflow-y-auto pr-1">
                {extractedCourses.map((c, courseIdx) => {
                  const colorCls = SUBJECT_COLOR_CLASSES[c.color] || 'subject-blue'

                  return (
                    <div
                      key={c.id}
                      className="glass-card rounded-2xl p-4 space-y-3 border border-border/50"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 flex-1">
                          {/* Subject color picker */}
                          <div className="w-24 shrink-0">
                            <Select
                              value={c.color}
                              onValueChange={(val: SubjectColor) =>
                                handleUpdateCourse(c.id, 'color', val)
                              }
                            >
                              <SelectTrigger className="h-8 text-xs glass-inset">
                                <span className={cn('subject-dot h-2.5 w-2.5 rounded-full mr-1', colorCls)} />
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {SUBJECT_COLORS.map((colorKey) => (
                                  <SelectItem key={colorKey} value={colorKey}>
                                    <div className="flex items-center gap-1.5">
                                      <span
                                        className={cn(
                                          'subject-dot h-2.5 w-2.5 rounded-full',
                                          SUBJECT_COLOR_CLASSES[colorKey]
                                        )}
                                      />
                                      <span>{SUBJECT_COLOR_LABELS[colorKey]}</span>
                                    </div>
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>

                          {/* Code */}
                          <Input
                            placeholder="Código"
                            value={c.code}
                            onChange={(e) => handleUpdateCourse(c.id, 'code', e.target.value)}
                            className="h-8 w-24 text-xs font-mono font-bold uppercase glass-inset"
                          />

                          {/* Name */}
                          <Input
                            placeholder="Nombre de la asignatura"
                            value={c.name}
                            onChange={(e) => handleUpdateCourse(c.id, 'name', e.target.value)}
                            className="h-8 flex-1 text-xs font-semibold glass-inset"
                          />
                        </div>

                        {/* Remove course */}
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleRemoveCourse(c.id)}
                          className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10 shrink-0"
                          title="Eliminar materia del preview"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                        {/* Professor */}
                        <div>
                          <Label className="text-[10px] text-muted-foreground">Docente</Label>
                          <Input
                            placeholder="Profesor asignado"
                            value={c.professor}
                            onChange={(e) => handleUpdateCourse(c.id, 'professor', e.target.value)}
                            className="h-7 text-xs glass-inset"
                          />
                        </div>

                        {/* Credits */}
                        <div>
                          <Label className="text-[10px] text-muted-foreground">Créditos</Label>
                          <Input
                            type="number"
                            min="1"
                            max="30"
                            value={c.credits}
                            onChange={(e) =>
                              handleUpdateCourse(c.id, 'credits', parseInt(e.target.value) || 1)
                            }
                            className="h-7 text-xs font-mono glass-inset"
                          />
                        </div>

                        {/* Semester */}
                        <div>
                          <Label className="text-[10px] text-muted-foreground">Semestre / Ciclo</Label>
                          <Input
                            placeholder="Ej: 2026-1"
                            value={c.semester}
                            onChange={(e) => handleUpdateCourse(c.id, 'semester', e.target.value)}
                            className="h-7 text-xs glass-inset"
                          />
                        </div>
                      </div>

                      {/* Schedules for this course */}
                      <div className="space-y-1.5 pt-2 border-t border-border/40">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-bold uppercase text-muted-foreground">
                            Bloques Horarios ({c.schedules.length})
                          </span>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleAddScheduleSlot(c.id)}
                            className="h-6 text-[10px] text-primary px-1.5 hover:bg-primary/10"
                          >
                            <Plus className="h-3 w-3 mr-0.5" />
                            Agregar Bloque
                          </Button>
                        </div>

                        {c.schedules.length === 0 ? (
                          <p className="text-[11px] text-muted-foreground italic">
                            Sin bloques de horario asignados.
                          </p>
                        ) : (
                          c.schedules.map((s, sIdx) => (
                            <div
                              key={sIdx}
                              className="flex items-center gap-2 p-1.5 rounded-xl glass-inset text-xs"
                            >
                              <div className="w-28">
                                <Select
                                  value={s.day}
                                  onValueChange={(val: DayOfWeek) =>
                                    handleUpdateSchedule(c.id, sIdx, 'day', val)
                                  }
                                >
                                  <SelectTrigger className="h-7 text-xs glass-inset">
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

                              <Input
                                type="time"
                                value={s.start_time}
                                onChange={(e) =>
                                  handleUpdateSchedule(c.id, sIdx, 'start_time', e.target.value)
                                }
                                className="h-7 w-24 text-xs font-mono glass-inset px-1 text-center"
                              />

                              <span className="text-muted-foreground">-</span>

                              <Input
                                type="time"
                                value={s.end_time}
                                onChange={(e) =>
                                  handleUpdateSchedule(c.id, sIdx, 'end_time', e.target.value)
                                }
                                className="h-7 w-24 text-xs font-mono glass-inset px-1 text-center"
                              />

                              <Input
                                placeholder="Aula / Salón"
                                value={s.room}
                                onChange={(e) =>
                                  handleUpdateSchedule(c.id, sIdx, 'room', e.target.value)
                                }
                                className="h-7 flex-1 text-xs glass-inset"
                              />

                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleRemoveScheduleSlot(c.id, sIdx)}
                                className="h-7 w-7 text-destructive hover:text-destructive shrink-0"
                                title="Eliminar bloque de horario"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-3 border-t border-border/40">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={importing}
            className="glass-inset text-xs"
          >
            Cerrar
          </Button>

          {extractedCourses.length > 0 && (
            <Button
              onClick={handleConfirmImport}
              disabled={importing}
              className="text-xs flex items-center gap-1.5 shadow-sm cursor-pointer"
            >
              {importing ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Importando materias...
                </>
              ) : (
                <>
                  <CheckCircle2 className="h-4 w-4" />
                  Confirmar e Importar {extractedCourses.length} Materias
                </>
              )}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
