'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { Eye, GitCompareArrows, Star } from 'lucide-react';
import { cn } from '@/lib/utils';
import { supabase } from '@/lib/supabase';

interface HoverPreviewProps {
  sponsorId: string;
  children: React.ReactNode;
  className?: string;
}

interface PreviewData {
  organisation_name: string;
  town_city: string | null;
  rating: string | null;
  sponsor_type: string | null;
  route: string[] | null;
  companies_house_number: string | null;
  company_status: string | null;
  industry_primary: string | null;
  overall_score: number | null;
  credit_risk_score: number | null;
  legitimacy_score: number | null;
}

// Cache preview data
const previewCache = new Map<string, PreviewData>();

export function HoverPreview({ sponsorId, children, className }: HoverPreviewProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [preview, setPreview] = useState<PreviewData | null>(null);
  const [loading, setLoading] = useState(false);
  const [position, setPosition] = useState({ top: 0, left: 0, flipUp: false });
  const triggerRef = useRef<HTMLDivElement>(null);
  const hoverTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cardRef = useRef<HTMLDivElement>(null);

  const fetchPreview = useCallback(async () => {
    const cached = previewCache.get(sponsorId);
    if (cached) {
      setPreview(cached);
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('sponsors')
        .select(`
          organisation_name, town_city, rating, sponsor_type, route,
          company_profiles ( companies_house_number, company_status, industry_primary, credit_risk_score, legitimacy_score ),
          sponsor_scores ( overall_score )
        `)
        .eq('id', sponsorId)
        .single();

      if (!error && data) {
        const profiles = data.company_profiles;
        const profile = Array.isArray(profiles) ? profiles[0] : profiles;
        const scores = data.sponsor_scores;
        const scoreObj = Array.isArray(scores) ? scores[0] : scores;

        const detail: PreviewData = {
          organisation_name: data.organisation_name as string,
          town_city: data.town_city as string | null,
          rating: data.rating as string | null,
          sponsor_type: data.sponsor_type as string | null,
          route: data.route as string[] | null,
          companies_house_number: (profile as Record<string, unknown>)?.companies_house_number as string | null ?? null,
          company_status: (profile as Record<string, unknown>)?.company_status as string | null ?? null,
          industry_primary: (profile as Record<string, unknown>)?.industry_primary as string | null ?? null,
          credit_risk_score: (profile as Record<string, unknown>)?.credit_risk_score as number | null ?? null,
          legitimacy_score: (profile as Record<string, unknown>)?.legitimacy_score as number | null ?? null,
          overall_score: (scoreObj as Record<string, unknown>)?.overall_score as number | null ?? null,
        };

        previewCache.set(sponsorId, detail);
        setPreview(detail);
      }
    } catch {
      // silently fail
    } finally {
      setLoading(false);
    }
  }, [sponsorId]);

  const handleMouseEnter = useCallback(() => {
    hoverTimer.current = setTimeout(() => {
      if (triggerRef.current) {
        const rect = triggerRef.current.getBoundingClientRect();
        const viewportHeight = window.innerHeight;
        const spaceBelow = viewportHeight - rect.bottom;
        const flipUp = spaceBelow < 240;

        setPosition({
          top: flipUp ? rect.top - 8 : rect.bottom + 8,
          left: Math.min(rect.left, window.innerWidth - 300),
          flipUp,
        });
      }
      setIsVisible(true);
      fetchPreview();
    }, 250);
  }, [fetchPreview]);

  const handleMouseLeave = useCallback(() => {
    if (hoverTimer.current) {
      clearTimeout(hoverTimer.current);
      hoverTimer.current = null;
    }
    setIsVisible(false);
  }, []);

  useEffect(() => {
    return () => {
      if (hoverTimer.current) clearTimeout(hoverTimer.current);
    };
  }, []);

  return (
    <div
      ref={triggerRef}
      className={cn('inline-block', className)}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {children}

      {isVisible && (
        <div
          ref={cardRef}
          className="fixed z-[90] w-72 animate-fadeIn border border-border bg-s1 shadow-xl shadow-black/40"
          style={{
            top: position.flipUp ? undefined : position.top,
            bottom: position.flipUp ? `calc(100vh - ${position.top}px)` : undefined,
            left: position.left,
          }}
          onMouseEnter={() => {
            if (hoverTimer.current) clearTimeout(hoverTimer.current);
          }}
          onMouseLeave={handleMouseLeave}
        >
          {loading && !preview && (
            <div className="flex items-center justify-center py-6">
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-amber border-t-transparent" />
            </div>
          )}

          {preview && (
            <div>
              {/* Header */}
              <div className="border-b border-border px-3 py-2">
                <div className="flex items-start justify-between gap-2">
                  <h4 className="text-sm font-semibold text-amber leading-tight truncate">
                    {preview.organisation_name}
                  </h4>
                  {preview.overall_score !== null && (
                    <span className={cn(
                      'flex-shrink-0 inline-block rounded px-1.5 py-0.5 font-data text-[10px] font-bold',
                      preview.overall_score >= 70 ? 'bg-green/10 text-green' :
                      preview.overall_score >= 50 ? 'bg-amber/10 text-amber' :
                      'bg-red/10 text-red'
                    )}>
                      {preview.overall_score}
                    </span>
                  )}
                </div>
                {preview.industry_primary && (
                  <div className="font-data text-[10px] text-dim mt-0.5 truncate">{preview.industry_primary}</div>
                )}
              </div>

              {/* Details grid */}
              <div className="px-3 py-2 space-y-1.5">
                <PreviewRow label="City" value={preview.town_city} />
                <PreviewRow
                  label="Rating"
                  value={preview.rating}
                  valueClass={preview.rating === 'A' ? 'text-green font-bold' : preview.rating === 'B' ? 'text-red font-bold' : undefined}
                />
                <PreviewRow label="Type" value={preview.sponsor_type} />
                <PreviewRow
                  label="CH Number"
                  value={preview.companies_house_number}
                  valueClass="text-cyan"
                />
                <PreviewRow
                  label="CH Status"
                  value={preview.company_status}
                  valueClass={preview.company_status?.toLowerCase() === 'active' ? 'text-green' : undefined}
                />
                {preview.credit_risk_score !== null && (
                  <PreviewRow
                    label="Credit Risk"
                    value={`${preview.credit_risk_score}/100`}
                    valueClass={
                      preview.credit_risk_score >= 70 ? 'text-green' :
                      preview.credit_risk_score >= 50 ? 'text-amber' :
                      'text-red'
                    }
                  />
                )}
                {preview.legitimacy_score !== null && (
                  <PreviewRow
                    label="Legitimacy"
                    value={`${preview.legitimacy_score}/100`}
                    valueClass={
                      preview.legitimacy_score >= 70 ? 'text-green' :
                      preview.legitimacy_score >= 50 ? 'text-amber' :
                      'text-red'
                    }
                  />
                )}
              </div>

              {/* Quick Actions */}
              <div className="border-t border-border mt-2 pt-2 px-3 pb-2 flex items-center gap-1.5">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    window.location.href = `/company/${sponsorId}`;
                  }}
                  className="flex items-center gap-1 px-2 py-1 text-[9px] font-data text-amber border border-amber/20 hover:bg-amber/10 transition-colors"
                >
                  <Eye size={9} />
                  Profile
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    window.location.href = `/compare?ids=${sponsorId}`;
                  }}
                  className="flex items-center gap-1 px-2 py-1 text-[9px] font-data text-cyan border border-cyan/20 hover:bg-cyan/10 transition-colors"
                >
                  <GitCompareArrows size={9} />
                  Compare
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                  }}
                  className="flex items-center gap-1 px-2 py-1 text-[9px] font-data text-green border border-green/20 hover:bg-green/10 transition-colors"
                >
                  <Star size={9} />
                  Watch
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function PreviewRow({
  label,
  value,
  valueClass,
}: {
  label: string;
  value: string | null | undefined;
  valueClass?: string;
}) {
  if (!value) return null;
  return (
    <div className="flex justify-between items-center text-xs">
      <span className="text-dim font-data text-[10px]">{label}</span>
      <span className={cn('font-data text-[10px] text-text', valueClass)}>{value}</span>
    </div>
  );
}
