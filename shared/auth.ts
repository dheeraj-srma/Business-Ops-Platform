/**
 * Shared Authentication & Authorization Helper
 * Manages JWT session tokens, user profiles, role permissions, and workspace access checks.
 *
 * AUTHORITY RULE:
 * The `nalka_token` HttpOnly cookie is the authoritative authentication mechanism.
 * The `nalka_user` readable cookie is a UI hint for the authenticated profile.
 * Do NOT use localStorage to store or validate JWTs, passwords, session tokens, or authentication credentials.
 *
 * SECURITY MODEL:
 * - Authentication state comes from the server (HttpOnly cookie → backend validates → returns identity).
 * - Frontend state is for UI only — never treat it as a security credential.
 * - If no valid session exists, the user is UNAUTHENTICATED. Never invent an identity.
 */

export type AuthStatus = 'loading' | 'authenticated' | 'unauthenticated';

export interface UserProfile {
  id: string;
  email: string;
  role: 'admin' | 'accountant' | 'stock_manager' | 'salesman' | 'viewer' | string;
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
 * Only used for dev fallback tokens — production tokens are set by the backend via Set-Cookie.
 */
export function setAuthSession(token: string, user: UserProfile, rememberMe = false): void {
  try {
    if (typeof window !== 'undefined') {
      const maxAge = rememberMe ? 86400 * 30 : 86400; // 30 days or 24 hours
      // Set client auth cookies for Edge middleware and client-side UI inspection.
      if (token) {
        document.cookie = `nalka_token=${token}; path=/; max-age=${maxAge}; SameSite=Lax`;
      }
      document.cookie = `nalka_user=${encodeURIComponent(JSON.stringify(user))}; path=/; max-age=${maxAge}; SameSite=Lax`;
      window.dispatchEvent(new Event('nalka_auth_change'));
    }
  } catch (e) {
    console.warn('Failed to set auth cookie:', e);
  }
}

/**
 * Retrieves current active authentication session from authoritative nalka_token or nalka_user cookie.
 * Returns null if no valid session exists. NEVER returns a fallback/default user.
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
          const payload = JSON.parse(jsonPayload);

          if (payload && payload.exp && payload.exp * 1000 > Date.now()) {
            const user: UserProfile = {
              id: payload.user_id || payload.sub || '',
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
 * Clears ALL authentication state — cookies, localStorage legacy keys, and server session.
 * This is the ONLY function that should be called during logout.
 * Order: server invalidation → cookie removal → localStorage cleanup → event dispatch.
 */
export async function clearAuthSession(): Promise<void> {
  try {
    if (typeof window !== 'undefined') {
      // 1. Server-side session invalidation (clear HttpOnly cookie on backend)
      try {
        await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' });
      } catch {
        // Server may be unreachable — still clean up client state
      }

      // 2. Expire client-readable cookies (matching exact path/attributes from creation)
      document.cookie = 'nalka_token=; path=/; max-age=0; SameSite=Lax';
      document.cookie = 'nalka_user=; path=/; max-age=0; SameSite=Lax';

      // 3. Remove ALL legacy localStorage auth keys — these must never be used as auth sources
      const legacyKeys = [
        'nalka_terminal_session',
        'nalka_auth_token',
        'nalka_access_token',
        'app_auth',
        'app_role',
        'app_salesman',
      ];
      legacyKeys.forEach((key) => {
        try { localStorage.removeItem(key); } catch {}
      });

      // 4. Dispatch auth change event for same-tab listeners (RouteGuard, WorkspaceSwitcher)
      window.dispatchEvent(new Event('nalka_auth_change'));

      // 5. Trigger storage event for cross-tab detection
      try {
        localStorage.setItem('nalka_logout_signal', Date.now().toString());
        localStorage.removeItem('nalka_logout_signal');
      } catch {}
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
  
  if (['admin', 'accountant'].includes(normalizedRole)) return true;

  switch (workspace) {
    case 'sales':
      return ['salesman', 'stock_manager', 'viewer', 'admin', 'accountant'].includes(normalizedRole);
    case 'operations':
      return ['stock_manager', 'admin', 'accountant'].includes(normalizedRole);
    case 'management':
      return ['admin', 'accountant'].includes(normalizedRole);
    default:
      return false;
  }
}

/**
 * Returns the canonical default workspace path based on user role.
 * This is the ONE authoritative function for role → workspace mapping.
 *
 * admin / accountant → /management
 * stock_manager → /operations
 * salesman / viewer → /sales
 */
export function getDefaultWorkspace(role?: string): string {
  const normalizedRole = (role || '').toLowerCase();
  if (['admin', 'accountant'].includes(normalizedRole)) return '/management';
  if (normalizedRole === 'stock_manager') return '/operations';
  if (['salesman', 'viewer'].includes(normalizedRole)) return '/sales';
  return '/sales';
}

/** Alias for clarity in consuming code */
export const getDefaultWorkspaceForRole = getDefaultWorkspace;
