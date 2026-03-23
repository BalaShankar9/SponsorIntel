'use client';

import { useState } from 'react';
import { Bookmark, Check, X } from 'lucide-react';
import { useAuthStore } from '@/lib/auth';
import { cn } from '@/lib/utils';

interface SaveSearchButtonProps {
  filters: Record<string, string>;
  resultCount?: number;
}

export function SaveSearchButton({ filters, resultCount }: SaveSearchButtonProps) {
  const [showInput, setShowInput] = useState(false);
  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const { token } = useAuthStore();

  const handleSave = async () => {
    if (!name.trim() || !token) return;
    setSaving(true);
    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/v1/searches/save`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            name: name.trim(),
            filters,
            result_count: resultCount,
          }),
        }
      );
      if (res.ok) {
        setSaved(true);
        setShowInput(false);
        setTimeout(() => setSaved(false), 3000);
      }
    } catch (err) {
      console.error('Save search error:', err);
    } finally {
      setSaving(false);
    }
  };

  if (saved) {
    return (
      <span className="flex items-center gap-1 text-[10px] font-data text-green">
        <Check size={10} />
        Saved
      </span>
    );
  }

  if (showInput) {
    return (
      <div className="flex items-center gap-1">
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Search name..."
          className="h-6 px-2 text-[10px] font-data bg-s2 border border-border text-text placeholder:text-muted focus:border-amber outline-none w-32"
          autoFocus
          onKeyDown={(e) => e.key === 'Enter' && handleSave()}
        />
        <button
          onClick={handleSave}
          disabled={saving || !name.trim()}
          className="h-6 px-2 bg-amber/20 border border-amber/30 text-amber text-[10px] font-data disabled:opacity-50"
        >
          {saving ? '...' : 'Save'}
        </button>
        <button
          onClick={() => setShowInput(false)}
          className="h-6 px-1 text-dim hover:text-text"
        >
          <X size={10} />
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={() => setShowInput(true)}
      className="flex items-center gap-1 text-[10px] font-data text-dim hover:text-amber transition-colors"
    >
      <Bookmark size={10} />
      Save Search
    </button>
  );
}
