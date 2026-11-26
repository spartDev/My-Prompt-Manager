import { useCallback, useRef } from 'react';

/** How a read ended: what it read, or why it failed */
export type ReadOutcome<T> = { readonly ok: true; readonly value: T } | { readonly ok: false; readonly error: unknown };

/** Starts a read: calls `read` at once, and `settle` with its outcome only if no newer read has started by then */
export type NewestRead = <T>(read: () => Promise<T>, settle: (outcome: ReadOutcome<T>) => void) => Promise<boolean>;

/**
 * Reads of which only the newest counts, the one started last, whatever order they end in
 * (My-Prompt-Manager-7v5k). A read that ends after a newer one has started changes nothing: its
 * `settle` is never called, so neither the data, the error nor the busy state move.
 *
 * A Try again's read can hang past RETRY_READ_BOUND_MS and end after a later Try again has brought the
 * Library back. Its failure must not bring Error Loading Data back over the Library, and its data must
 * not replace the newer read's: the newer read was asked for after whatever the hung one read past (a
 * write, an import, another Try again), and its outcome is the one the caller was told last.
 *
 * Resolves to true when the read worked and false when it failed; a read overtaken resolves to the
 * newest read's outcome, once that one has ended, so whoever awaits any of them learns how the reads
 * ended. Never rejects. The function returned is stable.
 */
export const useNewestRead = (): NewestRead => {
  // How many reads have started, and the outcome of the last one started: set by every read as it
  // starts, so it is there whenever a read finds a newer one has started
  const started = useRef(0);
  const newest = useRef<Promise<boolean> | null>(null);

  return useCallback(<T>(read: () => Promise<T>, settle: (outcome: ReadOutcome<T>) => void): Promise<boolean> => {
    started.current += 1;
    const self = started.current;
    const run = async (): Promise<boolean> => {
      let outcome: ReadOutcome<T>;
      try {
        outcome = { ok: true, value: await read() };
      } catch (error) {
        outcome = { ok: false, error };
      }
      if (self !== started.current && newest.current !== null) {
        return newest.current;
      }
      settle(outcome);
      return outcome.ok;
    };
    const outcome = run();
    newest.current = outcome;
    return outcome;
  }, []);
};
