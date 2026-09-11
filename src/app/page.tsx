import { redirect } from 'next/navigation'
import { getCurrentSession } from '@/lib/auth/session'

export default async function HomePage() {
  const session = await getCurrentSession()

  if (session?.user) {
    redirect('/dashboard')
  } else {
    redirect('/login')
  }
}
