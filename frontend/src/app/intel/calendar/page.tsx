'use client';

import { useState } from 'react';
import { CalendarView } from '@/components/intel/Calendar';
import { Calendar, ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/Button';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export default function CalendarPage() {
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());

  const prev = () => {
    if (month === 1) { setMonth(12); setYear(year - 1); }
    else setMonth(month - 1);
  };
  const next = () => {
    if (month === 12) { setMonth(1); setYear(year + 1); }
    else setMonth(month + 1);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Calendar size={16} className="text-cyan" />
          <h1 className="text-sm font-semibold text-text">Immigration Calendar</h1>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={prev}><ChevronLeft size={14} /></Button>
          <span className="text-sm font-data text-text min-w-[100px] text-center">
            {MONTHS[month - 1]} {year}
          </span>
          <Button variant="ghost" size="sm" onClick={next}><ChevronRight size={14} /></Button>
        </div>
      </div>

      <CalendarView month={month} year={year} />
    </div>
  );
}
