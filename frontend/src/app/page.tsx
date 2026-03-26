'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';

export default function LandingPage() {
  const [stats, setStats] = useState({ sponsors: 0, jobs: 0, intel: 0 });

  useEffect(() => {
    async function loadStats() {
      try {
        const [sponsorRes, jobRes] = await Promise.all([
          supabase.from('sponsors').select('*', { count: 'exact', head: true }),
          supabase.from('jobs').select('*', { count: 'exact', head: true }).eq('is_active', true),
        ]);
        setStats({
          sponsors: sponsorRes.count || 140000,
          jobs: jobRes.count || 0,
          intel: 0,
        });
      } catch {
        setStats({ sponsors: 140000, jobs: 0, intel: 0 });
      }
    }
    loadStats();
  }, []);

  return (
    <div className="min-h-screen bg-bg text-text">
      {/* Nav */}
      <nav className="border-b border-border px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded bg-amber/20 flex items-center justify-center">
            <span className="text-amber font-bold text-sm">SI</span>
          </div>
          <span className="font-semibold text-sm tracking-wide">SPONSORINTEL</span>
          <span className="text-[10px] font-data text-dim ml-1">.london</span>
        </div>
        <div className="flex items-center gap-4">
          <Link href="/login" className="text-xs text-dim hover:text-text transition-colors">Sign In</Link>
          <Link href="/register" className="text-xs bg-amber text-bg px-4 py-2 rounded font-semibold hover:bg-amber/90 transition-colors">
            Start Free
          </Link>
        </div>
      </nav>

      {/* Hero */}
      <section className="px-6 py-20 max-w-5xl mx-auto text-center">
        <div className="inline-block bg-cyan/10 text-cyan text-[10px] font-data px-3 py-1 rounded-full mb-6 tracking-wider">
          UK VISA SPONSORSHIP INTELLIGENCE
        </div>
        <h1 className="text-3xl md:text-5xl font-bold leading-tight mb-6">
          The Bloomberg Terminal<br />
          for <span className="text-amber">Visa Sponsorship</span>
        </h1>
        <p className="text-dim text-sm md:text-base max-w-2xl mx-auto mb-8 leading-relaxed">
          Real-time intelligence on {stats.sponsors.toLocaleString()}+ UK visa sponsors.
          AI-powered job matching, immigration policy alerts, and company risk signals —
          all in one platform built for skilled workers, lawyers, and HR teams.
        </p>
        <div className="flex items-center justify-center gap-4 mb-12">
          <Link href="/register" className="bg-amber text-bg px-8 py-3 rounded font-semibold text-sm hover:bg-amber/90 transition-all hover:-translate-y-0.5">
            Start Free — No Credit Card
          </Link>
          <Link href="/dashboard" className="border border-border text-text px-8 py-3 rounded font-semibold text-sm hover:bg-s1 transition-colors">
            View Demo
          </Link>
        </div>

        {/* Live Stats Bar */}
        <div className="flex items-center justify-center gap-8 text-center">
          <div>
            <div className="text-2xl font-data font-bold text-amber">{stats.sponsors.toLocaleString()}</div>
            <div className="text-[10px] font-data text-dim tracking-wider">SPONSORS TRACKED</div>
          </div>
          <div className="w-px h-10 bg-border" />
          <div>
            <div className="text-2xl font-data font-bold text-cyan">23+</div>
            <div className="text-[10px] font-data text-dim tracking-wider">JOB BOARDS SCRAPED</div>
          </div>
          <div className="w-px h-10 bg-border" />
          <div>
            <div className="text-2xl font-data font-bold text-green">181</div>
            <div className="text-[10px] font-data text-dim tracking-wider">AI AGENTS ACTIVE</div>
          </div>
        </div>
      </section>

      {/* Feature Grid */}
      <section className="px-6 py-16 max-w-5xl mx-auto">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[
            { icon: '🔍', title: 'Sponsor Search', desc: 'Search 140K+ UK sponsors by name, city, rating, route. Real-time data from Home Office register.', href: '/search' },
            { icon: '💼', title: 'Job Intelligence', desc: 'AI-scored visa-sponsorship likelihood on every job. Salary threshold checks, shortage list matching.', href: '/jobs' },
            { icon: '📡', title: 'Immigration Intel', desc: 'Real-time policy monitoring. GOV.UK, Hansard, BBC, legal blogs — classified by AI impact analysis.', href: '/intel' },
            { icon: '🗺️', title: 'UK Sponsor Map', desc: 'Interactive choropleth map showing sponsor density, salary heat maps, and regional trends.', href: '/map' },
            { icon: '📊', title: 'Market Trends', desc: 'Visa grant statistics by SOC code, salary benchmarks, industry growth charts.', href: '/trends' },
            { icon: '🔔', title: 'Smart Alerts', desc: 'Custom alerts for new sponsors, rating changes, policy updates. Email, in-app, or webhook.', href: '/alerts' },
          ].map((f) => (
            <Link key={f.title} href={f.href} className="border border-border bg-s1 p-5 rounded hover:border-amber/30 transition-all hover:-translate-y-0.5 group">
              <div className="text-2xl mb-3">{f.icon}</div>
              <h3 className="text-sm font-semibold mb-2 group-hover:text-amber transition-colors">{f.title}</h3>
              <p className="text-xs text-dim leading-relaxed">{f.desc}</p>
            </Link>
          ))}
        </div>
      </section>

      {/* Social Proof */}
      <section className="px-6 py-16 border-t border-border">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-lg font-semibold mb-8">Built for the UK Immigration Ecosystem</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-center">
            <div className="p-4">
              <div className="text-amber font-data text-lg font-bold mb-1">Skilled Workers</div>
              <p className="text-xs text-dim">Find sponsors actively hiring in your field. Salary threshold checks built in.</p>
            </div>
            <div className="p-4">
              <div className="text-cyan font-data text-lg font-bold mb-1">Immigration Lawyers</div>
              <p className="text-xs text-dim">Policy change alerts, sponsor risk signals, and client-ready company profiles.</p>
            </div>
            <div className="p-4">
              <div className="text-green font-data text-lg font-bold mb-1">HR & Recruitment</div>
              <p className="text-xs text-dim">Competitor intelligence, market benchmarks, and sponsorship compliance data.</p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="px-6 py-20 text-center">
        <h2 className="text-xl font-semibold mb-4">Start making informed visa decisions today</h2>
        <p className="text-sm text-dim mb-8">Free tier includes search, basic alerts, and 10 company profiles.</p>
        <Link href="/register" className="bg-amber text-bg px-8 py-3 rounded font-semibold text-sm hover:bg-amber/90 transition-all hover:-translate-y-0.5">
          Create Free Account
        </Link>
      </section>

      {/* Footer */}
      <footer className="border-t border-border px-6 py-8">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div className="text-[10px] font-data text-dim">
            © 2026 SponsorIntel — sponsorintel.london
          </div>
          <div className="flex items-center gap-4 text-[10px] font-data text-dim">
            <Link href="/pricing" className="hover:text-text">Pricing</Link>
            <Link href="/login" className="hover:text-text">Sign In</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
