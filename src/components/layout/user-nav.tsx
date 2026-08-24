'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useTheme } from 'next-themes'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Button } from '@/components/ui/button'
import { User, LogOut, Sun, Moon, Laptop, UserCheck } from 'lucide-react'
import type { Profile } from '@/types/database'
import type { User as AuthUser } from '@supabase/supabase-js'
import { toast } from 'sonner'

interface UserNavProps {
  user: AuthUser
  profile: Profile | null
}

export function UserNav({ user, profile }: UserNavProps) {
  const router = useRouter()
  const supabase = createClient()
  const { theme, setTheme } = useTheme()

  const displayName =
    profile?.display_name || user.user_metadata?.full_name || user.email?.split('@')[0] || 'Estudiante'
  const userEmail = user.email || ''
  const avatarUrl = profile?.avatar_url || user.user_metadata?.avatar_url

  const handleSignOut = async () => {
    try {
      await supabase.auth.signOut()
      toast.success('Sesión cerrada')
      router.push('/login')
      router.refresh()
    } catch (err: any) {
      toast.error('Error al cerrar sesión')
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          className="relative h-9 w-9 rounded-full border border-border/60 hover:border-primary/50 overflow-hidden p-0 cursor-pointer"
        >
          {avatarUrl ? (
            <img
              src={avatarUrl}
              alt={displayName}
              className="h-full w-full object-cover"
              referrerPolicy="no-referrer"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-primary/10 text-primary font-bold text-xs">
              {displayName.charAt(0).toUpperCase()}
            </div>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-56" align="end" forceMount>
        <DropdownMenuLabel className="font-normal">
          <div className="flex flex-col space-y-1">
            <p className="text-sm font-medium leading-none truncate">{displayName}</p>
            <p className="text-xs leading-none text-muted-foreground truncate">{userEmail}</p>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />

        {/* Theme Switchers */}
        <DropdownMenuLabel className="text-[11px] text-muted-foreground uppercase font-semibold">
          Tema
        </DropdownMenuLabel>
        <DropdownMenuItem
          onClick={() => setTheme('light')}
          className="flex items-center gap-2 cursor-pointer"
        >
          <Sun className="h-4 w-4" />
          <span>Claro</span>
          {theme === 'light' && <span className="ml-auto text-xs text-primary font-bold">✓</span>}
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => setTheme('dark')}
          className="flex items-center gap-2 cursor-pointer"
        >
          <Moon className="h-4 w-4" />
          <span>Oscuro</span>
          {theme === 'dark' && <span className="ml-auto text-xs text-primary font-bold">✓</span>}
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => setTheme('system')}
          className="flex items-center gap-2 cursor-pointer"
        >
          <Laptop className="h-4 w-4" />
          <span>Sistema</span>
          {theme === 'system' && <span className="ml-auto text-xs text-primary font-bold">✓</span>}
        </DropdownMenuItem>

        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={handleSignOut}
          className="flex items-center gap-2 text-destructive focus:text-destructive cursor-pointer"
        >
          <LogOut className="h-4 w-4" />
          <span>Cerrar Sesión</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
