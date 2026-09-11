import type { SubjectColor } from '@/types/domain'

/**
 * Explicit class map for subject/"materia" tinted-glass tokens.
 *
 * Plan finding H6: `command-search.tsx` used a dynamically interpolated class
 * name (`bg-subject-${color}-border`) that Tailwind's static analyzer can
 * never see at build time, so the class was never generated and the color
 * dot silently never rendered. Every consumer must look up the class name
 * here instead of building one from a string.
 *
 * Pair with the `subject-chip` / `subject-dot` / `subject-text` utilities
 * defined in `src/app/globals.css`, e.g.:
 *   <span className={cn('subject-chip', SUBJECT_COLOR_CLASSES.blue)}>
 *   <span className={cn('subject-dot', SUBJECT_COLOR_CLASSES[course.color])} />
 */
export const SUBJECT_COLOR_CLASSES: Record<SubjectColor, string> = {
  blue: 'subject-blue',
  red: 'subject-red',
  green: 'subject-green',
  orange: 'subject-orange',
  purple: 'subject-purple',
  teal: 'subject-teal',
}

export const SUBJECT_COLOR_LABELS: Record<SubjectColor, string> = {
  blue: 'Azul',
  red: 'Rojo',
  green: 'Verde',
  orange: 'Naranja',
  purple: 'Morado',
  teal: 'Verde azulado',
}

export const SUBJECT_COLORS: SubjectColor[] = ['blue', 'red', 'green', 'orange', 'purple', 'teal']
