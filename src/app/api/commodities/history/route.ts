import { NextRequest, NextResponse } from 'next/server';

const COMMODITY_API_URL =
  process.env.COMMODITY_API_URL || 'http://127.0.0.1:4113';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = req.nextUrl;
    const symbol = searchParams.get('symbol');
    if (!symbol) {
      return NextResponse.json(
        { success: false, error: 'symbol is required' },
        { status: 400 }
      );
    }

    const upstream = new URL('/api/history', COMMODITY_API_URL);
    upstream.searchParams.set('symbol', symbol);
    const startDate = searchParams.get('start_date');
    const endDate = searchParams.get('end_date');
    const limit = searchParams.get('limit');
    if (startDate) upstream.searchParams.set('start_date', startDate);
    if (endDate) upstream.searchParams.set('end_date', endDate);
    if (limit) upstream.searchParams.set('limit', limit);

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
      { success: false, error: 'Failed to fetch commodity history' },
      { status: 502 }
    );
  }
}
