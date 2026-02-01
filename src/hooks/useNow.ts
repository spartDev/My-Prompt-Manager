import { useState, useEffect } from 'react';

/**
 * Hook that returns the current timestamp and updates at a specified interval.
 * Unlike useRef, this triggers re-renders when the time updates.
 *
 * @param intervalMs - Update interval in milliseconds (default: 60000 = 1 minute)
 * @returns Current timestamp in milliseconds
 */
export const useNow = (intervalMs: number = 60000): number => {
  const [now, setNow] = useState<number>(() => Date.now());

  useEffect(() => {
    const interval = setInterval(() => {
      setNow(Date.now());
    }, intervalMs);

    return () => {
      clearInterval(interval);
    };
  }, [intervalMs]);

  return now;
};
