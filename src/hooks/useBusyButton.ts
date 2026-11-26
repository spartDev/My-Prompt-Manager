import { useCallback, useEffect, useRef, useState } from 'react';

import { RETRY_FAILURE_HOLD_MS } from '../constants/ui';

/**
 * How the work of a busy button ends: undefined when it worked, else the function that shows its
 * failure (a Notification, a report, a warning), which the hook calls as the busy state ends
 */
export type BusyResult = (() => void) | undefined;

export interface BusyButton {
  /** True from the press until the work has ended, or its failure's hold has passed */
  busy: boolean;
  /**
   * Runs `work` as the button's busy state; a call while it is busy does nothing. `work` never
   * rejects: it resolves to its failure instead
   */
  run: (work: () => Promise<BusyResult>) => Promise<void>;
}

/**
 * The Loading State of a button that keeps the keyboard while it is busy (docs/DESIGN_GUIDELINES.md):
 * busy at the press, a press meanwhile doing nothing. Work that succeeds ends the busy state at once;
 * work that fails ends it no sooner than RETRY_FAILURE_HOLD_MS after the press, so a failure that
 * comes within a frame or two does not flash it for one frame, and its failure shows then, in the
 * same commit as the idle button. Unmounted during the hold, the failure shows at once and no timer
 * is left.
 */
export function useBusyButton(): BusyButton {
  const [busy, setBusy] = useState(false);
  // Set at the press, before the commit that shows it, so a second press in between does nothing too
  const busyRef = useRef(false);
  // Ends the hold under way at once: on unmount, the failure is still shown
  const endHold = useRef<(() => void) | null>(null);
  useEffect(() => () => { endHold.current?.(); }, []);

  const run = useCallback(async (work: () => Promise<BusyResult>): Promise<void> => {
    if (busyRef.current) {
      return;
    }
    busyRef.current = true;
    setBusy(true);
    let timer: ReturnType<typeof setTimeout> | undefined;
    const held = new Promise<void>((resolve) => {
      timer = setTimeout(resolve, RETRY_FAILURE_HOLD_MS);
      endHold.current = () => {
        clearTimeout(timer);
        resolve();
      };
    });
    try {
      const showFailure = await work();
      if (showFailure) {
        await held;
        showFailure();
      }
    } finally {
      clearTimeout(timer);
      endHold.current = null;
      busyRef.current = false;
      setBusy(false);
    }
  }, []);

  return { busy, run };
}
