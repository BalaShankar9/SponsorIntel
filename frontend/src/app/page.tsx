'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';

// ─── Typewriter Hook ───────────────────────────────────────────────────────────
function useTypewriter(phrases: string[], speed = 60, pause = 2200) {
  const [displayed, setDisplayed] = useState('');
  const [phraseIdx, setPhraseIdx] = useState(0);
  const [charIdx, setCharIdx] = useState(0);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    const current = phrases[phraseIdx];
    let timeout: ReturnType<typeof setTimeout>;

    if (!deleting && charIdx < current.length) {
      timeout = setTimeout(() => setCharIdx(i => i + 1), speed);
    } else if (!deleting && charIdx === current.length) {
      timeout = setTimeout(() => setDeleting(true), pause);
    } else if (deleting && charIdx > 0) {
      timeout = setTimeout(() => setCharIdx(i => i - 1), speed / 2);
    } else if (deleting && charIdx === 0) {
      setDeleting(false);
      setPhraseIdx(i => (i + 1) % phrases.length);
    }

    setDisplayed(current.slice(0, charIdx));
    return () => clearTimeout(timeout);
  }, [charIdx, deleting, phraseIdx, phrases, speed, pause]);

  return displayed;
}

// ─── Counter Hook ──────────────────────────────────────────────────────────────
function useCountUp(target: number, duration = 1800, started = false) {
  const [count, setCount] = useState(0);
  useEffect(() => {
    if (!started || target === 0) return;
    let start = 0;
    const step = target / (duration / 16);
    const timer = setInterval(() => {
      start += step;
      if (start >= target) {
        setCount(target);
        clearInterval(timer);
      } else {
        setCount(Math.floor(start));
      }
    }, 16);
    return () => clearInterval(timer);
  }, [target, duration, started]);
  return count;
}

// ─── Intersection Observer Hook ───────────────────────────────────────────────
function useInView(threshold = 0.15) {
  const ref = useRef<HTMLDivElement>(null);
  const [inView, setInView] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) { setInView(true); obs.disconnect(); }
    }, { threshold });
    obs.observe(el);
    return () => obs.disconnect();
  }, [threshold]);
  return { ref, inView };
}

// ─── Ticker Data ──────────────────────────────────────────────────────────────
const TICKER_ITEMS = [
  { label: 'NHS TRUST LONDON', value: '+14 new roles', color: '#00d4aa' },
  { label: 'DELOITTE UK', value: 'SKILLED WORKER', color: '#f5a623' },
  { label: 'AMAZON EU', value: '£72,000 threshold', color: '#00e5ff' },
  { label: 'HOME OFFICE', value: 'SOC list updated', color: '#f5a623' },
  { label: 'HSBC BANK PLC', value: '+8 tech sponsors', color: '#00d4aa' },
  { label: 'REGISTER UPDATED', value: '2,847 new sponsors', color: '#00e5ff' },
  { label: 'SHORTAGE LIST', value: '212 roles eligible', color: '#00d4aa' },
  { label: 'META PLATFORMS', value: 'A-RATED sponsor', color: '#f5a623' },
  { label: 'PWC UK LLP', value: 'Global mobility ↑', color: '#00e5ff' },
  { label: 'GOLDMAN SACHS', value: 'Senior Dev open', color: '#00d4aa' },
  { label: 'BT GROUP', value: 'New: 23 tech roles', color: '#f5a623' },
  { label: 'VISA GRANTS Q1', value: '42,310 issued', color: '#00e5ff' },
];

// ─── Feature Data ─────────────────────────────────────────────────────────────
const FEATURES = [
  {
    icon: '⬡',
    label: 'SPONSOR SEARCH',
    title: 'Find Any UK Sponsor',
    desc: 'Instant lookup across 140K+ licensed sponsors. Filter by SOC route, city, rating, and industry. Real-time Home Office register sync.',
    color: '#f5a623',
    href: '/search',
    stat: '140K+',
    statLabel: 'sponsors indexed',
  },
  {
    icon: '◈',
    label: 'JOB INTELLIGENCE',
    title: 'AI-Scored Job Matching',
    desc: 'Every job auto-scored for visa sponsorship likelihood. Salary threshold checks, shortage occupation matching, SOC code detection.',
    color: '#00e5ff',
    href: '/jobs',
    stat: '23+',
    statLabel: 'job boards scraped',
  },
  {
    icon: '◉',
    label: 'IMMIGRATION INTEL',
    title: 'Policy Radar',
    desc: 'Live monitoring of GOV.UK, Hansard, BBC, and legal blogs. AI classifies every article by immigration impact. Never miss a rule change.',
    color: '#00d4aa',
    href: '/signals',
    stat: 'Real-time',
    statLabel: 'policy tracking',
  },
  {
    icon: '◎',
    label: 'SPONSOR MAP',
    title: 'UK Geographic Heat Map',
    desc: 'Interactive choropleth showing sponsor density by postcode district. Salary heat maps, regional hiring trends, and growth corridors.',
    color: '#f5a623',
    href: '/map',
    stat: '650+',
    statLabel: 'districts mapped',
  },
  {
    icon: '◇',
    label: 'MARKET TRENDS',
    title: 'Visa Intelligence Dashboard',
    desc: 'Visa grant statistics by SOC code and industry. Salary benchmarks, refusal rate trends, historical compare across quarters.',
    color: '#00e5ff',
    href: '/trends',
    stat: '5yr',
    statLabel: 'trend history',
  },
  {
    icon: '◆',
    label: 'SMART ALERTS',
    title: 'Custom Alert Engine',
    desc: 'Set alerts on any sponsor, policy keyword, or salary threshold. Email, in-app, and webhook delivery. Build complex alert logic.',
    color: '#00d4aa',
    href: '/alerts',
    stat: '<2min',
    statLabel: 'alert latency',
  },
];

// ─── Timeline Data ────────────────────────────────────────────────────────────
const TIMELINE = [
  { date: 'Q1 2026', event: 'Salary thresholds raised to £38,700 for most roles', type: 'alert' },
  { date: 'Mar 2026', event: '2,847 new sponsors added to licensed register', type: 'update' },
  { date: 'Feb 2026', event: 'Shortage Occupation List revised — 212 roles eligible', type: 'info' },
  { date: 'Jan 2026', event: 'Points-based system: new SOC codes introduced', type: 'update' },
  { date: 'Dec 2025', event: 'Record 42,310 Skilled Worker visas granted in Q4', type: 'info' },
];

// ─── Main Component ───────────────────────────────────────────────────────────
export default function LandingPage() {
  const [sponsorCount, setSponsorCount] = useState(140312);
  const [jobCount, setJobCount] = useState(0);
  const [scrolled, setScrolled] = useState(false);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const heroRef = useRef<HTMLDivElement>(null);

  const typewriter = useTypewriter([
    'UK Visa Intelligence.',
    'Real-Time Sponsor Data.',
    'Immigration Policy Radar.',
    'AI-Powered Job Matching.',
    'The Bloomberg for Visas.',
  ]);

  const { ref: statsRef, inView: statsInView } = useInView();
  const { ref: featuresRef, inView: featuresInView } = useInView(0.1);
  const { ref: timelineRef, inView: timelineInView } = useInView();

  const sponsorDisplay = useCountUp(sponsorCount, 2000, statsInView);
  const jobDisplay = useCountUp(jobCount || 84700, 2000, statsInView);
  const agentsDisplay = useCountUp(181, 1400, statsInView);
  const boardsDisplay = useCountUp(23, 1000, statsInView);

  useEffect(() => {
    async function loadStats() {
      try {
        const [sponsorRes, jobRes] = await Promise.all([
          supabase.from('sponsors').select('*', { count: 'exact', head: true }),
          supabase.from('jobs').select('*', { count: 'exact', head: true }).eq('is_active', true),
        ]);
        if (sponsorRes.count) setSponsorCount(sponsorRes.count);
        if (jobRes.count) setJobCount(jobRes.count);
      } catch {
        // use defaults
      }
    }
    loadStats();
  }, []);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 30);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    setMousePos({ x: e.clientX, y: e.clientY });
  }, []);

  return (
    <div
      className="min-h-screen bg-bg text-text overflow-x-hidden"
      onMouseMove={handleMouseMove}
      style={{ fontFamily: 'Inter, sans-serif' }}
    >
      {/* ── Animated Grid Background ── */}
      <div className="landing-grid-bg" aria-hidden />

      {/* ── Cursor Spotlight ── */}
      <div
        className="pointer-events-none fixed inset-0 z-0 transition-opacity duration-300"
        style={{
          background: `radial-gradient(600px circle at ${mousePos.x}px ${mousePos.y}px, rgba(245,166,35,0.04), transparent 70%)`,
        }}
        aria-hidden
      />

      {/* ── Nav ── */}
      <nav
        className="fixed top-0 left-0 right-0 z-50 transition-all duration-300"
        style={{
          background: scrolled ? 'rgba(10,10,10,0.92)' : 'transparent',
          backdropFilter: scrolled ? 'blur(12px)' : 'none',
          borderBottom: scrolled ? '1px solid rgba(255,255,255,0.06)' : '1px solid transparent',
        }}
      >
        <div className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div
              className="h-8 w-8 rounded flex items-center justify-center relative overflow-hidden"
              style={{ background: 'rgba(245,166,35,0.15)', border: '1px solid rgba(245,166,35,0.3)' }}
            >
              <span
                className="font-bold text-xs relative z-10"
                style={{ color: '#f5a623', fontFamily: 'JetBrains Mono, monospace' }}
              >
                SI
              </span>
              <div className="nav-logo-sweep" aria-hidden />
            </div>
            <div className="flex items-baseline gap-1">
              <span className="font-semibold text-sm tracking-widest text-white">SPONSORINTEL</span>
              <span className="text-[10px] font-mono" style={{ color: '#f5a623', opacity: 0.7 }}>.london</span>
            </div>
            <div
              className="hidden md:flex items-center gap-1.5 px-2 py-0.5 rounded-full"
              style={{ background: 'rgba(0,212,170,0.1)', border: '1px solid rgba(0,212,170,0.2)' }}
            >
              <div
                className="w-1.5 h-1.5 rounded-full"
                style={{ background: '#00d4aa', animation: 'pulse-dot 2s ease-in-out infinite' }}
              />
              <span className="text-[9px] font-mono tracking-widest" style={{ color: '#00d4aa' }}>LIVE</span>
            </div>
          </div>
          <div className="flex items-center gap-6">
            <div className="hidden md:flex items-center gap-5 text-xs text-gray-400">
              <Link href="/search" className="hover:text-white transition-colors">Search</Link>
              <Link href="/jobs" className="hover:text-white transition-colors">Jobs</Link>
              <Link href="/trends" className="hover:text-white transition-colors">Trends</Link>
              <Link href="/pricing" className="hover:text-white transition-colors">Pricing</Link>
            </div>
            <Link
              href="/login"
              className="text-xs text-gray-400 hover:text-white transition-colors"
            >
              Sign In
            </Link>
            <Link
              href="/register"
              className="text-xs px-4 py-2 rounded font-semibold transition-all hover:-translate-y-px"
              style={{
                background: 'linear-gradient(135deg, #f5a623, #e8941a)',
                color: '#0a0a0a',
                boxShadow: '0 0 20px rgba(245,166,35,0.3)',
              }}
            >
              Start Free
            </Link>
          </div>
        </div>
      </nav>

      {/* ── Live Ticker ── */}
      <div
        className="fixed top-14 left-0 right-0 z-40 overflow-hidden"
        style={{
          background: 'rgba(10,10,10,0.9)',
          borderBottom: '1px solid rgba(245,166,35,0.15)',
          height: '28px',
        }}
      >
        <div className="flex items-center h-full">
          <div
            className="flex-shrink-0 px-3 flex items-center gap-2 h-full"
            style={{
              background: 'rgba(245,166,35,0.12)',
              borderRight: '1px solid rgba(245,166,35,0.2)',
              minWidth: '80px',
            }}
          >
            <div className="w-1.5 h-1.5 rounded-full" style={{ background: '#f5a623', animation: 'pulse-dot 1.5s ease-in-out infinite' }} />
            <span className="text-[9px] font-mono tracking-widest" style={{ color: '#f5a623' }}>INTEL</span>
          </div>
          <div className="overflow-hidden flex-1">
            <div className="ticker-track flex items-center gap-0">
              {[...TICKER_ITEMS, ...TICKER_ITEMS].map((item, i) => (
                <div key={i} className="flex items-center gap-3 px-4 flex-shrink-0 h-7">
                  <span className="text-[10px] font-mono text-gray-500 tracking-wider">{item.label}</span>
                  <span className="text-[10px] font-mono font-semibold" style={{ color: item.color }}>{item.value}</span>
                  <span className="text-gray-700 text-xs">|</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ── Hero Section ── */}
      <section
        ref={heroRef}
        className="relative min-h-screen flex flex-col items-center justify-center px-6 pt-24"
        style={{ paddingBottom: '80px' }}
      >
        {/* Radar sweep */}
        <div className="hero-radar" aria-hidden>
          <div className="hero-radar-ring r1" />
          <div className="hero-radar-ring r2" />
          <div className="hero-radar-ring r3" />
          <div className="hero-radar-ring r4" />
          <div className="hero-radar-sweep" />
          <div className="hero-radar-dot" />
        </div>

        {/* Floating stat cards */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden" aria-hidden>
          <div className="float-card float-card-1">
            <div className="text-[9px] font-mono text-gray-500 mb-1 tracking-wider">SPONSORS</div>
            <div className="text-base font-mono font-bold" style={{ color: '#f5a623' }}>140,312</div>
            <div className="text-[8px] font-mono mt-0.5" style={{ color: '#00d4aa' }}>↑ +2,847 this week</div>
          </div>
          <div className="float-card float-card-2">
            <div className="text-[9px] font-mono text-gray-500 mb-1 tracking-wider">VISA GRANTS</div>
            <div className="text-base font-mono font-bold" style={{ color: '#00e5ff' }}>42,310</div>
            <div className="text-[8px] font-mono mt-0.5" style={{ color: '#00d4aa' }}>Q4 2025</div>
          </div>
          <div className="float-card float-card-3">
            <div className="text-[9px] font-mono text-gray-500 mb-1 tracking-wider">AI AGENTS</div>
            <div className="text-base font-mono font-bold" style={{ color: '#00d4aa' }}>181</div>
            <div className="text-[8px] font-mono mt-0.5" style={{ color: '#f5a623' }}>Active now</div>
          </div>
          <div className="float-card float-card-4">
            <div className="text-[9px] font-mono text-gray-500 mb-1 tracking-wider">JOB BOARDS</div>
            <div className="text-base font-mono font-bold" style={{ color: '#f5a623' }}>23+</div>
            <div className="text-[8px] font-mono mt-0.5" style={{ color: '#00e5ff' }}>Scraped live</div>
          </div>
        </div>

        {/* Badge */}
        <div
          className="relative z-10 inline-flex items-center gap-2 px-3 py-1.5 rounded-full mb-8"
          style={{
            background: 'rgba(0,229,255,0.08)',
            border: '1px solid rgba(0,229,255,0.2)',
            animation: 'fadeInDown 0.6s ease-out both',
          }}
        >
          <div className="w-1.5 h-1.5 rounded-full" style={{ background: '#00e5ff', animation: 'pulse-dot 2s ease-in-out infinite' }} />
          <span className="text-[10px] font-mono tracking-widest" style={{ color: '#00e5ff' }}>
            UK VISA SPONSORSHIP INTELLIGENCE PLATFORM
          </span>
        </div>

        {/* Main Heading */}
        <div
          className="relative z-10 text-center mb-6"
          style={{ animation: 'fadeInUp 0.7s ease-out 0.1s both' }}
        >
          <h1 className="text-4xl md:text-6xl lg:text-7xl font-bold leading-none tracking-tight mb-2">
            <span className="hero-gradient-text">The Bloomberg</span>
          </h1>
          <h1 className="text-4xl md:text-6xl lg:text-7xl font-bold leading-none tracking-tight mb-4">
            <span className="text-white">Terminal for</span>{' '}
            <span style={{ color: '#f5a623', textShadow: '0 0 40px rgba(245,166,35,0.4)' }}>Visas</span>
          </h1>
        </div>

        {/* Typewriter */}
        <div
          className="relative z-10 text-center mb-8 h-8 flex items-center justify-center"
          style={{ animation: 'fadeInUp 0.7s ease-out 0.2s both' }}
        >
          <span
            className="text-lg md:text-xl font-mono"
            style={{ color: '#888', letterSpacing: '0.02em' }}
          >
            {typewriter}
            <span className="terminal-cursor-inline" />
          </span>
        </div>

        {/* Sub copy */}
        <p
          className="relative z-10 text-center text-gray-400 text-sm md:text-base max-w-2xl mx-auto mb-10 leading-relaxed"
          style={{ animation: 'fadeInUp 0.7s ease-out 0.3s both' }}
        >
          Real-time intelligence on <span className="font-mono" style={{ color: '#f5a623' }}>140,312+</span> UK visa sponsors.
          AI-powered job matching, immigration policy alerts, company risk signals — built for
          skilled workers, lawyers, and HR teams.
        </p>

        {/* CTAs */}
        <div
          className="relative z-10 flex flex-col sm:flex-row items-center gap-4 mb-16"
          style={{ animation: 'fadeInUp 0.7s ease-out 0.4s both' }}
        >
          <Link
            href="/register"
            className="group flex items-center gap-2 px-8 py-3.5 rounded font-semibold text-sm transition-all hover:-translate-y-0.5"
            style={{
              background: 'linear-gradient(135deg, #f5a623, #e8941a)',
              color: '#0a0a0a',
              boxShadow: '0 0 30px rgba(245,166,35,0.35)',
            }}
          >
            Start Free — No Credit Card
            <span className="transition-transform group-hover:translate-x-1">→</span>
          </Link>
          <Link
            href="/search"
            className="group flex items-center gap-2 px-8 py-3.5 rounded font-semibold text-sm transition-all hover:-translate-y-0.5"
            style={{
              background: 'rgba(255,255,255,0.04)',
              border: '1px solid rgba(255,255,255,0.1)',
              color: '#e0e0e0',
            }}
          >
            <span>Explore Sponsors</span>
            <span className="text-xs opacity-50 group-hover:opacity-100 transition-opacity">⬡</span>
          </Link>
        </div>

        {/* Scroll indicator */}
        <div className="relative z-10 flex flex-col items-center gap-2" style={{ animation: 'fadeIn 1s ease-out 1.5s both' }}>
          <span className="text-[9px] font-mono text-gray-600 tracking-widest">SCROLL</span>
          <div className="scroll-indicator" />
        </div>
      </section>

      {/* ── Stats Section ── */}
      <section ref={statsRef} className="relative z-10 py-20 px-6">
        <div className="max-w-5xl mx-auto">
          <div
            className="grid grid-cols-2 md:grid-cols-4 gap-4"
            style={{ opacity: statsInView ? 1 : 0, transition: 'opacity 0.6s ease-out' }}
          >
            {[
              { value: sponsorDisplay, suffix: '+', label: 'Sponsors Tracked', color: '#f5a623', prefix: '' },
              { value: jobDisplay, suffix: '', label: 'Jobs Indexed', color: '#00e5ff', prefix: '' },
              { value: agentsDisplay, suffix: '', label: 'AI Agents Active', color: '#00d4aa', prefix: '' },
              { value: boardsDisplay, suffix: '+', label: 'Job Boards Scraped', color: '#f5a623', prefix: '' },
            ].map((stat, i) => (
              <div
                key={stat.label}
                className="stat-glass-card"
                style={{
                  opacity: statsInView ? 1 : 0,
                  transform: statsInView ? 'translateY(0)' : 'translateY(20px)',
                  transition: `all 0.6s ease-out ${i * 0.1}s`,
                }}
              >
                <div
                  className="text-3xl md:text-4xl font-mono font-bold mb-1"
                  style={{ color: stat.color, textShadow: `0 0 20px ${stat.color}66` }}
                >
                  {stat.prefix}{stat.value.toLocaleString()}{stat.suffix}
                </div>
                <div className="text-[10px] font-mono text-gray-500 tracking-widest uppercase">{stat.label}</div>
                <div
                  className="mt-3 h-px w-full"
                  style={{ background: `linear-gradient(90deg, ${stat.color}33, transparent)` }}
                />
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Features Grid ── */}
      <section ref={featuresRef} className="relative z-10 py-20 px-6">
        <div className="max-w-6xl mx-auto">
          {/* Section header */}
          <div className="text-center mb-16">
            <div
              className="inline-block text-[10px] font-mono tracking-widest px-3 py-1 rounded mb-4"
              style={{
                color: '#f5a623',
                background: 'rgba(245,166,35,0.08)',
                border: '1px solid rgba(245,166,35,0.2)',
              }}
            >
              PLATFORM CAPABILITIES
            </div>
            <h2 className="text-2xl md:text-3xl font-bold text-white mb-4">
              Every signal. Every sponsor. Every second.
            </h2>
            <p className="text-gray-400 text-sm max-w-xl mx-auto">
              Six intelligence modules working in parallel — scrapers, AI agents, and real-time feeds feeding a single unified platform.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {FEATURES.map((f, i) => (
              <Link
                key={f.title}
                href={f.href}
                className="feature-card group"
                style={{
                  '--feature-color': f.color,
                  opacity: featuresInView ? 1 : 0,
                  transform: featuresInView ? 'translateY(0)' : 'translateY(30px)',
                  transition: `all 0.5s ease-out ${i * 0.08}s`,
                } as React.CSSProperties}
              >
                <div className="feature-card-inner">
                  {/* Top bar */}
                  <div className="flex items-center justify-between mb-4">
                    <div
                      className="text-[9px] font-mono tracking-widest"
                      style={{ color: f.color, opacity: 0.7 }}
                    >
                      {f.label}
                    </div>
                    <div
                      className="text-xl font-mono transition-transform group-hover:scale-110 group-hover:rotate-12"
                      style={{ color: f.color }}
                    >
                      {f.icon}
                    </div>
                  </div>

                  {/* Title */}
                  <h3
                    className="text-sm font-semibold text-white mb-2 group-hover:text-opacity-100 transition-colors"
                    style={{ textShadow: `0 0 20px ${f.color}00` }}
                  >
                    {f.title}
                  </h3>

                  {/* Desc */}
                  <p className="text-xs text-gray-500 leading-relaxed mb-4 flex-1">{f.desc}</p>

                  {/* Bottom stat */}
                  <div
                    className="flex items-center justify-between pt-3"
                    style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}
                  >
                    <div>
                      <span
                        className="text-lg font-mono font-bold"
                        style={{ color: f.color }}
                      >
                        {f.stat}
                      </span>
                      <span className="text-[9px] font-mono text-gray-600 ml-2">{f.statLabel}</span>
                    </div>
                    <div
                      className="text-xs font-mono transition-all group-hover:translate-x-1"
                      style={{ color: f.color, opacity: 0 }}
                    >
                      →
                    </div>
                  </div>
                </div>

                {/* Hover glow border */}
                <div className="feature-card-glow" aria-hidden />
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* ── Who It's For ── */}
      <section className="relative z-10 py-20 px-6">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <div
              className="inline-block text-[10px] font-mono tracking-widest px-3 py-1 rounded mb-4"
              style={{ color: '#00e5ff', background: 'rgba(0,229,255,0.08)', border: '1px solid rgba(0,229,255,0.2)' }}
            >
              BUILT FOR
            </div>
            <h2 className="text-2xl md:text-3xl font-bold text-white">
              The entire UK immigration ecosystem
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              {
                title: 'Skilled Workers',
                subtitle: 'Find your sponsor',
                color: '#f5a623',
                points: [
                  'Search 140K+ licensed UK sponsors',
                  'AI job matching with sponsorship likelihood',
                  'Salary threshold checker per role',
                  'Company risk scores before you apply',
                  'Shortage occupation auto-detection',
                ],
                cta: 'Search Sponsors',
                href: '/search',
              },
              {
                title: 'Immigration Lawyers',
                subtitle: 'Stay ahead of policy',
                color: '#00e5ff',
                points: [
                  'Real-time policy change alerts',
                  'Sponsor compliance & risk signals',
                  'Client-ready company profiles',
                  'Enforcement action tracking',
                  'Route eligibility cross-reference',
                ],
                cta: 'View Signals',
                href: '/signals',
                featured: true,
              },
              {
                title: 'HR & Recruitment',
                subtitle: 'Competitive intelligence',
                color: '#00d4aa',
                points: [
                  'Competitor sponsorship benchmarks',
                  'Salary market data by SOC code',
                  'Talent pool mapping by region',
                  'Compliance calendar & deadlines',
                  'Workforce immigration analytics',
                ],
                cta: 'Explore Trends',
                href: '/trends',
              },
            ].map((persona) => (
              <div
                key={persona.title}
                className="persona-card"
                style={{
                  '--persona-color': persona.color,
                  borderColor: persona.featured ? `${persona.color}30` : 'rgba(255,255,255,0.06)',
                  boxShadow: persona.featured ? `0 0 40px -10px ${persona.color}30` : 'none',
                } as React.CSSProperties}
              >
                {persona.featured && (
                  <div
                    className="absolute top-3 right-3 text-[8px] font-mono tracking-widest px-2 py-0.5 rounded-full"
                    style={{ background: `${persona.color}20`, color: persona.color, border: `1px solid ${persona.color}40` }}
                  >
                    POPULAR
                  </div>
                )}
                <div className="text-[9px] font-mono tracking-widest mb-1" style={{ color: persona.color, opacity: 0.7 }}>
                  {persona.subtitle.toUpperCase()}
                </div>
                <h3 className="text-base font-bold text-white mb-4">{persona.title}</h3>
                <ul className="space-y-2.5 mb-6">
                  {persona.points.map((p) => (
                    <li key={p} className="flex items-start gap-2.5 text-xs text-gray-400">
                      <span className="mt-0.5 text-[10px] flex-shrink-0" style={{ color: persona.color }}>◆</span>
                      {p}
                    </li>
                  ))}
                </ul>
                <Link
                  href={persona.href}
                  className="inline-flex items-center gap-2 text-xs font-semibold font-mono transition-all hover:-translate-y-px"
                  style={{ color: persona.color }}
                >
                  {persona.cta} →
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Live Intelligence Feed ── */}
      <section ref={timelineRef} className="relative z-10 py-20 px-6">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-12">
            <div
              className="inline-block text-[10px] font-mono tracking-widest px-3 py-1 rounded mb-4"
              style={{ color: '#00d4aa', background: 'rgba(0,212,170,0.08)', border: '1px solid rgba(0,212,170,0.2)' }}
            >
              INTELLIGENCE FEED
            </div>
            <h2 className="text-2xl font-bold text-white">Latest UK Immigration Updates</h2>
          </div>

          <div className="space-y-0">
            {TIMELINE.map((item, i) => (
              <div
                key={i}
                className="timeline-item"
                style={{
                  opacity: timelineInView ? 1 : 0,
                  transform: timelineInView ? 'translateX(0)' : 'translateX(-20px)',
                  transition: `all 0.5s ease-out ${i * 0.1}s`,
                }}
              >
                <div className="timeline-dot" style={{
                  background: item.type === 'alert' ? '#ff4757' : item.type === 'update' ? '#f5a623' : '#00e5ff'
                }} />
                <div className="flex-1 pl-4">
                  <div className="flex items-center gap-3 mb-0.5">
                    <span className="text-[9px] font-mono text-gray-600 tracking-wider">{item.date}</span>
                    <span
                      className="text-[8px] font-mono px-1.5 py-0.5 rounded uppercase tracking-wider"
                      style={{
                        background: item.type === 'alert' ? 'rgba(255,71,87,0.1)' : item.type === 'update' ? 'rgba(245,166,35,0.1)' : 'rgba(0,229,255,0.1)',
                        color: item.type === 'alert' ? '#ff4757' : item.type === 'update' ? '#f5a623' : '#00e5ff',
                        border: `1px solid ${item.type === 'alert' ? 'rgba(255,71,87,0.2)' : item.type === 'update' ? 'rgba(245,166,35,0.2)' : 'rgba(0,229,255,0.2)'}`,
                      }}
                    >
                      {item.type}
                    </span>
                  </div>
                  <p className="text-sm text-gray-300">{item.event}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Terminal CTA ── */}
      <section className="relative z-10 py-24 px-6">
        <div className="max-w-3xl mx-auto">
          <div className="terminal-cta-card">
            {/* Terminal chrome */}
            <div className="flex items-center gap-1.5 mb-6 pb-4" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
              <div className="w-3 h-3 rounded-full" style={{ background: '#ff5f57' }} />
              <div className="w-3 h-3 rounded-full" style={{ background: '#ffbd2e' }} />
              <div className="w-3 h-3 rounded-full" style={{ background: '#28c840' }} />
              <span className="ml-3 text-[10px] font-mono text-gray-600 tracking-wider">sponsorintel.london — command center</span>
            </div>

            {/* Terminal lines */}
            <div className="space-y-2 mb-8 font-mono text-sm">
              <div className="flex gap-2">
                <span style={{ color: '#00d4aa' }}>$</span>
                <span className="text-gray-300">sponsorintel search --route skilled-worker --city london</span>
              </div>
              <div className="text-gray-500 text-xs pl-4">Found <span style={{ color: '#f5a623' }}>12,847</span> active sponsors in London</div>
              <div className="flex gap-2">
                <span style={{ color: '#00d4aa' }}>$</span>
                <span className="text-gray-300">sponsorintel alerts --threshold 38700 --shortage-list</span>
              </div>
              <div className="text-gray-500 text-xs pl-4">Alert set — <span style={{ color: '#00e5ff' }}>212 shortage roles</span> above threshold found</div>
              <div className="flex gap-2">
                <span style={{ color: '#00d4aa' }}>$</span>
                <span className="text-gray-300">sponsorintel company "NHS Foundation Trust" --enrich</span>
              </div>
              <div className="text-gray-500 text-xs pl-4">
                Profile enriched — Rating: <span style={{ color: '#00d4aa' }}>A-RATED</span> | Jobs: <span style={{ color: '#f5a623' }}>143 open</span>
              </div>
              <div className="flex gap-2 items-center">
                <span style={{ color: '#00d4aa' }}>$</span>
                <span className="terminal-cursor" style={{ color: '#f5a623' }} />
              </div>
            </div>

            <div className="text-center">
              <p className="text-gray-400 text-sm mb-6">
                Join thousands of professionals navigating UK immigration with data-driven intelligence.
              </p>
              <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                <Link
                  href="/register"
                  className="flex items-center gap-2 px-8 py-3.5 rounded font-semibold text-sm transition-all hover:-translate-y-0.5 w-full sm:w-auto justify-center"
                  style={{
                    background: 'linear-gradient(135deg, #f5a623, #e8941a)',
                    color: '#0a0a0a',
                    boxShadow: '0 0 30px rgba(245,166,35,0.3)',
                  }}
                >
                  Create Free Account →
                </Link>
                <Link
                  href="/pricing"
                  className="flex items-center gap-2 px-8 py-3.5 rounded font-semibold text-sm transition-all hover:-translate-y-0.5 w-full sm:w-auto justify-center"
                  style={{
                    background: 'rgba(255,255,255,0.04)',
                    border: '1px solid rgba(255,255,255,0.1)',
                    color: '#e0e0e0',
                  }}
                >
                  View Pricing
                </Link>
              </div>
              <p className="text-[10px] text-gray-600 font-mono mt-4">
                Free tier includes search, basic alerts, and 10 company profiles. No credit card required.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="relative z-10 py-12 px-6" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
        <div className="max-w-6xl mx-auto">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-8 mb-8">
            <div>
              <div className="flex items-center gap-2 mb-3">
                <div
                  className="h-6 w-6 rounded flex items-center justify-center text-[10px] font-bold font-mono"
                  style={{ background: 'rgba(245,166,35,0.15)', border: '1px solid rgba(245,166,35,0.3)', color: '#f5a623' }}
                >
                  SI
                </div>
                <span className="font-semibold text-xs tracking-widest text-white">SPONSORINTEL</span>
              </div>
              <p className="text-[11px] text-gray-600 max-w-xs leading-relaxed">
                UK&apos;s most comprehensive visa sponsorship intelligence platform. Built for skilled workers, lawyers, and HR teams.
              </p>
            </div>
            <div className="flex flex-wrap gap-6 text-[11px] font-mono text-gray-500">
              {[
                { label: 'Search', href: '/search' },
                { label: 'Jobs', href: '/jobs' },
                { label: 'Map', href: '/map' },
                { label: 'Trends', href: '/trends' },
                { label: 'Alerts', href: '/alerts' },
                { label: 'Pricing', href: '/pricing' },
                { label: 'Sign In', href: '/login' },
              ].map((l) => (
                <Link key={l.label} href={l.href} className="hover:text-white transition-colors">{l.label}</Link>
              ))}
            </div>
          </div>
          <div
            className="flex flex-col md:flex-row items-center justify-between gap-2 pt-6 text-[10px] font-mono text-gray-700"
            style={{ borderTop: '1px solid rgba(255,255,255,0.04)' }}
          >
            <span>© 2026 SponsorIntel — sponsorintel.london</span>
            <span>Real-time UK immigration intelligence — updated continuously</span>
          </div>
        </div>
      </footer>

      {/* ── Inline Styles for landing-specific CSS ── */}
      <style>{`
        /* Grid background */
        .landing-grid-bg {
          position: fixed;
          inset: 0;
          z-index: 0;
          pointer-events: none;
          background-image:
            linear-gradient(rgba(255,255,255,0.025) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255,255,255,0.025) 1px, transparent 1px);
          background-size: 60px 60px;
          mask-image: radial-gradient(ellipse 80% 80% at 50% 0%, black 40%, transparent 100%);
          -webkit-mask-image: radial-gradient(ellipse 80% 80% at 50% 0%, black 40%, transparent 100%);
        }

        /* Hero gradient text */
        .hero-gradient-text {
          background: linear-gradient(135deg, #fff 0%, #f5a623 50%, #00e5ff 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
        }

        /* Terminal cursor inline */
        .terminal-cursor-inline {
          display: inline-block;
          width: 2px;
          height: 1.1em;
          background: #f5a623;
          margin-left: 2px;
          vertical-align: text-bottom;
          animation: cursor-blink 1s step-end infinite;
        }

        /* Terminal cursor block */
        .terminal-cursor::after {
          content: '█';
          animation: cursor-blink 1s step-end infinite;
          color: #f5a623;
        }

        /* Ticker animation */
        .ticker-track {
          display: flex;
          animation: ticker-scroll 40s linear infinite;
          will-change: transform;
        }
        .ticker-track:hover { animation-play-state: paused; }

        /* Stat glass cards */
        .stat-glass-card {
          padding: 20px 24px;
          border-radius: 8px;
          background: rgba(255,255,255,0.03);
          border: 1px solid rgba(255,255,255,0.07);
          backdrop-filter: blur(10px);
          transition: all 0.3s ease;
        }
        .stat-glass-card:hover {
          background: rgba(255,255,255,0.05);
          border-color: rgba(245,166,35,0.2);
          transform: translateY(-2px);
        }

        /* Feature cards */
        .feature-card {
          position: relative;
          display: flex;
          flex-direction: column;
          padding: 0;
          border-radius: 10px;
          overflow: hidden;
          text-decoration: none;
          cursor: pointer;
        }
        .feature-card-inner {
          position: relative;
          z-index: 1;
          display: flex;
          flex-direction: column;
          flex: 1;
          padding: 20px;
          background: rgba(255,255,255,0.03);
          border: 1px solid rgba(255,255,255,0.07);
          border-radius: 10px;
          transition: all 0.3s ease;
        }
        .feature-card:hover .feature-card-inner {
          background: rgba(255,255,255,0.05);
          border-color: color-mix(in srgb, var(--feature-color) 30%, transparent);
          transform: translateY(-3px);
        }
        .feature-card:hover .feature-card-inner div:last-child span:last-child {
          opacity: 1 !important;
        }
        .feature-card-glow {
          position: absolute;
          inset: 0;
          border-radius: 10px;
          opacity: 0;
          transition: opacity 0.3s ease;
          background: radial-gradient(ellipse at 50% 0%, color-mix(in srgb, var(--feature-color) 8%, transparent) 0%, transparent 70%);
          pointer-events: none;
        }
        .feature-card:hover .feature-card-glow { opacity: 1; }

        /* Persona cards */
        .persona-card {
          position: relative;
          padding: 24px;
          border-radius: 10px;
          background: rgba(255,255,255,0.03);
          border: 1px solid;
          transition: all 0.3s ease;
        }
        .persona-card:hover {
          background: rgba(255,255,255,0.05);
          transform: translateY(-3px);
        }

        /* Hero radar */
        .hero-radar {
          position: absolute;
          left: 50%;
          top: 50%;
          transform: translate(-50%, -50%);
          width: 600px;
          height: 600px;
          pointer-events: none;
          opacity: 0.4;
        }
        .hero-radar-ring {
          position: absolute;
          top: 50%;
          left: 50%;
          border-radius: 50%;
          border: 1px solid rgba(245,166,35,0.15);
          transform: translate(-50%, -50%);
        }
        .hero-radar-ring.r1 { width: 150px; height: 150px; }
        .hero-radar-ring.r2 { width: 280px; height: 280px; border-color: rgba(245,166,35,0.1); }
        .hero-radar-ring.r3 { width: 420px; height: 420px; border-color: rgba(245,166,35,0.06); }
        .hero-radar-ring.r4 { width: 560px; height: 560px; border-color: rgba(245,166,35,0.04); }
        .hero-radar-sweep {
          position: absolute;
          top: 50%;
          left: 50%;
          width: 280px;
          height: 280px;
          margin: -140px 0 0 -140px;
          border-radius: 50%;
          background: conic-gradient(from 0deg, transparent 330deg, rgba(245,166,35,0.15) 355deg, rgba(245,166,35,0.05) 360deg);
          animation: radar-rotate 4s linear infinite;
          transform-origin: center;
        }
        .hero-radar-dot {
          position: absolute;
          top: 50%;
          left: 50%;
          width: 6px;
          height: 6px;
          border-radius: 50%;
          background: #f5a623;
          transform: translate(-50%, -50%);
          box-shadow: 0 0 12px #f5a623;
          animation: pulse-dot 2s ease-in-out infinite;
        }

        /* Float cards */
        .float-card {
          position: absolute;
          padding: 12px 16px;
          border-radius: 8px;
          background: rgba(10,10,10,0.85);
          border: 1px solid rgba(255,255,255,0.08);
          backdrop-filter: blur(12px);
          font-family: 'JetBrains Mono', monospace;
        }
        .float-card-1 {
          top: 20%;
          left: 5%;
          animation: float-1 6s ease-in-out infinite;
        }
        .float-card-2 {
          top: 25%;
          right: 5%;
          animation: float-2 7s ease-in-out infinite;
        }
        .float-card-3 {
          bottom: 25%;
          left: 3%;
          animation: float-3 8s ease-in-out infinite;
        }
        .float-card-4 {
          bottom: 20%;
          right: 5%;
          animation: float-4 6.5s ease-in-out infinite;
        }
        @media (max-width: 768px) {
          .float-card { display: none; }
          .hero-radar { width: 300px; height: 300px; }
          .hero-radar-ring.r3, .hero-radar-ring.r4 { display: none; }
        }

        /* Timeline */
        .timeline-item {
          display: flex;
          align-items: flex-start;
          position: relative;
          padding: 16px 0 16px 16px;
          border-left: 1px solid rgba(255,255,255,0.06);
        }
        .timeline-item:last-child { border-left-color: transparent; }
        .timeline-dot {
          position: absolute;
          left: -5px;
          top: 20px;
          width: 9px;
          height: 9px;
          border-radius: 50%;
          flex-shrink: 0;
          box-shadow: 0 0 8px currentColor;
        }

        /* Terminal CTA card */
        .terminal-cta-card {
          padding: 32px;
          border-radius: 12px;
          background: rgba(15,15,15,0.9);
          border: 1px solid rgba(245,166,35,0.15);
          box-shadow: 0 0 60px -20px rgba(245,166,35,0.15), inset 0 1px 0 rgba(255,255,255,0.05);
        }

        /* Scroll indicator */
        .scroll-indicator {
          width: 1px;
          height: 40px;
          background: linear-gradient(to bottom, rgba(245,166,35,0.5), transparent);
          animation: scroll-fade 2s ease-in-out infinite;
        }

        /* Nav logo sweep */
        .nav-logo-sweep {
          position: absolute;
          inset: 0;
          border-radius: inherit;
          background: conic-gradient(from 0deg, transparent 300deg, rgba(245,166,35,0.3) 360deg);
          animation: radar-rotate 3s linear infinite;
        }
      `}</style>
    </div>
  );
}
