import { useEffect, useState } from 'react';
import { AppState } from 'react-native';

/**
 * Lightweight live clock for screens that need wall-clock awareness.
 *
 * Ticks on a coarse interval (minute-level countdowns need nowhere near a
 * one-second loop) and re-syncs immediately when the app returns to the
 * foreground, so countdowns stay correct after backgrounding without
 * rendering anything while backgrounded.
 */
export function useNow(intervalMs = 30_000): Date {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const intervalId = setInterval(() => {
      setNow(new Date());
    }, intervalMs);

    const appStateSubscription = AppState.addEventListener('change', state => {
      if (state === 'active') {
        setNow(new Date());
      }
    });

    return () => {
      clearInterval(intervalId);
      appStateSubscription.remove();
    };
  }, [intervalMs]);

  return now;
}
