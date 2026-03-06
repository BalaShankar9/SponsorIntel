'use client';

import { useState } from 'react';
import { Card } from '@/components/ui/Card';
import { Badge, ScoreBadge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { ChevronRight, Briefcase, StickyNote, Calendar } from 'lucide-react';
import { formatDate } from '@/lib/utils';
import type { WatchlistItem } from '@/types';
import Link from 'next/link';

interface KanbanBoardProps {
  items: WatchlistItem[];
  onStatusChange: (id: string, newStatus: string) => void;
}

const columns = [
  { id: 'watching', label: 'Watching', color: 'text-accent', bg: 'bg-accent/10', border: 'border-accent/30' },
  { id: 'applied', label: 'Applied', color: 'text-cyan', bg: 'bg-cyan/10', border: 'border-cyan/30' },
  { id: 'interviewing', label: 'Interviewing', color: 'text-purple', bg: 'bg-purple/10', border: 'border-purple/30' },
  { id: 'offered', label: 'Offered', color: 'text-green', bg: 'bg-green/10', border: 'border-green/30' },
  { id: 'rejected', label: 'Rejected', color: 'text-red', bg: 'bg-red/10', border: 'border-red/30' },
];

const nextStatusMap: Record<string, string[]> = {
  watching: ['applied'],
  applied: ['interviewing', 'rejected'],
  interviewing: ['offered', 'rejected'],
  offered: [],
  rejected: [],
};

export function KanbanBoard({ items, onStatusChange }: KanbanBoardProps) {
  const [selectedItem, setSelectedItem] = useState<WatchlistItem | null>(null);

  return (
    <>
      <div className="grid grid-cols-5 gap-3">
        {columns.map((col) => {
          const colItems = items.filter((i) => (i.status || 'watching') === col.id);
          return (
            <div key={col.id} className="space-y-2">
              {/* Column Header */}
              <div className={`flex items-center justify-between rounded-lg border ${col.border} ${col.bg} px-3 py-2`}>
                <span className={`text-xs font-bold uppercase tracking-wider ${col.color}`}>
                  {col.label}
                </span>
                <span className="text-xs font-bold text-dim">{colItems.length}</span>
              </div>

              {/* Cards */}
              <div className="space-y-2">
                {colItems.map((item) => (
                  <div
                    key={item.id}
                    className="cursor-pointer rounded-lg border border-border bg-s1 p-3 transition-all hover:border-s4 hover:shadow-md"
                    onClick={() => setSelectedItem(item)}
                  >
                    <div className="flex items-start justify-between">
                      <p className="text-sm font-medium text-text leading-tight">
                        {item.sponsor_name || 'Unknown'}
                      </p>
                      <ScoreBadge score={item.sponsor_score} />
                    </div>
                    <div className="mt-2 flex items-center gap-2 text-[10px] text-dim2">
                      {item.applied_date && (
                        <span className="flex items-center gap-0.5">
                          <Calendar size={9} /> {formatDate(item.applied_date)}
                        </span>
                      )}
                    </div>

                    {/* Quick move buttons */}
                    {nextStatusMap[item.status || 'watching']?.length > 0 && (
                      <div className="mt-2 flex gap-1">
                        {nextStatusMap[item.status || 'watching'].map((next) => {
                          const nextCol = columns.find((c) => c.id === next);
                          return (
                            <button
                              key={next}
                              onClick={(e) => {
                                e.stopPropagation();
                                onStatusChange(item.id, next);
                              }}
                              className={`flex items-center gap-0.5 rounded px-1.5 py-0.5 text-[10px] font-medium transition-colors ${nextCol?.bg} ${nextCol?.color} hover:opacity-80`}
                            >
                              <ChevronRight size={8} /> {nextCol?.label}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                ))}

                {colItems.length === 0 && (
                  <div className="rounded-lg border border-dashed border-border/50 py-8 text-center text-xs text-dim2">
                    No items
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Detail Modal */}
      <Modal
        isOpen={!!selectedItem}
        onClose={() => setSelectedItem(null)}
        title={selectedItem?.sponsor_name || 'Company Details'}
      >
        {selectedItem && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <p className="text-xs text-dim">Score</p>
                <ScoreBadge score={selectedItem.sponsor_score} />
              </div>
              <div>
                <p className="text-xs text-dim">Status</p>
                <Badge variant={selectedItem.status === 'offered' ? 'green' : selectedItem.status === 'rejected' ? 'red' : 'blue'}>
                  {selectedItem.status || 'watching'}
                </Badge>
              </div>
              <div>
                <p className="text-xs text-dim">Priority</p>
                <p className="text-sm text-text">{selectedItem.priority ?? '--'}</p>
              </div>
              <div>
                <p className="text-xs text-dim">Applied Date</p>
                <p className="text-sm text-text">{formatDate(selectedItem.applied_date)}</p>
              </div>
            </div>

            {selectedItem.notes && (
              <div>
                <p className="mb-1 text-xs text-dim">Notes</p>
                <p className="rounded-md bg-s2 p-3 text-sm text-text">{selectedItem.notes}</p>
              </div>
            )}

            <div className="flex gap-2">
              <Link href={`/company/${selectedItem.sponsor_id}`}>
                <Button variant="secondary" size="sm">
                  <Briefcase size={14} /> View Company
                </Button>
              </Link>
              {nextStatusMap[selectedItem.status || 'watching']?.map((next) => {
                const nextCol = columns.find((c) => c.id === next);
                return (
                  <Button
                    key={next}
                    variant={next === 'rejected' ? 'red' : 'primary'}
                    size="sm"
                    onClick={() => {
                      onStatusChange(selectedItem.id, next);
                      setSelectedItem(null);
                    }}
                  >
                    Move to {nextCol?.label}
                  </Button>
                );
              })}
            </div>
          </div>
        )}
      </Modal>
    </>
  );
}
