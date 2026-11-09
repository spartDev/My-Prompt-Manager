import { useEffect, useState } from 'react';

import { motionDuration } from '../theme/motion';

/** Ease-out cubic: fast at first, settling on the value */
const easeOut = (t: number): number => 1 - (1 - t) ** 3;

/**
 * A number that counts up from 0 to `target` over `durationMs` with an ease-out, starting again each
 * time the target changes. Under reduced motion it is the target at once.
 */
export function useCountUp(target: number, durationMs: number): number {
  const duration = motionDuration(durationMs);
  const [value, setValue] = useState(duration > 0 ? 0 : target);

  useEffect(() => {
    if (duration <= 0 || target <= 0 || typeof requestAnimationFrame !== 'function') {
      setValue(target);
      return;
    }
    let frame = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const progress = Math.min(1, (now - start) / duration);
      setValue(Math.round(target * easeOut(progress)));
      if (progress < 1) {
        frame = requestAnimationFrame(tick);
      }
    };
    setValue(0);
    frame = requestAnimationFrame(tick);
    return () => { cancelAnimationFrame(frame); };
  }, [target, duration]);

  return value;
}
