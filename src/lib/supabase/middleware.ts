import { createServerClient } from '@supabase/ssr'
import { type NextRequest, NextResponse } from 'next/server'

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  })

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  const pathname = request.nextUrl.pathname
  const isAuthRoute = pathname.startsWith('/login') || pathname.startsWith('/auth')
  const isApiRoute = pathname.startsWith('/api')

  // If Supabase environment variables are not configured yet, allow viewing login and demo
  if (!supabaseUrl || !supabaseAnonKey || supabaseUrl.includes('placeholder.supabase.co')) {
    // If not on login page, redirect to login so the user can see the setup guide or enter demo mode
    if (!isAuthRoute && !isApiRoute && pathname !== '/demo') {
      const url = request.nextUrl.clone()
      url.pathname = '/login'
      return NextResponse.redirect(url)
    }
    return supabaseResponse
  }

  try {
    const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet: Array<{ name: string; value: string; options?: any }>) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({
            request,
          })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    })

    const {
      data: { user },
    } = await supabase.auth.getUser()

    // If not logged in and trying to access protected routes
    if (!user && !isAuthRoute && !isApiRoute) {
      const url = request.nextUrl.clone()
      url.pathname = '/login'
      return NextResponse.redirect(url)
    }

    // If logged in and trying to access login page, redirect to dashboard
    if (user && isAuthRoute && !pathname.startsWith('/auth/callback')) {
      const url = request.nextUrl.clone()
      url.pathname = '/dashboard'
      return NextResponse.redirect(url)
    }
  } catch (err) {
    console.warn('Middleware Supabase session check error:', err)
  }

  return supabaseResponse
}
