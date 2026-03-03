'use client';
import { CLERK_ENABLED } from '@/lib/clerk-available';
import { ClerkProvider } from '@clerk/nextjs';
import { dark } from '@clerk/themes';
import { useTheme } from 'next-themes';
import React from 'react';
import { ActiveThemeProvider } from '../themes/active-theme';
import { QueryProvider } from '@/lib/query-client';

function MaybeClerk({ children }: { children: React.ReactNode }) {
  const { resolvedTheme } = useTheme();

  if (!CLERK_ENABLED) {
    return <>{children}</>;
  }

  return (
    <ClerkProvider
      appearance={{
        baseTheme: resolvedTheme === 'dark' ? dark : undefined
      }}
    >
      {children}
    </ClerkProvider>
  );
}

export default function Providers({
  activeThemeValue,
  children
}: {
  activeThemeValue: string;
  children: React.ReactNode;
}) {
  return (
    <QueryProvider>
      <ActiveThemeProvider initialTheme={activeThemeValue}>
        <MaybeClerk>{children}</MaybeClerk>
      </ActiveThemeProvider>
    </QueryProvider>
  );
}
