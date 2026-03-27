'use client';

import { useState } from 'react';
import { supabase } from '@/lib/supabase';

interface AssessmentResult {
  company: any;
  probability: number;
  tier: string;
  reasoning: string[];
  salary_info: any;
  isl_match: boolean;
  visa_grants: number;
}

export default function SponsorCheckPage() {
  const [company, setCompany] = useState('');
  const [jobTitle, setJobTitle] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AssessmentResult | null>(null);

  const assess = async () => {
    if (!company.trim()) return;
    setLoading(true);
    setResult(null);

    try {
      const API = process.env.NEXT_PUBLIC_API_URL || '';

      // 1. Search for the company in sponsors
      const { data: sponsors } = await supabase
        .from('sponsors')
        .select('id, organisation_name, rating, routes, is_active, first_seen_date, town_city')
        .ilike('organisation_name', `%${company.trim()}%`)
        .limit(1);

      const sponsor = sponsors?.[0];

      // 2. Check ISL for job title match
      const { data: islData } = await supabase
        .from('immigration_salary_list')
        .select('soc_code, occupation_title, job_titles')
        .eq('is_active', true);

      let islMatch = false;
      let matchedSoc = '';
      const titleLower = jobTitle.toLowerCase();
      for (const entry of (islData || [])) {
        for (const t of (entry.job_titles || [])) {
          if (titleLower.includes(t.toLowerCase()) || t.toLowerCase().includes(titleLower)) {
            islMatch = true;
            matchedSoc = entry.soc_code;
            break;
          }
        }
        if (islMatch) break;
      }

      // 3. Get visa stats for matched SOC code
      let visaGrants = 0;
      if (matchedSoc) {
        const { data: stats } = await supabase
          .from('visa_statistics')
          .select('grants_total')
          .eq('soc_code', matchedSoc)
          .limit(1);
        visaGrants = stats?.[0]?.grants_total || 0;
      }

      // 4. Get salary benchmarks
      let salaryInfo = null;
      if (matchedSoc) {
        const { data: benchmarks } = await supabase
          .from('ons_salary_benchmarks')
          .select('*')
          .eq('soc_code', matchedSoc)
          .eq('region', 'UK')
          .limit(1);
        salaryInfo = benchmarks?.[0] || null;
      }

      // 5. Get job count for this sponsor
      let jobCount = 0;
      if (sponsor) {
        const { count } = await supabase
          .from('jobs')
          .select('*', { count: 'exact', head: true })
          .eq('sponsor_id', sponsor.id);
        jobCount = count || 0;
      }

      // 6. Calculate probability
      let score = 0;
      const reasoning: string[] = [];

      if (sponsor) {
        score += 30;
        reasoning.push(`✅ ${sponsor.organisation_name} is a registered UK visa sponsor`);

        if (sponsor.rating === 'A') {
          score += 20;
          reasoning.push('✅ A-rated sponsor (highest compliance rating)');
        } else if (sponsor.rating === 'B') {
          score += 5;
          reasoning.push('⚠️ B-rated sponsor (under compliance action)');
        }

        if (sponsor.routes?.includes('Skilled Worker')) {
          score += 10;
          reasoning.push('✅ Licensed for Skilled Worker route');
        }

        if (jobCount > 0) {
          score += 10;
          reasoning.push(`✅ Currently advertising ${jobCount} jobs`);
        } else {
          reasoning.push('⚠️ No active job listings found');
        }

        const firstSeen = new Date(sponsor.first_seen_date);
        const yearsActive = (Date.now() - firstSeen.getTime()) / (365.25 * 24 * 60 * 60 * 1000);
        if (yearsActive > 3) {
          score += 5;
          reasoning.push(`✅ Established sponsor (${Math.floor(yearsActive)} years on register)`);
        }
      } else {
        reasoning.push('❌ Company NOT found on UK Sponsor Register');
        reasoning.push('This company does not hold a sponsor licence and cannot sponsor Skilled Worker visas');
      }

      if (islMatch) {
        score += 15;
        reasoning.push(`✅ "${jobTitle}" is on the Immigration Salary List (SOC ${matchedSoc})`);
        reasoning.push('   Going rate salary requirement is waived for this role');
      }

      if (visaGrants > 1000) {
        score += 10;
        reasoning.push(`✅ ${visaGrants.toLocaleString()} Skilled Worker visas granted for this occupation in 2025`);
      } else if (visaGrants > 0) {
        score += 5;
        reasoning.push(`ℹ️ ${visaGrants.toLocaleString()} visas granted for this occupation in 2025`);
      }

      if (salaryInfo) {
        reasoning.push(`💰 Typical salary range: £${salaryInfo.p25_salary?.toLocaleString()} – £${salaryInfo.p75_salary?.toLocaleString()} (median £${salaryInfo.median_salary?.toLocaleString()})`);
        if (salaryInfo.median_salary >= 38700) {
          reasoning.push('✅ Median salary meets the £38,700 visa threshold');
        } else {
          reasoning.push('⚠️ Median salary is below the £38,700 general visa threshold');
        }
      }

      const probability = Math.min(100, score);
      const tier = probability >= 75 ? 'VERY LIKELY' : probability >= 50 ? 'LIKELY' : probability >= 25 ? 'POSSIBLE' : 'UNLIKELY';

      setResult({
        company: sponsor,
        probability,
        tier,
        reasoning,
        salary_info: salaryInfo,
        isl_match: islMatch,
        visa_grants: visaGrants,
      });
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const tierColor = (tier: string) =>
    tier === 'VERY LIKELY' ? 'text-green' : tier === 'LIKELY' ? 'text-cyan' : tier === 'POSSIBLE' ? 'text-amber' : 'text-red';

  const tierBg = (tier: string) =>
    tier === 'VERY LIKELY' ? 'bg-green/10 border-green/20' : tier === 'LIKELY' ? 'bg-cyan/10 border-cyan/20' : tier === 'POSSIBLE' ? 'bg-amber/10 border-amber/20' : 'bg-red/10 border-red/20';

  return (
    <div className="p-4 max-w-3xl mx-auto">
      <div className="mb-6">
        <h1 className="text-lg font-semibold">Will They Sponsor Me?</h1>
        <p className="text-xs text-dim mt-1">Enter a company name and job title to get an instant sponsorship assessment backed by government data.</p>
      </div>

      <div className="border border-border bg-s1 rounded p-5 mb-4">
        <div className="space-y-3">
          <div>
            <label className="text-[10px] font-data text-dim uppercase tracking-wider block mb-1">Company Name</label>
            <input
              type="text"
              value={company}
              onChange={(e) => setCompany(e.target.value)}
              placeholder="e.g. Deloitte, NHS, Google UK"
              className="w-full bg-bg border border-border rounded px-3 py-2 text-sm focus:border-amber outline-none"
              onKeyDown={(e) => e.key === 'Enter' && assess()}
            />
          </div>
          <div>
            <label className="text-[10px] font-data text-dim uppercase tracking-wider block mb-1">Job Title</label>
            <input
              type="text"
              value={jobTitle}
              onChange={(e) => setJobTitle(e.target.value)}
              placeholder="e.g. Software Engineer, Nurse, Data Analyst"
              className="w-full bg-bg border border-border rounded px-3 py-2 text-sm focus:border-cyan outline-none"
              onKeyDown={(e) => e.key === 'Enter' && assess()}
            />
          </div>
          <button
            onClick={assess}
            disabled={loading || !company.trim()}
            className="w-full bg-amber text-bg py-3 rounded font-semibold text-sm hover:bg-amber/90 transition-colors disabled:opacity-50"
          >
            {loading ? 'Analysing...' : 'Check Sponsorship Probability'}
          </button>
        </div>
      </div>

      {result && (
        <div className="space-y-4 animate-fadeIn">
          {/* Score Card */}
          <div className={`border rounded p-6 text-center ${tierBg(result.tier)}`}>
            <div className="text-4xl font-data font-bold mb-1">
              <span className={tierColor(result.tier)}>{result.probability}%</span>
            </div>
            <div className={`text-sm font-data font-bold tracking-wider ${tierColor(result.tier)}`}>
              {result.tier}
            </div>
            <div className="text-[10px] text-dim mt-2">Sponsorship Probability Score</div>
          </div>

          {/* Reasoning */}
          <div className="border border-border bg-s1 rounded p-4">
            <div className="text-[10px] font-data text-amber uppercase tracking-wider mb-3">ASSESSMENT DETAILS</div>
            <div className="space-y-2">
              {result.reasoning.map((r, i) => (
                <div key={i} className="text-xs leading-relaxed">{r}</div>
              ))}
            </div>
          </div>

          {/* Salary Benchmark */}
          {result.salary_info && (
            <div className="border border-border bg-s1 rounded p-4">
              <div className="text-[10px] font-data text-cyan uppercase tracking-wider mb-3">SALARY BENCHMARK (ONS 2024)</div>
              <div className="grid grid-cols-5 gap-2 text-center">
                {[
                  { label: '10th', value: result.salary_info.p10_salary },
                  { label: '25th', value: result.salary_info.p25_salary },
                  { label: 'Median', value: result.salary_info.median_salary },
                  { label: '75th', value: result.salary_info.p75_salary },
                  { label: '90th', value: result.salary_info.p90_salary },
                ].map((p) => (
                  <div key={p.label}>
                    <div className="text-[10px] font-data text-dim">{p.label}</div>
                    <div className="text-sm font-data font-bold">£{(p.value || 0).toLocaleString()}</div>
                  </div>
                ))}
              </div>
              <div className="mt-3 text-[10px] text-dim">
                Visa threshold: £38,700 | {result.salary_info.median_salary >= 38700 ? '✅ Median meets threshold' : '⚠️ Median below threshold'}
              </div>
            </div>
          )}

          {/* Visa Grants */}
          {result.visa_grants > 0 && (
            <div className="border border-border bg-s1 rounded p-4">
              <div className="text-[10px] font-data text-green uppercase tracking-wider mb-1">VISA GRANTS (2025)</div>
              <div className="text-2xl font-data font-bold text-green">{result.visa_grants.toLocaleString()}</div>
              <div className="text-[10px] text-dim">Skilled Worker visas granted for this occupation</div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
