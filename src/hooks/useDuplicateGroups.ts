import { useEffect, useState } from 'react';

import { PromptManager } from '../services/promptManager';
import type { DuplicateGroup } from '../services/usageInsights';
import type { Prompt } from '../types';

/**
 * The Duplicate pairs of the Library, grouped by original, found after the screen is drawn: the
 * comparison is pairwise and yields to the UI while it runs. Null while it runs, and when it cannot
 * finish (a Library over the finder's limit, a timeout, a storage error): the caller then shows nothing.
 * It runs again when `prompts` changes.
 */
export function useDuplicateGroups(prompts: Prompt[] | null): DuplicateGroup[] | null {
  const [groups, setGroups] = useState<DuplicateGroup[] | null>(null);

  useEffect(() => {
    if (!prompts) {
      return;
    }
    let cancelled = false;
    setGroups(null);
    // After the first paint, so the Section shows before the comparison starts
    const timer = setTimeout(() => {
      PromptManager.getInstance()
        .findDuplicatePrompts()
        .then(found => { if (!cancelled) { setGroups(found); } })
        .catch(() => { if (!cancelled) { setGroups(null); } });
    }, 0);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [prompts]);

  return groups;
}
