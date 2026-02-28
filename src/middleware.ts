import { NextRequest, NextResponse } from 'next/server';

export function middleware(req: NextRequest) {
  const user = process.env.AUTH_USER;
  const pass = process.env.AUTH_PASSWORD;

  // Skip auth if credentials not configured (local dev)
  if (!user || !pass) return NextResponse.next();

  const auth = req.headers.get('authorization');
  if (auth) {
    const [scheme, encoded] = auth.split(' ');
    if (scheme === 'Basic' && encoded) {
      const decoded = atob(encoded);
      const [u, p] = decoded.split(':');
      if (u === user && p === pass) {
        return NextResponse.next();
      }
    }
  }

  return new NextResponse('Authentication required', {
    status: 401,
    headers: { 'WWW-Authenticate': 'Basic realm="Prices Dashboard"' }
  });
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|manifest.webmanifest).*)'
  ]
};
