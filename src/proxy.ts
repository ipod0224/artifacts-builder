import { NextRequest, NextResponse } from 'next/server';

// API + RAG + Prices 路由不需要 Clerk 認證
const isApiRoute = (req: NextRequest) =>
  req.nextUrl.pathname.startsWith('/api/');

const isLocalOnlyRoute = (req: NextRequest) =>
  req.nextUrl.pathname.startsWith('/dashboard/rag') ||
  req.nextUrl.pathname.startsWith('/dashboard/prices');

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
  '/api/prices/',
  '/api/rag/search',
  '/api/rag/stats',
  '/api/rag/documents'
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

export default async function middleware(req: NextRequest) {
  const apiProxyUrl = process.env.API_PROXY_URL;

  // Block write routes on Vercel (only available locally)
  if (process.env.VERCEL && isWriteRoute(req.nextUrl.pathname)) {
    return NextResponse.json(
      { error: 'This endpoint is not available in production' },
      { status: 403 }
    );
  }

  // Runtime API proxy: rewrite /api/* to Cloudflare Tunnel backend
  if (apiProxyUrl && isApiRoute(req) && shouldProxy(req.nextUrl.pathname)) {
    const target = new URL(
      req.nextUrl.pathname + req.nextUrl.search,
      apiProxyUrl
    );
    return NextResponse.rewrite(target);
  }

  // API routes and local-only pages skip Clerk entirely
  if (isApiRoute(req) || isLocalOnlyRoute(req)) {
    return NextResponse.next();
  }

  // Only use Clerk when keys are configured
  const handler = await getClerkHandler();
  if (handler) {
    return handler(req);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    // Skip Next.js internals and static files
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    // Always run for API routes
    '/(api|trpc)(.*)'
  ]
};
