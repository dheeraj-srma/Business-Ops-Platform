/**
 * Shared Authentication & Authorization Helper
 * Manages JWT session tokens, user profiles, role permissions, and workspace access checks.
 *
 * AUTHORITY RULE:
 * The `nalka_token` cookie is the authoritative authentication mechanism.
 * Do NOT use localStorage to store or validate JWTs, passwords, session tokens, or authentication credentials.
 */

export interface UserProfile {
  id: string;
  email: string;
  role: 'admin' | 'stock_manager' | 'order_manager' | 'manager' | 'salesman' | 'customer' | 'viewer' | string;
  full_name: string;
  salesman_id?: string;
  is_active?: boolean;
}

export interface AuthSession {
  token: string;
  user: UserProfile;
}

/**
 * Helper to extract specific cookie value from document.cookie safely.
 */
function getCookie(name: string): string | null {
  if (typeof window === 'undefined') return null;
  const cookies = document.cookie.split(';');
  for (let c of cookies) {
    c = c.trim();
    if (c.startsWith(`${name}=`)) {
      return c.substring(name.length + 1);
    }
  }
  return null;
}

/**
 * Sets authenticated JWT session cookie in browser.
 */
export function setAuthSession(token: string, user: UserProfile, isDevClientToken = false): void {
  try {
    if (typeof window !== 'undefined') {
      // Set client auth cookies for Edge middleware and client-side UI inspection.
      // Only set nalka_token via document.cookie if it's a dev client-generated token (not set by backend HttpOnly Set-Cookie)
      if (isDevClientToken) {
        document.cookie = `nalka_token=${token}; path=/; max-age=86400; SameSite=Lax`;
      }
      document.cookie = `nalka_user=${encodeURIComponent(JSON.stringify(user))}; path=/; max-age=86400; SameSite=Lax`;
      window.dispatchEvent(new Event('nalka_auth_change'));
    }
  } catch (e) {
    console.warn('Failed to set auth cookie:', e);
  }
}

/**
 * Retrieves current active authentication session from authoritative nalka_token or nalka_user cookie.
 */
export function getAuthSession(): AuthSession | null {
  try {
    if (typeof window !== 'undefined') {
      const userCookieStr = getCookie('nalka_user');
      let userFromCookie: UserProfile | null = null;
      if (userCookieStr) {
        try {
          userFromCookie = JSON.parse(decodeURIComponent(userCookieStr));
        } catch {
          // ignore
        }
      }

      // If user profile cookie is present, it reflects the authoritative active profile
      if (userFromCookie && userFromCookie.role) {
        const token = getCookie('nalka_token') || 'httponly-session-token';
        return {
          token,
          user: userFromCookie,
        };
      }

      // Fallback: decode token payload if nalka_user cookie wasn't set
      const token = getCookie('nalka_token');
      if (token) {
        const parts = token.split('.');
        if (parts.length === 3) {
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
          const payload = JSON.parse(jsonPayload);

          if (payload && payload.exp && payload.exp * 1000 > Date.now()) {
            const user: UserProfile = {
              id: payload.user_id || payload.sub || 'usr-001',
              email: payload.email || '',
              role: (payload.role || 'viewer').toLowerCase(),
              full_name: payload.full_name || payload.email || 'User',
              salesman_id: payload.salesman_id || undefined,
            };
            return { token, user };
          }
        }
      }
    }
  } catch (e) {
    console.warn('Error reading auth session from cookie:', e);
  }
  return null;
}

/**
 * Clears authentication session and cookie upon logout.
 */
export function clearAuthSession(): void {
  try {
    if (typeof window !== 'undefined') {
      document.cookie = 'nalka_token=; path=/; max-age=0';
      document.cookie = 'nalka_user=; path=/; max-age=0';
      localStorage.removeItem('nalka_terminal_session');
      localStorage.removeItem('nalka_auth_token');
      localStorage.removeItem('app_auth');
      localStorage.removeItem('app_role');
      localStorage.removeItem('app_salesman');
      fetch('/api/auth/logout', { method: 'POST', credentials: 'include' }).catch(() => {});
      window.dispatchEvent(new Event('nalka_auth_change'));
    }
  } catch (e) {
    console.warn('Failed to clear session:', e);
  }
}

/**
 * Checks if user is authenticated via valid cookie.
 */
export function isAuthenticated(): boolean {
  const session = getAuthSession();
  return !!session && !!session.token && !!session.user;
}

/**
 * UX/Pre-navigation guard checking if a user role is authorized to access a workspace.
 * Note: Authoritative workspace authorization is enforced on the server by Edge middleware.
 */
export function hasWorkspaceAccess(
  workspace: 'sales' | 'operations' | 'management',
  role?: string
): boolean {
  const normalizedRole = (role || '').toLowerCase();
  
  if (normalizedRole === 'admin') return true;

  switch (workspace) {
    case 'sales':
      return ['salesman', 'stock_manager', 'order_manager', 'manager', 'admin', 'customer', 'viewer'].includes(normalizedRole);
    case 'operations':
      return ['stock_manager', 'order_manager', 'manager', 'admin'].includes(normalizedRole);
    case 'management':
      return ['admin'].includes(normalizedRole);
    default:
      return false;
  }
}

/**
 * Returns default workspace path based on user role.
 */
export function getDefaultWorkspace(role?: string): string {
  const normalizedRole = (role || '').toLowerCase();
  if (normalizedRole === 'admin') return '/management';
  if (['stock_manager', 'order_manager', 'manager'].includes(normalizedRole)) return '/operations';
  return '/sales';
}

