'use client';

import { useState, useEffect } from 'react';
import { ChevronDown, ChevronUp, AlertTriangle, Lightbulb } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Card } from '@/components/ui/Card';

interface Factor {
  key: string;
  label: string;
  weight: number;
  score: number | null;
}

interface ScoreBreakdownProps {
  sponsorId: string;
  overallScore: number;
  className?: string;
}

function ScoreBar({ score, label, weight }: { score: number | null; label: string; weight: number }) {
  const s = score ?? 0;
  const color =
    s >= 80 ? 'bg-green' : s >= 60 ? 'bg-amber' : s > 0 ? 'bg-red' : 'bg-s3';
  const textColor =
    s >= 80 ? 'text-green' : s >= 60 ? 'text-amber' : s > 0 ? 'text-red' : 'text-dim';

  return (
    <div className="space-y-0.5">
      <div className="flex items-center justify-between">
        <span className="font-data text-[10px] text-dim uppercase tracking-wider">
          {label}{' '}
          <span className="text-muted">({Math.round(weight * 100)}%)</span>
        </span>
        <span className={cn('font-data text-[11px] font-bold tabular-nums', textColor)}>
          {score !== null ? score : '--'}
        </span>
      </div>
      <div className="h-1.5 w-full rounded-full bg-s3 overflow-hidden">
        <div
          className={cn('h-full rounded-full transition-all duration-slower', color)}
          style={{ width: `${s}%` }}
        />
      </div>
    </div>
  );
}

export function ScoreBreakdown({ sponsorId, overallScore, className }: ScoreBreakdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [data, setData] = useState<{
    factors: Factor[];
    risk_flags: string[];
    suggestion: string | null;
  } | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!isOpen || data) return;

    async function fetchBreakdown() {
      setLoading(true);
      try {
        const res = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL}/api/v1/sponsors/${sponsorId}/score-breakdown`
        );
        if (res.ok) {
          const json = await res.json();
          setData({
            factors: json.factors,
            risk_flags: json.risk_flags || [],
            suggestion: json.suggestion,
          });
        }
      } catch (err) {
        console.error('Score breakdown fetch error:', err);
      } finally {
        setLoading(false);
      }
    }
    fetchBreakdown();
  }, [isOpen, sponsorId, data]);

  const scoreColor =
    overallScore >= 80
      ? 'text-green'
      : overallScore >= 60
        ? 'text-amber'
        : 'text-red';

  return (
    <div className={className}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-1.5 text-[10px] font-data text-dim hover:text-amber transition-colors"
      >
        {isOpen ? <ChevronUp size={10} /> : <ChevronDown size={10} />}
        Why this score?
      </button>

      {isOpen && (
        <Card className="mt-2 !p-3 animate-slideInUp border-amber/10">
          <div className="flex items-center justify-between mb-3">
            <span className="font-data text-[10px] uppercase tracking-[0.15em] text-dim">
              Score Breakdown
            </span>
            <span className={cn('font-data text-lg font-bold tabular-nums', scoreColor)}>
              {overallScore}/100
            </span>
          </div>

          {loading ? (
            <div className="space-y-3">
              {Array.from({ length: 7 }).map((_, i) => (
                <div key={i} className="animate-pulse">
                  <div className="h-2.5 bg-s2 rounded w-32 mb-1" />
                  <div className="h-1.5 bg-s2 rounded w-full" />
                </div>
              ))}
            </div>
          ) : data ? (
            <>
              <div className="space-y-2.5">
                {data.factors.map((f) => (
                  <ScoreBar
                    key={f.key}
                    score={f.score}
                    label={f.label}
                    weight={f.weight}
                  />
                ))}
              </div>

              {data.risk_flags.length > 0 && (
                <div className="mt-3 pt-3 border-t border-border">
                  <div className="flex items-center gap-1.5 mb-1">
                    <AlertTriangle size={10} className="text-red" />
                    <span className="font-data text-[9px] uppercase tracking-wider text-red">
                      Risk Flags
                    </span>
                  </div>
                  <ul className="space-y-0.5">
                    {data.risk_flags.map((flag, i) => (
                      <li key={i} className="text-[10px] text-dim font-data">
                        - {flag}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {data.suggestion && (
                <div className="mt-3 pt-3 border-t border-border flex items-start gap-1.5">
                  <Lightbulb size={10} className="text-amber flex-shrink-0 mt-0.5" />
                  <span className="text-[10px] text-amber font-data">
                    {data.suggestion}
                  </span>
                </div>
              )}
            </>
          ) : null}
        </Card>
      )}
    </div>
  );
}
