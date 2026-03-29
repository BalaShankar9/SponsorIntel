import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function getScoreColor(score: number | null): string {
  if (score === null) return 'text-dim';
  if (score >= 80) return 'text-green';
  if (score >= 60) return 'text-amber';
  return 'text-red';
}

export function getScoreBg(score: number | null): string {
  if (score === null) return 'bg-s3';
  if (score >= 80) return 'bg-green/20';
  if (score >= 60) return 'bg-amber/20';
  return 'bg-red/20';
}

export function getRatingColor(rating: string | null): string {
  if (rating === 'A') return 'text-green';
  if (rating === 'B') return 'text-amber';
  return 'text-dim';
}

export function scoreColor(score: number): string {
  if (score >= 80) return 'text-green';
  if (score >= 60) return 'text-amber';
  return 'text-red';
}

export function scoreBgColor(score: number): string {
  if (score >= 80) return 'bg-green/20';
  if (score >= 60) return 'bg-amber/20';
  return 'bg-red/20';
}

export function ratingColor(rating: string): string {
  if (rating === 'A') return 'text-green';
  if (rating === 'B') return 'text-amber';
  return 'text-dim';
}

export function formatNumber(n: number | null | undefined): string {
  if (n === null || n === undefined) return '--';
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toString();
}

export function formatDate(dateStr: string | null): string {
  if (!dateStr) return '--';
  return new Date(dateStr).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

export function formatRelativeDate(dateStr: string): string {
  const now = new Date();
  const date = new Date(dateStr);
  const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (seconds < 10) return 'Just now';
  if (seconds < 60) return `${seconds}s ago`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`;
  return formatDate(dateStr);
}

export function timeAgo(dateStr: string): string {
  const now = new Date();
  const date = new Date(dateStr);
  const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (seconds < 60) return 'just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`;
  return formatDate(dateStr);
}
