import type { LucideIcon } from 'lucide-react'
import { Calculator, Calendar, LayoutGrid, ListChecks, Settings, BarChart3 } from 'lucide-react'

/**
 * Single source of truth for app navigation (fixes plan finding: sidebar and
 * bottom-nav previously duplicated this list with inconsistent labels).
 */
export interface NavItem {
  href: string
  /** Full label, used in the desktop sidebar. */
  title: string
  /** Short label for the mobile bottom nav (≤ 10 chars recommended). */
  shortTitle: string
  icon: LucideIcon
}

export const NAV_ITEMS: NavItem[] = [
  { href: '/dashboard', title: 'Horario', shortTitle: 'Horario', icon: LayoutGrid },
  { href: '/courses', title: 'Materias', shortTitle: 'Materias', icon: ListChecks },
  { href: '/calculator', title: 'Calculadora', shortTitle: 'Notas', icon: Calculator },
  { href: '/stats', title: 'Estadísticas', shortTitle: 'Stats', icon: BarChart3 },
  { href: '/settings', title: 'Configuración', shortTitle: 'Ajustes', icon: Settings },
]

export const APP_NAME = 'Amellify'
export const APP_DESCRIPTION =
  'Gestión inteligente de horarios universitarios y seguimiento académico.'
export const BRAND_ICON = Calendar
