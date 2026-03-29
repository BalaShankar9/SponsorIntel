'use client';

import { useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';

interface ShortcutHandlers {
  onOpenCommandPalette?: () => void;
  onToggleSidebar?: () => void;
  onCloseModal?: () => void;
}

const NAV_SHORTCUTS: Record<string, string> = {
  d: '/dashboard',
  s: '/search',
  j: '/jobs',
  m: '/map',
  t: '/trends',
  i: '/signals',
  c: '/compare',
  w: '/tracker',
  a: '/alerts',
};

export const SHORTCUT_LABELS: Record<string, string> = {
  '/dashboard': 'G D',
  '/search': 'G S',
  '/jobs': 'G J',
  '/map': 'G M',
  '/trends': 'G T',
  '/signals': 'G I',
  '/compare': 'G C',
  '/tracker': 'G W',
  '/alerts': 'G A',
};

function isInputFocused(): boolean {
  const el = document.activeElement;
  if (!el) return false;
  const tag = el.tagName.toLowerCase();
  if (tag === 'input' || tag === 'textarea' || tag === 'select') return true;
  if ((el as HTMLElement).isContentEditable) return true;
  return false;
}

export function useKeyboardShortcuts(handlers: ShortcutHandlers = {}) {
  const router = useRouter();
  const pendingKey = useRef<string | null>(null);
  const pendingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearPending = useCallback(() => {
    pendingKey.current = null;
    if (pendingTimer.current) {
      clearTimeout(pendingTimer.current);
      pendingTimer.current = null;
    }
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const isMac = navigator.platform.toUpperCase().includes('MAC');
      const mod = isMac ? e.metaKey : e.ctrlKey;

      // Cmd/Ctrl+K: open command palette
      if (mod && e.key === 'k') {
        e.preventDefault();
        handlers.onOpenCommandPalette?.();
        clearPending();
        return;
      }

      // Esc: close modal or navigate back
      if (e.key === 'Escape') {
        handlers.onCloseModal?.();
        clearPending();
        return;
      }

      // Don't trigger shortcuts when typing in inputs
      if (isInputFocused()) return;

      // [ : toggle sidebar
      if (e.key === '[') {
        e.preventDefault();
        handlers.onToggleSidebar?.();
        clearPending();
        return;
      }

      // Two-key G combos
      if (e.key === 'g' || e.key === 'G') {
        if (!pendingKey.current) {
          pendingKey.current = 'g';
          pendingTimer.current = setTimeout(clearPending, 500);
          return;
        }
      }

      if (pendingKey.current === 'g') {
        const key = e.key.toLowerCase();
        const path = NAV_SHORTCUTS[key];
        if (path) {
          e.preventDefault();
          router.push(path);
        }
        clearPending();
        return;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      clearPending();
    };
  }, [handlers, router, clearPending]);
}
