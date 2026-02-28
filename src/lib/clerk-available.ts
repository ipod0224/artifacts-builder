/**
 * Single source of truth for Clerk availability.
 * NEXT_PUBLIC_ env vars are inlined at build time.
 */
export const CLERK_ENABLED = Boolean(
  process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY
);
