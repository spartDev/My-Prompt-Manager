/**
 * Crypto Web Worker
 *
 * Handles CPU-intensive encryption and decryption operations in a separate thread
 * to prevent blocking the main UI thread. Uses the same AES-256-GCM encryption
 * as the main EncryptionService.
 *
 * Benefits:
 * - Non-blocking UI during large backup encryption/decryption
 * - Better UX for encrypted operations
 * - Parallel processing capability
 *
 * Communication:
 * - Main thread sends encrypt/decrypt requests via postMessage
 * - Worker responds with results or errors
 * - Each operation has a unique requestId for tracking
 *
 * @module cryptoWorker
 */

/**
 * Message types for worker communication
 */
export type CryptoWorkerRequestType = 'encrypt' | 'decrypt';

/**
 * Request message from main thread to worker
 */
export interface CryptoWorkerRequest {
  /** Unique identifier for this request */
  requestId: string;
  /** Operation type */
  type: CryptoWorkerRequestType;
  /** Data to encrypt (for encrypt operation) */
  plainText?: string;
  /** Encrypted payload (for decrypt operation) */
  payload?: {
    cipherText: string;
    salt: string;
    iv: string;
  };
  /** Password for encryption/decryption */
  password: string;
}

/**
 * Success response from worker to main thread
 */
export interface CryptoWorkerSuccessResponse {
  /** Request ID this response corresponds to */
  requestId: string;
  /** Whether operation succeeded */
  success: true;
  /** Encrypted result (for encrypt operation) */
  encrypted?: {
    cipherText: string;
    salt: string;
    iv: string;
  };
  /** Decrypted plaintext (for decrypt operation) */
  plainText?: string;
}

/**
 * Error response from worker to main thread
 */
export interface CryptoWorkerErrorResponse {
  /** Request ID this response corresponds to */
  requestId: string;
  /** Whether operation succeeded */
  success: false;
  /** Error message */
  error: string;
}

export type CryptoWorkerResponse = CryptoWorkerSuccessResponse | CryptoWorkerErrorResponse;

// ============================================================================
// Worker Implementation
// ============================================================================

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

const encoder = new TextEncoder();
const decoder = new TextDecoder();

/**
 * Converts Uint8Array to ArrayBuffer
 */
const toArrayBuffer = (view: Uint8Array): ArrayBuffer =>
  view.buffer.slice(view.byteOffset, view.byteOffset + view.byteLength) as ArrayBuffer;

/**
 * Encodes ArrayBuffer to base64 string
 */
const toBase64 = (buffer: ArrayBuffer): string => {
  const byteArray = new Uint8Array(buffer);
  let binary = '';
  byteArray.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return globalThis.btoa(binary);
};

/**
 * Decodes base64 string to Uint8Array
 */
const fromBase64 = (value: string): Uint8Array => {
  const binaryString = globalThis.atob(value);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i += 1) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
};

/**
 * Generates cryptographically secure random bytes
 */
const generateRandomBytes = (length: number): Uint8Array => {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  return bytes;
};

/**
 * Derives encryption key from password using PBKDF2
 */
const deriveKey = async (password: string, salt: ArrayBuffer): Promise<CryptoKey> => {
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    encoder.encode(password),
    { name: 'PBKDF2' },
    false,
    ['deriveKey']
  );

  return crypto.subtle.deriveKey(
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
 * Encrypts plaintext using AES-256-GCM
 */
const encrypt = async (plainText: string, password: string): Promise<{ cipherText: string; salt: string; iv: string }> => {
  if (!password) {
    throw new Error('Encryption password must not be empty.');
  }

  const salt = generateRandomBytes(SALT_LENGTH);
  const iv = generateRandomBytes(IV_LENGTH);
  const key = await deriveKey(password, toArrayBuffer(salt));

  const encryptedBuffer = await crypto.subtle.encrypt(
    { name: ENCRYPTION_ALGORITHM, iv: toArrayBuffer(iv) },
    key,
    encoder.encode(plainText)
  );

  return {
    cipherText: toBase64(encryptedBuffer),
    salt: toBase64(toArrayBuffer(salt)),
    iv: toBase64(toArrayBuffer(iv))
  };
};

/**
 * Decrypts ciphertext using AES-256-GCM
 */
const decrypt = async (
  payload: { cipherText: string; salt: string; iv: string },
  password: string
): Promise<string> => {
  if (!password) {
    throw new Error('Decryption password must not be empty.');
  }

  const saltBytes = fromBase64(payload.salt);
  const ivBytes = fromBase64(payload.iv);
  const cipherBytes = fromBase64(payload.cipherText);

  const key = await deriveKey(password, toArrayBuffer(saltBytes));

  const decryptedBuffer = await crypto.subtle.decrypt(
    { name: ENCRYPTION_ALGORITHM, iv: toArrayBuffer(ivBytes) },
    key,
    toArrayBuffer(cipherBytes)
  );

  return decoder.decode(decryptedBuffer);
};

/**
 * Handles incoming messages from main thread
 */
const handleMessage = async (request: CryptoWorkerRequest): Promise<void> => {
  const { requestId, type } = request;

  try {
    if (type === 'encrypt') {
      if (!request.plainText) {
        throw new Error('plainText is required for encrypt operation');
      }

      const result = await encrypt(request.plainText, request.password);

      const response: CryptoWorkerSuccessResponse = {
        requestId,
        success: true,
        encrypted: result
      };

      self.postMessage(response);
    } else {
      // type === 'decrypt'
      if (!request.payload) {
        throw new Error('payload is required for decrypt operation');
      }

      const result = await decrypt(request.payload, request.password);

      const response: CryptoWorkerSuccessResponse = {
        requestId,
        success: true,
        plainText: result
      };

      self.postMessage(response);
    }
  } catch (error) {
    const errorResponse: CryptoWorkerErrorResponse = {
      requestId,
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };

    self.postMessage(errorResponse);
  }
};

/**
 * Message handler for worker
 */
self.addEventListener('message', (event: MessageEvent<CryptoWorkerRequest>) => {
  void handleMessage(event.data);
});
