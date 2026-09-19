// shared/api/client.ts
/**
 * Shared Platform API Client Wrapper
 * Handles base URL resolution, HttpOnly cookie credentials,
 * correlation IDs, and unified error parsing across all platform workspaces.
 */

export interface ApiError {
  error: string;
  message: string;
  correlation_id?: string;
  status_code?: number;
}

const getApiBaseUrl = (): string => {
  if (typeof window !== 'undefined') {
    if (process.env.NEXT_PUBLIC_API_URL) {
      return process.env.NEXT_PUBLIC_API_URL;
    }
    return `${window.location.protocol}//${window.location.hostname}:8000`;
  }
  return process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000';
};

export async function apiClient<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const baseUrl = getApiBaseUrl();
  const url = endpoint.startsWith('http') ? endpoint : `${baseUrl}${endpoint.startsWith('/') ? '' : '/'}${endpoint}`;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
    'X-Correlation-ID': typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : String(Date.now()),
    ...(options.headers as Record<string, string> || {}),
  };

  const config: RequestInit = {
    ...options,
    headers,
    credentials: 'include', // Automatically passes HttpOnly nalka_token cookie
  };

  try {
    const response = await fetch(url, config);

    if (!response.ok) {
      let errorBody: ApiError;
      try {
        errorBody = await response.json();
      } catch {
        errorBody = {
          error: 'HTTP_ERROR',
          message: `HTTP ${response.status}: ${response.statusText}`,
          status_code: response.status,
        };
      }
      errorBody.status_code = response.status;
      throw errorBody;
    }

    // Return empty object for 204 No Content
    if (response.status === 204) {
      return {} as T;
    }

    return await response.json();
  } catch (error: any) {
    if (error.error && error.message) {
      throw error;
    }
    throw {
      error: 'NETWORK_ERROR',
      message: error.message || 'Failed to connect to platform API server.',
      status_code: 500,
    } as ApiError;
  }
}
