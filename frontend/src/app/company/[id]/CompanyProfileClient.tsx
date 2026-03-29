'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { ProfileHeader } from '@/components/company/ProfileHeader';
import { ScoreRadar } from '@/components/company/ScoreRadar';
import { TabNav } from '@/components/company/TabNav';
import { OverviewTab } from '@/components/company/OverviewTab';
import { FinancialsTab } from '@/components/company/FinancialsTab';
import { PeopleTab } from '@/components/company/PeopleTab';
import { ReviewsTab } from '@/components/company/ReviewsTab';
import { SimilarCompanies } from '@/components/company/SimilarCompanies';
import { JobsTab } from '@/components/company/JobsTab';
import type { SponsorDetail, CompanyProfile, Sponsor } from '@/types';

interface CompanyProfileClientProps {
  initialData: SponsorDetail;
}

interface SimilarSponsor extends Sponsor {
  overall_score?: number | null;
}

const POLL_INTERVAL = 15_000; // 15 seconds

export function CompanyProfileClient({ initialData }: CompanyProfileClientProps) {
  const [sponsor, setSponsor] = useState<SponsorDetail>(initialData);
  const [activeTab, setActiveTab] = useState('overview');
  const [similar, setSimilar] = useState<SimilarSponsor[]>([]);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());
  const [isLive, setIsLive] = useState(true);
  const prevEnrichedRef = useRef(initialData.profile?.enriched_at);

  // Live refresh: poll for profile updates
  const refreshProfile = useCallback(async () => {
    if (!sponsor.profile) return;
    try {
      const { data } = await supabase
        .from('company_profiles')
        .select('*')
        .eq('sponsor_id', sponsor.id)
        .single();

      if (data && data.enriched_at !== prevEnrichedRef.current) {
        prevEnrichedRef.current = data.enriched_at;
        setSponsor(prev => ({ ...prev, profile: data as CompanyProfile }));
        setLastUpdate(new Date());
      }
    } catch {
      // Silent fail on poll
    }
  }, [sponsor.id, sponsor.profile]);

  // Poll every 15s
  useEffect(() => {
    if (!isLive) return;
    const interval = setInterval(refreshProfile, POLL_INTERVAL);
    return () => clearInterval(interval);
  }, [refreshProfile, isLive]);

  // Also try Supabase Realtime (works if table is in supabase_realtime publication)
  useEffect(() => {
    if (!sponsor.profile) return;

    const channel = supabase
      .channel(`profile-${sponsor.id}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'company_profiles',
          filter: `sponsor_id=eq.${sponsor.id}`,
        },
        (payload) => {
          if (payload.new) {
            setSponsor(prev => ({ ...prev, profile: payload.new as CompanyProfile }));
            setLastUpdate(new Date());
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [sponsor.id, sponsor.profile]);

  // Determine which tabs have data
  const profile = sponsor.profile;
  const hasFinancials = profile && (
    profile.has_charges !== null ||
    profile.has_insolvency_history !== null ||
    profile.credit_risk_score !== null ||
    profile.has_ccjs !== null ||
    profile.accounts_overdue !== null
  );
  const hasReviews = profile && (
    profile.glassdoor_rating !== null ||
    profile.trustpilot_rating !== null ||
    profile.google_rating !== null
  );
  const hasPeople = profile && (
    profile.employee_count_estimate !== null ||
    profile.linkedin_url !== null
  );

  const availableTabs = [
    { id: 'overview', label: 'OVERVIEW' },
    { id: 'jobs', label: 'JOBS' },
    ...(hasFinancials ? [{ id: 'financials', label: 'FINANCIALS' }] : []),
    ...(hasPeople ? [{ id: 'people', label: 'PEOPLE' }] : []),
    ...(hasReviews ? [{ id: 'reviews', label: 'REVIEWS' }] : []),
  ];

  // Fetch similar companies: same industry_primary or same town_city
  useEffect(() => {
    async function loadSimilar() {
      try {
        const industry = sponsor.profile?.industry_primary;
        const city = sponsor.town_city;

        if (industry) {
          const { data } = await supabase
            .from('company_profiles')
            .select(`
              sponsor_id,
              industry_primary,
              sponsors!inner (
                id, organisation_name, town_city, county, rating, sponsor_type, route, is_active
              ),
              sponsor_scores (overall_score)
            `)
            .eq('industry_primary', industry)
            .neq('sponsor_id', sponsor.id)
            .limit(5);

          if (data && data.length > 0) {
            const mapped = data.map((row: Record<string, unknown>) => {
              const s = row.sponsors as Record<string, unknown>;
              const scoreArr = row.sponsor_scores as Array<{ overall_score: number }> | null;
              return {
                ...s,
                overall_score: scoreArr?.[0]?.overall_score ?? null,
              } as SimilarSponsor;
            });
            setSimilar(mapped);
            return;
          }
        }

        // Fallback: same city
        if (city) {
          const { data } = await supabase
            .from('sponsors')
            .select(`
              id, organisation_name, town_city, county, rating, sponsor_type, route, is_active,
              sponsor_scores (overall_score)
            `)
            .eq('town_city', city)
            .neq('id', sponsor.id)
            .limit(5);

          if (data) {
            const mapped = data.map((row: Record<string, unknown>) => {
              const scoreArr = row.sponsor_scores as Array<{ overall_score: number }> | null;
              const { sponsor_scores: _ss, ...rest } = row;
              return {
                ...rest,
                overall_score: scoreArr?.[0]?.overall_score ?? null,
              } as SimilarSponsor;
            });
            setSimilar(mapped);
          }
        }
      } catch {
        setSimilar([]);
      }
    }
    loadSimilar();
  }, [sponsor.id, sponsor.profile?.industry_primary, sponsor.town_city]);

  const renderTab = () => {
    switch (activeTab) {
      case 'overview':
        return <OverviewTab sponsor={sponsor} />;
      case 'jobs':
        return <JobsTab sponsorId={sponsor.id} />;
      case 'financials':
        return <FinancialsTab profile={sponsor.profile} />;
      case 'people':
        return <PeopleTab profile={sponsor.profile} />;
      case 'reviews':
        return <ReviewsTab profile={sponsor.profile} />;
      default:
        return <OverviewTab sponsor={sponsor} />;
    }
  };

  return (
    <div className="space-y-3">
      <ProfileHeader sponsor={sponsor} />

      {/* Live indicator */}
      <div className="flex items-center justify-between px-1">
        <button
          onClick={() => setIsLive(!isLive)}
          className="flex items-center gap-1.5 text-[10px] font-data uppercase tracking-wider text-dim hover:text-text transition-colors"
        >
          <span className={`h-1.5 w-1.5 rounded-full ${isLive ? 'bg-green animate-pulse' : 'bg-red'}`} />
          {isLive ? 'LIVE' : 'PAUSED'}
        </button>
        <span className="text-[9px] font-data text-muted">
          Updated {lastUpdate.toLocaleTimeString()}
        </span>
      </div>

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
        {/* Main content area */}
        <div className="lg:col-span-2">
          <TabNav
            tabs={availableTabs}
            activeTab={activeTab}
            onChange={setActiveTab}
          />
          <div className="mt-3 animate-fadeIn">
            {renderTab()}
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-3">
          <ScoreRadar breakdown={sponsor.scores} />
          <SimilarCompanies sponsors={similar} />
        </div>
      </div>
    </div>
  );
}
