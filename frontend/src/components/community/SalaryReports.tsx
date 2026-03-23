'use client';

import { useEffect, useState } from 'react';
import { Banknote } from 'lucide-react';
import { Card, CardTitle } from '@/components/ui/Card';

interface SalaryData {
  role_title: string;
  visa_route: string | null;
  report_count: number;
  median_salary: number;
  min_salary: number;
  max_salary: number;
}

interface SalaryReportsProps {
  sponsorId: string;
}

export function SalaryReports({ sponsorId }: SalaryReportsProps) {
  const [data, setData] = useState<SalaryData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchSalary() {
      try {
        const res = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL}/api/v1/community/salary-reports/${sponsorId}`
        );
        if (res.ok) {
          setData(await res.json());
        }
      } catch (err) {
        console.error('Salary reports fetch error:', err);
      } finally {
        setLoading(false);
      }
    }
    fetchSalary();
  }, [sponsorId]);

  if (loading || data.length === 0) return null;

  return (
    <Card className="!p-3">
      <div className="flex items-center gap-1.5 mb-2">
        <Banknote size={11} className="text-amber" />
        <CardTitle>Community Salary Reports</CardTitle>
      </div>
      <div className="space-y-1.5">
        {data.map((d, i) => (
          <div key={i} className="flex items-center justify-between py-1 border-b border-border/20">
            <div>
              <span className="text-[11px] font-data text-text">{d.role_title}</span>
              {d.visa_route && (
                <span className="ml-1.5 text-[9px] font-data text-cyan">
                  ({d.visa_route})
                </span>
              )}
            </div>
            <div className="text-right">
              <span className="font-data text-[11px] font-bold text-amber tabular-nums">
                £{Math.round(d.median_salary).toLocaleString()}
              </span>
              <span className="font-data text-[8px] text-dim block">
                {d.report_count} reports | £{Math.round(d.min_salary).toLocaleString()}-£{Math.round(d.max_salary).toLocaleString()}
              </span>
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}
