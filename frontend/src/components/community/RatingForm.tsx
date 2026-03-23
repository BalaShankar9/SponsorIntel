'use client';

import { useState } from 'react';
import { Star, Send } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { useAuthStore } from '@/lib/auth';
import { cn } from '@/lib/utils';

interface RatingFormProps {
  sponsorId: string;
  onSubmit?: () => void;
}

const INTERACTION_TYPES = [
  { value: 'applied', label: 'I Applied' },
  { value: 'interviewed', label: 'I Was Interviewed' },
  { value: 'sponsored', label: 'I Was Sponsored' },
  { value: 'worked_here', label: 'I Worked Here' },
];

function StarRating({
  value,
  onChange,
  label,
}: {
  value: number;
  onChange: (v: number) => void;
  label: string;
}) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-[10px] font-data text-dim uppercase tracking-wider">{label}</span>
      <div className="flex gap-0.5">
        {[1, 2, 3, 4, 5].map((star) => (
          <button
            key={star}
            onClick={() => onChange(star)}
            className="transition-colors"
          >
            <Star
              size={14}
              className={cn(
                star <= value ? 'fill-amber text-amber' : 'text-s4 hover:text-amber/50'
              )}
            />
          </button>
        ))}
      </div>
    </div>
  );
}

export function RatingForm({ sponsorId, onSubmit }: RatingFormProps) {
  const { token, isAuthenticated } = useAuthStore();
  const [interactionType, setInteractionType] = useState('');
  const [overall, setOverall] = useState(0);
  const [ratingProcess, setRatingProcess] = useState(0);
  const [interview, setInterview] = useState(0);
  const [sponsorship, setSponsorship] = useState(0);
  const [culture, setCulture] = useState(0);
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  if (!isAuthenticated) {
    return (
      <Card className="!p-3">
        <p className="text-xs text-dim font-data text-center">
          Sign in to rate this sponsor
        </p>
      </Card>
    );
  }

  if (submitted) {
    return (
      <Card className="!p-3 border-green/20">
        <p className="text-xs text-green font-data text-center">
          Rating submitted. Pending admin approval.
        </p>
      </Card>
    );
  }

  const handleSubmit = async () => {
    if (!interactionType || overall === 0) return;
    setSubmitting(true);
    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/v1/community/ratings`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            sponsor_id: sponsorId,
            interaction_type: interactionType,
            rating_overall: overall,
            rating_process: ratingProcess || null,
            rating_interview: interview || null,
            rating_sponsorship: sponsorship || null,
            rating_culture: culture || null,
            comment: comment || null,
          }),
        }
      );
      if (res.ok) {
        setSubmitted(true);
        onSubmit?.();
      }
    } catch (err) {
      console.error('Rating submit error:', err);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Card className="!p-3">
      <h4 className="font-data text-[10px] uppercase tracking-[0.15em] text-dim mb-3">
        Rate This Sponsor
      </h4>

      {/* Interaction type */}
      <div className="grid grid-cols-2 gap-1 mb-3">
        {INTERACTION_TYPES.map((t) => (
          <button
            key={t.value}
            onClick={() => setInteractionType(t.value)}
            className={cn(
              'px-2 py-1.5 text-[10px] font-data border transition-colors',
              interactionType === t.value
                ? 'border-amber bg-amber/10 text-amber'
                : 'border-border text-dim hover:border-amber/30'
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Star ratings */}
      <div className="space-y-2 mb-3">
        <StarRating value={overall} onChange={setOverall} label="Overall *" />
        <StarRating value={ratingProcess} onChange={setRatingProcess} label="Application Process" />
        <StarRating value={interview} onChange={setInterview} label="Interview" />
        <StarRating value={sponsorship} onChange={setSponsorship} label="Sponsorship Support" />
        <StarRating value={culture} onChange={setCulture} label="Work Culture" />
      </div>

      {/* Comment */}
      <textarea
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        placeholder="Share your experience (optional)..."
        maxLength={2000}
        rows={3}
        className="w-full px-2 py-1.5 bg-s2 border border-border text-xs font-data text-text placeholder:text-muted resize-none focus:border-amber outline-none mb-3"
      />

      {/* Submit */}
      <button
        onClick={handleSubmit}
        disabled={submitting || !interactionType || overall === 0}
        className="w-full flex items-center justify-center gap-1.5 py-2 bg-amber/20 border border-amber/30 text-amber text-xs font-data font-bold uppercase tracking-wider hover:bg-amber/30 transition-colors disabled:opacity-50"
      >
        <Send size={10} />
        {submitting ? 'Submitting...' : 'Submit Rating'}
      </button>
    </Card>
  );
}
