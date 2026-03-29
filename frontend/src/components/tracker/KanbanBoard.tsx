'use client';

import { useState } from 'react';
import { ChevronRight, Calendar, StickyNote, Check, X } from 'lucide-react';
import { formatDate } from '@/lib/utils';
import type { WatchlistItem } from '@/types';
import Link from 'next/link';

interface KanbanBoardProps {
  items: WatchlistItem[];
  onStatusChange: (id: string, newStatus: string) => void;
  onNoteUpdate: (id: string, notes: string) => void;
}

const columns = [
  { id: 'watching', label: 'WATCHING', color: 'text-amber', bg: 'bg-amber/10', border: 'border-amber/30', headerBg: 'bg-amber' },
  { id: 'applied', label: 'APPLIED', color: 'text-blue', bg: 'bg-blue/10', border: 'border-blue/30', headerBg: 'bg-blue' },
  { id: 'interviewing', label: 'INTERVIEW', color: 'text-cyan', bg: 'bg-cyan/10', border: 'border-cyan/30', headerBg: 'bg-cyan' },
  { id: 'offered', label: 'OFFERED', color: 'text-green', bg: 'bg-green/10', border: 'border-green/30', headerBg: 'bg-green' },
  { id: 'rejected', label: 'REJECTED', color: 'text-red', bg: 'bg-red/10', border: 'border-red/30', headerBg: 'bg-red' },
];

const nextStatusMap: Record<string, string[]> = {
  watching: ['applied'],
  applied: ['interviewing', 'rejected'],
  interviewing: ['offered', 'rejected'],
  offered: [],
  rejected: [],
};

function KanbanCard({
  item,
  onStatusChange,
  onNoteUpdate,
}: {
  item: WatchlistItem;
  onStatusChange: (id: string, newStatus: string) => void;
  onNoteUpdate: (id: string, notes: string) => void;
}) {
  const [editingNote, setEditingNote] = useState(false);
  const [noteText, setNoteText] = useState(item.notes || '');
  const status = item.status || 'watching';

  const saveNote = () => {
    onNoteUpdate(item.id, noteText);
    setEditingNote(false);
  };

  const cancelNote = () => {
    setNoteText(item.notes || '');
    setEditingNote(false);
  };

  return (
    <div className="border border-s3 bg-s1 p-2 transition-colors hover:border-amber/30">
      {/* Company Name + Score */}
      <div className="flex items-start justify-between">
        <Link
          href={`/company/${item.sponsor_id}`}
          className="font-data text-xs text-text hover:text-amber"
        >
          {item.sponsor_name || 'UNKNOWN'}
        </Link>
        {item.sponsor_score !== null && (
          <span className={`font-data text-[10px] font-bold ${
            (item.sponsor_score ?? 0) >= 70 ? 'text-green' : (item.sponsor_score ?? 0) >= 50 ? 'text-amber' : 'text-red'
          }`}>
            {item.sponsor_score}
          </span>
        )}
      </div>

      {/* Date */}
      <div className="mt-1 flex items-center gap-1 font-data text-[9px] text-muted">
        <Calendar size={8} />
        {item.applied_date ? formatDate(item.applied_date) : formatDate(item.created_at)}
      </div>

      {/* Notes */}
      <div className="mt-1">
        {editingNote ? (
          <div className="space-y-1">
            <textarea
              value={noteText}
              onChange={(e) => setNoteText(e.target.value)}
              className="w-full border border-amber/30 bg-bg p-1 font-data text-[10px] text-text focus:outline-none resize-none"
              rows={2}
              autoFocus
            />
            <div className="flex gap-1">
              <button onClick={saveNote} className="text-green hover:text-green/80">
                <Check size={10} />
              </button>
              <button onClick={cancelNote} className="text-red hover:text-red/80">
                <X size={10} />
              </button>
            </div>
          </div>
        ) : (
          <button
            onClick={() => setEditingNote(true)}
            className="flex items-start gap-1 text-left font-data text-[9px] text-dim hover:text-amber w-full"
          >
            <StickyNote size={8} className="mt-0.5 shrink-0" />
            <span className="line-clamp-2">{item.notes || 'Click to add note...'}</span>
          </button>
        )}
      </div>

      {/* Move Buttons */}
      {nextStatusMap[status]?.length > 0 && (
        <div className="mt-1.5 flex gap-1">
          {nextStatusMap[status].map((next) => {
            const nextCol = columns.find((c) => c.id === next);
            return (
              <button
                key={next}
                onClick={() => onStatusChange(item.id, next)}
                className={`flex items-center gap-0.5 px-1.5 py-0.5 font-data text-[8px] font-bold uppercase transition-colors ${nextCol?.bg} ${nextCol?.color} hover:opacity-80`}
              >
                <ChevronRight size={7} /> {nextCol?.label}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

export function KanbanBoard({ items, onStatusChange, onNoteUpdate }: KanbanBoardProps) {
  return (
    <div className="grid grid-cols-5 gap-2">
      {columns.map((col) => {
        const colItems = items.filter((i) => (i.status || 'watching') === col.id);
        return (
          <div key={col.id} className="space-y-1">
            {/* Column Header */}
            <div className={`flex items-center justify-between px-2 py-1.5 ${col.headerBg}`}>
              <span className="font-data text-[10px] font-bold uppercase tracking-widest text-bg">
                {col.label}
              </span>
              <span className="font-data text-[10px] font-bold text-bg/70">{colItems.length}</span>
            </div>

            {/* Cards */}
            <div className="space-y-1">
              {colItems.map((item) => (
                <KanbanCard
                  key={item.id}
                  item={item}
                  onStatusChange={onStatusChange}
                  onNoteUpdate={onNoteUpdate}
                />
              ))}

              {colItems.length === 0 && (
                <div className="border border-dashed border-s3 py-6 text-center font-data text-[9px] text-muted">
                  EMPTY
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
