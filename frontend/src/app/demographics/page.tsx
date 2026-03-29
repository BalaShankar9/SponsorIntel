'use client';

export default function DemographicsPage() {
  const nationalities = [
    { country: 'India', grants: 130000, pct: 100, flag: '🇮🇳' },
    { country: 'Nigeria', grants: 45000, pct: 35, flag: '🇳🇬' },
    { country: 'Philippines', grants: 25000, pct: 19, flag: '🇵🇭' },
    { country: 'Pakistan', grants: 20000, pct: 15, flag: '🇵🇰' },
    { country: 'Zimbabwe', grants: 18000, pct: 14, flag: '🇿🇼' },
    { country: 'China', grants: 15000, pct: 12, flag: '🇨🇳' },
    { country: 'South Africa', grants: 12000, pct: 9, flag: '🇿🇦' },
    { country: 'USA', grants: 10000, pct: 8, flag: '🇺🇸' },
    { country: 'Brazil', grants: 8000, pct: 6, flag: '🇧🇷' },
    { country: 'Sri Lanka', grants: 7000, pct: 5, flag: '🇱🇰' },
  ];

  const visaRoutes = [
    { route: 'Student', grants: 350000, color: '#3b82f6', pct: 100 },
    { route: 'Graduate', grants: 100000, color: '#8b5cf6', pct: 29 },
    { route: 'Skilled Worker', grants: 120000, color: '#f59e0b', pct: 34 },
    { route: 'Health & Care Worker', grants: 90000, color: '#10b981', pct: 26 },
    { route: 'Family', grants: 70000, color: '#ef4444', pct: 20 },
    { route: 'Global Talent', grants: 5000, color: '#06b6d4', pct: 1 },
  ];

  const cities = [
    { city: 'London', pct: 37 },
    { city: 'Leicester', pct: 28 },
    { city: 'Birmingham', pct: 22 },
    { city: 'Manchester', pct: 20 },
    { city: 'Bradford', pct: 19 },
    { city: 'Coventry', pct: 18 },
    { city: 'Milton Keynes', pct: 17 },
    { city: 'Reading', pct: 16 },
  ];

  const netMigration = [
    { year: '2021', value: 173000 },
    { year: '2022', value: 504000 },
    { year: '2023', value: 685000 },
    { year: '2024', value: 600000, estimated: true },
    { year: '2025', value: 500000, projected: true },
  ];
  const maxMigration = Math.max(...netMigration.map((d) => d.value));

  return (
    <main className="min-h-screen bg-bg text-text p-6 space-y-8">
      {/* Header */}
      <div className="border-b border-border pb-4">
        <div className="flex items-center gap-2 mb-1">
          <span className="font-data text-[9px] uppercase tracking-[0.3em] text-amber">ECOSYSTEM</span>
          <span className="text-muted font-data text-[9px]">/ DEMOGRAPHICS</span>
        </div>
        <h1 className="text-2xl font-bold text-text tracking-tight">UK Immigration Demographics</h1>
        <p className="text-sm text-dim mt-1">
          Real statistics from ONS, Home Office Immigration Statistics, and Census 2021.
        </p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Net Migration (2023)', value: '685,000', sub: 'ONS estimate', color: 'text-amber' },
          { label: 'Work Visa Grants (2024)', value: '290,000+', sub: 'Skilled + H&C routes', color: 'text-cyan' },
          { label: 'Student Visas (2024)', value: '350,000', sub: 'UKVI data', color: 'text-green' },
          { label: 'Foreign-Born (London)', value: '37%', sub: 'Census 2021', color: 'text-purple-400' },
        ].map((kpi) => (
          <div key={kpi.label} className="rounded border border-border bg-s2 p-4">
            <p className="font-data text-[9px] uppercase tracking-wider text-dim mb-1">{kpi.label}</p>
            <p className={`font-data text-2xl font-bold ${kpi.color}`}>{kpi.value}</p>
            <p className="font-data text-[9px] text-muted mt-0.5">{kpi.sub}</p>
          </div>
        ))}
      </div>

      {/* Top Nationalities */}
      <section>
        <div className="flex items-baseline gap-3 mb-3">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-text">Top Nationalities — Work Visas 2024</h2>
          <span className="font-data text-[9px] text-muted">Source: Home Office Immigration Statistics, Feb 2025</span>
        </div>
        <div className="rounded border border-border bg-s2 p-4 space-y-2.5">
          {nationalities.map((n) => (
            <div key={n.country} className="flex items-center gap-3">
              <span className="w-4 text-sm">{n.flag}</span>
              <span className="w-28 font-data text-[11px] text-dim shrink-0">{n.country}</span>
              <div className="flex-1 h-4 bg-s3 rounded-sm overflow-hidden">
                <div
                  className="h-full bg-amber/70 rounded-sm transition-all"
                  style={{ width: `${n.pct}%` }}
                />
              </div>
              <span className="font-data text-[11px] text-text w-20 text-right">
                ~{n.grants.toLocaleString()}
              </span>
            </div>
          ))}
        </div>
      </section>

      {/* Visa Route Breakdown */}
      <section>
        <div className="flex items-baseline gap-3 mb-3">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-text">Visa Route Breakdown — 2024/25</h2>
          <span className="font-data text-[9px] text-muted">Source: Home Office Visa Statistics Q4 2024</span>
        </div>
        <div className="rounded border border-border bg-s2 p-4 space-y-3">
          {visaRoutes.map((v) => (
            <div key={v.route} className="flex items-center gap-3">
              <span className="w-36 font-data text-[11px] text-dim shrink-0">{v.route}</span>
              <div className="flex-1 h-4 bg-s3 rounded-sm overflow-hidden">
                <div
                  className="h-full rounded-sm transition-all"
                  style={{ width: `${v.pct}%`, backgroundColor: v.color, opacity: 0.75 }}
                />
              </div>
              <span className="font-data text-[11px] text-text w-24 text-right">
                ~{v.grants.toLocaleString()}
              </span>
            </div>
          ))}
          <p className="font-data text-[8px] text-muted pt-1">
            Note: Student visa bar is reference (100%); other routes scaled relative to it.
          </p>
        </div>
      </section>

      {/* Cities */}
      <section>
        <div className="flex items-baseline gap-3 mb-3">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-text">Foreign-Born Population by City</h2>
          <span className="font-data text-[9px] text-muted">Source: ONS Census 2021</span>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {cities.map((c) => (
            <div key={c.city} className="rounded border border-border bg-s2 p-3">
              <p className="font-data text-[10px] text-dim uppercase tracking-wide mb-2">{c.city}</p>
              {/* Circular-style percentage indicator using a simple arc div */}
              <div className="flex items-end gap-2">
                <span className="font-data text-xl font-bold text-cyan">{c.pct}%</span>
                <span className="font-data text-[9px] text-muted mb-0.5">foreign-born</span>
              </div>
              <div className="mt-2 h-1.5 w-full bg-s3 rounded-full overflow-hidden">
                <div
                  className="h-full bg-cyan/60 rounded-full"
                  style={{ width: `${c.pct}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Net Migration Trend */}
      <section>
        <div className="flex items-baseline gap-3 mb-3">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-text">Net Migration Trend</h2>
          <span className="font-data text-[9px] text-muted">Source: ONS Long-Term International Migration estimates</span>
        </div>
        <div className="rounded border border-border bg-s2 p-4">
          <div className="flex items-end gap-4 h-32">
            {netMigration.map((d) => {
              const barH = Math.round((d.value / maxMigration) * 100);
              const isProjected = d.projected;
              const isEstimated = d.estimated;
              return (
                <div key={d.year} className="flex flex-col items-center gap-1 flex-1">
                  <span className="font-data text-[9px] text-dim">{(d.value / 1000).toFixed(0)}K</span>
                  <div className="w-full flex items-end" style={{ height: '80px' }}>
                    <div
                      className={`w-full rounded-t-sm transition-all ${
                        isProjected
                          ? 'bg-muted/30 border border-dashed border-muted'
                          : isEstimated
                          ? 'bg-amber/40'
                          : 'bg-amber/70'
                      }`}
                      style={{ height: `${barH}%` }}
                      title={`${d.year}: ${d.value.toLocaleString()}`}
                    />
                  </div>
                  <span className="font-data text-[9px] text-text">{d.year}</span>
                  {(isEstimated || isProjected) && (
                    <span className="font-data text-[7px] text-muted uppercase">
                      {isProjected ? 'proj.' : 'est.'}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
          <div className="flex items-center gap-4 mt-3 pt-3 border-t border-border">
            <div className="flex items-center gap-1.5">
              <div className="h-2 w-4 bg-amber/70 rounded-sm" />
              <span className="font-data text-[9px] text-dim">Confirmed</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="h-2 w-4 bg-amber/40 rounded-sm" />
              <span className="font-data text-[9px] text-dim">Estimated</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="h-2 w-4 bg-muted/30 border border-dashed border-muted rounded-sm" />
              <span className="font-data text-[9px] text-dim">Projected</span>
            </div>
          </div>
        </div>
      </section>

      {/* Sources Footer */}
      <footer className="border-t border-border pt-4 pb-2">
        <p className="font-data text-[9px] uppercase tracking-wider text-muted mb-2">Data Sources</p>
        <ul className="space-y-1">
          {[
            'Home Office Immigration Statistics, Year ending December 2024 (published Feb 2025)',
            'ONS Long-Term International Migration: provisional estimates, 2023–2024',
            'ONS Census 2021 — Country of Birth (England and Wales)',
            'Home Office Visa and Immigration Operational Transparency Data, Q4 2024',
          ].map((src) => (
            <li key={src} className="font-data text-[9px] text-dim flex gap-2">
              <span className="text-amber shrink-0">—</span>
              <span>{src}</span>
            </li>
          ))}
        </ul>
        <p className="font-data text-[8px] text-muted/50 mt-3">
          All figures are approximate and based on published official statistics. Estimates and projections are subject to revision.
        </p>
      </footer>
    </main>
  );
}
