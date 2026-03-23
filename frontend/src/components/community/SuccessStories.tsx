'use client';

import { useEffect, useState } from 'react';
import { Award, UserCheck } from 'lucide-react';
import { Card, CardTitle } from '@/components/ui/Card';

interface Story {
  story_text: string;
  visa_route: string | null;
  year: number | null;
  is_anonymous: boolean;
  created_at: string;
}

interface SuccessStoriesProps {
  sponsorId: string;
}

export function SuccessStories({ sponsorId }: SuccessStoriesProps) {
  const [stories, setStories] = useState<Story[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchStories() {
      try {
        const res = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL}/api/v1/community/success-stories/${sponsorId}`
        );
        if (res.ok) {
          setStories(await res.json());
        }
      } catch (err) {
        console.error('Success stories fetch error:', err);
      } finally {
        setLoading(false);
      }
    }
    fetchStories();
  }, [sponsorId]);

  if (loading || stories.length === 0) return null;

  return (
    <Card className="!p-3">
      <div className="flex items-center gap-1.5 mb-2">
        <Award size={11} className="text-green" />
        <CardTitle>Success Stories</CardTitle>
        <span className="ml-auto font-data text-[9px] text-green bg-green/10 px-1.5 py-0.5">
          {stories.length} sponsored
        </span>
      </div>
      <div className="space-y-2">
        {stories.map((s, i) => (
          <div
            key={i}
            className="border border-border/30 p-2 stagger-item"
          >
            <div className="flex items-center gap-2 mb-1">
              <UserCheck size={10} className="text-green" />
              <span className="text-[9px] font-data text-green">
                {s.visa_route || 'Visa sponsored'}{s.year ? ` (${s.year})` : ''}
              </span>
            </div>
            <p className="text-[10px] text-dim leading-relaxed">{s.story_text}</p>
          </div>
        ))}
      </div>
    </Card>
  );
}
