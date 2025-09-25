import type { Buffer } from 'buffer';

interface EncryptedPayload {
  cipherText: string; // base64 encoded
  salt: string; // base64 encoded
  iv: string; // base64 encoded
}

const ENCRYPTION_ALGORITHM = 'AES-GCM';
const KEY_LENGTH = 256;
const PBKDF2_ITERATIONS = 100_000;
const PBKDF2_DIGEST = 'SHA-256';
const IV_LENGTH = 12; // AES-GCM recommended
const SALT_LENGTH = 16;

const encoder = new TextEncoder();
const decoder = new TextDecoder();

const toArrayBuffer = (view: Uint8Array): ArrayBuffer => view.buffer.slice(view.byteOffset, view.byteOffset + view.byteLength) as ArrayBuffer;

const getCrypto = (): Crypto => {
  if (typeof globalThis.crypto !== 'undefined') {
    return globalThis.crypto;
  }

  throw new Error('Web Crypto API is not available in the current environment.');
};

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

const generateRandomBytes = (length: number): Uint8Array => {
  const cryptoObj = getCrypto();
  const bytes = new Uint8Array(length);
  cryptoObj.getRandomValues(bytes);
  return bytes;
};

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

export class EncryptionService {
  async encrypt(plainText: string, password: string): Promise<EncryptedPayload> {
    if (!password) {
      throw new Error('Encryption password must not be empty.');
    }

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

  async decrypt(payload: EncryptedPayload, password: string): Promise<string> {
    if (!password) {
      throw new Error('Decryption password must not be empty.');
    }

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

export const encryptionService = new EncryptionService();
