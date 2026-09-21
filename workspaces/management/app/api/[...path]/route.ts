import { NextRequest, NextResponse } from 'next/server';

const BACKEND_URL = process.env.BACKEND_INTERNAL_URL || process.env.NEXT_PUBLIC_BACKEND_URL || 'http://127.0.0.1:8000';

async function handler(req: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  try {
    const { path } = await params;
    let subpath = (path || []).join('/');
    if (subpath === 'products') {
      subpath = 'inventory';
    }
    const url = new URL(req.url);
    const targetUrl = `${BACKEND_URL}/api/${subpath}${url.search}`;

    const headers: Record<string, string> = {};
    req.headers.forEach((val, key) => {
      if (key !== 'host' && key !== 'content-length' && key !== 'connection') {
        headers[key] = val;
      }
    });

    const init: RequestInit = {
      method: req.method,
      headers,
    };

    if (req.method !== 'GET' && req.method !== 'HEAD') {
      init.body = await req.text();
    }

    const res = await fetch(targetUrl, init);
    const data = await res.text();

    const responseHeaders: Record<string, string> = {
      'content-type': res.headers.get('content-type') || 'application/json',
      'cache-control': 'no-store',
    };
    ['x-database-mode', 'x-snapshot-captured-at', 'x-correlation-id', 'x-response-time-ms'].forEach(h => {
      const val = res.headers.get(h);
      if (val) responseHeaders[h] = val;
    });

    return new NextResponse(data, {
      status: res.status,
      headers: responseHeaders,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Proxy Error' }, { status: 502 });
  }
}

export const GET = handler;
export const POST = handler;
export const PUT = handler;
export const DELETE = handler;
export const PATCH = handler;
