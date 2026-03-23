'use client';

import { useState, useEffect, useCallback } from 'react';
import { soundManager } from '@/lib/sounds';

export function useSoundEffects() {
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    setEnabled(soundManager.isEnabled());
  }, []);

  const toggle = useCallback(() => {
    const newState = !enabled;
    setEnabled(newState);
    soundManager.setEnabled(newState);
  }, [enabled]);

  const play = useCallback((type: 'notification' | 'milestone' | 'achievement') => {
    soundManager.play(type);
  }, []);

  return { enabled, toggle, play };
}
