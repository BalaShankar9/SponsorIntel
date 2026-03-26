import type { Metadata } from 'next';
import { Inter, JetBrains_Mono } from 'next/font/google';
import '@/styles/globals.css';
import { ConditionalShell } from '@/components/layout/ConditionalShell';

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
  title: 'SponsorIntel | UK Visa Sponsorship Intelligence Platform',
  description: 'Real-time intelligence on 140,000+ UK visa sponsors. AI-powered job matching, immigration policy alerts, salary benchmarks, and company risk signals for skilled workers, lawyers, and HR teams.',
  keywords: 'UK visa sponsor, skilled worker visa, immigration, sponsor licence, visa sponsorship jobs, UK work visa',
  openGraph: {
    title: 'SponsorIntel | UK Visa Sponsorship Intelligence',
    description: 'The Bloomberg Terminal for UK visa sponsorship. Track 140K+ sponsors, AI-scored jobs, real-time policy alerts.',
    url: 'https://sponsorintel.london',
    siteName: 'SponsorIntel',
    type: 'website',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`dark ${inter.variable} ${jetbrainsMono.variable}`}>
      <body className="bg-bg font-ui text-text antialiased">
        <div className="bg-radar" aria-hidden="true" />
        <div className="bg-dots fixed inset-0 pointer-events-none z-[-1]" aria-hidden="true" />
        <ConditionalShell>{children}</ConditionalShell>
      </body>
    </html>
  );
}
