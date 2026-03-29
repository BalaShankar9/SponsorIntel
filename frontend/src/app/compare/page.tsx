'use client';

import { useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/lib/auth';
import { ProGate } from '@/components/ui/ProGate';
import { X, Plus, Search } from 'lucide-react';
import { cn, formatNumber } from '@/lib/utils';
import type { SponsorDetail, Sponsor } from '@/types';

const COLORS = ['#f5a623', '#00d4aa', '#00e5ff', '#a78bfa', '#ff4757', '#4a9eff'];
const MAX_COMPANIES = 6;

interface CompareCompany {
  detail: SponsorDetail;
  color: string;
}

// Comparison row data
interface ComparisonRow {
  label: string;
  key: string;
  getValue: (d: SponsorDetail) => string | number | null | undefined;
  higherBetter?: boolean;
  format?: 'number' | 'percent' | 'score' | 'text';
}

const comparisonRows: ComparisonRow[] = [
  { label: 'RATING', key: 'rating', getValue: (d) => d.rating, format: 'text' },
  { label: 'SPONSOR TYPE', key: 'sponsor_type', getValue: (d) => d.sponsor_type || '--', format: 'text' },
  { label: 'ROUTES', key: 'routes', getValue: (d) => d.route?.join(', ') || '--', format: 'text' },
  { label: 'YEARS ON REGISTER', key: 'years', getValue: (d) => d.first_seen_date ? Math.floor((Date.now() - new Date(d.first_seen_date).getTime()) / (365.25 * 86400000)) : null, higherBetter: true, format: 'number' },
  { label: 'CONSECUTIVE A DAYS', key: 'a_days', getValue: (d) => d.consecutive_a_rating_days, higherBetter: true, format: 'number' },
  { label: 'RATING CHANGES', key: 'rating_changes', getValue: (d) => d.times_rating_changed, higherBetter: false, format: 'number' },
  { label: 'EMPLOYEES', key: 'employees', getValue: (d) => d.profile?.employee_count_estimate, higherBetter: true, format: 'number' },
  { label: 'EMP GROWTH 6M', key: 'growth_6m', getValue: (d) => d.profile?.employee_growth_6m, higherBetter: true, format: 'percent' },
  { label: 'EMP GROWTH 12M', key: 'growth_12m', getValue: (d) => d.profile?.employee_growth_12m, higherBetter: true, format: 'percent' },
  { label: 'GLASSDOOR', key: 'glassdoor', getValue: (d) => d.profile?.glassdoor_rating, higherBetter: true, format: 'number' },
  { label: 'TRUSTPILOT', key: 'trustpilot', getValue: (d) => d.profile?.trustpilot_rating, higherBetter: true, format: 'number' },
  { label: 'GOOGLE RATING', key: 'google', getValue: (d) => d.profile?.google_rating, higherBetter: true, format: 'number' },
  { label: 'CREDIT RISK', key: 'credit', getValue: (d) => d.profile?.credit_risk_score, higherBetter: true, format: 'score' },
  { label: 'LEGITIMACY', key: 'legitimacy', getValue: (d) => d.profile?.legitimacy_score, higherBetter: true, format: 'score' },
  { label: 'ENRICHMENT', key: 'enrichment', getValue: (d) => d.profile?.enrichment_level, higherBetter: true, format: 'number' },
  { label: 'INDUSTRY', key: 'industry', getValue: (d) => d.profile?.industry_primary || '--', format: 'text' },
  { label: 'COMPANY STATUS', key: 'status', getValue: (d) => d.profile?.company_status || '--', format: 'text' },
  { label: 'HAS CAREERS PAGE', key: 'careers', getValue: (d) => d.profile?.has_careers_page ? 'YES' : 'NO', format: 'text' },
  { label: 'INSOLVENCY', key: 'insolvency', getValue: (d) => d.profile?.has_insolvency_history ? 'YES' : 'NO', format: 'text' },
];

export default function ComparePage() {
  const isPro = true; // All features available
  const [companies, setCompanies] = useState<CompareCompany[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Sponsor[]>([]);
  const [searching, setSearching] = useState(false);
  const [loadingDetail, setLoadingDetail] = useState(false);

  const handleSearch = useCallback(async (q: string) => {
    setSearchQuery(q);
    if (q.length < 2) {
      setSearchResults([]);
      return;
    }
    setSearching(true);
    try {
      const { data } = await supabase
        .from('sponsors')
        .select('id, organisation_name, town_city, county, type_and_rating, rating, sponsor_type, route, is_active, first_seen_date, last_seen_date')
        .ilike('organisation_name', `%${q}%`)
        .limit(5);
      setSearchResults(data || []);
    } catch {
      setSearchResults([]);
    } finally {
      setSearching(false);
    }
  }, []);

  const addCompany = async (sponsor: Sponsor) => {
    if (companies.length >= MAX_COMPANIES) return;
    if (companies.some((c) => c.detail.id === sponsor.id)) return;

    setLoadingDetail(true);
    try {
      const { data } = await supabase
        .from('sponsors')
        .select(`
          *,
          company_profiles (*)
        `)
        .eq('id', sponsor.id)
        .single();

      if (data) {
        const profile = Array.isArray(data.company_profiles)
          ? data.company_profiles[0] || null
          : data.company_profiles || null;

        const detail: SponsorDetail = {
          ...data,
          consecutive_a_rating_days: data.consecutive_a_rating_days ?? 0,
          times_rating_changed: data.times_rating_changed ?? 0,
          profile,
          company_profiles: undefined,
        };

        setCompanies((prev) => [
          ...prev,
          { detail, color: COLORS[prev.length % COLORS.length] },
        ]);
      }
    } catch (err) {
      console.error('Failed to load company detail:', err);
    } finally {
      setLoadingDetail(false);
      setSearchQuery('');
      setSearchResults([]);
    }
  };

  const removeCompany = (id: string) => {
    setCompanies((prev) => {
      const updated = prev.filter((c) => c.detail.id !== id);
      return updated.map((c, i) => ({ ...c, color: COLORS[i % COLORS.length] }));
    });
  };

  const formatValue = (val: string | number | null | undefined, format?: string) => {
    if (val === null || val === undefined) return '--';
    if (format === 'percent' && typeof val === 'number') return `${val > 0 ? '+' : ''}${val.toFixed(1)}%`;
    if (format === 'number' && typeof val === 'number') return formatNumber(val);
    if (format === 'score' && typeof val === 'number') return String(val);
    return String(val);
  };

  const getBestIndex = (values: (string | number | null | undefined)[], higherBetter?: boolean) => {
    const numericVals = values.map((v) => (typeof v === 'number' ? v : null));
    const validNums = numericVals.filter((v): v is number => v !== null);
    if (validNums.length === 0) return -1;
    const best = higherBetter ? Math.max(...validNums) : Math.min(...validNums);
    return numericVals.findIndex((v) => v === best);
  };

  const content = (
    <div className="space-y-3">
      {/* Search */}
      {companies.length < MAX_COMPANIES && (
        <div className="border border-s3 bg-s1 p-3">
          <div className="relative">
            <Search className="absolute left-2 top-1/2 h-3 w-3 -translate-y-1/2 text-amber" />
            <input
              type="text"
              placeholder={`SEARCH COMPANIES (UP TO ${MAX_COMPANIES})...`}
              value={searchQuery}
              onChange={(e) => handleSearch(e.target.value)}
              className="w-full border border-s3 bg-bg py-1.5 pl-7 pr-3 font-data text-xs text-text placeholder-muted focus:border-amber focus:outline-none"
            />
            {searching && (
              <span className="absolute right-2 top-1/2 -translate-y-1/2 font-data text-[9px] text-amber animate-pulse">
                SEARCHING...
              </span>
            )}
          </div>
          {searchResults.length > 0 && (
            <div className="mt-1 border border-s3 bg-bg">
              {searchResults.map((s) => (
                <button
                  key={s.id}
                  className="flex w-full items-center gap-3 px-3 py-1.5 text-left transition-colors hover:bg-amber/5 disabled:opacity-30"
                  onClick={() => addCompany(s)}
                  disabled={companies.some((c) => c.detail.id === s.id)}
                >
                  <Plus size={10} className="text-amber" />
                  <span className="font-data text-xs text-text">{s.organisation_name}</span>
                  <span className="font-data text-[10px] text-dim">{s.town_city}</span>
                  {s.rating && (
                    <span className={`ml-auto font-data text-xs font-bold ${s.rating === 'A' ? 'text-green' : 'text-red'}`}>
                      {s.rating}
                    </span>
                  )}
                </button>
              ))}
            </div>
          )}
          {loadingDetail && (
            <p className="mt-1 font-data text-[10px] text-amber animate-pulse">LOADING DETAILS...</p>
          )}
        </div>
      )}

      {/* Selected Companies Tags */}
      {companies.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {companies.map((c) => (
            <button
              key={c.detail.id}
              onClick={() => removeCompany(c.detail.id)}
              className="inline-flex items-center gap-1 border px-2 py-0.5 font-data text-[10px] transition-colors hover:bg-s2"
              style={{ borderColor: c.color, color: c.color }}
            >
              {c.detail.organisation_name}
              <X size={8} />
            </button>
          ))}
        </div>
      )}

      {companies.length === 0 && (
        <div className="border border-s3 bg-s1 py-16 text-center">
          <p className="font-data text-sm text-amber">SELECT COMPANIES TO COMPARE</p>
          <p className="mt-1 font-data text-xs text-dim">SEARCH ABOVE TO ADD UP TO {MAX_COMPANIES} COMPANIES</p>
        </div>
      )}

      {/* Comparison Table */}
      {companies.length > 0 && (
        <div className="border border-s3 bg-s1 overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-amber/20">
                <th className="px-3 py-2 text-left font-data text-[9px] font-bold uppercase tracking-widest text-dim">METRIC</th>
                {companies.map((c) => (
                  <th key={c.detail.id} className="px-3 py-2 text-center font-data text-[9px] font-bold uppercase tracking-widest" style={{ color: c.color }}>
                    {c.detail.organisation_name.substring(0, 20)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {comparisonRows.map((row) => {
                const values = companies.map((c) => row.getValue(c.detail));
                const bestIdx = row.higherBetter !== undefined ? getBestIndex(values, row.higherBetter) : -1;

                return (
                  <tr key={row.key} className="border-b border-s3/30 hover:bg-amber/5">
                    <td className="px-3 py-1.5 font-data text-[10px] text-dim">{row.label}</td>
                    {values.map((val, idx) => (
                      <td
                        key={idx}
                        className={cn(
                          'px-3 py-1.5 text-center font-data text-xs',
                          idx === bestIdx && companies.length > 1 ? 'text-green font-bold' : 'text-text'
                        )}
                      >
                        {formatValue(val, row.format)}
                      </td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );

  return (
    <div className="space-y-3">
      <div className="border-b border-amber/30 pb-2">
        <h1 className="font-data text-lg font-bold uppercase tracking-wider text-amber">
          COMPARE TOOL
        </h1>
        <p className="font-data text-xs text-dim">
          SIDE-BY-SIDE SPONSOR ANALYSIS // UP TO {MAX_COMPANIES} COMPANIES
        </p>
      </div>

      <ProGate isAllowed={isPro} feature="Compare Tool">
        {content}
      </ProGate>
    </div>
  );
}
