import { useEffect, useState } from 'react';

import { type Lookalike, searchLookalike } from '../services/promptLookalike';
import type { Prompt } from '../types';

/** The pause in typing after which the text is compared with the Library */
export const LOOKALIKE_PAUSE_MS = 400;

/**
 * How long one task may compare Prompts before it hands the editor back: at least one comparison,
 * then none started once this is spent, so a frame is never held for long
 */
export const LOOKALIKE_TASK_BUDGET_MS = 8;

/**
 * The Lookalike of the text being written ("This looks familiar"), searched once typing pauses, a
 * few milliseconds per task, so a long text or a large Library never freezes the editor. A
 * search still running when the text changes is dropped. Until a search ends, the last one found
 * stays.
 */
export function useLookalike(content: string, library: readonly Prompt[], excludeId?: string): Lookalike | null {
  const [lookalike, setLookalike] = useState<Lookalike | null>(null);

  useEffect(() => {
    const search = searchLookalike(content, library, excludeId);
    const runSlice = () => {
      const started = performance.now();
      do {
        const step = search.next();
        if (step.done) {
          setLookalike(step.value);
          return;
        }
      } while (performance.now() - started < LOOKALIKE_TASK_BUDGET_MS);
      timer = setTimeout(runSlice, 0);
    };
    let timer = setTimeout(runSlice, LOOKALIKE_PAUSE_MS);
    return () => { clearTimeout(timer); };
  }, [content, library, excludeId]);

  return lookalike;
}
