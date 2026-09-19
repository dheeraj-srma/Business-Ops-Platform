import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Only protect workspace route subtrees
  const isSalesRoute = pathname.startsWith('/sales');
  const isOperationsRoute = pathname.startsWith('/operations');
  const isManagementRoute = pathname.startsWith('/management');

  if (!isSalesRoute && !isOperationsRoute && !isManagementRoute) {
    return NextResponse.next();
  }

  // 1. Extract HttpOnly session cookie or Bearer token header
  const tokenCookie = request.cookies.get('nalka_token')?.value;
  const authHeader = request.headers.get('authorization');
  const token = tokenCookie || (authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : null);

  // Unauthenticated -> Server Redirect to /login
  if (!token) {
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('from', pathname);
    return NextResponse.redirect(loginUrl);
  }

  // 2. Decode JWT claims on Edge server (without heavy crypto node libs)
  try {
    const parts = token.split('.');
    if (parts.length !== 3) {
      const loginUrl = new URL('/login', request.url);
      return NextResponse.redirect(loginUrl);
    }

    // Base64URL decode JWT payload
    const base64Url = parts[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split('')
        .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    );

    const payload = JSON.parse(jsonPayload);
    const userRole = (payload.role || 'viewer').toLowerCase();

    // Verify token expiration
    if (payload.exp && payload.exp * 1000 < Date.now()) {
      const loginUrl = new URL('/login', request.url);
      return NextResponse.redirect(loginUrl);
    }

    // 3. Server-side Permission & Workspace Access Enforcement
    if (isManagementRoute && userRole !== 'admin') {
      // Non-admin attempting management workspace -> Redirect to authorized default workspace
      const redirectUrl = userRole.includes('stock') || userRole.includes('order')
        ? new URL('/operations', request.url)
        : new URL('/sales', request.url);
      return NextResponse.redirect(redirectUrl);
    }

    if (isOperationsRoute && !['admin', 'stock_manager', 'order_manager', 'manager'].includes(userRole)) {
      // Non-operations role attempting operations workspace -> Redirect to sales
      return NextResponse.redirect(new URL('/sales', request.url));
    }

    // Authorized request -> Proceed
    return NextResponse.next();
  } catch (e) {
    console.warn('Middleware token decode error:', e);
    return NextResponse.redirect(new URL('/login', request.url));
  }
}

export const config = {
  matcher: [
    '/sales/:path*',
    '/operations/:path*',
    '/management/:path*',
  ],
};
