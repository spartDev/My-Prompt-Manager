/**
 * A fake of the Web Locks API's LockManager (navigator.locks) for tests. Locks are exclusive
 * and granted first come, first served, per name. Whoever shares the same instance shares the
 * locks, so two AsyncMutex instances given the same fake stand for two contexts of the
 * extension (a popup and the service worker). `log` records every grant and release, in order.
 */
export class FakeLockManager {
  private readonly tails = new Map<string, Promise<void>>();
  readonly log: string[] = [];

  request<T>(name: string, callback: (lock: Lock) => T | Promise<T>): Promise<T> {
    const previous = this.tails.get(name) ?? Promise.resolve();
    const granted = previous.then<T>(() => {
      this.log.push(`acquire ${name}`);
      return callback({ name, mode: 'exclusive' });
    });
    const released = granted.then(
      () => {
        this.log.push(`release ${name}`);
      },
      () => {
        this.log.push(`release ${name}`);
      }
    );
    this.tails.set(name, released);
    return granted;
  }
}

/** Installs `locks` as navigator.locks and returns the function that removes it again. */
export function installNavigatorLocks(locks: unknown): () => void {
  Object.defineProperty(globalThis.navigator, 'locks', { value: locks, configurable: true, writable: true });
  return () => {
    Reflect.deleteProperty(globalThis.navigator, 'locks');
  };
}
