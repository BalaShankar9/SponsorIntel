import type { Metadata } from 'next';
import { Inter, JetBrains_Mono } from 'next/font/google';
import '@/styles/globals.css';
import { AppShell } from '@/components/layout/AppShell';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-ui',
  weight: ['400', '500', '600', '700'],
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-data',
  weight: ['400', '500', '700'],
});

export const metadata: Metadata = {
  title: 'SponsorIntel | UK Sponsorship Intelligence Terminal',
  description: 'Bloomberg-style terminal for UK visa sponsorship intelligence. Real-time data on sponsor companies, jobs, ratings, and compliance signals.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`dark ${inter.variable} ${jetbrainsMono.variable}`}>
      <body className="bg-bg font-ui text-text antialiased">
        <div className="bg-radar" aria-hidden="true" />
        <div className="bg-dots fixed inset-0 pointer-events-none z-[-1]" aria-hidden="true" />
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
