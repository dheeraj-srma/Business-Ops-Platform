/**
 * Shared Authentication & Authorization Helper
 * Manages JWT session tokens, user profiles, role permissions, and workspace access checks.
 */

export interface UserProfile {
  id: string;
  email: string;
  role: 'admin' | 'stock_manager' | 'order_manager' | 'salesman' | 'customer' | 'viewer' | string;
  full_name: string;
  salesman_id?: string;
  is_active?: boolean;
}

export interface AuthSession {
  token: string;
  user: UserProfile;
}

const SESSION_KEY = 'nalka_terminal_session';
const TOKEN_KEY = 'nalka_auth_token';

/**
 * Stores authenticated JWT session and user profile in browser storage.
 */
export function setAuthSession(token: string, user: UserProfile): void {
  try {
    if (typeof window !== 'undefined') {
      localStorage.setItem(TOKEN_KEY, token);
      localStorage.setItem(
        SESSION_KEY,
        JSON.stringify({
          token,
          user,
          profile: user,
        })
      );
      // Set secure auth cookie for server-side checks if needed
      document.cookie = `nalka_token=${token}; path=/; max-age=86400; SameSite=Lax`;
    }
  } catch (e) {
    console.warn('Failed to persist auth session:', e);
  }
}

/**
 * Retrieves current active authentication session.
 */
export function getAuthSession(): AuthSession | null {
  try {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem(SESSION_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        const token = parsed.token || localStorage.getItem(TOKEN_KEY);
        const user = parsed.profile || parsed.user;
        if (token && user) {
          return { token, user };
        }
      }
    }
  } catch (e) {
    console.warn('Error reading auth session:', e);
  }
  return null;
}

/**
 * Clears authentication session upon logout.
 */
export function clearAuthSession(): void {
  try {
    if (typeof window !== 'undefined') {
      localStorage.removeItem(SESSION_KEY);
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem('app_auth');
      localStorage.removeItem('app_role');
      document.cookie = 'nalka_token=; path=/; max-age=0';
    }
  } catch (e) {
    console.warn('Failed to clear session:', e);
  }
}

/**
 * Checks if user is authenticated.
 */
export function isAuthenticated(): boolean {
  const session = getAuthSession();
  return !!session && !!session.token && !!session.user;
}

/**
 * Verified Permission Matrix checking if a user role is authorized to access a workspace.
 */
export function hasWorkspaceAccess(
  workspace: 'sales' | 'operations' | 'management',
  role?: string
): boolean {
  const normalizedRole = (role || '').toLowerCase();
  
  if (normalizedRole === 'admin') return true;

  switch (workspace) {
    case 'sales':
      return ['salesman', 'stock_manager', 'order_manager', 'admin', 'customer', 'viewer'].includes(normalizedRole);
    case 'operations':
      return ['stock_manager', 'order_manager', 'admin'].includes(normalizedRole);
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
  if (['stock_manager', 'order_manager'].includes(normalizedRole)) return '/operations';
  return '/sales';
}
