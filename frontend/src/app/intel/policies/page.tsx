'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { PolicyCard } from '@/components/intel/PolicyCard';
import { FileText } from 'lucide-react';
import type { IntelPolicy } from '@/types/intel';

const STAGES = ['proposed', 'consultation', 'parliamentary_debate', 'enacted', 'effective'];

export default function PoliciesPage() {
  const [policies, setPolicies] = useState<IntelPolicy[]>([]);
  const [stage, setStage] = useState<string | undefined>();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetch() {
      setLoading(true);
      let query = supabase.from('intel_policies').select('*').order('last_updated_at', { ascending: false });
      if (stage) query = query.eq('stage', stage);
      const { data } = await query;
      setPolicies(data || []);
      setLoading(false);
    }
    fetch();
  }, [stage]);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <FileText size={16} className="text-cyan" />
        <h1 className="text-sm font-semibold text-text">Policy Tracker</h1>
      </div>

      <div className="flex gap-1.5 flex-wrap">
        <button onClick={() => setStage(undefined)}
          className={`px-2 py-1 text-xs rounded border transition-colors ${!stage ? 'border-amber text-amber bg-amber/10' : 'border-border text-dim hover:text-text'}`}>
          All Stages
        </button>
        {STAGES.map((s) => (
          <button key={s} onClick={() => setStage(s)}
            className={`px-2 py-1 text-xs rounded border transition-colors capitalize ${stage === s ? 'border-amber text-amber bg-amber/10' : 'border-border text-dim hover:text-text'}`}>
            {s.replace(/_/g, ' ')}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => <div key={i} className="h-32 bg-s1 border border-border animate-shimmer rounded" />)}
        </div>
      ) : policies.length === 0 ? (
        <div className="text-center text-dim text-sm py-8">No policies tracked yet.</div>
      ) : (
        <div className="space-y-2">
          {policies.map((p) => <PolicyCard key={p.id} policy={p} />)}
        </div>
      )}
    </div>
  );
}
