/**
 * AsyncMutex - Queue-based mutex for preventing race conditions in async operations.
 *
 * Supports both single-lock and keyed-lock patterns:
 * - Single lock: `mutex.withLock(() => operation())`
 * - Keyed lock: `mutex.withLock('key', () => operation())`
 */
export class AsyncMutex {
  private locks = new Map<string, Promise<void>>();
  private static readonly DEFAULT_KEY = '__default__';

  /**
   * Execute an operation with exclusive access (mutex).
   * Operations are queued and executed in order.
   *
   * @param operation - Async function to execute with exclusive access
   * @returns Promise resolving to the operation's result
   */
  async withLock<T>(operation: () => Promise<T>): Promise<T>;
  /**
   * Execute an operation with exclusive access for a specific key.
   * Different keys can run concurrently; same keys are queued.
   *
   * @param lockKey - Key to lock on (operations with same key are serialized)
   * @param operation - Async function to execute with exclusive access
   * @returns Promise resolving to the operation's result
   */
  async withLock<T>(lockKey: string, operation: () => Promise<T>): Promise<T>;
  async withLock<T>(
    lockKeyOrOperation: string | (() => Promise<T>),
    maybeOperation?: () => Promise<T>
  ): Promise<T> {
    const lockKey = typeof lockKeyOrOperation === 'string'
      ? lockKeyOrOperation
      : AsyncMutex.DEFAULT_KEY;
    const operation = typeof lockKeyOrOperation === 'function'
      ? lockKeyOrOperation
      : (maybeOperation as () => Promise<T>);

    // Create a promise that will resolve when this operation gets to run
    let resolveQueue: (() => void) | undefined;
    const queuePromise = new Promise<void>(resolve => {
      resolveQueue = resolve;
    });

    // Chain this operation after the existing lock (or resolve immediately if none)
    const existingLock = this.locks.get(lockKey);
    const chainedPromise = existingLock
      ? existingLock.then(() => {}, () => {}) // Wait for previous, ignore its result/error
      : Promise.resolve();

    // Set our queue promise as the new lock BEFORE awaiting the chain
    // This ensures the next operation will wait for us
    this.locks.set(lockKey, queuePromise);

    // Wait for our turn (previous operation to complete)
    await chainedPromise;

    // Now we have exclusive access - execute the operation
    try {
      return await operation();
    } finally {
      // Signal that we're done (release the lock for next operation)
      if (resolveQueue) {
        resolveQueue();
      }

      // Clean up if we're still the current lock holder
      if (this.locks.get(lockKey) === queuePromise) {
        this.locks.delete(lockKey);
      }
    }
  }
}
