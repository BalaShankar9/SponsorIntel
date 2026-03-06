'use client';

import { Sidebar } from './Sidebar';
import { Topbar } from './Topbar';

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-bg">
      <Sidebar />
      <Topbar />
      <main className="ml-[220px] mt-14 min-h-[calc(100vh-56px)] p-4">
        {children}
      </main>
    </div>
  );
}
