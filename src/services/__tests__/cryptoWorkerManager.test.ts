/**
 * Tests for CryptoWorkerManager
 * Verifies web worker timeout, error handling, and lifecycle management
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import type { CryptoWorkerResponse } from '../../workers/cryptoWorker';
import { CryptoWorkerManager } from '../cryptoWorkerManager';

describe('CryptoWorkerManager', () => {
  let manager: CryptoWorkerManager;
  let mockWorker: {
    postMessage: ReturnType<typeof vi.fn>;
    terminate: ReturnType<typeof vi.fn>;
    onmessage: ((event: MessageEvent) => void) | null;
    onerror: ((event: ErrorEvent) => void) | null;
  };

  beforeEach(() => {
    // Reset singleton instance
    (CryptoWorkerManager as any).instance = null;

    // Mock Worker constructor
    mockWorker = {
      postMessage: vi.fn(),
      terminate: vi.fn(),
      onmessage: null,
      onerror: null
    };

    global.Worker = vi.fn(() => mockWorker as any) as any;

    manager = CryptoWorkerManager.getInstance();
  });

  afterEach(() => {
    manager.terminate();
    vi.clearAllMocks();
    vi.clearAllTimers();
  });

  describe('Singleton Pattern', () => {
    it('should return the same instance', () => {
      const instance1 = CryptoWorkerManager.getInstance();
      const instance2 = CryptoWorkerManager.getInstance();

      expect(instance1).toBe(instance2);
    });
  });

  describe('Worker Lifecycle', () => {
    it('should lazy-load worker on first operation', async () => {
      expect(global.Worker).not.toHaveBeenCalled();
      expect(manager.isActive()).toBe(false);

      // Start encryption operation (don't await, just trigger)
      const encryptPromise = manager.encrypt('test', 'password');

      // Worker should be created
      expect(global.Worker).toHaveBeenCalledTimes(1);
      expect(manager.isActive()).toBe(true);

      // Simulate worker response to prevent hanging promise
      const requestId = (mockWorker.postMessage as any).mock.calls[0][0].requestId;
      const response: CryptoWorkerResponse = {
        requestId,
        success: true,
        encrypted: {
          cipherText: 'encrypted',
          salt: 'salt',
          iv: 'iv'
        }
      };

      mockWorker.onmessage?.(new MessageEvent('message', { data: response }));

      await encryptPromise;
    });

    it('should reuse existing worker for subsequent operations', async () => {
      // First operation
      const promise1 = manager.encrypt('test1', 'password');
      const requestId1 = (mockWorker.postMessage as any).mock.calls[0][0].requestId;
      mockWorker.onmessage?.(new MessageEvent('message', {
        data: { requestId: requestId1, success: true, encrypted: { cipherText: 'enc1', salt: 's1', iv: 'i1' } }
      }));
      await promise1;

      expect(global.Worker).toHaveBeenCalledTimes(1);

      // Second operation
      const promise2 = manager.encrypt('test2', 'password');
      const requestId2 = (mockWorker.postMessage as any).mock.calls[1][0].requestId;
      mockWorker.onmessage?.(new MessageEvent('message', {
        data: { requestId: requestId2, success: true, encrypted: { cipherText: 'enc2', salt: 's2', iv: 'i2' } }
      }));
      await promise2;

      // Should still be just 1 worker
      expect(global.Worker).toHaveBeenCalledTimes(1);
      expect(manager.isActive()).toBe(true);
    });

    it('should terminate worker and cleanup resources', async () => {
      const promise = manager.encrypt('test', 'password');

      expect(manager.isActive()).toBe(true);
      expect(manager.getPendingCount()).toBe(1);

      manager.terminate();

      expect(mockWorker.terminate).toHaveBeenCalledTimes(1);
      expect(manager.isActive()).toBe(false);
      expect(manager.getPendingCount()).toBe(0);

      // Promise should be rejected
      await expect(promise).rejects.toThrow('Worker terminated');
    });
  });

  describe('Timeout Handling', () => {
    it('should timeout after 30 seconds', async () => {
      vi.useFakeTimers();

      const encryptPromise = manager.encrypt('test', 'password');

      expect(manager.getPendingCount()).toBe(1);

      // Fast-forward 30 seconds
      vi.advanceTimersByTime(30_000);

      await expect(encryptPromise).rejects.toThrow('Worker operation timed out');
      expect(manager.getPendingCount()).toBe(0);

      vi.useRealTimers();
    });

    it('should clear timeout when operation completes', async () => {
      vi.useFakeTimers();

      const encryptPromise = manager.encrypt('test', 'password');

      expect(manager.getPendingCount()).toBe(1);

      // Simulate quick response (before timeout)
      const requestId = (mockWorker.postMessage as any).mock.calls[0][0].requestId;
      const response: CryptoWorkerResponse = {
        requestId,
        success: true,
        encrypted: {
          cipherText: 'encrypted',
          salt: 'salt',
          iv: 'iv'
        }
      };

      mockWorker.onmessage?.(new MessageEvent('message', { data: response }));

      await encryptPromise;

      expect(manager.getPendingCount()).toBe(0);

      // Advance timer to verify timeout was cleared
      vi.advanceTimersByTime(30_000);

      // No errors should be thrown
      vi.useRealTimers();
    });

    it('should handle multiple pending operations with different timeouts', async () => {
      vi.useFakeTimers();

      const promise1 = manager.encrypt('test1', 'password');
      const promise2 = manager.encrypt('test2', 'password');
      const promise3 = manager.encrypt('test3', 'password');

      expect(manager.getPendingCount()).toBe(3);

      // Complete second operation
      const requestId2 = (mockWorker.postMessage as any).mock.calls[1][0].requestId;
      mockWorker.onmessage?.(new MessageEvent('message', {
        data: { requestId: requestId2, success: true, encrypted: { cipherText: 'enc2', salt: 's2', iv: 'i2' } }
      }));

      await promise2;
      expect(manager.getPendingCount()).toBe(2);

      // Timeout remaining operations
      vi.advanceTimersByTime(30_000);

      await expect(promise1).rejects.toThrow('Worker operation timed out');
      await expect(promise3).rejects.toThrow('Worker operation timed out');
      expect(manager.getPendingCount()).toBe(0);

      vi.useRealTimers();
    });
  });

  describe('Error Handling', () => {
    it('should handle worker errors', async () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const encryptPromise = manager.encrypt('test', 'password');

      expect(manager.getPendingCount()).toBe(1);

      // Simulate worker error
      const errorEvent = new ErrorEvent('error', {
        message: 'Worker crashed',
        error: new Error('Worker crashed')
      });

      mockWorker.onerror?.(errorEvent);

      await expect(encryptPromise).rejects.toThrow('Worker error: Worker crashed');
      expect(manager.getPendingCount()).toBe(0);

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        '[CryptoWorkerManager] Worker error:',
        errorEvent
      );

      consoleErrorSpy.mockRestore();
    });

    it('should handle worker returning error response', async () => {
      const encryptPromise = manager.encrypt('test', 'password');

      const requestId = (mockWorker.postMessage as any).mock.calls[0][0].requestId;
      const errorResponse: CryptoWorkerResponse = {
        requestId,
        success: false,
        error: 'Encryption failed: Invalid password'
      };

      mockWorker.onmessage?.(new MessageEvent('message', { data: errorResponse }));

      await expect(encryptPromise).rejects.toThrow('Encryption failed: Invalid password');
      expect(manager.getPendingCount()).toBe(0);
    });

    it('should reject all pending operations on worker error', async () => {
      const promise1 = manager.encrypt('test1', 'password');
      const promise2 = manager.decrypt({ cipherText: 'ct', salt: 's', iv: 'i' }, 'password');
      const promise3 = manager.encrypt('test3', 'password');

      expect(manager.getPendingCount()).toBe(3);

      // Trigger worker error
      const errorEvent = new ErrorEvent('error', {
        message: 'Fatal worker error',
        error: new Error('Fatal worker error')
      });

      mockWorker.onerror?.(errorEvent);

      await expect(promise1).rejects.toThrow('Worker error: Fatal worker error');
      await expect(promise2).rejects.toThrow('Worker error: Fatal worker error');
      await expect(promise3).rejects.toThrow('Worker error: Fatal worker error');

      expect(manager.getPendingCount()).toBe(0);
    });

    it('should handle response for unknown request ID gracefully', async () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      // Initialize worker first by starting an operation
      const validPromise = manager.encrypt('test', 'password');
      const validRequestId = (mockWorker.postMessage as any).mock.calls[0][0].requestId;

      // Send response for unknown request ID
      const unknownResponse: CryptoWorkerResponse = {
        requestId: 'unknown-request-id',
        success: true,
        encrypted: { cipherText: 'ct', salt: 's', iv: 'i' }
      };

      mockWorker.onmessage?.(new MessageEvent('message', { data: unknownResponse }));

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        '[CryptoWorkerManager] Received response for unknown request:',
        'unknown-request-id'
      );

      // Complete valid operation to cleanup
      mockWorker.onmessage?.(new MessageEvent('message', {
        data: { requestId: validRequestId, success: true, encrypted: { cipherText: 'ct', salt: 's', iv: 'i' } }
      }));
      await validPromise;

      consoleErrorSpy.mockRestore();
    });
  });

  describe('Encryption Operations', () => {
    it('should encrypt data successfully', async () => {
      const encryptPromise = manager.encrypt('my secret data', 'MyP@ssw0rd!');

      const requestId = (mockWorker.postMessage as any).mock.calls[0][0].requestId;
      const request = (mockWorker.postMessage as any).mock.calls[0][0];

      expect(request.type).toBe('encrypt');
      expect(request.plainText).toBe('my secret data');
      expect(request.password).toBe('MyP@ssw0rd!');

      const response: CryptoWorkerResponse = {
        requestId,
        success: true,
        encrypted: {
          cipherText: 'base64-encrypted-data',
          salt: 'base64-salt',
          iv: 'base64-iv'
        }
      };

      mockWorker.onmessage?.(new MessageEvent('message', { data: response }));

      const result = await encryptPromise;

      expect(result).toEqual({
        cipherText: 'base64-encrypted-data',
        salt: 'base64-salt',
        iv: 'base64-iv'
      });
    });

    it('should throw error if worker does not return encrypted data', async () => {
      const encryptPromise = manager.encrypt('test', 'password');

      const requestId = (mockWorker.postMessage as any).mock.calls[0][0].requestId;
      const response: any = {
        requestId,
        success: true,
        // Missing encrypted field
      };

      mockWorker.onmessage?.(new MessageEvent('message', { data: response }));

      await expect(encryptPromise).rejects.toThrow('Worker did not return encrypted data');
    });
  });

  describe('Decryption Operations', () => {
    it('should decrypt data successfully', async () => {
      const encryptedPayload = {
        cipherText: 'base64-encrypted-data',
        salt: 'base64-salt',
        iv: 'base64-iv'
      };

      const decryptPromise = manager.decrypt(encryptedPayload, 'MyP@ssw0rd!');

      const requestId = (mockWorker.postMessage as any).mock.calls[0][0].requestId;
      const request = (mockWorker.postMessage as any).mock.calls[0][0];

      expect(request.type).toBe('decrypt');
      expect(request.payload).toEqual(encryptedPayload);
      expect(request.password).toBe('MyP@ssw0rd!');

      const response: CryptoWorkerResponse = {
        requestId,
        success: true,
        plainText: 'decrypted secret data'
      };

      mockWorker.onmessage?.(new MessageEvent('message', { data: response }));

      const result = await decryptPromise;

      expect(result).toBe('decrypted secret data');
    });

    it('should throw error if worker does not return plaintext', async () => {
      const decryptPromise = manager.decrypt(
        { cipherText: 'ct', salt: 's', iv: 'i' },
        'password'
      );

      const requestId = (mockWorker.postMessage as any).mock.calls[0][0].requestId;
      const response: any = {
        requestId,
        success: true,
        // Missing plainText field
      };

      mockWorker.onmessage?.(new MessageEvent('message', { data: response }));

      await expect(decryptPromise).rejects.toThrow('Worker did not return decrypted data');
    });
  });

  describe('Request ID Generation', () => {
    it('should generate unique request IDs', async () => {
      const promise1 = manager.encrypt('test1', 'password');
      const promise2 = manager.encrypt('test2', 'password');
      const promise3 = manager.encrypt('test3', 'password');

      const requestId1 = (mockWorker.postMessage as any).mock.calls[0][0].requestId;
      const requestId2 = (mockWorker.postMessage as any).mock.calls[1][0].requestId;
      const requestId3 = (mockWorker.postMessage as any).mock.calls[2][0].requestId;

      expect(requestId1).not.toBe(requestId2);
      expect(requestId2).not.toBe(requestId3);
      expect(requestId1).not.toBe(requestId3);

      // Cleanup: respond to all requests
      [requestId1, requestId2, requestId3].forEach((id) => {
        mockWorker.onmessage?.(new MessageEvent('message', {
          data: { requestId: id, success: true, encrypted: { cipherText: 'ct', salt: 's', iv: 'i' } }
        }));
      });

      await Promise.all([promise1, promise2, promise3]);
    });
  });

  describe('Pending Count Tracking', () => {
    it('should track pending operations count', async () => {
      expect(manager.getPendingCount()).toBe(0);

      const promise1 = manager.encrypt('test1', 'password');
      expect(manager.getPendingCount()).toBe(1);

      const promise2 = manager.encrypt('test2', 'password');
      expect(manager.getPendingCount()).toBe(2);

      const promise3 = manager.decrypt({ cipherText: 'ct', salt: 's', iv: 'i' }, 'password');
      expect(manager.getPendingCount()).toBe(3);

      // Complete one operation
      const requestId1 = (mockWorker.postMessage as any).mock.calls[0][0].requestId;
      mockWorker.onmessage?.(new MessageEvent('message', {
        data: { requestId: requestId1, success: true, encrypted: { cipherText: 'ct', salt: 's', iv: 'i' } }
      }));

      await promise1;
      expect(manager.getPendingCount()).toBe(2);

      // Complete remaining operations
      const requestId2 = (mockWorker.postMessage as any).mock.calls[1][0].requestId;
      const requestId3 = (mockWorker.postMessage as any).mock.calls[2][0].requestId;

      mockWorker.onmessage?.(new MessageEvent('message', {
        data: { requestId: requestId2, success: true, encrypted: { cipherText: 'ct', salt: 's', iv: 'i' } }
      }));
      mockWorker.onmessage?.(new MessageEvent('message', {
        data: { requestId: requestId3, success: true, plainText: 'decrypted' }
      }));

      await Promise.all([promise2, promise3]);
      expect(manager.getPendingCount()).toBe(0);
    });
  });
});
