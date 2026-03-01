import { NextRequest, NextResponse } from 'next/server';

// API + RAG + Prices 路由不需要 Clerk 認證
const isApiRoute = (req: NextRequest) =>
  req.nextUrl.pathname.startsWith('/api/');

const isLocalOnlyRoute = (req: NextRequest) =>
  req.nextUrl.pathname.startsWith('/dashboard/rag') ||
  req.nextUrl.pathname.startsWith('/dashboard/prices') ||
  req.nextUrl.pathname.startsWith('/dashboard/commodities') ||
  req.nextUrl.pathname.startsWith('/dashboard/quotes');

const hasClerkKeys = Boolean(
  process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY && process.env.CLERK_SECRET_KEY
);

// Dynamically import Clerk only when keys are available
let clerkHandler: ((req: NextRequest) => Promise<NextResponse>) | null = null;

async function getClerkHandler() {
  if (clerkHandler) return clerkHandler;
  if (!hasClerkKeys) return null;

  const { clerkMiddleware, createRouteMatcher } = await import(
    '@clerk/nextjs/server'
  );
  const isPublicRoute = createRouteMatcher(['/', '/auth(.*)']);
  const isProtectedRoute = createRouteMatcher(['/dashboard(.*)']);

  const handler = clerkMiddleware(async (auth, req: NextRequest) => {
    if (isPublicRoute(req)) return;
    if (isProtectedRoute(req)) await auth.protect();
  });

  clerkHandler = handler as unknown as (
    req: NextRequest
  ) => Promise<NextResponse>;
  return clerkHandler;
}

// Proxyable API paths (exclude /api/rag/update for security)
const PROXY_API_PATHS = [
  '/api/prices',
  '/api/rag/search',
  '/api/rag/stats',
  '/api/rag/documents',
  '/api/commodities'
];

// Write endpoints that should only work locally
const WRITE_ROUTES = ['/api/rag/update'];

function shouldProxy(pathname: string): boolean {
  return PROXY_API_PATHS.some(
    (p) => pathname === p || pathname.startsWith(p + '/')
  );
}

function isWriteRoute(pathname: string): boolean {
  return WRITE_ROUTES.some((p) => pathname.startsWith(p));
}

/** Set auth cookie on a response if needed. */
function maybeSetAuthCookie(
  response: NextResponse,
  needsCookie: boolean,
  token: string
): NextResponse {
  if (needsCookie) {
    response.cookies.set('_ab_auth', token, {
      httpOnly: true,
      secure: true,
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 30 // 30 days
    });
  }
  return response;
}

export default async function middleware(req: NextRequest) {
  // --- Basic Auth gate (cookie + header) ---
  // Browser fetch() doesn't auto-send Basic Auth headers,
  // so we persist auth in a cookie after the first challenge.
  let needsAuthCookie = false;
  let authToken = '';
  const authUser = process.env.AUTH_USER;
  const authPass = process.env.AUTH_PASSWORD;

  if (authUser && authPass) {
    authToken = btoa(`${authUser}:${authPass}`);
    const authCookie = req.cookies.get('_ab_auth')?.value;
    let authenticated = authCookie === authToken;

    if (!authenticated) {
      const authorization = req.headers.get('authorization');
      if (authorization) {
        const [scheme, encoded] = authorization.split(' ');
        if (scheme === 'Basic' && encoded) {
          const decoded = atob(encoded);
          const [u, p] = decoded.split(':');
          if (u === authUser && p === authPass) {
            authenticated = true;
            needsAuthCookie = true; // first auth via header, set cookie
          }
        }
      }
    }

    if (!authenticated) {
      return new NextResponse('Authentication required', {
        status: 401,
        headers: { 'WWW-Authenticate': 'Basic realm="Prices Dashboard"' }
      });
    }
  }

  const apiProxyUrl = process.env.API_PROXY_URL;

  // Block write routes on Vercel (only available locally)
  if (process.env.VERCEL && isWriteRoute(req.nextUrl.pathname)) {
    return maybeSetAuthCookie(
      NextResponse.json(
        { error: 'This endpoint is not available in production' },
        { status: 403 }
      ),
      needsAuthCookie,
      authToken
    );
  }

  // Runtime API proxy: rewrite /api/* to Cloudflare Tunnel backend
  if (apiProxyUrl && isApiRoute(req) && shouldProxy(req.nextUrl.pathname)) {
    const target = new URL(
      req.nextUrl.pathname + req.nextUrl.search,
      apiProxyUrl
    );
    const headers = new Headers(req.headers);
    const bearerToken = process.env.TUNNEL_BEARER_TOKEN;
    if (bearerToken) {
      headers.set('Authorization', `Bearer ${bearerToken}`);
    }
    return maybeSetAuthCookie(
      NextResponse.rewrite(target, { request: { headers } }),
      needsAuthCookie,
      authToken
    );
  }

  // API routes and local-only pages skip Clerk entirely
  if (isApiRoute(req) || isLocalOnlyRoute(req)) {
    return maybeSetAuthCookie(NextResponse.next(), needsAuthCookie, authToken);
  }

  // Only use Clerk when keys are configured
  const handler = await getClerkHandler();
  if (handler) {
    const res = await handler(req);
    return maybeSetAuthCookie(res, needsAuthCookie, authToken);
  }

  return maybeSetAuthCookie(NextResponse.next(), needsAuthCookie, authToken);
}

export const config = {
  matcher: [
    // Skip Next.js internals and static files
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    // Always run for API routes
    '/(api|trpc)(.*)'
  ]
};
