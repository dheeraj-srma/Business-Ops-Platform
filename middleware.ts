import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const isRootRoute = pathname === '/';
  const isSalesRoute = pathname.startsWith('/sales');
  const isOperationsRoute = pathname.startsWith('/operations');
  const isManagementRoute = pathname.startsWith('/management');

  if (!isRootRoute && !isSalesRoute && !isOperationsRoute && !isManagementRoute) {
    return NextResponse.next();
  }

  // 1. Helper to safely decode JWT payload
  const decodeJwtPayload = (jwtStr: string): any => {
    try {
      const parts = jwtStr.split('.');
      if (parts.length !== 3) return null;
      const base64Url = parts[1];
      let base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
      while (base64.length % 4) {
        base64 += '=';
      }
      let jsonPayload = '';
      try {
        jsonPayload = decodeURIComponent(
          atob(base64)
            .split('')
            .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
            .join('')
        );
      } catch {
        jsonPayload = atob(base64);
      }
      return JSON.parse(jsonPayload);
    } catch {
      return null;
    }
  };

  // 2. Extract JWT from nalka_token cookie(s) and Authorization header — THESE are the only auth sources
  const tokenCookies = request.cookies.getAll('nalka_token');
  const authHeader = request.headers.get('authorization');
  const bearerToken = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : null;

  const candidateTokenStrings = [
    ...tokenCookies.map((c) => c.value),
    ...(bearerToken ? [bearerToken] : []),
  ].filter(Boolean);

  // 3. Find the first valid (non-expired) token — no preference logic, just first valid one
  let validPayload: any = null;
  const now = Date.now();

  for (const tokenStr of candidateTokenStrings) {
    const p = decodeJwtPayload(tokenStr);
    if (p && (!p.exp || p.exp * 1000 > now)) {
      validPayload = p;
      break; // Use first valid token — no role-based preference
    }
  }

  // SECURITY: nalka_user cookie is NOT an authentication source.
  // It is a UI hint set alongside the token. If the token is missing/invalid, the user is unauthenticated.
  // NEVER fall back to nalka_user or any client-side state to determine identity.

  // Unauthenticated -> Server Redirect to /login
  if (!validPayload) {
    const loginUrl = new URL('/login', request.url);
    if (!isRootRoute) {
      loginUrl.searchParams.set('from', pathname);
    }
    return NextResponse.redirect(loginUrl);
  }

  // 4. Resolve authoritative role from the validated JWT payload ONLY
  const userRole = (validPayload.role || '').toLowerCase();

  const isKnownRole = ['admin', 'accountant', 'stock_manager', 'salesman', 'viewer'].includes(userRole);
  if (!isKnownRole) {
    // Fail closed for unknown role
    return NextResponse.redirect(new URL('/login', request.url));
  }

  // Root route '/' authenticated -> Redirect to authorized default workspace
  if (isRootRoute) {
    const defaultWorkspace = ['admin', 'accountant'].includes(userRole)
      ? '/management'
      : userRole === 'stock_manager'
      ? '/operations'
      : '/sales';
    return NextResponse.redirect(new URL(defaultWorkspace, request.url));
  }

  // 5. Server-side Permission & Workspace Access Enforcement
  if (isManagementRoute && !['admin', 'accountant'].includes(userRole)) {
    const redirectUrl = userRole === 'stock_manager'
      ? new URL('/operations', request.url)
      : new URL('/sales', request.url);
    return NextResponse.redirect(redirectUrl);
  }

  if (isOperationsRoute && !['admin', 'accountant', 'stock_manager'].includes(userRole)) {
    return NextResponse.redirect(new URL('/sales', request.url));
  }

  if (isSalesRoute && !['admin', 'accountant', 'stock_manager', 'salesman', 'viewer'].includes(userRole)) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  // Authorized request -> Proceed
  return NextResponse.next();
}

export const config = {
  matcher: [
    '/',
    '/sales/:path*',
    '/operations/:path*',
    '/management/:path*',
  ],
};
