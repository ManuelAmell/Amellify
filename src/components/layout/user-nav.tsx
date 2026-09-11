'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import { useTheme } from 'next-themes'
import { toast } from 'sonner'
import { signOut } from '@/lib/auth/client'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { LogOut, Sun, Moon, Laptop } from 'lucide-react'
import type { UserProfile } from '@/types/domain'

interface UserNavProps {
  profile: UserProfile | null
}

export function UserNav({ profile }: UserNavProps) {
  const router = useRouter()
  const { theme, setTheme } = useTheme()

  const displayName = profile?.displayName || profile?.email?.split('@')[0] || 'Estudiante'
  const userEmail = profile?.email ?? ''
  const avatarUrl = profile?.avatarUrl ?? undefined

  const handleSignOut = async () => {
    try {
      await signOut()
      toast.success('Sesión cerrada')
      router.push('/login')
      router.refresh()
    } catch {
      toast.error('Error al cerrar sesión')
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label={`Menú de cuenta de ${displayName}`}
          className="cursor-pointer rounded-full ring-offset-background transition-shadow focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        >
          <Avatar>
            {avatarUrl ? (
              <AvatarImage
                src={avatarUrl}
                alt=""
                referrerPolicy="no-referrer"
                fallback={<AvatarFallback>{displayName.charAt(0).toUpperCase()}</AvatarFallback>}
              />
            ) : (
              <AvatarFallback>{displayName.charAt(0).toUpperCase()}</AvatarFallback>
            )}
          </Avatar>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-56" align="end">
        <DropdownMenuLabel className="font-normal">
          <div className="flex flex-col space-y-1">
            <p className="truncate text-sm font-medium leading-none">{displayName}</p>
            {userEmail && <p className="truncate text-xs leading-none text-muted-foreground">{userEmail}</p>}
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />

        <DropdownMenuLabel className="text-[11px] font-semibold uppercase text-muted-foreground">
          Tema
        </DropdownMenuLabel>
        <DropdownMenuRadioGroup value={theme} onValueChange={setTheme}>
          <DropdownMenuRadioItem value="light">
            <Sun className="h-4 w-4" />
            <span className="ml-2">Claro</span>
          </DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="dark">
            <Moon className="h-4 w-4" />
            <span className="ml-2">Oscuro</span>
          </DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="system">
            <Laptop className="h-4 w-4" />
            <span className="ml-2">Sistema</span>
          </DropdownMenuRadioItem>
        </DropdownMenuRadioGroup>

        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={handleSignOut} className="text-destructive focus:text-destructive">
          <LogOut className="h-4 w-4" />
          <span>Cerrar sesión</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
