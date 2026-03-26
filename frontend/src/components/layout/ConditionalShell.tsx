'use client';

import { usePathname } from 'next/navigation';
import { AppShell } from './AppShell';

const BARE_ROUTES = ['/', '/login', '/register', '/onboarding', '/pricing'];

export function ConditionalShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isBare = BARE_ROUTES.includes(pathname);

  if (isBare) {
    return <>{children}</>;
  }

  return <AppShell>{children}</AppShell>;
}
