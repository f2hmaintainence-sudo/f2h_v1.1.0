import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

/**
 * Next.js Proxy (formerly Middleware) for Route Protection
 * Industry-standard approach: Server-side auth check using HTTP-only cookies
 * No localStorage dependency - immune to XSS attacks
 */

// Routes that don't require authentication
const PUBLIC_ROUTES = [
  '/login',
  '/register',
  '/forgot-password',
  '/reset-password',
  '/',
  '/appapk',
  '/download/customer',
  '/download/delivery',
  '/privacy-policy',
  '/terms-and-conditions',
  '/refund-policy',
  '/delivery-policy',
  '/delete-account',
  '/contact-us',
  '/pricing',
];

const PUBLIC_PREFIXES = [
  '/receipt',
  '/invoice',
  '/billing',
  '/download',
];

// Panel routes use client-side auth guard (AuthProvider + /users/me)
const PANEL_PREFIXES = ['/admin', '/delivery', '/customer'];

// Static asset patterns to skip
const STATIC_PATTERNS = [
  '/_next',
  '/api',
  '/assets',
  '/favicon.ico',
  '/robots.txt',
  '/sitemap.xml',
];

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  
  // Skip middleware for static assets
  if (STATIC_PATTERNS.some(pattern => pathname.startsWith(pattern))) {
    return NextResponse.next();
  }
  
  // Allow public routes and prefixes without auth
  if (PUBLIC_ROUTES.includes(pathname) || PUBLIC_PREFIXES.some(prefix => pathname.startsWith(prefix))) {
    return NextResponse.next();
  }

  // Let panel routes pass; client-side guard handles auth and role redirects
  if (PANEL_PREFIXES.some(prefix => pathname.startsWith(prefix))) {
    return NextResponse.next();
  }
  
  // Check for HTTP-only access_token cookie
  const accessToken = request.cookies.get('access_token')?.value;
  
  if (!accessToken) {
    return NextResponse.redirect(new URL('/login', request.url));
  }
    
  // Token exists - allow request to proceed
  // Backend JWT guard will validate the token on API calls
  // If token is invalid/expired, API will return 401 and frontend handles redirect
  return NextResponse.next();
}

// Configure which routes the middleware runs on
export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder
     */
    '/((?!_next/static|_next/image|favicon.ico|assets|public).*)',
  ],
};
