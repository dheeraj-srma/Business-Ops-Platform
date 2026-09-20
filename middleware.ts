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
      const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
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

  // 2. Extract and decode all available candidate tokens (HttpOnly cookie, duplicate cookies, Bearer header)
  const tokenCookies = request.cookies.getAll('nalka_token');
  const authHeader = request.headers.get('authorization');
  const bearerToken = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : null;

  const candidateTokenStrings = [
    ...tokenCookies.map((c) => c.value),
    ...(bearerToken ? [bearerToken] : []),
  ].filter(Boolean);

  let validPayload: any = null;
  const now = Date.now();

  for (const tokenStr of candidateTokenStrings) {
    const p = decodeJwtPayload(tokenStr);
    if (p && (!p.exp || p.exp * 1000 > now)) {
      validPayload = p;
      // If we find an admin or manager payload, prefer it over a lower-privileged stale cookie
      if (['admin', 'stock_manager', 'order_manager', 'manager'].includes((p.role || '').toLowerCase())) {
        break;
      }
    }
  }

  // Also check nalka_user cookie as fallback hint if tokens were stripped/proxying
  let userProfileFromCookie: any = null;
  const userCookieRaw = request.cookies.get('nalka_user')?.value;
  if (userCookieRaw) {
    try {
      userProfileFromCookie = JSON.parse(decodeURIComponent(userCookieRaw));
    } catch {
      // ignore
    }
  }

  // Unauthenticated -> Server Redirect to /login
  if (!validPayload && !userProfileFromCookie) {
    const loginUrl = new URL('/login', request.url);
    if (!isRootRoute) {
      loginUrl.searchParams.set('from', pathname);
    }
    return NextResponse.redirect(loginUrl);
  }

  // 3. Resolve authoritative role
  const userRole = (
    validPayload?.role ||
    userProfileFromCookie?.role ||
    'viewer'
  ).toLowerCase();

  // Root route '/' authenticated -> Redirect to authorized default workspace
  if (isRootRoute) {
    const defaultWorkspace = userRole === 'admin'
      ? '/management'
      : ['manager', 'stock_manager', 'order_manager'].includes(userRole)
      ? '/operations'
      : '/sales';
    return NextResponse.redirect(new URL(defaultWorkspace, request.url));
  }

  // 4. Server-side Permission & Workspace Access Enforcement
  if (isManagementRoute && userRole !== 'admin') {
    const redirectUrl = ['manager', 'stock_manager', 'order_manager'].includes(userRole)
      ? new URL('/operations', request.url)
      : new URL('/sales', request.url);
    return NextResponse.redirect(redirectUrl);
  }

  if (isOperationsRoute && !['admin', 'manager', 'stock_manager', 'order_manager'].includes(userRole)) {
    return NextResponse.redirect(new URL('/sales', request.url));
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
