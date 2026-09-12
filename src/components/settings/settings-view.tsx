'use client'

import * as React from 'react'
import type { CourseWithDetails, UserPreferences } from '@/types/database'
import type { UserProfile } from '@/types/domain'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Progress } from '@/components/ui/progress'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
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
  ShieldAlert,
  KeyRound,
  Trash2,
} from 'lucide-react'
import {
  updateProfile,
  updatePreferences,
  changePassword,
  deleteAccount,
  exportData,
  importData,
} from '@/lib/actions/profile'
import { toast } from 'sonner'

interface SettingsViewProps {
  profile: (UserProfile & { display_name?: string | null; current_semester?: string; passing_grade?: number; max_grade?: number }) | null
  courses: CourseWithDetails[]
}

export function SettingsView({ profile, courses: _courses }: SettingsViewProps) {
  const router = useRouter()
  const { theme, setTheme } = useTheme()
  const [aiDialogOpen, setAiDialogOpen] = React.useState(false)
  const [savingProfile, setSavingProfile] = React.useState(false)
  const [savingPrefs, setSavingPrefs] = React.useState(false)

  // Profile Form State
  const initialName = profile?.displayName ?? profile?.display_name ?? ''
  const initialSemester = profile?.currentSemester ?? profile?.current_semester ?? ''
  const initialPassing = Number(profile?.passingGrade ?? profile?.passing_grade ?? 3.0)
  const initialMax = Number(profile?.maxGrade ?? profile?.max_grade ?? 5.0)

  const [displayName, setDisplayName] = React.useState(initialName)
  const [university, setUniversity] = React.useState(profile?.university || '')
  const [faculty, setFaculty] = React.useState(profile?.faculty || '')
  const [currentSemester, setCurrentSemester] = React.useState(initialSemester)

  // Academic Settings State (Bug H13 fix: normalize numbers & strings)
  const [passingGrade, setPassingGrade] = React.useState<string>(initialPassing.toString())
  const [maxGrade, setMaxGrade] = React.useState<string>(initialMax.toString())

  // Appearance Preferences State
  const prefs = (profile?.preferences || {}) as Partial<UserPreferences>
  const [gridCompact, setGridCompact] = React.useState<boolean>(prefs.gridCompact ?? false)
  const [timeFormat24h, setTimeFormat24h] = React.useState<boolean>(prefs.timeFormat24h ?? true)
  const [weekStartsOn, setWeekStartsOn] = React.useState<'monday' | 'sunday'>(
    prefs.weekStartsOn ?? 'monday'
  )

  // Data Import / Export State
  const [isExporting, setIsExporting] = React.useState(false)
  const [isImporting, setIsImporting] = React.useState(false)
  const [importProgress, setImportProgress] = React.useState(0)
  const fileInputRef = React.useRef<HTMLInputElement>(null)

  // Account Tab State
  const [currentPassword, setCurrentPassword] = React.useState('')
  const [newPassword, setNewPassword] = React.useState('')
  const [confirmPassword, setConfirmPassword] = React.useState('')
  const [changingPassword, setChangingPassword] = React.useState(false)

  // Delete Account Modal State
  const [deleteDialogOpen, setDeleteDialogOpen] = React.useState(false)
  const [deleteConfirmationInput, setDeleteConfirmationInput] = React.useState('')
  const [isDeletingAccount, setIsDeletingAccount] = React.useState(false)

  // Save Profile (User info + academic scale)
  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault()
    const numPassing = parseFloat(passingGrade)
    const numMax = parseFloat(maxGrade)

    if (isNaN(numPassing) || isNaN(numMax)) {
      toast.error('Las notas deben ser números válidos')
      return
    }

    if (numMax <= numPassing) {
      toast.error('La nota máxima debe ser estrictamente mayor a la nota mínima de aprobación')
      return
    }

    try {
      setSavingProfile(true)
      const res = await updateProfile({
        displayName: displayName.trim() || undefined,
        university: university.trim() || undefined,
        faculty: faculty.trim() || undefined,
        currentSemester: currentSemester.trim() || undefined,
        passingGrade: numPassing,
        maxGrade: numMax,
      })

      if (!res.ok) {
        toast.error(res.error || 'Error al guardar el perfil')
        return
      }

      toast.success('Perfil y configuración académica guardados con éxito')
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Error al guardar el perfil'
      toast.error(message)
    } finally {
      setSavingProfile(false)
    }
  }

  // Save Appearance Preferences
  const handleSavePreferences = async () => {
    try {
      setSavingPrefs(true)
      const res = await updatePreferences({
        gridCompact,
        timeFormat24h,
        weekStartsOn,
      })

      if (!res.ok) {
        toast.error(res.error || 'Error al guardar preferencias')
        return
      }

      toast.success('Preferencias de visualización actualizadas')
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Error al guardar preferencias'
      toast.error(message)
    } finally {
      setSavingPrefs(false)
    }
  }

  // Backup: Export JSON using transactional server action
  const handleExportJSON = async () => {
    try {
      setIsExporting(true)
      const res = await exportData()
      if (!res.ok) {
        toast.error(res.error || 'Error al exportar datos')
        return
      }

      const dataStr = JSON.stringify(res.data, null, 2)
      const blob = new Blob([dataStr], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `amellify_backup_${new Date().toISOString().slice(0, 10)}.json`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)

      toast.success('Copia de seguridad descargada exitosamente en JSON')
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Error al exportar datos'
      toast.error(message)
    } finally {
      setIsExporting(false)
    }
  }

  // Backup: Import JSON with transactional Zod validation & progress bar
  const handleImportFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setIsImporting(true)
    setImportProgress(20)

    const reader = new FileReader()
    reader.onload = async (event) => {
      try {
        setImportProgress(50)
        const rawJson = JSON.parse(event.target?.result as string)

        setImportProgress(75)
        const res = await importData(rawJson)

        setImportProgress(100)
        if (!res.ok) {
          toast.error(res.error || 'Los datos del archivo JSON no son válidos')
          return
        }

        toast.success(
          `¡Importación completada! ${res.data.imported} materias añadidas, ${res.data.skipped} omitidas por existir previamente.`
        )
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Error desconocido'
        toast.error(`Error al procesar el archivo: ${message}`)
      } finally {
        setTimeout(() => {
          setIsImporting(false)
          setImportProgress(0)
          if (fileInputRef.current) fileInputRef.current.value = ''
        }, 600)
      }
    }

    reader.onerror = () => {
      toast.error('Error al leer el archivo seleccionado')
      setIsImporting(false)
      setImportProgress(0)
    }

    reader.readAsText(file)
  }

  // Change Password
  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!currentPassword) {
      toast.error('Ingresa tu contraseña actual')
      return
    }

    if (newPassword.length < 8) {
      toast.error('La nueva contraseña debe tener al menos 8 caracteres')
      return
    }

    if (newPassword !== confirmPassword) {
      toast.error('Las contraseñas no coinciden')
      return
    }

    try {
      setChangingPassword(true)
      const res = await changePassword({
        currentPassword,
        newPassword,
      })

      if (!res.ok) {
        toast.error(res.error || 'No fue posible cambiar la contraseña')
        return
      }

      toast.success('Contraseña actualizada con éxito')
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Error al cambiar contraseña'
      toast.error(message)
    } finally {
      setChangingPassword(false)
    }
  }

  // Delete Account
  const handleConfirmDeleteAccount = async () => {
    if (deleteConfirmationInput !== 'ELIMINAR') {
      toast.error('Escribe ELIMINAR en mayúsculas para confirmar')
      return
    }

    try {
      setIsDeletingAccount(true)
      const res = await deleteAccount({ confirmation: 'ELIMINAR' })
      if (!res.ok) {
        toast.error(res.error || 'No fue posible eliminar la cuenta')
        return
      }

      toast.success('Cuenta eliminada. Hasta pronto.')
      router.push('/login')
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Error al eliminar la cuenta'
      toast.error(message)
    } finally {
      setIsDeletingAccount(false)
    }
  }

  // Scale preset selector helper
  const handleScalePresetChange = (presetValue: string) => {
    if (presetValue === '5.0') {
      setMaxGrade('5.0')
      setPassingGrade('3.0')
    } else if (presetValue === '7.0') {
      setMaxGrade('7.0')
      setPassingGrade('4.0')
    } else if (presetValue === '10.0') {
      setMaxGrade('10.0')
      setPassingGrade('6.0')
    }
  }

  // Normalize maxGrade to match preset select values
  const currentMaxNum = parseFloat(maxGrade)
  const normalizedPreset =
    currentMaxNum === 5 ? '5.0' : currentMaxNum === 7 ? '7.0' : currentMaxNum === 10 ? '10.0' : 'custom'

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
          <Settings className="h-6 w-6 text-primary" />
          Configuración
        </h2>
        <p className="text-xs text-muted-foreground mt-1">
          Personaliza tu perfil universitario, escala de calificaciones, visualización y gestión de
          cuenta.
        </p>
      </div>

      {/* Segmented Glass Tabs */}
      <Tabs defaultValue="profile" className="space-y-6">
        <TabsList className="grid grid-cols-2 sm:grid-cols-5 glass-inset p-1 rounded-2xl w-full max-w-2xl">
          <TabsTrigger value="profile" className="text-xs rounded-xl">
            Perfil
          </TabsTrigger>
          <TabsTrigger value="academic" className="text-xs rounded-xl">
            Académico
          </TabsTrigger>
          <TabsTrigger value="appearance" className="text-xs rounded-xl">
            Apariencia
          </TabsTrigger>
          <TabsTrigger value="data" className="text-xs rounded-xl">
            Datos & IA
          </TabsTrigger>
          <TabsTrigger value="account" className="text-xs rounded-xl">
            Cuenta
          </TabsTrigger>
        </TabsList>

        {/* Tab 1: Profile */}
        <TabsContent value="profile">
          <div className="glass-card rounded-2xl p-6 max-w-2xl space-y-5">
            <div className="border-b border-border/40 pb-3">
              <h3 className="text-base font-bold flex items-center gap-2 text-foreground">
                <User className="h-4 w-4 text-primary" />
                Información del Estudiante
              </h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                Tus datos institucionales se mostrarán en la barra superior, horarios y reportes.
              </p>
            </div>

            <form onSubmit={handleSaveProfile} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="displayName" className="text-xs font-semibold">
                  Nombre completo o apodo
                </Label>
                <Input
                  id="displayName"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="Manuel Amell"
                  className="h-9 text-xs glass-inset"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="university" className="text-xs font-semibold">
                    Universidad / Institución
                  </Label>
                  <Input
                    id="university"
                    value={university}
                    onChange={(e) => setUniversity(e.target.value)}
                    placeholder="Universidad de Cartagena"
                    className="h-9 text-xs glass-inset"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="faculty" className="text-xs font-semibold">
                    Facultad / Programa
                  </Label>
                  <Input
                    id="faculty"
                    value={faculty}
                    onChange={(e) => setFaculty(e.target.value)}
                    placeholder="Ingeniería de Sistemas"
                    className="h-9 text-xs glass-inset"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="semester" className="text-xs font-semibold">
                  Semestre Actual
                </Label>
                <Input
                  id="semester"
                  value={currentSemester}
                  onChange={(e) => setCurrentSemester(e.target.value)}
                  placeholder="2026-1"
                  className="h-9 text-xs glass-inset"
                />
              </div>

              <div className="pt-2">
                <Button
                  type="submit"
                  disabled={savingProfile}
                  className="text-xs flex items-center gap-1.5 shadow-sm cursor-pointer"
                >
                  <Save className="h-4 w-4" />
                  {savingProfile ? 'Guardando...' : 'Guardar Perfil'}
                </Button>
              </div>
            </form>
          </div>
        </TabsContent>

        {/* Tab 2: Academic Settings (Bug H13 fix) */}
        <TabsContent value="academic">
          <div className="glass-card rounded-2xl p-6 max-w-2xl space-y-5">
            <div className="border-b border-border/40 pb-3">
              <h3 className="text-base font-bold flex items-center gap-2 text-foreground">
                <GraduationCap className="h-4 w-4 text-primary" />
                Escala de Calificaciones y Aprobación
              </h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                Ajusta la escala numérica y la nota mínima requerida para aprobar asignaturas en tu
                universidad.
              </p>
            </div>

            <form onSubmit={handleSaveProfile} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">Plantilla de Escala</Label>
                  <Select
                    value={normalizedPreset}
                    onValueChange={handleScalePresetChange}
                  >
                    <SelectTrigger className="h-9 text-xs glass-inset">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="5.0">0 a 5.0 (Colombia - Por defecto)</SelectItem>
                      <SelectItem value="7.0">0 a 7.0 (Chile)</SelectItem>
                      <SelectItem value="10.0">0 a 10.0 (México, España, etc.)</SelectItem>
                      <SelectItem value="custom">Personalizada</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="maxGradeInput" className="text-xs font-semibold">
                    Calificación Máxima
                  </Label>
                  <Input
                    id="maxGradeInput"
                    type="number"
                    step="0.1"
                    min="1"
                    max="1000"
                    value={maxGrade}
                    onChange={(e) => setMaxGrade(e.target.value)}
                    className="h-9 text-xs font-mono glass-inset"
                    required
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="passingGrade" className="text-xs font-semibold">
                  Nota Mínima Aprobatoria
                </Label>
                <Input
                  id="passingGrade"
                  type="number"
                  step="0.01"
                  min="0"
                  max={maxGrade}
                  value={passingGrade}
                  onChange={(e) => setPassingGrade(e.target.value)}
                  className="h-9 text-xs font-mono glass-inset max-w-xs"
                  required
                />
              </div>

              <div className="rounded-xl glass-inset p-3.5 text-xs text-muted-foreground leading-relaxed">
                💡 <strong>¿Cómo funciona?</strong> La calculadora y estadísticas utilizarán esta nota
                mínima de aprobación (<strong>{passingGrade} / {maxGrade}</strong>) para calcular con
                exactitud la nota requerida en los parciales pendientes y señalar materias en riesgo.
              </div>

              <div className="pt-2">
                <Button
                  type="submit"
                  disabled={savingProfile}
                  className="text-xs flex items-center gap-1.5 shadow-sm cursor-pointer"
                >
                  <Save className="h-4 w-4" />
                  {savingProfile ? 'Guardando...' : 'Guardar Escala Académica'}
                </Button>
              </div>
            </form>
          </div>
        </TabsContent>

        {/* Tab 3: Appearance */}
        <TabsContent value="appearance">
          <div className="glass-card rounded-2xl p-6 max-w-2xl space-y-5">
            <div className="border-b border-border/40 pb-3">
              <h3 className="text-base font-bold flex items-center gap-2 text-foreground">
                <Palette className="h-4 w-4 text-primary" />
                Tema y Visualización del Horario
              </h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                Personaliza el modo de color, la densidad del grid y el orden semanal.
              </p>
            </div>

            <div className="space-y-5">
              {/* Theme Switcher */}
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Modo de Color</Label>
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant={theme === 'light' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setTheme('light')}
                    className="h-8 text-xs glass-inset"
                  >
                    ☀️ Claro
                  </Button>
                  <Button
                    type="button"
                    variant={theme === 'dark' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setTheme('dark')}
                    className="h-8 text-xs glass-inset"
                  >
                    🌙 Oscuro
                  </Button>
                  <Button
                    type="button"
                    variant={theme === 'system' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setTheme('system')}
                    className="h-8 text-xs glass-inset"
                  >
                    💻 Sistema
                  </Button>
                </div>
              </div>

              {/* Grid Compact Mode */}
              <div className="flex items-center justify-between py-2 border-t border-border/40">
                <div className="space-y-0.5">
                  <Label className="text-xs font-semibold">Grid Compacto</Label>
                  <p className="text-[11px] text-muted-foreground">
                    Reduce la altura de cada bloque horario para visualizar más contenido en pantalla.
                  </p>
                </div>
                <Switch checked={gridCompact} onCheckedChange={setGridCompact} />
              </div>

              {/* 24h Format */}
              <div className="flex items-center justify-between py-2 border-t border-border/40">
                <div className="space-y-0.5">
                  <Label className="text-xs font-semibold">Formato de 24 Horas</Label>
                  <p className="text-[11px] text-muted-foreground">
                    Visualiza 14:00 en lugar de 2:00 PM.
                  </p>
                </div>
                <Switch checked={timeFormat24h} onCheckedChange={setTimeFormat24h} />
              </div>

              {/* Week Starts On */}
              <div className="flex items-center justify-between py-2 border-t border-border/40">
                <div className="space-y-0.5">
                  <Label className="text-xs font-semibold">Primer día de la semana</Label>
                  <p className="text-[11px] text-muted-foreground">
                    Orden de los días en la vista de cuadrícula.
                  </p>
                </div>
                <div className="w-36">
                  <Select
                    value={weekStartsOn}
                    onValueChange={(val) => setWeekStartsOn(val as 'monday' | 'sunday')}
                  >
                    <SelectTrigger className="h-8 text-xs glass-inset">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="monday">Lunes</SelectItem>
                      <SelectItem value="sunday">Domingo</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="pt-2 border-t border-border/40">
                <Button
                  onClick={handleSavePreferences}
                  disabled={savingPrefs}
                  className="text-xs flex items-center gap-1.5 cursor-pointer"
                >
                  <Save className="h-4 w-4" />
                  {savingPrefs ? 'Guardando...' : 'Guardar Preferencias'}
                </Button>
              </div>
            </div>
          </div>
        </TabsContent>

        {/* Tab 4: Data & AI (Backup JSON & AI scanner) */}
        <TabsContent value="data">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-3xl">
            {/* AI Import Tool */}
            <div className="glass-card rounded-2xl p-5 flex flex-col justify-between space-y-4">
              <div>
                <h3 className="text-base font-bold flex items-center gap-2 text-foreground">
                  <Sparkles className="h-4 w-4 text-accent" />
                  Escanear Horario con IA
                </h3>
                <p className="text-xs text-muted-foreground mt-1">
                  Sube una foto de tu horario institucional para extraer automáticamente materias,
                  aulas y profesores con Inteligencia Artificial.
                </p>
              </div>

              <div className="space-y-3">
                <p className="text-[11px] text-muted-foreground">
                  Procesamiento visual en cascada con Gemini 2.0 Flash y vista previa editable antes
                  de importar.
                </p>
                <Button
                  onClick={() => setAiDialogOpen(true)}
                  className="w-full text-xs flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <Sparkles className="h-4 w-4" />
                  Abrir Escáner de IA
                </Button>
              </div>
            </div>

            {/* JSON Backup & Restore with Zod and Progress */}
            <div className="glass-card rounded-2xl p-5 flex flex-col justify-between space-y-4">
              <div>
                <h3 className="text-base font-bold flex items-center gap-2 text-foreground">
                  <Database className="h-4 w-4 text-primary" />
                  Copia de Seguridad JSON
                </h3>
                <p className="text-xs text-muted-foreground mt-1">
                  Exporta tus materias, horarios y notas en un archivo JSON transaccional o restaura
                  desde un respaldo previo.
                </p>
              </div>

              <div className="space-y-3">
                {isImporting && (
                  <div className="space-y-1.5 p-2 rounded-xl glass-inset">
                    <div className="flex justify-between text-[11px] text-muted-foreground">
                      <span>Importando datos...</span>
                      <span className="font-mono">{importProgress}%</span>
                    </div>
                    <Progress value={importProgress} className="h-1.5" />
                  </div>
                )}

                <Button
                  variant="outline"
                  onClick={handleExportJSON}
                  disabled={isExporting}
                  className="w-full text-xs flex items-center justify-center gap-1.5 glass-inset cursor-pointer"
                >
                  <Download className="h-4 w-4" />
                  {isExporting ? 'Descargando...' : 'Descargar Copia JSON'}
                </Button>

                <div className="relative">
                  <input
                    type="file"
                    ref={fileInputRef}
                    accept=".json,application/json"
                    onChange={handleImportFileChange}
                    disabled={isImporting}
                    className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                  />
                  <Button
                    variant="outline"
                    disabled={isImporting}
                    className="w-full text-xs flex items-center justify-center gap-1.5 glass-inset pointer-events-none"
                  >
                    <Upload className="h-4 w-4" />
                    {isImporting ? 'Importando...' : 'Restaurar desde JSON'}
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </TabsContent>

        {/* Tab 5: Account (Password change & Delete account) */}
        <TabsContent value="account">
          <div className="space-y-6 max-w-2xl">
            {/* Change Password Card */}
            <div className="glass-card rounded-2xl p-6 space-y-5">
              <div className="border-b border-border/40 pb-3">
                <h3 className="text-base font-bold flex items-center gap-2 text-foreground">
                  <KeyRound className="h-4 w-4 text-primary" />
                  Cambiar Contraseña
                </h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Actualiza tu clave de acceso. Se revocarán las demás sesiones abiertas.
                </p>
              </div>

              <form onSubmit={handleChangePassword} className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="currentPass" className="text-xs font-semibold">
                    Contraseña actual
                  </Label>
                  <Input
                    id="currentPass"
                    type="password"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    placeholder="••••••••"
                    className="h-9 text-xs glass-inset"
                    required
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="newPass" className="text-xs font-semibold">
                      Nueva contraseña
                    </Label>
                    <Input
                      id="newPass"
                      type="password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="Mínimo 8 caracteres"
                      className="h-9 text-xs glass-inset"
                      required
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="confirmPass" className="text-xs font-semibold">
                      Confirmar nueva contraseña
                    </Label>
                    <Input
                      id="confirmPass"
                      type="password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Repite la contraseña"
                      className="h-9 text-xs glass-inset"
                      required
                    />
                  </div>
                </div>

                <div className="pt-2">
                  <Button
                    type="submit"
                    disabled={changingPassword}
                    className="text-xs flex items-center gap-1.5 shadow-sm cursor-pointer"
                  >
                    <KeyRound className="h-4 w-4" />
                    {changingPassword ? 'Actualizando...' : 'Actualizar Contraseña'}
                  </Button>
                </div>
              </form>
            </div>

            {/* Danger Zone: Delete Account */}
            <div className="glass-card rounded-2xl p-6 border-destructive/40 bg-destructive/5 space-y-4">
              <div>
                <h3 className="text-base font-bold flex items-center gap-2 text-destructive">
                  <ShieldAlert className="h-5 w-5" />
                  Zona de Peligro · Eliminar Cuenta
                </h3>
                <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                  Eliminar tu cuenta borrará definitivamente todos tus datos, incluyendo materias,
                  horarios de clase, notas parciales, configuraciones y preferencias. Esta acción es
                  irreversible.
                </p>
              </div>

              <div>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => {
                    setDeleteConfirmationInput('')
                    setDeleteDialogOpen(true)
                  }}
                  className="text-xs flex items-center gap-1.5 cursor-pointer"
                >
                  <Trash2 className="h-4 w-4" />
                  Eliminar mi cuenta definitivamente
                </Button>
              </div>
            </div>
          </div>
        </TabsContent>
      </Tabs>

      {/* AI Import Modal */}
      <AIImportDialog open={aiDialogOpen} onOpenChange={setAiDialogOpen} />

      {/* Accessible AlertDialog for Account Deletion */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-destructive">
              <Trash2 className="h-5 w-5" />
              ¿Eliminar cuenta permanentemente?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-xs leading-relaxed space-y-2">
              <p>
                Esta acción <strong>no se puede deshacer</strong>. Perderás el acceso a todas tus
                materias registradas, horarios, parciales calculados y configuraciones asociadas.
              </p>
              <p className="font-semibold text-foreground pt-1">
                Para confirmar, escribe la palabra <span className="font-mono text-destructive">ELIMINAR</span> a continuación:
              </p>
            </AlertDialogDescription>
          </AlertDialogHeader>

          <div className="py-2">
            <Input
              value={deleteConfirmationInput}
              onChange={(e) => setDeleteConfirmationInput(e.target.value)}
              placeholder="Escribe ELIMINAR para confirmar"
              className="glass-inset text-xs font-mono"
            />
          </div>

          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeletingAccount}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              disabled={deleteConfirmationInput !== 'ELIMINAR' || isDeletingAccount}
              onClick={handleConfirmDeleteAccount}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90 cursor-pointer"
            >
              {isDeletingAccount ? 'Eliminando...' : 'Sí, eliminar mi cuenta'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
