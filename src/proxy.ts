import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server';
import { NextRequest, NextResponse } from 'next/server';

// RAG 相關路由完全跳過 Clerk（不連外網）
const isLocalOnlyRoute = createRouteMatcher([
  '/dashboard/rag(.*)',
  '/api/rag(.*)'
]);

// 公開路由
const isPublicRoute = createRouteMatcher(['/', '/auth(.*)']);

const isProtectedRoute = createRouteMatcher(['/dashboard(.*)']);

export default clerkMiddleware(async (auth, req: NextRequest) => {
  // RAG 路由完全跳過，不經過 Clerk
  if (isLocalOnlyRoute(req)) {
    return NextResponse.next();
  }

  // 公開路由不需要認證
  if (isPublicRoute(req)) return;

  // 其他 dashboard 路由需要認證
  if (isProtectedRoute(req)) await auth.protect();
});

export const config = {
  matcher: [
    // Skip Next.js internals and static files
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    // Always run for API routes
    '/(api|trpc)(.*)'
  ]
};
