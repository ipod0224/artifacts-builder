import { NextRequest, NextResponse } from 'next/server';

const COMMODITY_API_URL =
  process.env.COMMODITY_API_URL || 'http://127.0.0.1:4113';

export async function GET(req: NextRequest) {
  try {
    const symbol = req.nextUrl.searchParams.get('symbol') || '';
    const upstream = new URL('/api/changes', COMMODITY_API_URL);
    if (symbol) upstream.searchParams.set('symbol', symbol);

    const headers: HeadersInit = {};
    const token = process.env.TUNNEL_BEARER_TOKEN;
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const res = await fetch(upstream.toString(), {
      headers,
      signal: AbortSignal.timeout(10_000)
    });
    const data = await res.json();
    return NextResponse.json(data);
  } catch {
    return NextResponse.json(
      { success: false, error: 'Failed to fetch commodity changes' },
      { status: 502 }
    );
  }
}
