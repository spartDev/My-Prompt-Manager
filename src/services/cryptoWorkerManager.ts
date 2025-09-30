/**
 * Crypto Worker Manager
 *
 * Manages Web Worker lifecycle and provides a Promise-based API for
 * offloading encryption/decryption operations to a background thread.
 *
 * Features:
 * - Lazy worker initialization (created on first use)
 * - Promise-based API with request tracking
 * - Automatic cleanup and error handling
 * - Singleton pattern for efficient worker reuse
 *
 * Usage:
 * ```typescript
 * const manager = CryptoWorkerManager.getInstance();
 * const encrypted = await manager.encrypt('data', 'password');
 * const decrypted = await manager.decrypt(encrypted, 'password');
 * manager.terminate(); // When done
 * ```
 *
 * @module cryptoWorkerManager
 */

import type {
  CryptoWorkerRequest,
  CryptoWorkerResponse,
  CryptoWorkerSuccessResponse
} from '../workers/cryptoWorker';

/**
 * Encrypted payload structure matching EncryptionService
 */
export interface EncryptedPayload {
  cipherText: string;
  salt: string;
  iv: string;
}

/**
 * Pending request tracker
 */
interface PendingRequest {
  resolve: (value: CryptoWorkerSuccessResponse) => void;
  reject: (error: Error) => void;
  timeout: ReturnType<typeof setTimeout>;
}

/**
 * Default timeout for worker operations (30 seconds)
 */
const DEFAULT_TIMEOUT_MS = 30_000;

/**
 * Crypto Worker Manager
 *
 * Singleton class that manages a Web Worker for encryption/decryption operations.
 * Provides a Promise-based API that queues requests and handles responses.
 *
 * Worker Lifecycle:
 * - Created lazily on first encrypt/decrypt call
 * - Reused for all subsequent operations
 * - Manually terminated when no longer needed
 *
 * Error Handling:
 * - Timeouts after 30 seconds per operation
 * - Rejects promises on worker errors
 * - Cleans up pending requests on termination
 *
 * @class CryptoWorkerManager
 * @public
 */
export class CryptoWorkerManager {
  private static instance: CryptoWorkerManager | null = null;
  private worker: Worker | null = null;
  private pendingRequests = new Map<string, PendingRequest>();
  private requestIdCounter = 0;

  /**
   * Private constructor for singleton pattern
   */
  private constructor() {
    // Singleton
  }

  /**
   * Gets the singleton instance of CryptoWorkerManager
   *
   * @returns {CryptoWorkerManager} Singleton instance
   * @public
   */
  public static getInstance(): CryptoWorkerManager {
    if (!CryptoWorkerManager.instance) {
      CryptoWorkerManager.instance = new CryptoWorkerManager();
    }
    return CryptoWorkerManager.instance;
  }

  /**
   * Initializes the Web Worker if not already created
   *
   * Creates a new Worker instance and sets up message/error handlers.
   * The worker is created from the cryptoWorker module.
   *
   * @private
   */
  private ensureWorker(): void {
    if (this.worker) {
      return;
    }

    this.worker = new Worker(new URL('../workers/cryptoWorker.ts', import.meta.url), {
      type: 'module'
    });

    this.worker.onmessage = (event: MessageEvent<CryptoWorkerResponse>) => {
      this.handleWorkerResponse(event.data);
    };

    this.worker.onerror = (error: ErrorEvent) => {
      console.error('[CryptoWorkerManager] Worker error:', error);
      this.rejectAllPending(new Error(`Worker error: ${error.message}`));
    };
  }

  /**
   * Handles response messages from the worker
   *
   * Matches responses to pending requests by requestId and resolves/rejects
   * the corresponding Promise.
   *
   * @param {CryptoWorkerResponse} response - Response from worker
   * @private
   */
  private handleWorkerResponse(response: CryptoWorkerResponse): void {
    const pending = this.pendingRequests.get(response.requestId);
    if (!pending) {
      console.error('[CryptoWorkerManager] Received response for unknown request:', response.requestId);
      return;
    }

    clearTimeout(pending.timeout);
    this.pendingRequests.delete(response.requestId);

    if (response.success) {
      pending.resolve(response);
    } else {
      pending.reject(new Error(response.error));
    }
  }

  /**
   * Generates a unique request ID
   *
   * @returns {string} Unique request identifier
   * @private
   */
  private generateRequestId(): string {
    this.requestIdCounter += 1;
    return `crypto-${Date.now().toString()}-${this.requestIdCounter.toString()}`;
  }

  /**
   * Sends a request to the worker and returns a Promise
   *
   * Creates a Promise that will be resolved when the worker responds.
   * Automatically times out after DEFAULT_TIMEOUT_MS.
   *
   * @param {CryptoWorkerRequest} request - Request to send to worker
   * @returns {Promise<CryptoWorkerSuccessResponse>} Promise that resolves with worker response
   * @private
   */
  private sendRequest(request: CryptoWorkerRequest): Promise<CryptoWorkerSuccessResponse> {
    this.ensureWorker();

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pendingRequests.delete(request.requestId);
        reject(new Error('Worker operation timed out'));
      }, DEFAULT_TIMEOUT_MS);

      this.pendingRequests.set(request.requestId, {
        resolve,
        reject,
        timeout
      });

      if (!this.worker) {
        reject(new Error('Worker not initialized'));
        return;
      }

      this.worker.postMessage(request);
    });
  }

  /**
   * Encrypts plaintext using the Web Worker
   *
   * Offloads encryption to a background thread to prevent UI blocking.
   * Uses AES-256-GCM with PBKDF2 key derivation (same as EncryptionService).
   *
   * @param {string} plainText - Text to encrypt
   * @param {string} password - Encryption password
   * @returns {Promise<EncryptedPayload>} Encrypted payload with ciphertext, salt, and IV
   * @throws {Error} If password is empty, worker fails, or operation times out
   *
   * @example
   * const manager = CryptoWorkerManager.getInstance();
   * const encrypted = await manager.encrypt('secret data', 'MyP@ssw0rd!');
   * // encrypted = { cipherText: '...', salt: '...', iv: '...' }
   *
   * @public
   */
  public async encrypt(plainText: string, password: string): Promise<EncryptedPayload> {
    const requestId = this.generateRequestId();

    const request: CryptoWorkerRequest = {
      requestId,
      type: 'encrypt',
      plainText,
      password
    };

    const response = await this.sendRequest(request);

    if (!response.encrypted) {
      throw new Error('Worker did not return encrypted data');
    }

    return response.encrypted;
  }

  /**
   * Decrypts ciphertext using the Web Worker
   *
   * Offloads decryption to a background thread to prevent UI blocking.
   * Uses AES-256-GCM with PBKDF2 key derivation (same as EncryptionService).
   *
   * @param {EncryptedPayload} payload - Encrypted payload from encrypt()
   * @param {string} password - Decryption password (must match encryption password)
   * @returns {Promise<string>} Decrypted plaintext
   * @throws {Error} If password is wrong, payload is corrupted, or operation times out
   *
   * @example
   * const manager = CryptoWorkerManager.getInstance();
   * const encrypted = await manager.encrypt('secret', 'MyP@ssw0rd!');
   * const decrypted = await manager.decrypt(encrypted, 'MyP@ssw0rd!');
   * // decrypted === 'secret'
   *
   * @public
   */
  public async decrypt(payload: EncryptedPayload, password: string): Promise<string> {
    const requestId = this.generateRequestId();

    const request: CryptoWorkerRequest = {
      requestId,
      type: 'decrypt',
      payload,
      password
    };

    const response = await this.sendRequest(request);

    if (!response.plainText) {
      throw new Error('Worker did not return decrypted data');
    }

    return response.plainText;
  }

  /**
   * Rejects all pending requests with an error
   *
   * Called when worker encounters a fatal error or is terminated.
   * Cleans up all pending promises to prevent memory leaks.
   *
   * @param {Error} error - Error to reject with
   * @private
   */
  private rejectAllPending(error: Error): void {
    this.pendingRequests.forEach((pending) => {
      clearTimeout(pending.timeout);
      pending.reject(error);
    });
    this.pendingRequests.clear();
  }

  /**
   * Terminates the Web Worker and cleans up resources
   *
   * Stops the worker thread and rejects all pending requests.
   * Call this when crypto operations are no longer needed.
   *
   * After termination, the worker will be recreated on next encrypt/decrypt call.
   *
   * @public
   */
  public terminate(): void {
    if (this.worker) {
      this.rejectAllPending(new Error('Worker terminated'));
      this.worker.terminate();
      this.worker = null;
    }
  }

  /**
   * Checks if worker is currently active
   *
   * @returns {boolean} True if worker is initialized
   * @public
   */
  public isActive(): boolean {
    return this.worker !== null;
  }

  /**
   * Gets count of pending operations
   *
   * Useful for debugging and monitoring worker load.
   *
   * @returns {number} Number of pending requests
   * @public
   */
  public getPendingCount(): number {
    return this.pendingRequests.size;
  }
}

/**
 * Singleton instance of CryptoWorkerManager
 *
 * Pre-instantiated manager ready for use throughout the application.
 *
 * @example
 * import { cryptoWorkerManager } from './cryptoWorkerManager';
 *
 * // Encrypt in background
 * const encrypted = await cryptoWorkerManager.encrypt('data', 'password');
 *
 * // Decrypt in background
 * const decrypted = await cryptoWorkerManager.decrypt(encrypted, 'password');
 *
 * // Clean up when done
 * cryptoWorkerManager.terminate();
 *
 * @public
 */
export const cryptoWorkerManager = CryptoWorkerManager.getInstance();
