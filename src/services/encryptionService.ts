/**
 * Encryption Service
 *
 * Provides AES-256-GCM encryption and decryption for backup data protection.
 * Uses Web Crypto API with PBKDF2 key derivation for password-based encryption.
 *
 * Security Features:
 * - AES-256-GCM authenticated encryption
 * - PBKDF2 key derivation with 100,000 iterations
 * - Cryptographically secure random salt and IV generation
 * - Base64 encoding for safe storage and transport
 *
 * @module encryptionService
 */

import type { Buffer } from 'buffer';

import { cryptoWorkerManager } from './cryptoWorkerManager';

/**
 * Encrypted payload structure
 *
 * Contains all data needed to decrypt an encrypted message:
 * - cipherText: The encrypted data (base64)
 * - salt: Random salt used for key derivation (base64)
 * - iv: Initialization vector for AES-GCM (base64)
 *
 * @interface EncryptedPayload
 */
interface EncryptedPayload {
  /** Base64-encoded encrypted data */
  cipherText: string;
  /** Base64-encoded salt for PBKDF2 key derivation */
  salt: string;
  /** Base64-encoded initialization vector for AES-GCM */
  iv: string;
}

/** Encryption algorithm: AES-GCM for authenticated encryption */
const ENCRYPTION_ALGORITHM = 'AES-GCM';

/** Key length in bits: 256 bits for AES-256 */
const KEY_LENGTH = 256;

/** PBKDF2 iteration count: 100,000 for strong key derivation */
const PBKDF2_ITERATIONS = 100_000;

/** Hash algorithm for PBKDF2: SHA-256 */
const PBKDF2_DIGEST = 'SHA-256';

/** IV (initialization vector) length: 12 bytes recommended for AES-GCM */
const IV_LENGTH = 12;

/** Salt length: 16 bytes for PBKDF2 */
const SALT_LENGTH = 16;

/**
 * Threshold for automatic worker usage (100KB)
 * Data larger than this will automatically use Web Worker
 */
const WORKER_SIZE_THRESHOLD = 100 * 1024;

const encoder = new TextEncoder();
const decoder = new TextDecoder();

/**
 * Converts Uint8Array view to ArrayBuffer
 *
 * Creates a proper ArrayBuffer from a Uint8Array view by slicing the buffer
 * to ensure correct byte offset and length.
 *
 * @param {Uint8Array} view - The Uint8Array view to convert
 * @returns {ArrayBuffer} Properly sliced ArrayBuffer
 * @private
 */
const toArrayBuffer = (view: Uint8Array): ArrayBuffer => view.buffer.slice(view.byteOffset, view.byteOffset + view.byteLength) as ArrayBuffer;

/**
 * Gets the Web Crypto API instance
 *
 * @returns {Crypto} The Web Crypto API instance
 * @throws {Error} If Web Crypto API is not available
 * @private
 */
const getCrypto = (): Crypto => {
  if (typeof globalThis.crypto !== 'undefined') {
    return globalThis.crypto;
  }

  throw new Error('Web Crypto API is not available in the current environment.');
};

/**
 * Encodes ArrayBuffer to base64 string
 *
 * Cross-environment base64 encoding that works in both browser and Node.js.
 * Prefers btoa (browser) but falls back to Buffer (Node.js).
 *
 * @param {ArrayBuffer} buffer - The buffer to encode
 * @returns {string} Base64-encoded string
 * @throws {Error} If base64 encoding is not supported
 * @private
 */
const toBase64 = (buffer: ArrayBuffer): string => {
  if (typeof globalThis.btoa === 'function') {
    const byteArray = new Uint8Array(buffer);
    let binary = '';
    byteArray.forEach((byte) => {
      binary += String.fromCharCode(byte);
    });
    return globalThis.btoa(binary);
  }

  if (typeof (globalThis as { Buffer?: typeof Buffer }).Buffer !== 'undefined') {
    return (globalThis as { Buffer: typeof Buffer }).Buffer.from(buffer).toString('base64');
  }

  throw new Error('Base64 encoding not supported in this environment.');
};

/**
 * Decodes base64 string to Uint8Array
 *
 * Cross-environment base64 decoding that works in both browser and Node.js.
 * Prefers atob (browser) but falls back to Buffer (Node.js).
 *
 * @param {string} value - The base64 string to decode
 * @returns {Uint8Array} Decoded bytes
 * @throws {Error} If base64 decoding is not supported
 * @private
 */
const fromBase64 = (value: string): Uint8Array => {
  if (typeof globalThis.atob === 'function') {
    const binaryString = globalThis.atob(value);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i += 1) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes;
  }

  if (typeof (globalThis as { Buffer?: typeof Buffer }).Buffer !== 'undefined') {
    return new Uint8Array((globalThis as { Buffer: typeof Buffer }).Buffer.from(value, 'base64'));
  }

  throw new Error('Base64 decoding not supported in this environment.');
};

/**
 * Generates cryptographically secure random bytes
 *
 * Uses Web Crypto API's getRandomValues for cryptographically
 * secure random number generation.
 *
 * @param {number} length - Number of random bytes to generate
 * @returns {Uint8Array} Array of random bytes
 * @private
 */
const generateRandomBytes = (length: number): Uint8Array => {
  const cryptoObj = getCrypto();
  const bytes = new Uint8Array(length);
  cryptoObj.getRandomValues(bytes);
  return bytes;
};

/**
 * Derives encryption key from password using PBKDF2
 *
 * Uses PBKDF2 (Password-Based Key Derivation Function 2) with:
 * - 100,000 iterations for strong key derivation
 * - SHA-256 hash algorithm
 * - 256-bit key length for AES-256
 *
 * @param {string} password - The password to derive key from
 * @param {ArrayBuffer} salt - Random salt for key derivation
 * @returns {Promise<CryptoKey>} Derived encryption key
 * @private
 */
const deriveKey = async (password: string, salt: ArrayBuffer): Promise<CryptoKey> => {
  const cryptoObj = getCrypto();
  const keyMaterial = await cryptoObj.subtle.importKey(
    'raw',
    encoder.encode(password),
    { name: 'PBKDF2' },
    false,
    ['deriveKey']
  );

  return cryptoObj.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt,
      iterations: PBKDF2_ITERATIONS,
      hash: PBKDF2_DIGEST
    },
    keyMaterial,
    { name: ENCRYPTION_ALGORITHM, length: KEY_LENGTH },
    false,
    ['encrypt', 'decrypt']
  );
};

/**
 * Encryption Service
 *
 * Provides password-based encryption and decryption using industry-standard
 * cryptographic algorithms and best practices.
 *
 * Technical Specifications:
 * - Algorithm: AES-256-GCM (Galois/Counter Mode)
 * - Key Derivation: PBKDF2 with 100,000 iterations
 * - Hash Function: SHA-256
 * - IV Length: 12 bytes (AES-GCM recommended)
 * - Salt Length: 16 bytes
 *
 * Security Notes:
 * - Generates cryptographically secure random salts and IVs for each encryption
 * - Uses authenticated encryption (GCM mode) to detect tampering
 * - Does NOT enforce password strength (caller's responsibility)
 * - Works in both browser (Web Crypto API) and Node.js environments
 *
 * @class EncryptionService
 * @public
 */
export class EncryptionService {
  /**
   * Encrypts plaintext using AES-256-GCM with a password-derived key
   *
   * Process:
   * 1. Generate random salt and IV
   * 2. Derive encryption key from password using PBKDF2
   * 3. Encrypt plaintext using AES-256-GCM
   * 4. Return base64-encoded ciphertext, salt, and IV
   *
   * Web Worker Support:
   * - useWorker: true - Force use of Web Worker (non-blocking)
   * - useWorker: false - Use main thread (default)
   * - useWorker: 'auto' - Automatically use worker for data > 100KB
   *
   * IMPORTANT: This method does NOT validate password strength.
   * Use the passwordValidator utility in UI to warn users about weak passwords.
   * Users can proceed with any non-empty password.
   *
   * @param {string} plainText - The text to encrypt (any string, including unicode)
   * @param {string} password - The encryption password (any non-empty string)
   * @param {boolean | 'auto'} [useWorker=false] - Whether to use Web Worker (true/false/'auto')
   * @returns {Promise<EncryptedPayload>} Encrypted payload with ciphertext, salt, and IV
   * @throws {Error} If password is empty or Web Crypto API is unavailable
   *
   * @example
   * const service = new EncryptionService();
   * const encrypted = await service.encrypt('secret data', 'MyP@ssw0rd!');
   * // encrypted = { cipherText: '...', salt: '...', iv: '...' }
   *
   * @example
   * // Use Web Worker for large data (non-blocking UI)
   * const encrypted = await service.encrypt(largeData, 'MyP@ssw0rd!', true);
   *
   * @example
   * // Automatic worker selection based on data size
   * const encrypted = await service.encrypt(data, 'MyP@ssw0rd!', 'auto');
   *
   * @public
   */
  async encrypt(plainText: string, password: string, useWorker: boolean | 'auto' = false): Promise<EncryptedPayload> {
    if (!password) {
      throw new Error('Encryption password must not be empty.');
    }

    // Determine if we should use the worker
    let shouldUseWorker = false;
    if (useWorker === true) {
      shouldUseWorker = true;
    } else if (useWorker === 'auto') {
      const dataSize = encoder.encode(plainText).length;
      shouldUseWorker = dataSize > WORKER_SIZE_THRESHOLD;
    }

    // Delegate to worker if requested
    if (shouldUseWorker) {
      return cryptoWorkerManager.encrypt(plainText, password);
    }

    // Main thread encryption (original implementation)
    const cryptoObj = getCrypto();
    const salt = generateRandomBytes(SALT_LENGTH);
    const iv = generateRandomBytes(IV_LENGTH);

    const key = await deriveKey(password, toArrayBuffer(salt));

    const encryptedBuffer = await cryptoObj.subtle.encrypt(
      { name: ENCRYPTION_ALGORITHM, iv: toArrayBuffer(iv) },
      key,
      encoder.encode(plainText)
    );

    return {
      cipherText: toBase64(encryptedBuffer),
      salt: toBase64(toArrayBuffer(salt)),
      iv: toBase64(toArrayBuffer(iv))
    };
  }

  /**
   * Decrypts ciphertext using AES-256-GCM with a password-derived key
   *
   * Process:
   * 1. Decode base64-encoded salt, IV, and ciphertext
   * 2. Derive decryption key from password using PBKDF2 with provided salt
   * 3. Decrypt ciphertext using AES-256-GCM with provided IV
   * 4. Return decrypted plaintext
   *
   * Web Worker Support:
   * - useWorker: true - Force use of Web Worker (non-blocking)
   * - useWorker: false - Use main thread (default)
   * - useWorker: 'auto' - Automatically use worker for data > 100KB
   *
   * The password must exactly match the one used for encryption. The salt
   * ensures that the same password produces different keys each time.
   *
   * @param {EncryptedPayload} payload - Encrypted payload from encrypt()
   * @param {string} password - The decryption password (must match encryption password)
   * @param {boolean | 'auto'} [useWorker=false] - Whether to use Web Worker (true/false/'auto')
   * @returns {Promise<string>} Decrypted plaintext
   * @throws {Error} If password is empty, wrong, or payload is corrupted
   *
   * @example
   * const service = new EncryptionService();
   * const encrypted = await service.encrypt('secret data', 'MyP@ssw0rd!');
   * const decrypted = await service.decrypt(encrypted, 'MyP@ssw0rd!');
   * // decrypted === 'secret data'
   *
   * @example
   * // Use Web Worker for large data (non-blocking UI)
   * const decrypted = await service.decrypt(encryptedLargeData, 'MyP@ssw0rd!', true);
   *
   * @example
   * // Automatic worker selection based on data size
   * const decrypted = await service.decrypt(encrypted, 'MyP@ssw0rd!', 'auto');
   *
   * @public
   */
  async decrypt(payload: EncryptedPayload, password: string, useWorker: boolean | 'auto' = false): Promise<string> {
    if (!password) {
      throw new Error('Decryption password must not be empty.');
    }

    // Determine if we should use the worker
    let shouldUseWorker = false;
    if (useWorker === true) {
      shouldUseWorker = true;
    } else if (useWorker === 'auto') {
      // Estimate size from base64 ciphertext
      const estimatedSize = (payload.cipherText.length * 3) / 4;
      shouldUseWorker = estimatedSize > WORKER_SIZE_THRESHOLD;
    }

    // Delegate to worker if requested
    if (shouldUseWorker) {
      return cryptoWorkerManager.decrypt(payload, password);
    }

    // Main thread decryption (original implementation)
    const cryptoObj = getCrypto();
    const saltBytes = fromBase64(payload.salt);
    const ivBytes = fromBase64(payload.iv);
    const cipherBytes = fromBase64(payload.cipherText);

    const key = await deriveKey(password, toArrayBuffer(saltBytes));

    const decryptedBuffer = await cryptoObj.subtle.decrypt(
      { name: ENCRYPTION_ALGORITHM, iv: toArrayBuffer(ivBytes) },
      key,
      toArrayBuffer(cipherBytes)
    );

    return decoder.decode(decryptedBuffer);
  }
}

/**
 * Singleton instance of EncryptionService
 *
 * Pre-instantiated service ready for use throughout the application.
 *
 * @example
 * import { encryptionService } from './encryptionService';
 * const encrypted = await encryptionService.encrypt('data', 'password');
 *
 * @public
 */
export const encryptionService = new EncryptionService();
