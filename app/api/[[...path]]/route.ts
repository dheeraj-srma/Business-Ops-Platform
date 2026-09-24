import { NextRequest, NextResponse } from 'next/server';

function getBackendBaseUrl(): string {
  const raw =
    process.env.BACKEND_API_URL ||
    process.env.BACKEND_INTERNAL_URL ||
    process.env.NEXT_PUBLIC_BACKEND_URL ||
    process.env.NEXT_PUBLIC_API_URL ||
    'http://127.0.0.1:8000';
  return raw.replace(/\/+$/, '');
}

async function handler(
  req: NextRequest,
  context: { params: Promise<{ path: string[] }> }
) {
  try {
    const { path } = await context.params;
    let subpath = (path || []).join('/');

    // Compatibility alias: products -> inventory
    if (subpath === 'products') {
      subpath = 'inventory';
    }

    const backendBase = getBackendBaseUrl();
    const url = new URL(req.url);
    const targetUrl = `${backendBase}/api/${subpath}${url.search}`;

    // Filter and forward client headers
    const forwardHeaders: Record<string, string> = {};
    req.headers.forEach((value, key) => {
      const lower = key.toLowerCase();
      // Exclude hop-by-hop and host headers
      if (
        lower !== 'host' &&
        lower !== 'content-length' &&
        lower !== 'connection' &&
        lower !== 'transfer-encoding'
      ) {
        forwardHeaders[key] = value;
      }
    });

    const init: RequestInit = {
      method: req.method,
      headers: forwardHeaders,
      cache: 'no-store',
    };

    if (req.method !== 'GET' && req.method !== 'HEAD' && req.method !== 'OPTIONS') {
      init.body = await req.text();
    }

    const res = await fetch(targetUrl, init);
    const data = await res.text();

    const responseHeaders: Record<string, string> = {
      'content-type': res.headers.get('content-type') || 'application/json',
      'cache-control': 'no-store',
    };

    // Forward diagnostic and tracing headers if present
    const forwardedHeaderNames = [
      'x-database-mode',
      'x-snapshot-captured-at',
      'x-correlation-id',
      'x-response-time-ms',
    ];
    for (const h of forwardedHeaderNames) {
      const val = res.headers.get(h);
      if (val) {
        responseHeaders[h] = val;
      }
    }

    const response = new NextResponse(data, {
      status: res.status,
      statusText: res.statusText,
      headers: responseHeaders,
    });

    // Relay Set-Cookie headers from backend (crucial for auth session tokens)
    const setCookies =
      typeof (res.headers as any).getSetCookie === 'function'
        ? (res.headers as any).getSetCookie()
        : res.headers.get('set-cookie')
        ? [res.headers.get('set-cookie')!]
        : [];

    for (const cookieStr of setCookies) {
      response.headers.append('set-cookie', cookieStr);
    }

    return response;
  } catch (error: any) {
    console.error('API Proxy error:', error);
    return NextResponse.json(
      {
        error: 'Proxy Error',
        message: error?.message || 'Failed to communicate with backend service.',
      },
      { status: 502 }
    );
  }
}

export const GET = handler;
export const POST = handler;
export const PUT = handler;
export const DELETE = handler;
export const PATCH = handler;
export const HEAD = handler;
export const OPTIONS = handler;
