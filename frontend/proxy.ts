import { type NextRequest } from 'next/server'
import { createMiddlewareClient } from '@/lib/supabase-server'

const PROTECTED_PATHS = ['/plan', '/schedule', '/checkin']

export default async function proxy(request: NextRequest) {
  const { supabase, response } = createMiddlewareClient(request)

  const { data: { user } } = await supabase.auth.getUser()

  const isProtected = PROTECTED_PATHS.some((path) =>
    request.nextUrl.pathname.startsWith(path)
  )

  if (isProtected && !user) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    return Response.redirect(url)
  }

  // If logged in and visiting /login, send them to /plan
  if (request.nextUrl.pathname === '/login' && user) {
    const url = request.nextUrl.clone()
    url.pathname = '/plan'
    return Response.redirect(url)
  }

  return response
}

export const config = {
  matcher: ['/plan/:path*', '/schedule/:path*', '/checkin/:path*', '/login'],
}