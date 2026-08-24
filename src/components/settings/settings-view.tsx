'use client'

import * as React from 'react'
import type { Profile, CourseWithDetails, UserPreferences } from '@/types/database'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { AIImportDialog } from '@/components/ai/ai-import-dialog'
import { useTheme } from 'next-themes'
import {
  Settings,
  User,
  GraduationCap,
  Palette,
  Database,
  Sparkles,
  Download,
  Upload,
  Save,
  CheckCircle2,
} from 'lucide-react'
import { updateProfile, updatePreferences } from '@/lib/actions/profile'
import { createCourse } from '@/lib/actions/courses'
import { toast } from 'sonner'

interface SettingsViewProps {
  profile: Profile | null
  courses: CourseWithDetails[]
}

export function SettingsView({ profile, courses }: SettingsViewProps) {
  const { theme, setTheme } = useTheme()
  const [aiDialogOpen, setAiDialogOpen] = React.useState(false)
  const [saving, setSaving] = React.useState(false)

  // Profile Form State
  const [displayName, setDisplayName] = React.useState(profile?.display_name || '')
  const [university, setUniversity] = React.useState(profile?.university || '')
  const [faculty, setFaculty] = React.useState(profile?.faculty || '')
  const [currentSemester, setCurrentSemester] = React.useState(profile?.current_semester || '')

  // Academic Settings State
  const [passingGrade, setPassingGrade] = React.useState(
    profile?.passing_grade !== undefined ? profile.passing_grade.toString() : '3.0'
  )
  const [maxGrade, setMaxGrade] = React.useState(
    profile?.max_grade !== undefined ? profile.max_grade.toString() : '5.0'
  )

  // Appearance Preferences State
  const prefs = (profile?.preferences || {}) as Partial<UserPreferences>
  const [gridCompact, setGridCompact] = React.useState<boolean>(prefs.gridCompact ?? false)
  const [timeFormat24h, setTimeFormat24h] = React.useState<boolean>(prefs.timeFormat24h ?? true)
  const [weekStartsOn, setWeekStartsOn] = React.useState<'monday' | 'sunday'>(
    prefs.weekStartsOn ?? 'monday'
  )

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      setSaving(true)
      await updateProfile({
        display_name: displayName.trim(),
        university: university.trim(),
        faculty: faculty.trim(),
        current_semester: currentSemester.trim(),
        passing_grade: parseFloat(passingGrade) || 3.0,
        max_grade: parseFloat(maxGrade) || 5.0,
      })
      toast.success('Perfil y ajustes académicos actualizados')
    } catch (err: any) {
      toast.error(err.message || 'Error al guardar el perfil')
    } finally {
      setSaving(false)
    }
  }

  const handleSavePreferences = async () => {
    try {
      setSaving(true)
      await updatePreferences({
        gridCompact,
        timeFormat24h,
        weekStartsOn,
      })
      toast.success('Preferencias de visualización guardadas')
    } catch (err: any) {
      toast.error(err.message || 'Error al guardar preferencias')
    } finally {
      setSaving(false)
    }
  }

  // Backup: Export JSON
  const handleExportJSON = () => {
    try {
      const dataStr = JSON.stringify(courses, null, 2)
      const blob = new Blob([dataStr], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `amellify_backup_${new Date().toISOString().slice(0, 10)}.json`
      a.click()
      URL.revokeObjectURL(url)
      toast.success('Copia de seguridad descargada en JSON')
    } catch (err) {
      toast.error('Error al exportar datos')
    }
  }

  // Backup: Import JSON
  const handleImportJSON = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = async (event) => {
      try {
        const json = JSON.parse(event.target?.result as string)
        if (!Array.isArray(json)) throw new Error('El JSON debe contener un arreglo de materias')

        let imported = 0
        for (const item of json) {
          await createCourse(
            {
              code: item.code || 'MATERIA',
              name: item.name || 'Materia importada',
              professor: item.professor || '',
              email: item.email || '',
              faculty: item.faculty || '',
              semester: item.semester || '',
              credits: item.credits || 3,
              color: item.color || 'blue',
              status: item.status || 'active',
            },
            item.schedules || []
          )
          imported++
        }
        toast.success(`¡${imported} materias importadas correctamente!`)
      } catch (err: any) {
        toast.error(`Error al importar JSON: ${err.message}`)
      }
    }
    reader.readAsText(file)
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
          <Settings className="h-6 w-6 text-primary" />
          Configuración
        </h2>
        <p className="text-xs text-muted-foreground mt-1">
          Personaliza tu perfil universitario, escala de notas, apariencia y datos.
        </p>
      </div>

      <Tabs defaultValue="profile" className="space-y-6">
        <TabsList className="grid grid-cols-4 max-w-md">
          <TabsTrigger value="profile" className="text-xs">
            Perfil
          </TabsTrigger>
          <TabsTrigger value="academic" className="text-xs">
            Académico
          </TabsTrigger>
          <TabsTrigger value="appearance" className="text-xs">
            Apariencia
          </TabsTrigger>
          <TabsTrigger value="data" className="text-xs">
            Datos & IA
          </TabsTrigger>
        </TabsList>

        {/* Tab 1: Profile */}
        <TabsContent value="profile">
          <Card className="glass-panel border-border/80 shadow-sm max-w-2xl">
            <CardHeader className="p-5 pb-3">
              <CardTitle className="text-base font-bold flex items-center gap-2">
                <User className="h-4 w-4 text-primary" />
                Información del Estudiante
              </CardTitle>
              <CardDescription className="text-xs">
                Tus datos institucionales se mostrarán en la barra superior y reportes.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-5 pt-2">
              <form onSubmit={handleSaveProfile} className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="displayName" className="text-xs">Nombre completo o apodo</Label>
                  <Input
                    id="displayName"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    placeholder="Manuel Amell"
                    className="h-9 text-xs"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="university" className="text-xs">Universidad / Institución</Label>
                    <Input
                      id="university"
                      value={university}
                      onChange={(e) => setUniversity(e.target.value)}
                      placeholder="Universidad de Cartagena"
                      className="h-9 text-xs"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="faculty" className="text-xs">Facultad / Carrera</Label>
                    <Input
                      id="faculty"
                      value={faculty}
                      onChange={(e) => setFaculty(e.target.value)}
                      placeholder="Ingeniería de Sistemas"
                      className="h-9 text-xs"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="semester" className="text-xs">Semestre Actual</Label>
                  <Input
                    id="semester"
                    value={currentSemester}
                    onChange={(e) => setCurrentSemester(e.target.value)}
                    placeholder="2026-1 (Semestre 7)"
                    className="h-9 text-xs"
                  />
                </div>

                <Button type="submit" disabled={saving} className="text-xs flex items-center gap-1.5">
                  <Save className="h-4 w-4" />
                  {saving ? 'Guardando...' : 'Guardar Perfil'}
                </Button>
              </form>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab 2: Academic Settings */}
        <TabsContent value="academic">
          <Card className="glass-panel border-border/80 shadow-sm max-w-2xl">
            <CardHeader className="p-5 pb-3">
              <CardTitle className="text-base font-bold flex items-center gap-2">
                <GraduationCap className="h-4 w-4 text-primary" />
                Escala de Calificaciones
              </CardTitle>
              <CardDescription className="text-xs">
                Configura la escala de notas de tu universidad y el puntaje mínimo de aprobación.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-5 pt-2">
              <form onSubmit={handleSaveProfile} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label className="text-xs">Escala Máxima de Calificación</Label>
                    <Select
                      value={maxGrade}
                      onValueChange={(val) => {
                        setMaxGrade(val)
                        if (val === '5.0') setPassingGrade('3.0')
                        else if (val === '7.0') setPassingGrade('4.0')
                        else if (val === '10.0') setPassingGrade('6.0')
                      }}
                    >
                      <SelectTrigger className="h-9 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="5.0">0 a 5.0 (Colombia - Default)</SelectItem>
                        <SelectItem value="7.0">0 a 7.0 (Chile)</SelectItem>
                        <SelectItem value="10.0">0 a 10.0 (México, España, etc.)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="passingGrade" className="text-xs">Nota Mínima Aprobatoria</Label>
                    <Input
                      id="passingGrade"
                      type="number"
                      step="0.01"
                      min="0"
                      max={maxGrade}
                      value={passingGrade}
                      onChange={(e) => setPassingGrade(e.target.value)}
                      className="h-9 text-xs font-mono"
                      required
                    />
                  </div>
                </div>

                <div className="rounded-lg bg-muted/30 p-3 text-xs text-muted-foreground">
                  💡 La calculadora de notas usará esta nota mínima ({passingGrade} / {maxGrade}) para calcular automáticamente cuánto necesitas en tus parciales pendientes para aprobar cada asignatura.
                </div>

                <Button type="submit" disabled={saving} className="text-xs flex items-center gap-1.5">
                  <Save className="h-4 w-4" />
                  {saving ? 'Guardando...' : 'Guardar Escala Académica'}
                </Button>
              </form>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab 3: Appearance */}
        <TabsContent value="appearance">
          <Card className="glass-panel border-border/80 shadow-sm max-w-2xl">
            <CardHeader className="p-5 pb-3">
              <CardTitle className="text-base font-bold flex items-center gap-2">
                <Palette className="h-4 w-4 text-primary" />
                Tema y Visualización del Grid
              </CardTitle>
              <CardDescription className="text-xs">
                Ajusta la apariencia del horario según tus preferencias.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-5 pt-2 space-y-5">
              {/* Theme Switcher */}
              <div className="space-y-1.5">
                <Label className="text-xs">Modo de Color</Label>
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant={theme === 'light' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setTheme('light')}
                    className="h-8 text-xs"
                  >
                    ☀️ Claro
                  </Button>
                  <Button
                    type="button"
                    variant={theme === 'dark' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setTheme('dark')}
                    className="h-8 text-xs"
                  >
                    🌙 Oscuro
                  </Button>
                  <Button
                    type="button"
                    variant={theme === 'system' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setTheme('system')}
                    className="h-8 text-xs"
                  >
                    💻 Sistema
                  </Button>
                </div>
              </div>

              {/* Grid Compact Mode */}
              <div className="flex items-center justify-between py-2 border-t border-border/50">
                <div className="space-y-0.5">
                  <Label className="text-xs font-semibold">Grid Compacto</Label>
                  <p className="text-[11px] text-muted-foreground">
                    Reduce el alto de las celdas horarias para ver más horas sin desplazarte.
                  </p>
                </div>
                <Switch checked={gridCompact} onCheckedChange={setGridCompact} />
              </div>

              {/* 24h Format */}
              <div className="flex items-center justify-between py-2 border-t border-border/50">
                <div className="space-y-0.5">
                  <Label className="text-xs font-semibold">Formato 24 Horas</Label>
                  <p className="text-[11px] text-muted-foreground">
                    Muestra 14:00 en lugar de 2:00 PM.
                  </p>
                </div>
                <Switch checked={timeFormat24h} onCheckedChange={setTimeFormat24h} />
              </div>

              {/* Week Starts On */}
              <div className="flex items-center justify-between py-2 border-t border-border/50">
                <div className="space-y-0.5">
                  <Label className="text-xs font-semibold">Primer día de la semana</Label>
                  <p className="text-[11px] text-muted-foreground">
                    Orden del horario semanal en el grid.
                  </p>
                </div>
                <div className="w-36">
                  <Select
                    value={weekStartsOn}
                    onValueChange={(val: any) => setWeekStartsOn(val)}
                  >
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="monday">Lunes</SelectItem>
                      <SelectItem value="sunday">Domingo</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="pt-2 border-t">
                <Button
                  onClick={handleSavePreferences}
                  disabled={saving}
                  className="text-xs flex items-center gap-1.5"
                >
                  <Save className="h-4 w-4" />
                  {saving ? 'Guardando...' : 'Guardar Preferencias'}
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab 4: Data & AI */}
        <TabsContent value="data">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-3xl">
            {/* AI Import Tool */}
            <Card className="glass-panel border-border/80 shadow-sm">
              <CardHeader className="p-5 pb-3">
                <CardTitle className="text-base font-bold flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-accent" />
                  Escanear Horario con IA
                </CardTitle>
                <CardDescription className="text-xs">
                  Sube una foto o PDF de tu horario institucional para extraerlo automáticamente.
                </CardDescription>
              </CardHeader>
              <CardContent className="p-5 pt-1 space-y-3">
                <p className="text-xs text-muted-foreground">
                  Procesado con Gemini 2.0 Flash / OpenRouter y cargado directamente en tu base de datos Supabase.
                </p>
                <Button
                  onClick={() => setAiDialogOpen(true)}
                  className="w-full text-xs flex items-center justify-center gap-1.5"
                >
                  <Sparkles className="h-4 w-4" />
                  Abrir Escáner de IA
                </Button>
              </CardContent>
            </Card>

            {/* JSON Backup & Restore */}
            <Card className="glass-panel border-border/80 shadow-sm">
              <CardHeader className="p-5 pb-3">
                <CardTitle className="text-base font-bold flex items-center gap-2">
                  <Database className="h-4 w-4 text-primary" />
                  Copia de Seguridad JSON
                </CardTitle>
                <CardDescription className="text-xs">
                  Exporta o importa tus materias y horarios en formato JSON.
                </CardDescription>
              </CardHeader>
              <CardContent className="p-5 pt-1 space-y-3">
                <Button
                  variant="outline"
                  onClick={handleExportJSON}
                  className="w-full text-xs flex items-center justify-center gap-1.5"
                >
                  <Download className="h-4 w-4" />
                  Descargar Copia JSON
                </Button>

                <div className="relative">
                  <input
                    type="file"
                    accept=".json"
                    onChange={handleImportJSON}
                    className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                  />
                  <Button
                    variant="outline"
                    className="w-full text-xs flex items-center justify-center gap-1.5 pointer-events-none"
                  >
                    <Upload className="h-4 w-4" />
                    Restaurar desde JSON
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      {/* AI Import Modal */}
      <AIImportDialog open={aiDialogOpen} onOpenChange={setAiDialogOpen} />
    </div>
  )
}
