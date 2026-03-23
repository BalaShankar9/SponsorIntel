'use client';

import { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';

interface LoadingTerminalProps {
  messages?: string[];
  className?: string;
}

const DEFAULT_MESSAGES = [
  'Scanning 140,910 sponsors...',
  'Cross-referencing Companies House filings...',
  'Analyzing hiring patterns across 8,697 jobs...',
  'Checking enrichment levels...',
  'Loading intelligence data...',
];

export function LoadingTerminal({
  messages = DEFAULT_MESSAGES,
  className,
}: LoadingTerminalProps) {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (messages.length <= 1) return;
    const interval = setInterval(() => {
      setIndex((prev) => (prev + 1) % messages.length);
    }, 2000);
    return () => clearInterval(interval);
  }, [messages.length]);

  return (
    <div className={cn('flex items-center gap-2 py-8 justify-center', className)}>
      <span className="h-1.5 w-1.5 rounded-full bg-amber animate-pulse" />
      <span className="font-data text-xs text-dim animate-fadeIn" key={index}>
        {messages[index]}
      </span>
      <span className="terminal-cursor font-data text-xs" />
    </div>
  );
}
