import { useCallback, useEffect, useRef, useState } from 'react';

import { admit } from '../../services/promptAdmission';
import { decode } from '../../services/promptEncoder';
import type { SharedPromptData } from '../../types';
import { Logger } from '../../utils';

export interface ShareCodeImport {
  code: string;
  setCode: (code: string) => void;
  /** The Prompt the code holds, as Admission would admit it; null until a valid code is pasted */
  decoded: SharedPromptData | null;
  /** Why the code cannot be opened (not a Share code, or refused at Admission); empty when none */
  error: string;
  validating: boolean;
  reset: () => void;
}

const DEBOUNCE_MS = 300;

/**
 * Opens a Share code as the user pastes it. Decoding only parses; whether the text may enter the
 * Library is Admission's call, asked now (without saving) so a refusal shows straight away. The
 * preview shows what will be saved, so it shows Admission's result rather than the raw text.
 */
export function useShareCodeImport(onOpened?: (decoded: SharedPromptData) => void): ShareCodeImport {
  // The latest callback, read when the debounced check ends
  const onOpenedRef = useRef(onOpened);
  useEffect(() => { onOpenedRef.current = onOpened; });

  const [code, setCodeState] = useState('');
  const [decoded, setDecoded] = useState<SharedPromptData | null>(null);
  const [error, setError] = useState('');
  const [validating, setValidating] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearTimer = useCallback(() => {
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
    }
  }, []);

  useEffect(() => clearTimer, [clearTimer]);

  const reset = useCallback(() => {
    clearTimer();
    setCodeState('');
    setDecoded(null);
    setError('');
    setValidating(false);
  }, [clearTimer]);

  const setCode = useCallback((next: string) => {
    setCodeState(next);
    clearTimer();

    if (!next.trim()) {
      setDecoded(null);
      setError('');
      setValidating(false);
      return;
    }

    setValidating(true);
    timer.current = setTimeout(() => {
      try {
        const admission = admit(decode(next));
        if (!admission.ok) {
          const message = Object.values(admission.errors)
            .flatMap(refusal => (refusal ? [refusal.message] : []))
            .join('; ');
          setDecoded(null);
          setError(message);
          Logger.warn('Share code would be refused at Admission', {
            component: 'PromptEditor',
            mode: 'import',
            fields: Object.keys(admission.errors)
          });
          return;
        }
        setDecoded(admission.text);
        setError('');
        onOpenedRef.current?.(admission.text);
        Logger.info('Share code opened', { component: 'PromptEditor', mode: 'import' });
      } catch (err) {
        setDecoded(null);
        setError((err as Error).message || 'Invalid Share code');
        Logger.warn('Share code could not be opened', {
          component: 'PromptEditor',
          error: (err as Error).message
        });
      } finally {
        setValidating(false);
      }
    }, DEBOUNCE_MS);
  }, [clearTimer]);

  return { code, setCode, decoded, error, validating, reset };
}
