import { useEffect, useRef, useState } from 'react';

import { motionDuration } from '../theme/motion';

export interface AnimatedPresence<T> {
  /** What to render: the open value, or the last one while it leaves, or null once gone */
  shown: T | null;
  /** True while the exit animation plays: the component is still in the document, leaving */
  exiting: boolean;
}

/**
 * Keeps a panel in the document for the length of its exit animation. Pass the open value (null
 * when closed) and the exit duration from MOTION: `shown` is what to render and `exiting` says
 * to play the exit animation. Opening again while leaving cancels the unmount, and the timer is
 * cleared on unmount. Under prefers-reduced-motion the panel leaves at once.
 */
export function useAnimatedPresence<T>(value: T | null, exitMs: number): AnimatedPresence<T> {
  // The last open value, rendered while leaving
  const lastValueRef = useRef<T | null>(value);
  if (value !== null) { lastValueRef.current = value; }

  const [mounted, setMounted] = useState(value !== null);
  const open = value !== null;

  useEffect(() => {
    if (open) {
      setMounted(true);
      return;
    }
    const timer = setTimeout(() => { setMounted(false); }, motionDuration(exitMs));
    return () => { clearTimeout(timer); };
  }, [open, exitMs]);

  if (open) {
    return { shown: value, exiting: false };
  }
  return mounted ? { shown: lastValueRef.current, exiting: true } : { shown: null, exiting: false };
}
