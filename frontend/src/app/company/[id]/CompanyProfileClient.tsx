'use client';

import { useState, useEffect } from 'react';
import { api } from '@/lib/api';
import { ProfileHeader } from '@/components/company/ProfileHeader';
import { ScoreRadar } from '@/components/company/ScoreRadar';
import { TabNav } from '@/components/company/TabNav';
import { OverviewTab } from '@/components/company/OverviewTab';
import { JobsTab } from '@/components/company/JobsTab';
import { PeopleTab } from '@/components/company/PeopleTab';
import { FinancialsTab } from '@/components/company/FinancialsTab';
import { ReviewsTab } from '@/components/company/ReviewsTab';
import { NewsTab } from '@/components/company/NewsTab';
import { TimelineTab } from '@/components/company/TimelineTab';
import { SimilarCompanies } from '@/components/company/SimilarCompanies';
import type { SponsorDetail, Sponsor } from '@/types';

interface CompanyProfileClientProps {
  initialData: SponsorDetail;
}

export function CompanyProfileClient({ initialData }: CompanyProfileClientProps) {
  const [sponsor] = useState<SponsorDetail>(initialData);
  const [activeTab, setActiveTab] = useState('overview');
  const [similar, setSimilar] = useState<Sponsor[]>([]);

  useEffect(() => {
    // Fetch similar companies
    api.get<Sponsor[]>(`/api/v1/sponsors/${sponsor.id}/similar`)
      .then(setSimilar)
      .catch(() => setSimilar([]));
  }, [sponsor.id]);

  const handleAddToWatchlist = async () => {
    try {
      await api.post('/api/v1/watchlist', { sponsor_id: sponsor.id });
    } catch (err) {
      console.error('Failed to add to watchlist:', err);
    }
  };

  const handleAddNote = () => {
    // Would open a modal in full implementation
    console.log('Add note for', sponsor.id);
  };

  const renderTab = () => {
    switch (activeTab) {
      case 'overview':
        return <OverviewTab sponsor={sponsor} />;
      case 'jobs':
        return <JobsTab sponsorId={sponsor.id} />;
      case 'people':
        return <PeopleTab profile={sponsor.profile} />;
      case 'financials':
        return <FinancialsTab profile={sponsor.profile} />;
      case 'reviews':
        return <ReviewsTab profile={sponsor.profile} />;
      case 'news':
        return <NewsTab sponsorId={sponsor.id} />;
      case 'timeline':
        return <TimelineTab sponsorId={sponsor.id} />;
      default:
        return <OverviewTab sponsor={sponsor} />;
    }
  };

  return (
    <div className="space-y-4">
      {/* Profile Header */}
      <ProfileHeader
        sponsor={sponsor}
        onAddToWatchlist={handleAddToWatchlist}
        onAddNote={handleAddNote}
      />

      {/* Radar Chart (shown alongside header on wide screens) */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          {/* Tab Navigation */}
          <TabNav activeTab={activeTab} onChange={setActiveTab} />
          <div className="mt-4">
            {renderTab()}
          </div>
        </div>
        <div>
          <ScoreRadar breakdown={sponsor.score_breakdown} />
        </div>
      </div>

      {/* Similar Companies */}
      <SimilarCompanies sponsors={similar} />
    </div>
  );
}
