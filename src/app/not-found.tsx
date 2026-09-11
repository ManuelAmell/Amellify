import Link from 'next/link'
import { Compass } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'

export default function NotFound() {
  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-12">
      <Card tier="float" className="w-full max-w-md rounded-2xl">
        <CardContent className="flex flex-col items-center gap-4 p-8 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
            <Compass className="h-6 w-6" aria-hidden="true" />
          </div>
          <div className="space-y-1.5">
            <h1 className="text-lg font-semibold text-foreground">Página no encontrada</h1>
            <p className="text-sm text-muted-foreground">
              La página que buscas no existe o fue movida.
            </p>
          </div>
          <Button asChild className="mt-2 w-full">
            <Link href="/dashboard">Volver al inicio</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
