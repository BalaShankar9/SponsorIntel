'use client';

import { useEffect, useState, useMemo } from 'react';
import { api } from '@/lib/api';
import { Card, CardHeader, CardTitle } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { PageSpinner } from '@/components/ui/Spinner';
import { Search, ChevronDown, ChevronRight, Pencil, Save, X, StickyNote, ExternalLink } from 'lucide-react';
import { formatDate, timeAgo } from '@/lib/utils';
import type { UserNote } from '@/types';
import Link from 'next/link';

interface GroupedNotes {
  sponsor_id: string;
  sponsor_name: string;
  notes: (UserNote & { sponsor_name?: string })[];
}

export default function NotesPage() {
  const [notes, setNotes] = useState<(UserNote & { sponsor_name?: string })[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [expandedGroup, setExpandedGroup] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState('');

  useEffect(() => {
    async function fetchNotes() {
      try {
        const data = await api.get<(UserNote & { sponsor_name?: string })[]>('/api/v1/notes');
        setNotes(data);
      } catch (err) {
        console.error('Failed to fetch notes:', err);
      } finally {
        setLoading(false);
      }
    }
    fetchNotes();
  }, []);

  // Group by sponsor
  const grouped = useMemo(() => {
    const groups: Record<string, GroupedNotes> = {};
    const filtered = notes.filter((n) =>
      search === '' || n.content.toLowerCase().includes(search.toLowerCase()) ||
      (n.sponsor_name && n.sponsor_name.toLowerCase().includes(search.toLowerCase()))
    );

    filtered.forEach((note) => {
      if (!groups[note.sponsor_id]) {
        groups[note.sponsor_id] = {
          sponsor_id: note.sponsor_id,
          sponsor_name: note.sponsor_name || 'Unknown Company',
          notes: [],
        };
      }
      groups[note.sponsor_id].notes.push(note);
    });

    return Object.values(groups).sort((a, b) => {
      const aLatest = Math.max(...a.notes.map((n) => new Date(n.updated_at).getTime()));
      const bLatest = Math.max(...b.notes.map((n) => new Date(n.updated_at).getTime()));
      return bLatest - aLatest;
    });
  }, [notes, search]);

  const handleEdit = (note: UserNote) => {
    setEditingId(note.id);
    setEditContent(note.content);
  };

  const handleSave = async (noteId: string) => {
    try {
      await api.put(`/api/v1/notes/${noteId}`, { content: editContent });
      setNotes((prev) =>
        prev.map((n) => (n.id === noteId ? { ...n, content: editContent, updated_at: new Date().toISOString() } : n))
      );
      setEditingId(null);
    } catch (err) {
      console.error('Failed to save note:', err);
    }
  };

  if (loading) return <PageSpinner />;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold text-text">Notes</h1>
        <p className="text-sm text-dim">Your research notes organized by company</p>
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-dim2" />
        <input
          type="text"
          placeholder="Search notes..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full rounded-md border border-border bg-s2 py-2 pl-9 pr-3 text-sm text-text placeholder-dim2 focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent/50"
        />
      </div>

      {grouped.length === 0 && (
        <Card>
          <div className="flex flex-col items-center py-12 text-center">
            <StickyNote className="mb-3 h-8 w-8 text-dim2" />
            <p className="text-sm text-dim">
              {notes.length === 0 ? 'No notes yet. Add notes from company profiles.' : 'No notes match your search.'}
            </p>
          </div>
        </Card>
      )}

      {/* Grouped Notes */}
      <div className="space-y-2">
        {grouped.map((group) => {
          const isExpanded = expandedGroup === group.sponsor_id;
          return (
            <Card key={group.sponsor_id} padding={false}>
              {/* Group Header */}
              <button
                className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-s2"
                onClick={() => setExpandedGroup(isExpanded ? null : group.sponsor_id)}
              >
                {isExpanded ? <ChevronDown size={14} className="text-dim" /> : <ChevronRight size={14} className="text-dim" />}
                <span className="flex-1 text-sm font-medium text-text">{group.sponsor_name}</span>
                <span className="text-xs text-dim2">{group.notes.length} note{group.notes.length !== 1 ? 's' : ''}</span>
                <Link
                  href={`/company/${group.sponsor_id}`}
                  onClick={(e) => e.stopPropagation()}
                  className="text-xs text-accent hover:underline"
                >
                  <ExternalLink size={12} />
                </Link>
              </button>

              {/* Notes List */}
              {isExpanded && (
                <div className="border-t border-border">
                  {group.notes.map((note) => (
                    <div key={note.id} className="border-b border-border/50 px-4 py-3 last:border-0">
                      {editingId === note.id ? (
                        <div className="space-y-2">
                          <textarea
                            value={editContent}
                            onChange={(e) => setEditContent(e.target.value)}
                            className="w-full rounded-md border border-border bg-s2 p-3 text-sm text-text focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent/50"
                            rows={4}
                          />
                          <div className="flex gap-2">
                            <Button size="sm" onClick={() => handleSave(note.id)}>
                              <Save size={12} /> Save
                            </Button>
                            <Button size="sm" variant="ghost" onClick={() => setEditingId(null)}>
                              <X size={12} /> Cancel
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <div>
                          <p className="whitespace-pre-wrap text-sm text-text">{note.content}</p>
                          <div className="mt-2 flex items-center justify-between">
                            <span className="text-[10px] text-dim2">
                              {timeAgo(note.updated_at)} {note.updated_at !== note.created_at && '(edited)'}
                            </span>
                            <button
                              onClick={() => handleEdit(note)}
                              className="text-dim2 transition-colors hover:text-accent"
                            >
                              <Pencil size={12} />
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </Card>
          );
        })}
      </div>
    </div>
  );
}
