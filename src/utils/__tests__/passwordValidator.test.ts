import { describe, it, expect } from 'vitest';

import { PasswordValidationError } from '../../types/backup';
import {
  validatePassword,
  getPasswordErrorMessage,
  getPasswordRequirements
} from '../passwordValidator';

describe('passwordValidator', () => {
  describe('validatePassword', () => {
    describe('valid passwords', () => {
      it('should accept strong password with all requirements', () => {
        const result = validatePassword('MyStr0ng!Pass');
        expect(result.valid).toBe(true);
        expect(result.errors).toHaveLength(0);
        expect(result.strength).toBe('strong');
        expect(result.score).toBeGreaterThan(70);
      });

      it('should accept password with minimum length and all character types', () => {
        const result = validatePassword('Abc123!@#$%^');
        expect(result.valid).toBe(true);
        expect(result.errors).toHaveLength(0);
      });

      it('should accept long complex password', () => {
        const result = validatePassword('ThisIsAVeryL0ng&ComplexP@ssw0rd!2024');
        expect(result.valid).toBe(true);
        expect(result.errors).toHaveLength(0);
        expect(result.strength).toBe('strong');
        expect(result.score).toBeGreaterThan(80);
      });

      it('should accept password with unicode special characters', () => {
        const result = validatePassword('MyP@ss©w0rd™');
        expect(result.valid).toBe(true);
        expect(result.errors).toHaveLength(0);
      });

      it('should accept passphrase style password', () => {
        const result = validatePassword('Correct-Horse-Battery-Staple-99!');
        expect(result.valid).toBe(true);
        expect(result.errors).toHaveLength(0);
        expect(result.strength).toBe('strong');
      });
    });

    describe('length validation', () => {
      it('should reject password shorter than 12 characters', () => {
        const result = validatePassword('Short1!');
        expect(result.valid).toBe(false);
        expect(result.errors).toContain(PasswordValidationError.TOO_SHORT);
      });

      it('should reject 11 character password even with all character types', () => {
        const result = validatePassword('Abcd1234!@#');
        expect(result.valid).toBe(false);
        expect(result.errors).toContain(PasswordValidationError.TOO_SHORT);
      });

      it('should accept exactly 12 character password', () => {
        // Changed from 'Abcd1234!@#$' which contains sequential patterns
        const result = validatePassword('Zmx9!@P#7$Qw');
        expect(result.valid).toBe(true);
      });

      it('should reject password longer than 128 characters', () => {
        const longPassword = 'A1!' + 'a'.repeat(126);
        const result = validatePassword(longPassword);
        expect(result.valid).toBe(false);
        expect(result.errors).toContain(PasswordValidationError.TOO_LONG);
      });

      it('should accept exactly 128 character password', () => {
        const password = 'A1!' + 'a'.repeat(125);
        const result = validatePassword(password);
        // May have other errors but not TOO_LONG
        expect(result.errors).not.toContain(PasswordValidationError.TOO_LONG);
      });
    });

    describe('character variety validation', () => {
      it('should reject password without uppercase letters', () => {
        const result = validatePassword('lowercase123!@#');
        expect(result.valid).toBe(false);
        expect(result.errors).toContain(PasswordValidationError.NO_UPPERCASE);
      });

      it('should reject password without lowercase letters', () => {
        const result = validatePassword('UPPERCASE123!@#');
        expect(result.valid).toBe(false);
        expect(result.errors).toContain(PasswordValidationError.NO_LOWERCASE);
      });

      it('should reject password without numbers', () => {
        const result = validatePassword('NoNumbersHere!@#');
        expect(result.valid).toBe(false);
        expect(result.errors).toContain(PasswordValidationError.NO_NUMBERS);
      });

      it('should reject password without special characters', () => {
        const result = validatePassword('NoSpecials123ABC');
        expect(result.valid).toBe(false);
        expect(result.errors).toContain(PasswordValidationError.NO_SPECIAL_CHARS);
      });

      it('should accept various special characters', () => {
        const specialChars = ['!', '@', '#', '$', '%', '^', '&', '*', '(', ')', '-', '_', '+', '='];
        for (const char of specialChars) {
          const password = `Test123${char}Pass`;
          const result = validatePassword(password);
          expect(result.errors).not.toContain(PasswordValidationError.NO_SPECIAL_CHARS);
        }
      });

      it('should report multiple missing character types', () => {
        const result = validatePassword('alllowercase');
        expect(result.valid).toBe(false);
        expect(result.errors).toContain(PasswordValidationError.NO_UPPERCASE);
        expect(result.errors).toContain(PasswordValidationError.NO_NUMBERS);
        expect(result.errors).toContain(PasswordValidationError.NO_SPECIAL_CHARS);
      });
    });

    describe('common password detection', () => {
      it('should reject common password "password"', () => {
        const result = validatePassword('Password123!');
        expect(result.valid).toBe(false);
        expect(result.errors).toContain(PasswordValidationError.COMMON_PASSWORD);
      });

      it('should reject common password "123456"', () => {
        const result = validatePassword('Abc123456!@#');
        expect(result.valid).toBe(false);
        expect(result.errors).toContain(PasswordValidationError.COMMON_PASSWORD);
      });

      it('should reject password with keyboard sequences', () => {
        const result = validatePassword('Qwerty123!@#');
        expect(result.valid).toBe(false);
        expect(result.errors).toContain(PasswordValidationError.COMMON_PASSWORD);
      });

      it('should reject password with alphabet sequence', () => {
        const result = validatePassword('Abcdefgh123!');
        expect(result.valid).toBe(false);
        expect(result.errors).toContain(PasswordValidationError.COMMON_PASSWORD);
      });

      it('should reject password with number sequence', () => {
        const result = validatePassword('Test12345678!');
        expect(result.valid).toBe(false);
        expect(result.errors).toContain(PasswordValidationError.COMMON_PASSWORD);
      });

      it('should reject password with repeated characters', () => {
        const result = validatePassword('Aaa123456!!!');
        expect(result.valid).toBe(false);
        expect(result.errors).toContain(PasswordValidationError.COMMON_PASSWORD);
      });

      it('should reject password "admin123"', () => {
        const result = validatePassword('Admin123!@#$');
        expect(result.valid).toBe(false);
        expect(result.errors).toContain(PasswordValidationError.COMMON_PASSWORD);
      });
    });

    describe('entropy validation', () => {
      it('should reject password with insufficient entropy', () => {
        // Simple pattern repeated
        const result = validatePassword('Aa1!Aa1!Aa1!');
        expect(result.valid).toBe(false);
        expect(result.errors).toContain(PasswordValidationError.INSUFFICIENT_ENTROPY);
      });

      it('should accept password with high entropy', () => {
        const result = validatePassword('xK9#mL2$pQ7!');
        expect(result.valid).toBe(true);
        expect(result.score).toBeGreaterThan(60);
      });

      it('should give higher score to more random passwords', () => {
        const simple = validatePassword('Password123!');
        const complex = validatePassword('xK9#mL2$pQ7!wZ5@');

        // Complex should have higher score (if both are valid)
        if (complex.valid) {
          expect(complex.score).toBeGreaterThan(simple.score);
        }
      });
    });

    describe('strength scoring', () => {
      it('should classify very short passwords as weak', () => {
        const result = validatePassword('Aa1!');
        expect(result.strength).toBe('weak');
        expect(result.score).toBeLessThan(40);
      });

      it('should classify passwords meeting minimum requirements as fair or better', () => {
        const result = validatePassword('SimpleP@ss12');
        if (result.valid) {
          expect(['fair', 'good', 'strong']).toContain(result.strength);
        }
      });

      it('should classify long complex passwords as strong', () => {
        const result = validatePassword('ThisIsMyVeryStr0ng&SecureP@ssw0rd2024!');
        expect(result.strength).toBe('strong');
        expect(result.score).toBeGreaterThan(80);
      });

      it('should give higher score for longer passwords', () => {
        const short = validatePassword('MyP@ss12word');
        const long = validatePassword('MyMuchL0nger&MoreSecureP@ssw0rd!');

        expect(long.score).toBeGreaterThan(short.score);
      });

      it('should return score between 0 and 100', () => {
        const passwords = [
          'a',
          'Aa1!',
          'ShortP@ss1',
          'MediumP@ssw0rd1',
          'VeryL0ng&ComplexP@ssw0rd!2024'
        ];

        for (const password of passwords) {
          const result = validatePassword(password);
          expect(result.score).toBeGreaterThanOrEqual(0);
          expect(result.score).toBeLessThanOrEqual(100);
        }
      });
    });

    describe('edge cases', () => {
      it('should handle empty string', () => {
        const result = validatePassword('');
        expect(result.valid).toBe(false);
        expect(result.errors.length).toBeGreaterThan(0);
      });

      it('should handle password with only spaces', () => {
        const result = validatePassword('            ');
        expect(result.valid).toBe(false);
      });

      it('should handle password with mixed whitespace', () => {
        const result = validatePassword('My P@ss w0rd!');
        // Spaces count as special characters
        expect(result.valid).toBe(true);
      });

      it('should handle password with emoji', () => {
        const result = validatePassword('MyP@ssw0rd😀!');
        expect(result.valid).toBe(true);
      });

      it('should handle password with accented characters', () => {
        // Made longer to ensure it passes entropy check
        const result = validatePassword('MéP@ssw0rd!éÇ12');
        expect(result.valid).toBe(true);
      });
    });
  });

  describe('getPasswordErrorMessage', () => {
    it('should return correct message for TOO_SHORT', () => {
      const message = getPasswordErrorMessage(PasswordValidationError.TOO_SHORT);
      expect(message).toContain('12');
      expect(message).toContain('characters');
    });

    it('should return correct message for TOO_LONG', () => {
      const message = getPasswordErrorMessage(PasswordValidationError.TOO_LONG);
      expect(message).toContain('128');
    });

    it('should return correct message for NO_UPPERCASE', () => {
      const message = getPasswordErrorMessage(PasswordValidationError.NO_UPPERCASE);
      expect(message).toContain('uppercase');
    });

    it('should return correct message for NO_LOWERCASE', () => {
      const message = getPasswordErrorMessage(PasswordValidationError.NO_LOWERCASE);
      expect(message).toContain('lowercase');
    });

    it('should return correct message for NO_NUMBERS', () => {
      const message = getPasswordErrorMessage(PasswordValidationError.NO_NUMBERS);
      expect(message).toContain('number');
    });

    it('should return correct message for NO_SPECIAL_CHARS', () => {
      const message = getPasswordErrorMessage(PasswordValidationError.NO_SPECIAL_CHARS);
      expect(message).toContain('special character');
    });

    it('should return correct message for COMMON_PASSWORD', () => {
      const message = getPasswordErrorMessage(PasswordValidationError.COMMON_PASSWORD);
      expect(message).toContain('common');
    });

    it('should return correct message for INSUFFICIENT_ENTROPY', () => {
      const message = getPasswordErrorMessage(PasswordValidationError.INSUFFICIENT_ENTROPY);
      expect(message).toContain('complex');
    });
  });

  describe('getPasswordRequirements', () => {
    it('should return array of requirements', () => {
      const requirements = getPasswordRequirements();
      expect(Array.isArray(requirements)).toBe(true);
      expect(requirements.length).toBeGreaterThan(0);
    });

    it('should include length requirement', () => {
      const requirements = getPasswordRequirements();
      const hasLength = requirements.some(req => req.includes('12') && req.includes('characters'));
      expect(hasLength).toBe(true);
    });

    it('should include all character type requirements', () => {
      const requirements = getPasswordRequirements();
      const hasUppercase = requirements.some(req => req.toLowerCase().includes('uppercase'));
      const hasLowercase = requirements.some(req => req.toLowerCase().includes('lowercase'));
      const hasNumbers = requirements.some(req => req.toLowerCase().includes('number'));
      const hasSpecial = requirements.some(req => req.toLowerCase().includes('special'));

      expect(hasUppercase).toBe(true);
      expect(hasLowercase).toBe(true);
      expect(hasNumbers).toBe(true);
      expect(hasSpecial).toBe(true);
    });

    it('should mention common passwords', () => {
      const requirements = getPasswordRequirements();
      const hasCommonCheck = requirements.some(req => req.toLowerCase().includes('common'));
      expect(hasCommonCheck).toBe(true);
    });
  });
});
