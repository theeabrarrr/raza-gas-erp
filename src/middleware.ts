import { type NextRequest, NextResponse } from 'next/server'
import { updateSession } from '@/utils/supabase/middleware'

export async function middleware(request: NextRequest) {
    // 1. Refresh Session (This sets response cookies)
    const { response, user } = await updateSession(request)

    const path = request.nextUrl.pathname

    // 2. Define Public Routes
    // /auth includes callback, confirm, etc.
    const isPublicRoute =
        path.startsWith('/login') ||
        path.startsWith('/signup') ||
        path.startsWith('/auth');

    // 3. User is NOT Logged In
    if (!user) {
        // Allow public routes
        if (isPublicRoute) {
            return response
        }
        // Redirect unrelated paths to login
        // Exclude static files (handled by matcher, but good to be safe)
        const url = request.nextUrl.clone()
        url.pathname = '/login'
        // Preserve original destination for redirectback (optional, not implemented here for simplicity)
        return NextResponse.redirect(url)
    }

    // 4. User IS Logged In
    if (user) {
        const role = user.user_metadata?.role || '';

        // A. Redirect Logged-In Users away from Login/Signup
        if (path.startsWith('/login') || path.startsWith('/signup')) {
            const url = request.nextUrl.clone()
            // Default Redirect based on Role
            if (role === 'super_admin') url.pathname = '/super-admin'
            else if (role === 'driver') url.pathname = '/driver'
            else url.pathname = '/' // Admin / Manager
            return NextResponse.redirect(url)
        }

        // B. Strict Role Enforcement

        // SUPER ADMIN
        if (role === 'super_admin') {
            // STRICT: Block /admin
            if (path.startsWith('/admin')) {
                const url = request.nextUrl.clone()
                url.pathname = '/super-admin'
                return NextResponse.redirect(url)
            }
            // Redirect Root to Super Admin
            if (path === '/') {
                const url = request.nextUrl.clone()
                url.pathname = '/super-admin'
                return NextResponse.redirect(url)
            }
        }

        // DRIVER
        if (role === 'driver') {
            // Must NOT access /admin or /super-admin or / (Root Dashboard)
            // User Request: "Allow `/driver`. Redirect away from Admin pages."
            if (path.startsWith('/admin') || path.startsWith('/super-admin') || path === '/') {
                const url = request.nextUrl.clone()
                url.pathname = '/driver'
                return NextResponse.redirect(url)
            }
        }

        // ADMIN / SHOP MANAGER
        if (role === 'admin' || role === 'shop_manager') {
            // Block /super-admin
            if (path.startsWith('/super-admin')) {
                const url = request.nextUrl.clone()
                url.pathname = '/'
                return NextResponse.redirect(url)
            }
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
