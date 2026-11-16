import { useState, useEffect, useRef, useCallback } from 'react';

interface UseKioskSessionOptions {
  timeoutSeconds?: number;
  onTimeout?: () => void;
  enabled?: boolean;
}

export interface KioskSessionState {
  remainingSeconds: number;
  timedOut: boolean;
  resetTimer: () => void;
  dismissBanner: () => void;
}

/**
 * BR-20: Kiosk Session & Inactivity Timeout
 * Enforces a 60-second inactivity countdown on public kiosk pages.
 * Resets sensitive form inputs and returns to initial state upon inactivity.
 */
export function useKioskSession({
  timeoutSeconds = 60,
  onTimeout,
  enabled = true,
}: UseKioskSessionOptions = {}): KioskSessionState {
  const [remainingSeconds, setRemainingSeconds] = useState<number>(timeoutSeconds);
  const [timedOut, setTimedOut] = useState<boolean>(false);
  const lastActivityRef = useRef<number>(Date.now());
  const onTimeoutRef = useRef(onTimeout);

  useEffect(() => {
    onTimeoutRef.current = onTimeout;
  }, [onTimeout]);

  const resetTimer = useCallback(() => {
    lastActivityRef.current = Date.now();
    setRemainingSeconds(timeoutSeconds);
  }, [timeoutSeconds]);

  const dismissBanner = useCallback(() => {
    setTimedOut(false);
  }, []);

  useEffect(() => {
    if (!enabled) return;

    // Reset timestamp on mount
    lastActivityRef.current = Date.now();
    setRemainingSeconds(timeoutSeconds);

    const handleUserActivity = () => {
      lastActivityRef.current = Date.now();
    };

    const events = ['mousemove', 'mousedown', 'keydown', 'touchstart', 'scroll', 'click'];
    events.forEach((evt) => window.addEventListener(evt, handleUserActivity, { passive: true }));

    const interval = window.setInterval(() => {
      const elapsed = Math.floor((Date.now() - lastActivityRef.current) / 1000);
      const remaining = Math.max(0, timeoutSeconds - elapsed);
      setRemainingSeconds(remaining);

      if (remaining === 0) {
        lastActivityRef.current = Date.now(); // reset internal mark to prevent repeated triggers
        setTimedOut(true);
        if (onTimeoutRef.current) {
          onTimeoutRef.current();
        }
      }
    }, 1000);

    return () => {
      window.clearInterval(interval);
      events.forEach((evt) => window.removeEventListener(evt, handleUserActivity));
    };
  }, [enabled, timeoutSeconds]);

  return {
    remainingSeconds,
    timedOut,
    resetTimer,
    dismissBanner,
  };
}
