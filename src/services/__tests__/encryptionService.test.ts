import { describe, it, expect, beforeEach } from 'vitest';

import { EncryptionService } from '../encryptionService';

describe('EncryptionService', () => {
  let service: EncryptionService;

  beforeEach(() => {
    service = new EncryptionService();
  });

  describe('encrypt', () => {
    describe('password acceptance', () => {
      it('should reject empty password', async () => {
        await expect(service.encrypt('test data', '')).rejects.toThrow('must not be empty');
      });

      it('should accept weak passwords (non-blocking)', async () => {
        const weakPasswords = [
          'Short1!',
          'lowercase123!@#',
          'UPPERCASE123!@#',
          'NoNumbersHere!@#',
          'NoSpecials123ABC',
          'password123',
          'weak'
        ];

        for (const password of weakPasswords) {
          const result = await service.encrypt('test data', password);
          expect(result).toBeDefined();
          expect(result.cipherText).toBeDefined();
          expect(result.salt).toBeDefined();
          expect(result.iv).toBeDefined();
        }
      });

      it('should accept strong password', async () => {
        const result = await service.encrypt('test data', 'MyStr0ng!Pass');
        expect(result).toBeDefined();
        expect(result.cipherText).toBeDefined();
        expect(result.salt).toBeDefined();
        expect(result.iv).toBeDefined();
      });
    });

    describe('encryption functionality', () => {
      const validPassword = 'MyStr0ng!Pass';

      it('should return encrypted payload with all required fields', async () => {
        const result = await service.encrypt('test data', validPassword);

        expect(result).toHaveProperty('cipherText');
        expect(result).toHaveProperty('salt');
        expect(result).toHaveProperty('iv');
        expect(typeof result.cipherText).toBe('string');
        expect(typeof result.salt).toBe('string');
        expect(typeof result.iv).toBe('string');
      });

      it('should produce different ciphertext for same input (due to random IV)', async () => {
        const plainText = 'test data';
        const result1 = await service.encrypt(plainText, validPassword);
        const result2 = await service.encrypt(plainText, validPassword);

        expect(result1.cipherText).not.toBe(result2.cipherText);
        expect(result1.iv).not.toBe(result2.iv);
        expect(result1.salt).not.toBe(result2.salt);
      });

      it('should encrypt different data differently', async () => {
        const result1 = await service.encrypt('test data 1', validPassword);
        const result2 = await service.encrypt('test data 2', validPassword);

        expect(result1.cipherText).not.toBe(result2.cipherText);
      });

      it('should handle empty plaintext', async () => {
        const result = await service.encrypt('', validPassword);
        expect(result.cipherText).toBeDefined();
      });

      it('should handle large plaintext', async () => {
        const largePlaintext = 'x'.repeat(1000000); // 1MB
        const result = await service.encrypt(largePlaintext, validPassword);
        expect(result.cipherText).toBeDefined();
        expect(result.cipherText.length).toBeGreaterThan(0);
      });

      it('should handle special characters in plaintext', async () => {
        const specialText = '!@#$%^&*()_+-=[]{}|;:,.<>?/~`\'"\\';
        const result = await service.encrypt(specialText, validPassword);
        expect(result.cipherText).toBeDefined();
      });

      it('should handle unicode characters in plaintext', async () => {
        const unicodeText = 'Hello 世界 🌍 Привет';
        const result = await service.encrypt(unicodeText, validPassword);
        expect(result.cipherText).toBeDefined();
      });

      it('should produce base64 encoded output', async () => {
        const result = await service.encrypt('test', validPassword);

        // Base64 regex pattern
        const base64Pattern = /^[A-Za-z0-9+/]*={0,2}$/;
        expect(base64Pattern.test(result.cipherText)).toBe(true);
        expect(base64Pattern.test(result.salt)).toBe(true);
        expect(base64Pattern.test(result.iv)).toBe(true);
      });
    });
  });

  describe('decrypt', () => {
    const validPassword = 'MyStr0ng!Pass';

    it('should reject empty password', async () => {
      const encrypted = await service.encrypt('test', validPassword);
      await expect(service.decrypt(encrypted, '')).rejects.toThrow('must not be empty');
    });

    it('should successfully decrypt encrypted data', async () => {
      const plainText = 'test data';
      const encrypted = await service.encrypt(plainText, validPassword);
      const decrypted = await service.decrypt(encrypted, validPassword);

      expect(decrypted).toBe(plainText);
    });

    it('should decrypt empty string', async () => {
      const encrypted = await service.encrypt('', validPassword);
      const decrypted = await service.decrypt(encrypted, validPassword);
      expect(decrypted).toBe('');
    });

    it('should decrypt large data', async () => {
      const largePlaintext = 'x'.repeat(1000000);
      const encrypted = await service.encrypt(largePlaintext, validPassword);
      const decrypted = await service.decrypt(encrypted, validPassword);

      expect(decrypted).toBe(largePlaintext);
    });

    it('should decrypt special characters', async () => {
      const specialText = '!@#$%^&*()_+-=[]{}|;:,.<>?/~`\'"\\';
      const encrypted = await service.encrypt(specialText, validPassword);
      const decrypted = await service.decrypt(encrypted, validPassword);

      expect(decrypted).toBe(specialText);
    });

    it('should decrypt unicode characters', async () => {
      const unicodeText = 'Hello 世界 🌍 Привет';
      const encrypted = await service.encrypt(unicodeText, validPassword);
      const decrypted = await service.decrypt(encrypted, validPassword);

      expect(decrypted).toBe(unicodeText);
    });

    it('should fail with wrong password', async () => {
      const plainText = 'test data';
      const encrypted = await service.encrypt(plainText, validPassword);

      await expect(service.decrypt(encrypted, 'Wr0ngP@ssw0rd!')).rejects.toThrow();
    });

    it('should fail with corrupted ciphertext', async () => {
      const encrypted = await service.encrypt('test', validPassword);
      const corrupted = {
        ...encrypted,
        cipherText: encrypted.cipherText.slice(0, -5) + 'XXXXX'
      };

      await expect(service.decrypt(corrupted, validPassword)).rejects.toThrow();
    });

    it('should fail with corrupted salt', async () => {
      const encrypted = await service.encrypt('test', validPassword);
      const corrupted = {
        ...encrypted,
        salt: 'invalid-salt-value'
      };

      await expect(service.decrypt(corrupted, validPassword)).rejects.toThrow();
    });

    it('should fail with corrupted IV', async () => {
      const encrypted = await service.encrypt('test', validPassword);
      const corrupted = {
        ...encrypted,
        iv: 'invalid-iv-value'
      };

      await expect(service.decrypt(corrupted, validPassword)).rejects.toThrow();
    });

    it('should handle multiple encrypt/decrypt cycles', async () => {
      let data = 'original data';

      for (let i = 0; i < 5; i++) {
        const encrypted = await service.encrypt(data, validPassword);
        const decrypted = await service.decrypt(encrypted, validPassword);
        expect(decrypted).toBe(data);
        data = decrypted;
      }
    });
  });

  describe('encryption roundtrip', () => {
    const validPassword = 'MyStr0ng!Pass';

    it('should maintain data integrity through encrypt/decrypt cycle', async () => {
      const testCases = [
        'simple text',
        'Text with numbers 123456',
        'Special chars !@#$%^&*()',
        'Unicode 世界 🌍',
        'Multi\nLine\nText',
        'Tabs\tand\tspaces',
        JSON.stringify({ key: 'value', nested: { data: [1, 2, 3] } }),
        'x'.repeat(10000) // Large text
      ];

      for (const testCase of testCases) {
        const encrypted = await service.encrypt(testCase, validPassword);
        const decrypted = await service.decrypt(encrypted, validPassword);
        expect(decrypted).toBe(testCase);
      }
    });

    it('should work with different passwords including weak ones', async () => {
      const passwords = [
        'MyStr0ng!Pass', // Strong
        'An0therV@lidP@ss', // Strong
        'weak', // Weak but allowed
        'password', // Common but allowed
        '123' // Very weak but allowed
      ];

      for (const password of passwords) {
        const plainText = 'test data';
        const encrypted = await service.encrypt(plainText, password);
        const decrypted = await service.decrypt(encrypted, password);
        expect(decrypted).toBe(plainText);
      }
    });

    it('should fail to decrypt with different password', async () => {
      const plainText = 'test data';
      const password1 = 'MyStr0ng!Pass';
      const password2 = 'Diff3rent!Pass';

      const encrypted = await service.encrypt(plainText, password1);
      await expect(service.decrypt(encrypted, password2)).rejects.toThrow();
    });
  });

  describe('security properties', () => {
    const validPassword = 'MyStr0ng!Pass';

    it('should generate unique salt for each encryption', async () => {
      const salts = new Set<string>();
      for (let i = 0; i < 10; i++) {
        const result = await service.encrypt('test', validPassword);
        salts.add(result.salt);
      }
      expect(salts.size).toBe(10); // All should be unique
    });

    it('should generate unique IV for each encryption', async () => {
      const ivs = new Set<string>();
      for (let i = 0; i < 10; i++) {
        const result = await service.encrypt('test', validPassword);
        ivs.add(result.iv);
      }
      expect(ivs.size).toBe(10); // All should be unique
    });
  });
});
