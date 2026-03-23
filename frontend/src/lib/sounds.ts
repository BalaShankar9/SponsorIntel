'use client';

// Sound effect URLs (tiny base64 inline or hosted audio)
// These are placeholder paths — replace with actual audio files
const SOUND_URLS = {
  notification: '/sounds/notification.mp3',
  milestone: '/sounds/milestone.mp3',
  achievement: '/sounds/achievement.mp3',
} as const;

type SoundType = keyof typeof SOUND_URLS;

class SoundManager {
  private enabled = false;
  private audioCache = new Map<SoundType, HTMLAudioElement>();

  setEnabled(enabled: boolean) {
    this.enabled = enabled;
    if (typeof window !== 'undefined') {
      localStorage.setItem('sponsorintel-sounds', enabled ? '1' : '0');
    }
  }

  isEnabled(): boolean {
    if (typeof window === 'undefined') return false;
    const stored = localStorage.getItem('sponsorintel-sounds');
    this.enabled = stored === '1';
    return this.enabled;
  }

  play(type: SoundType) {
    if (!this.enabled || typeof window === 'undefined') return;

    try {
      let audio = this.audioCache.get(type);
      if (!audio) {
        audio = new Audio(SOUND_URLS[type]);
        audio.volume = 0.3;
        this.audioCache.set(type, audio);
      }
      audio.currentTime = 0;
      audio.play().catch(() => {
        // Silently ignore autoplay restrictions
      });
    } catch {
      // Audio not available
    }
  }
}

export const soundManager = new SoundManager();
