'use client';

import { useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';
import { formatNumber } from '@/lib/utils';

interface NumberAnimationProps {
  value: number;
  duration?: number;       // ms, default 300
  format?: 'number' | 'compact' | 'percent' | 'currency';
  prefix?: string;
  suffix?: string;
  className?: string;
  decimals?: number;
}

export function NumberAnimation({
  value,
  duration = 300,
  format = 'compact',
  prefix = '',
  suffix = '',
  className,
  decimals = 0,
}: NumberAnimationProps) {
  const [display, setDisplay] = useState<string>('');
  const prevValue = useRef<number>(value);
  const rafId = useRef<number>(0);

  const formatValue = (v: number): string => {
    switch (format) {
      case 'compact':
        return formatNumber(v);
      case 'percent':
        return `${v.toFixed(decimals)}%`;
      case 'currency':
        return `£${v >= 1000 ? formatNumber(v) : v.toLocaleString()}`;
      case 'number':
      default:
        return decimals > 0
          ? v.toFixed(decimals)
          : Math.round(v).toLocaleString();
    }
  };

  useEffect(() => {
    const from = prevValue.current;
    const to = value;
    prevValue.current = value;

    if (from === to) {
      setDisplay(`${prefix}${formatValue(to)}${suffix}`);
      return;
    }

    const startTime = performance.now();

    const animate = (currentTime: number) => {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);
      // ease-out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      const current = from + (to - from) * eased;

      setDisplay(`${prefix}${formatValue(current)}${suffix}`);

      if (progress < 1) {
        rafId.current = requestAnimationFrame(animate);
      }
    };

    rafId.current = requestAnimationFrame(animate);

    return () => {
      if (rafId.current) cancelAnimationFrame(rafId.current);
    };
  }, [value, duration, format, prefix, suffix, decimals]);

  return (
    <span className={cn('font-data tabular-nums', className)}>
      {display}
    </span>
  );
}
