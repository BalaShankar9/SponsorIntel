'use client';

import { Users, UserPlus, UserMinus } from 'lucide-react';
import { Card, CardHeader, CardTitle } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { formatDate } from '@/lib/utils';
import type { CompanyProfile } from '@/types';

interface PeopleTabProps {
  profile: CompanyProfile | null;
}

// This would be populated from enrichment data in production.
// For now, show structure with placeholder data.
export function PeopleTab({ profile }: PeopleTabProps) {
  if (!profile) {
    return (
      <div className="flex h-64 items-center justify-center text-sm text-dim">
        No enrichment data available. Company profile has not been enriched yet.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Directors */}
      <Card>
        <CardHeader>
          <CardTitle>Directors & Officers</CardTitle>
          <Badge variant="blue">Companies House</Badge>
        </CardHeader>
        <div className="text-sm text-dim">
          <p>Director and officer data is populated via Companies House enrichment.</p>
          <p className="mt-2">Companies House Number: <span className="text-accent">{profile.companies_house_number || 'Not linked'}</span></p>
        </div>
      </Card>

      {/* Recent Officer Changes */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Officer Changes</CardTitle>
        </CardHeader>
        <div className="space-y-2">
          <div className="flex items-center gap-3 rounded-md bg-s2/50 p-3 text-sm text-dim">
            <Users size={16} />
            Officer change data will appear here as events are detected.
          </div>
        </div>
      </Card>

      {/* PSC Section */}
      <Card>
        <CardHeader>
          <CardTitle>Persons with Significant Control (PSC)</CardTitle>
        </CardHeader>
        <div className="text-sm text-dim">
          PSC data is populated via Companies House enrichment.
        </div>
      </Card>
    </div>
  );
}
