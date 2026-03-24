'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import type { IntelCalendarEvent } from '@/types/intel';

interface CalendarProps {
  month: number;
  year: number;
  visaRoute?: string;
}

export function CalendarView({ month, year, visaRoute }: CalendarProps) {
  const [events, setEvents] = useState<IntelCalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetch() {
      setLoading(true);
      const start = `${year}-${String(month).padStart(2, '0')}-01`;
      const endMonth = month === 12 ? 1 : month + 1;
      const endYear = month === 12 ? year + 1 : year;
      const end = `${endYear}-${String(endMonth).padStart(2, '0')}-01`;

      let query = supabase
        .from('intel_calendar')
        .select('*')
        .gte('event_date', start)
        .lt('event_date', end)
        .order('event_date');

      if (visaRoute) query = query.contains('visa_routes', [visaRoute]);

      const { data } = await query;
      setEvents(data || []);
      setLoading(false);
    }
    fetch();
  }, [month, year, visaRoute]);

  // Build calendar grid
  const firstDay = new Date(year, month - 1, 1);
  const daysInMonth = new Date(year, month, 0).getDate();
  const startDayOfWeek = firstDay.getDay(); // 0=Sun

  const days: (number | null)[] = [];
  for (let i = 0; i < startDayOfWeek; i++) days.push(null);
  for (let i = 1; i <= daysInMonth; i++) days.push(i);

  const getEventsForDay = (day: number) => {
    const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    return events.filter((e) => e.event_date === dateStr);
  };

  if (loading) return <div className="h-64 bg-s1 border border-border animate-shimmer rounded" />;

  return (
    <div>
      {/* Day headers */}
      <div className="grid grid-cols-7 gap-px mb-px">
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => (
          <div key={d} className="text-center text-[9px] font-data uppercase text-dim py-1">
            {d}
          </div>
        ))}
      </div>

      {/* Calendar grid */}
      <div className="grid grid-cols-7 gap-px">
        {days.map((day, idx) => {
          const dayEvents = day ? getEventsForDay(day) : [];
          return (
            <div
              key={idx}
              className={`min-h-[80px] border border-border p-1 ${
                day ? 'bg-s1' : 'bg-bg'
              }`}
            >
              {day && (
                <>
                  <span className="text-[10px] font-data text-dim">{day}</span>
                  {dayEvents.map((evt) => (
                    <div
                      key={evt.id}
                      className="mt-0.5 rounded bg-cyan/10 border border-cyan/20 px-1 py-0.5 cursor-pointer hover:bg-cyan/15"
                      title={evt.description || evt.title}
                    >
                      <p className="text-[8px] font-data text-cyan truncate">{evt.title}</p>
                    </div>
                  ))}
                </>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
