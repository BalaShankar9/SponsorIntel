'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

interface Benchmark {
  soc_code: string;
  occupation_title: string;
  median_salary: number;
  p10_salary: number;
  p25_salary: number;
  p75_salary: number;
  p90_salary: number;
}

export default function SalaryCalculatorPage() {
  const [occupations, setOccupations] = useState<Benchmark[]>([]);
  const [selected, setSelected] = useState<Benchmark | null>(null);
  const [salary, setSalary] = useState(40000);
  const [islMatch, setIslMatch] = useState(false);

  useEffect(() => {
    async function load() {
      const { data } = await supabase
        .from('ons_salary_benchmarks')
        .select('*')
        .eq('region', 'UK')
        .order('occupation_title');
      setOccupations(data || []);
    }
    load();
  }, []);

  useEffect(() => {
    if (!selected) return;
    async function checkISL() {
      const { data } = await supabase
        .from('immigration_salary_list')
        .select('soc_code')
        .eq('soc_code', selected!.soc_code)
        .eq('is_active', true)
        .limit(1);
      setIslMatch(!!(data && data.length > 0));
    }
    checkISL();
  }, [selected]);

  const threshold = 38700;
  const meetsThreshold = salary >= threshold;
  const percentile = selected
    ? salary <= (selected.p10_salary || 0) ? '<10th'
      : salary <= (selected.p25_salary || 0) ? '10th–25th'
      : salary <= (selected.median_salary || 0) ? '25th–50th'
      : salary <= (selected.p75_salary || 0) ? '50th–75th'
      : salary <= (selected.p90_salary || 0) ? '75th–90th'
      : '>90th'
    : '';
  const aboveThreshold = salary - threshold;

  return (
    <div className="p-4 max-w-3xl mx-auto">
      <div className="mb-6">
        <h1 className="text-lg font-semibold">Visa Salary Threshold Calculator</h1>
        <p className="text-xs text-dim mt-1">Check if your salary meets the Skilled Worker visa threshold and see how it compares to UK market rates.</p>
      </div>

      <div className="border border-border bg-s1 rounded p-5 mb-4">
        <div className="space-y-4">
          <div>
            <label className="text-[10px] font-data text-dim uppercase tracking-wider block mb-1">Select Occupation</label>
            <select
              value={selected?.soc_code || ''}
              onChange={(e) => setSelected(occupations.find(o => o.soc_code === e.target.value) || null)}
              className="w-full bg-bg border border-border rounded px-3 py-2 text-sm focus:border-amber outline-none"
            >
              <option value="">Choose your occupation...</option>
              {occupations.map((o) => (
                <option key={o.soc_code} value={o.soc_code}>{o.occupation_title} (SOC {o.soc_code})</option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-[10px] font-data text-dim uppercase tracking-wider block mb-1">Your Annual Salary (£)</label>
            <input
              type="range"
              min={15000}
              max={150000}
              step={1000}
              value={salary}
              onChange={(e) => setSalary(Number(e.target.value))}
              className="w-full accent-amber"
            />
            <div className="flex justify-between mt-1">
              <span className="text-[10px] font-data text-dim">£15,000</span>
              <span className="text-xl font-data font-bold text-amber">£{salary.toLocaleString()}</span>
              <span className="text-[10px] font-data text-dim">£150,000</span>
            </div>
          </div>
        </div>
      </div>

      {/* Result */}
      <div className={`border rounded p-6 mb-4 ${meetsThreshold ? 'border-green/30 bg-green/5' : 'border-red/30 bg-red/5'}`}>
        <div className="text-center">
          <div className={`text-2xl font-data font-bold ${meetsThreshold ? 'text-green' : 'text-red'}`}>
            {meetsThreshold ? '✅ MEETS THRESHOLD' : '❌ BELOW THRESHOLD'}
          </div>
          <div className="text-sm font-data mt-2">
            £{salary.toLocaleString()} is{' '}
            <span className={meetsThreshold ? 'text-green' : 'text-red'}>
              £{Math.abs(aboveThreshold).toLocaleString()} {meetsThreshold ? 'above' : 'below'}
            </span>
            {' '}the £38,700 general threshold
          </div>
          {islMatch && (
            <div className="text-xs text-cyan mt-2">
              ✨ This role is on the Immigration Salary List — going rate requirement waived
            </div>
          )}
        </div>
      </div>

      {/* Percentile Chart */}
      {selected && (
        <div className="border border-border bg-s1 rounded p-5">
          <div className="text-[10px] font-data text-cyan uppercase tracking-wider mb-4">
            SALARY POSITION — {selected.occupation_title}
          </div>
          <div className="relative h-8 bg-bg rounded-full overflow-hidden mb-4">
            {/* Salary bar */}
            <div
              className="absolute top-0 left-0 h-full bg-gradient-to-r from-red/40 via-amber/40 to-green/40 rounded-full"
              style={{ width: `${Math.min(100, (salary / (selected.p90_salary || 80000)) * 100)}%` }}
            />
            {/* Threshold marker */}
            <div
              className="absolute top-0 h-full w-0.5 bg-red"
              style={{ left: `${Math.min(100, (threshold / (selected.p90_salary || 80000)) * 100)}%` }}
            />
          </div>
          <div className="grid grid-cols-5 gap-2 text-center text-[10px] font-data">
            <div><span className="text-dim">P10</span><br />£{(selected.p10_salary || 0).toLocaleString()}</div>
            <div><span className="text-dim">P25</span><br />£{(selected.p25_salary || 0).toLocaleString()}</div>
            <div><span className="text-amber">Median</span><br />£{(selected.median_salary || 0).toLocaleString()}</div>
            <div><span className="text-dim">P75</span><br />£{(selected.p75_salary || 0).toLocaleString()}</div>
            <div><span className="text-dim">P90</span><br />£{(selected.p90_salary || 0).toLocaleString()}</div>
          </div>
          <div className="text-center mt-3 text-xs">
            Your salary is in the <span className="text-cyan font-bold">{percentile}</span> percentile for this occupation
          </div>
        </div>
      )}

      <div className="mt-4 text-[10px] text-dim text-center">
        Data sources: ONS ASHE 2024, Home Office Immigration Salary List, UK Sponsor Register
      </div>
    </div>
  );
}
