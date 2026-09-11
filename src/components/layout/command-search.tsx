'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import { Search, Clock, MapPin, User } from 'lucide-react'
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from '@/components/ui/command'
import { NAV_ITEMS } from '@/config/nav'
import { SUBJECT_COLOR_CLASSES } from '@/config/subject-colors'
import { cn } from '@/lib/utils'
import type { CourseWithDetails } from '@/types/domain'

interface CommandSearchProps {
  courses: CourseWithDetails[]
}

/**
 * Header search trigger + ⌘K palette. Rebuilt on the `cmdk`-backed `Command`
 * primitive (see `src/components/ui/command.tsx`) so arrow-key navigation,
 * typeahead filtering and `role="listbox"` semantics come for free — the old
 * v2 version was a hand-rolled list of `<button>`s with none of that.
 */
export function CommandSearch({ courses }: CommandSearchProps) {
  const [open, setOpen] = React.useState(false)
  const router = useRouter()

  React.useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        setOpen((prev) => !prev)
      }
    }
    document.addEventListener('keydown', down)
    return () => document.removeEventListener('keydown', down)
  }, [])

  const navigateTo = React.useCallback(
    (href: string) => {
      setOpen(false)
      router.push(href)
    },
    [router]
  )

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Buscar materias, profesores o aulas"
        className="glass-inset flex w-40 cursor-pointer items-center justify-between gap-2 rounded-full px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground sm:w-64"
      >
        <span className="flex items-center gap-2">
          <Search className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">Buscar materia, profesor...</span>
          <span className="sm:hidden">Buscar</span>
        </span>
        <kbd className="pointer-events-none hidden select-none items-center gap-0.5 rounded border border-border/60 bg-background/60 px-1.5 font-mono text-[10px] font-medium sm:inline-flex">
          <span>⌘</span>K
        </kbd>
      </button>

      <CommandDialog open={open} onOpenChange={setOpen}>
        <CommandInput placeholder="Escribe el nombre de la materia, código, docente o aula..." />
        <CommandList>
          <CommandEmpty>No se encontraron resultados.</CommandEmpty>
          <CommandGroup heading="Navegación">
            {NAV_ITEMS.map((item) => (
              <CommandItem key={item.href} value={item.title} onSelect={() => navigateTo(item.href)}>
                <item.icon className="h-4 w-4 text-primary" />
                <span>{item.title}</span>
              </CommandItem>
            ))}
          </CommandGroup>

          {courses.length > 0 && (
            <>
              <CommandSeparator />
              <CommandGroup heading="Materias">
                {courses.map((course) => (
                  <CommandItem
                    key={course.id}
                    value={`${course.code} ${course.name} ${course.professor}`}
                    onSelect={() => navigateTo(`/courses?course=${course.id}`)}
                  >
                    <span
                      className={cn('subject-dot h-2.5 w-2.5 shrink-0 rounded-full', SUBJECT_COLOR_CLASSES[course.color])}
                    />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">
                        <span className="mr-1.5 font-mono text-muted-foreground">[{course.code}]</span>
                        {course.name}
                      </p>
                      <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
                        {course.professor && (
                          <span className="flex items-center gap-1 truncate">
                            <User className="h-3 w-3" /> {course.professor}
                          </span>
                        )}
                        {course.schedules[0] && (
                          <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {course.schedules[0].day} {course.schedules[0].startTime}
                          </span>
                        )}
                        {course.schedules[0]?.room && (
                          <span className="flex items-center gap-1">
                            <MapPin className="h-3 w-3" /> {course.schedules[0].room}
                          </span>
                        )}
                      </div>
                    </div>
                  </CommandItem>
                ))}
              </CommandGroup>
            </>
          )}
        </CommandList>
      </CommandDialog>
    </>
  )
}
