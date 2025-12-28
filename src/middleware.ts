import { type NextRequest, NextResponse } from 'next/server'
import { updateSession } from '@/utils/supabase/middleware'

export async function middleware(request: NextRequest) {
    // 1. Refresh Session (This sets response cookies)
    const { response, user } = await updateSession(request)

    const path = request.nextUrl.pathname

    // 2. Define Protected Logic
    const isAuthRoute = path.startsWith('/login') || path.startsWith('/auth')
    const isRoot = path === '/'

    // 3. User is NOT Logged In
    if (!user) {
        // Determine if accessing protected route
        // Exclude static assets/api is handled by matcher
        // If not auth route, redirect to login
        if (!isAuthRoute) {
            const url = request.nextUrl.clone()
            url.pathname = '/login'
            return NextResponse.redirect(url)
        }
    }

    // 4. User IS Logged In
    if (user) {
        // If trying to access Login page, redirect to Dashboard
        if (path.startsWith('/login')) {
            const url = request.nextUrl.clone()
            url.pathname = '/'
            return NextResponse.redirect(url)
        }

        // RBAC: Driver cannot access Admin routes
        const role = user.user_metadata?.role || '';
        if (role === 'driver' && path.startsWith('/admin')) {
            const url = request.nextUrl.clone()
            url.pathname = '/driver'
            return NextResponse.redirect(url)
        }
    }

    return response
}

export const config = {
    matcher: [
        /*
         * Match all request paths except for the ones starting with:
         * - _next/static (static files)
         * - _next/image (image optimization files)
         * - favicon.ico (favicon file)
         * Feel free to modify this pattern to include more paths.
         */
        '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
    ],
}
