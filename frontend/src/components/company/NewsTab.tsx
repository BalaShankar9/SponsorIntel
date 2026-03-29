'use client';

import { useState } from 'react';
import { Newspaper } from 'lucide-react';
import { Card, CardHeader, CardTitle } from '@/components/ui/Card';

interface NewsTabProps {
  sponsorId: string;
}

export function NewsTab({ sponsorId }: NewsTabProps) {
  return (
    <div className="space-y-3">
      <Card>
        <CardHeader>
          <CardTitle>News & Mentions</CardTitle>
        </CardHeader>
      </Card>

      <div className="flex h-48 flex-col items-center justify-center border border-s3 bg-s1 text-center">
        <Newspaper className="mb-2 h-6 w-6 text-dim" />
        <p className="text-sm text-dim">No news articles available for this company.</p>
        <p className="mt-1 text-[10px] text-dim">News monitoring will be enabled in a future update.</p>
      </div>
    </div>
  );
}
