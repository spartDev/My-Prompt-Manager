import { describe, it, expect, beforeEach, afterEach } from 'vitest';

import { FakeLockManager, installNavigatorLocks } from '../../test/utils/FakeLockManager';
import { AsyncMutex } from '../asyncMutex';

describe('AsyncMutex', () => {
  describe('single lock mode', () => {
    it('executes operations in sequence', async () => {
      const mutex = new AsyncMutex();
      const executionOrder: number[] = [];

      const operation1 = mutex.withLock(async () => {
        await new Promise(resolve => setTimeout(resolve, 50));
        executionOrder.push(1);
        return 'result1';
      });

      const operation2 = mutex.withLock(async () => {
        executionOrder.push(2);
        return 'result2';
      });

      const [result1, result2] = await Promise.all([operation1, operation2]);

      expect(result1).toBe('result1');
      expect(result2).toBe('result2');
      expect(executionOrder).toEqual([1, 2]);
    });

    it('returns operation result', async () => {
      const mutex = new AsyncMutex();
      const result = await mutex.withLock(async () => {
        return { data: 'test' };
      });
      expect(result).toEqual({ data: 'test' });
    });

    it('propagates errors from operations', async () => {
      const mutex = new AsyncMutex();
      await expect(
        mutex.withLock(async () => {
          throw new Error('Test error');
        })
      ).rejects.toThrow('Test error');
    });

    it('releases lock even when operation throws', async () => {
      const mutex = new AsyncMutex();
      const executionOrder: number[] = [];

      // First operation throws
      const operation1 = mutex.withLock(async () => {
        executionOrder.push(1);
        throw new Error('First operation failed');
      });

      // Second operation should still run
      const operation2 = mutex.withLock(async () => {
        executionOrder.push(2);
        return 'success';
      });

      await expect(operation1).rejects.toThrow('First operation failed');
      await expect(operation2).resolves.toBe('success');
      expect(executionOrder).toEqual([1, 2]);
    });
  });

  describe('keyed lock mode', () => {
    it('serializes operations with same key', async () => {
      const mutex = new AsyncMutex();
      const executionOrder: string[] = [];

      const operation1 = mutex.withLock('key1', async () => {
        await new Promise(resolve => setTimeout(resolve, 50));
        executionOrder.push('key1-op1');
        return 'result1';
      });

      const operation2 = mutex.withLock('key1', async () => {
        executionOrder.push('key1-op2');
        return 'result2';
      });

      await Promise.all([operation1, operation2]);

      expect(executionOrder).toEqual(['key1-op1', 'key1-op2']);
    });

    it('allows concurrent operations with different keys', async () => {
      const mutex = new AsyncMutex();
      const startTimes: Record<string, number> = {};
      const endTimes: Record<string, number> = {};

      const operation1 = mutex.withLock('key1', async () => {
        startTimes['key1'] = Date.now();
        await new Promise(resolve => setTimeout(resolve, 50));
        endTimes['key1'] = Date.now();
        return 'result1';
      });

      const operation2 = mutex.withLock('key2', async () => {
        startTimes['key2'] = Date.now();
        await new Promise(resolve => setTimeout(resolve, 50));
        endTimes['key2'] = Date.now();
        return 'result2';
      });

      await Promise.all([operation1, operation2]);

      // Both operations should start roughly at the same time (within 20ms)
      expect(Math.abs(startTimes['key1'] - startTimes['key2'])).toBeLessThan(20);
    });

    it('releases lock for key even when operation throws', async () => {
      const mutex = new AsyncMutex();
      const executionOrder: string[] = [];

      // First operation throws
      const operation1 = mutex.withLock('key1', async () => {
        executionOrder.push('key1-op1');
        throw new Error('First operation failed');
      });

      // Second operation with same key should still run
      const operation2 = mutex.withLock('key1', async () => {
        executionOrder.push('key1-op2');
        return 'success';
      });

      await expect(operation1).rejects.toThrow('First operation failed');
      await expect(operation2).resolves.toBe('success');
      expect(executionOrder).toEqual(['key1-op1', 'key1-op2']);
    });
  });

  describe('high concurrency', () => {
    it('handles many concurrent operations correctly', async () => {
      const mutex = new AsyncMutex();
      const executionOrder: number[] = [];
      const operations: Promise<number>[] = [];

      for (let i = 0; i < 10; i++) {
        operations.push(
          mutex.withLock(async () => {
            executionOrder.push(i);
            await new Promise(resolve => setTimeout(resolve, 5));
            return i;
          })
        );
      }

      const results = await Promise.all(operations);

      // All operations should complete
      expect(results).toHaveLength(10);
      expect(executionOrder).toHaveLength(10);

      // Results should match their index (order of queueing)
      results.forEach((result, index) => {
        expect(result).toBe(index);
      });
    });

    it('handles mixed keyed operations correctly', async () => {
      const mutex = new AsyncMutex();
      const key1Order: number[] = [];
      const key2Order: number[] = [];

      const operations: Promise<void>[] = [];

      for (let i = 0; i < 5; i++) {
        operations.push(
          mutex.withLock('key1', async () => {
            key1Order.push(i);
            await new Promise(resolve => setTimeout(resolve, 5));
          })
        );
        operations.push(
          mutex.withLock('key2', async () => {
            key2Order.push(i);
            await new Promise(resolve => setTimeout(resolve, 5));
          })
        );
      }

      await Promise.all(operations);

      // Each key should have operations in order
      expect(key1Order).toEqual([0, 1, 2, 3, 4]);
      expect(key2Order).toEqual([0, 1, 2, 3, 4]);
    });
  });

  describe('cleanup behavior', () => {
    it('cleans up lock when operation completes', async () => {
      const mutex = new AsyncMutex();

      // Access the private locks map for testing
      // @ts-expect-error - accessing private property for testing
      const locks: Map<string, Promise<void>> = mutex.locks;

      await mutex.withLock('testKey', async () => {
        // During execution, lock should exist
        expect(locks.has('testKey')).toBe(true);
      });

      // After completion, lock should be cleaned up
      expect(locks.has('testKey')).toBe(false);
    });

    it('cleans up default lock when operation completes', async () => {
      const mutex = new AsyncMutex();

      // @ts-expect-error - accessing private property for testing
      const locks: Map<string, Promise<void>> = mutex.locks;
      // @ts-expect-error - accessing private static for testing
      const defaultKey: string = AsyncMutex.DEFAULT_KEY;

      await mutex.withLock(async () => {
        expect(locks.has(defaultKey)).toBe(true);
      });

      expect(locks.has(defaultKey)).toBe(false);
    });
  });

  describe('shared across contexts (Web Locks)', () => {
    let locks: FakeLockManager;
    let uninstall: () => void;

    beforeEach(() => {
      locks = new FakeLockManager();
      uninstall = installNavigatorLocks(locks);
    });

    afterEach(() => {
      uninstall();
    });

    const slowly = async (push: () => void): Promise<void> => {
      await new Promise((resolve) => setTimeout(resolve, 20));
      push();
    };

    it('a mutex with a scope takes the Web Lock scope:key, so two instances (two contexts) exclude each other', async () => {
      const worker = new AsyncMutex({ scope: 'storage' });
      const popup = new AsyncMutex({ scope: 'storage' });
      const order: string[] = [];

      await Promise.all([
        worker.withLock('prompts', () => slowly(() => order.push('worker'))),
        popup.withLock('prompts', async () => {
          order.push('popup');
        })
      ]);

      expect(order).toEqual(['worker', 'popup']);
      expect(locks.log).toEqual([
        'acquire storage:prompts',
        'release storage:prompts',
        'acquire storage:prompts',
        'release storage:prompts'
      ]);
    });

    it('without a scope, two instances do not exclude each other, as before', async () => {
      const a = new AsyncMutex();
      const b = new AsyncMutex();
      const order: string[] = [];

      await Promise.all([
        a.withLock('k', () => slowly(() => order.push('a'))),
        b.withLock('k', async () => {
          order.push('b');
        })
      ]);

      expect(order).toEqual(['b', 'a']);
      expect(locks.log).toEqual([]);
    });

    it('keys of one scope are separate locks, and the default key is one of them', async () => {
      const mutex = new AsyncMutex({ scope: 's' });

      await Promise.all([
        mutex.withLock('a', () => slowly(() => undefined)),
        mutex.withLock('b', async () => undefined),
        mutex.withLock(async () => undefined)
      ]);

      expect(locks.log.slice(0, 3)).toEqual(['acquire s:a', 'acquire s:b', 'acquire s:__default__']);
    });

    it('returns the operation result, propagates its error unchanged, and releases the lock either way', async () => {
      const mutex = new AsyncMutex({ scope: 's' });
      const failure = new Error('boom');

      await expect(mutex.withLock('k', async () => 'ok')).resolves.toBe('ok');
      await expect(
        mutex.withLock('k', async () => {
          throw failure;
        })
      ).rejects.toBe(failure);
      await expect(mutex.withLock('k', async () => 'after')).resolves.toBe('after');

      expect(locks.log).toEqual([
        'acquire s:k',
        'release s:k',
        'acquire s:k',
        'release s:k',
        'acquire s:k',
        'release s:k'
      ]);
    });

    it('nested locks on different keys stay legal (CATEGORIES, then PROMPTS, then SETTINGS)', async () => {
      const mutex = new AsyncMutex({ scope: 's' });

      const result = await mutex.withLock('categories', () =>
        mutex.withLock('prompts', () => mutex.withLock('settings', async () => 'done'))
      );

      expect(result).toBe('done');
      expect(locks.log).toEqual([
        'acquire s:categories',
        'acquire s:prompts',
        'acquire s:settings',
        'release s:settings',
        'release s:prompts',
        'release s:categories'
      ]);
    });

    it('falls back to the in-memory queue when the runtime has no Web Locks', async () => {
      uninstall();
      const mutex = new AsyncMutex({ scope: 's' });
      // @ts-expect-error - accessing private property for testing
      const inMemory: Map<string, Promise<void>> = mutex.locks;

      await mutex.withLock('k', async () => {
        expect(inMemory.has('k')).toBe(true);
      });

      expect(inMemory.has('k')).toBe(false);
      expect(locks.log).toEqual([]);
    });

    it('falls back to the in-memory queue when request throws synchronously', async () => {
      installNavigatorLocks({
        request: () => {
          throw new Error('Web Locks are not usable here');
        }
      });
      const mutex = new AsyncMutex({ scope: 's' });

      await expect(mutex.withLock('k', async () => 'ok')).resolves.toBe('ok');
    });

    it('falls back to the in-memory queue when the API rejects the request without running the operation', async () => {
      // For example a SecurityError in an opaque origin: the promise rejects, the callback never runs
      installNavigatorLocks({
        request: () => Promise.reject(new DOMException('The request is not allowed here', 'SecurityError'))
      });
      const mutex = new AsyncMutex({ scope: 's' });
      let runs = 0;

      await expect(
        mutex.withLock('k', async () => {
          runs += 1;
          return 'ok';
        })
      ).resolves.toBe('ok');
      expect(runs).toBe(1);
    });

    it('runs an operation that throws once, and hands its error back instead of falling back', async () => {
      const mutex = new AsyncMutex({ scope: 's' });
      let runs = 0;

      await expect(
        mutex.withLock('k', async () => {
          runs += 1;
          throw new Error('boom');
        })
      ).rejects.toThrow('boom');
      expect(runs).toBe(1);
    });
  });
});
