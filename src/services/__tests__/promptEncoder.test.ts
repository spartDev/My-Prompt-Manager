/**
 * @vitest-environment jsdom
 *
 * jsdom, not happy-dom: happy-dom keeps <script> text when DOMPurify >=3.4.12
 * strips tags, so XSS assertions would fail although real browsers strip it.
 */
import LZString from 'lz-string';
import { describe, it, expect } from 'vitest';

import { testEncoderRoundtrip } from '../../test/helpers/encoder-helpers';
import type { Prompt } from '../../types';
import { encode, decode } from '../promptEncoder';

// Helper to create test prompt
function createTestPrompt(overrides: Partial<Prompt> = {}): Prompt {
  return {
    id: 'test-id',
    title: 'Test Prompt',
    content: 'This is a test prompt',
    category: 'Test Category',
    createdAt: Date.now(),
    updatedAt: Date.now(),
    ...overrides,
  };
}

// Helper to capture thrown error for property assertions
function captureError(fn: () => void): Error {
  try {
    fn();
    throw new Error('Expected function to throw');
  } catch (err) {
    return err as Error;
  }
}

describe('PromptEncoder', () => {
  describe('Verbatim', () => {
    it('should carry tags, "metadata:" and surrounding whitespace through a round trip unchanged', () => {
      const prompt = createTestPrompt({
        title: '  Onboarding <helper>  ',
        content: '\n  Summarize the metadata: use <example>text</example> tags; if count=5 and onboarding = true\n\n',
        category: ' <b>Work</b> ',
      });

      const decoded = decode(encode(prompt));

      expect(decoded).toEqual({
        title: prompt.title,
        content: prompt.content,
        category: prompt.category,
      });
    });
  });

  describe('encode', () => {
    it('should encode a valid prompt', () => {
      const prompt = createTestPrompt();
      const encoded = encode(prompt);
      expect(encoded).toBeTruthy();
      expect(typeof encoded).toBe('string');
    });

    it('should produce URL-safe string', () => {
      const prompt = createTestPrompt();
      const encoded = encode(prompt);
      expect(encoded).toBeTruthy();
      expect(typeof encoded).toBe('string');
      // Verify no unsafe characters
      expect(encoded).not.toMatch(/[\s<>"{}|\\^`]/);
    });

    it('should not strip HTML-like tags from any field', () => {
      const prompt = createTestPrompt({
        title: '<script>alert("xss")</script>Test',
        content: '<b>Bold</b> content',
        category: '<img src=x>Cat',
      });
      const decoded = decode(encode(prompt));
      expect(decoded.title).toBe('<script>alert("xss")</script>Test');
      expect(decoded.content).toBe('<b>Bold</b> content');
      expect(decoded.category).toBe('<img src=x>Cat');
    });

    it('should not trim whitespace from any field', () => {
      const prompt = createTestPrompt({
        title: '   Test   ',
        content: '   Content   ',
        category: '   Cat   ',
      });
      const decoded = decode(encode(prompt));
      expect(decoded.title).toBe('   Test   ');
      expect(decoded.content).toBe('   Content   ');
      expect(decoded.category).toBe('   Cat   ');
    });

    it('should encode the fields exactly as given, leaving emptiness and length to Admission', () => {
      const prompt = createTestPrompt({ title: '', content: ` ${'x'.repeat(25_000)} `, category: 'x'.repeat(100) });

      expect(decode(encode(prompt))).toEqual({
        title: '',
        content: prompt.content,
        category: prompt.category,
      });
    });

    it('should throw when the encoded code would be too large to share', () => {
      // Incompressible text: every character is different from its neighbours
      let seed = 1;
      const noise = Array.from({ length: 60_000 }, () => {
        seed = (seed * 48_271) % 2_147_483_647;
        return String.fromCharCode(33 + (seed % 90));
      }).join('');
      const prompt = createTestPrompt({ content: noise });

      expect(() => encode(prompt)).toThrow('Prompt too large to share');
      expect(captureError(() => encode(prompt))).toHaveProperty('name', 'PromptEncoderError');
    });

    it('should produce compressed output', () => {
      const prompt = createTestPrompt({
        content: 'A'.repeat(1000),
      });
      const encoded = encode(prompt);
      const uncompressed = JSON.stringify(prompt);
      // Encoded should be significantly smaller
      expect(encoded.length).toBeLessThan(uncompressed.length / 2);
    });
  });

  describe('Pinned Prompts', () => {
    it('should not carry the pinned flag in a share link', () => {
      const encoded = encode(createTestPrompt({ pinned: true }));
      const payload = JSON.parse(LZString.decompressFromEncodedURIComponent(encoded)) as Record<string, unknown>;
      expect(payload).not.toHaveProperty('pinned');
      expect(decode(encoded)).not.toHaveProperty('pinned');
    });
  });

  describe('decode', () => {
    it('should decode a valid encoded string', () => {
      const prompt = createTestPrompt();
      const encoded = encode(prompt);
      const decoded = decode(encoded);
      expect(decoded.title).toBe(prompt.title);
      expect(decoded.content).toBe(prompt.content);
      expect(decoded.category).toBe(prompt.category);
    });

    it('should handle round-trip encoding/decoding', () => {
      const prompt = createTestPrompt({
        title: 'Complex Title',
        content: 'Complex content with special chars: !@#$%^*()',
        category: 'Complex Category',
      });
      testEncoderRoundtrip(prompt);
    });

    it('should throw PromptEncoderError for invalid encoded string', () => {
      expect(() => decode('invalid')).toThrow('Invalid sharing code format');
      const err = captureError(() => decode('invalid'));
      expect(err).toHaveProperty('type', 'DATA_CORRUPTION');
      expect(err).toHaveProperty('name', 'PromptEncoderError');
    });

    it('should throw PromptEncoderError for corrupted encoded string', () => {
      const prompt = createTestPrompt();
      const encoded = encode(prompt);
      const corrupted = encoded.slice(0, -10);
      expect(() => decode(corrupted)).toThrow();
    });

    it('should return the fields exactly as encoded, leaving emptiness and length to Admission', () => {
      const payload = {
        title: '',
        content: `\n ${'A'.repeat(25_000)} \n`,
        category: 'x'.repeat(100),
      };
      const encoded = LZString.compressToEncodedURIComponent(JSON.stringify(payload));

      expect(decode(encoded)).toEqual(payload);
    });

    it('should return only title, content and category, and keep hidden characters for Admission to remove', () => {
      const payload = {
        title: 'Zero\u{200B}width',
        content: 'Tag\u{E0041} and bidi\u{202E} <script>alert(1)</script>',
        category: 'Cat',
        isAdmin: true,
      };
      const encoded = LZString.compressToEncodedURIComponent(JSON.stringify(payload));

      expect(decode(encoded)).toEqual({
        title: 'Zero\u{200B}width',
        content: 'Tag\u{E0041} and bidi\u{202E} <script>alert(1)</script>',
        category: 'Cat',
      });
    });

    it('should reject a payload whose fields are not all strings', () => {
      const payloads = [
        { title: 123, content: 'Content', category: 'Cat' },
        { title: 'Title', content: null, category: 'Cat' },
        { title: 'Title', content: 'Content', category: { name: 'Cat' } },
      ];

      for (const payload of payloads) {
        const encoded = LZString.compressToEncodedURIComponent(JSON.stringify(payload));
        expect(() => decode(encoded)).toThrow('Invalid sharing code format');
        expect(captureError(() => decode(encoded))).toHaveProperty('type', 'DATA_CORRUPTION');
      }
    });

    it('should throw PromptEncoderError for malformed JSON', () => {
      const malformed = LZString.compressToEncodedURIComponent('{invalid json}');
      expect(() => decode(malformed)).toThrow('Invalid sharing code format');
    });

    it('should throw PromptEncoderError for missing fields', () => {
      const payload = { title: 'Title', content: 'Content' };
      const encoded = LZString.compressToEncodedURIComponent(JSON.stringify(payload));
      expect(() => decode(encoded)).toThrow('Invalid sharing code format');
      expect(captureError(() => decode(encoded))).toHaveProperty('type', 'DATA_CORRUPTION');
    });

    it('should throw PromptEncoderError for a payload that is not an object', () => {
      for (const payload of [null, 'text', 42, ['Title', 'Content', 'Category']]) {
        const encoded = LZString.compressToEncodedURIComponent(JSON.stringify(payload));
        expect(() => decode(encoded)).toThrow('Invalid sharing code format');
      }
    });
  });

  describe('Security', () => {
    // No sink in the extension interprets Prompt text as HTML (ADR-001), so markup-looking
    // text is ordinary text: it is carried literally and never altered or executed.
    it('should carry markup-looking text literally in every field', () => {
      const prompt = createTestPrompt({
        title: '<script>alert(1)</script><b>Test</b>',
        content: '<img src=x onerror=alert(2)><i>Content</i> javascript:alert(3)',
        category: '<a href="javascript:alert(4)">Cat</a>',
      });
      const decoded = decode(encode(prompt));
      expect(decoded.title).toBe(prompt.title);
      expect(decoded.content).toBe(prompt.content);
      expect(decoded.category).toBe(prompt.category);
    });

    it('should keep Hidden characters in the code, for Admission to remove when the Prompt is saved', () => {
      const prompt = createTestPrompt({ content: 'Hidden\u{200B}zero\u{E0041}tag\u{202E}bidi' });
      expect(decode(encode(prompt)).content).toBe(prompt.content);
    });

    it('should reject a code that is not valid JSON after decompression', () => {
      const encoded = LZString.compressToEncodedURIComponent('<script>alert(1)</script>');
      expect(() => decode(encoded)).toThrow('Invalid sharing code format');
    });
  });

  describe('Edge Cases', () => {
    it('should handle special characters', () => {
      const prompt = createTestPrompt({
        title: '!@#$%^*()_+-=[]{}|;:",?/',
        content: 'Content with émojis 🎉🚀',
        category: 'Category with Ü̈mlaut',
      });
      testEncoderRoundtrip(prompt);
    });

    it('should handle unicode characters', () => {
      const prompt = createTestPrompt({
        title: '中文标题',
        content: 'Contenu en français',
        category: 'Категория',
      });
      testEncoderRoundtrip(prompt);
    });

    it('should handle maximum allowed sizes', () => {
      const prompt = createTestPrompt({
        title: 'x'.repeat(100),
        content: 'y'.repeat(20_000),
        category: 'z'.repeat(50),
      });
      testEncoderRoundtrip(prompt);
    });

    it('should handle newlines and tabs', () => {
      const prompt = createTestPrompt({
        title: 'Title with\ttabs',
        content: 'Content\nwith\nnewlines',
        category: 'Category\rwith\rreturns',
      });
      testEncoderRoundtrip(prompt);
    });
  });

  describe('Decompression Bomb Protection', () => {
    it('should reject encoded strings exceeding size limit', () => {
      const hugeString = 'x'.repeat(45_000);
      expect(() => decode(hugeString)).toThrow('Sharing code too large');
    });

    it('should reject payloads exceeding decompressed size limit', () => {
      const payload = {
        title: 'Title',
        content: 'A'.repeat(90_000), // Compresses far below the encoded limit, but is over twice as long once decompressed
        category: 'Cat',
      };
      const encoded = LZString.compressToEncodedURIComponent(JSON.stringify(payload));
      expect(encoded.length).toBeLessThan(40_000);
      expect(() => decode(encoded)).toThrow('Decompressed data too large');
      expect(captureError(() => decode(encoded))).toHaveProperty('name', 'PromptEncoderError');
    });

    it('should accept legitimate payloads with normal compression', () => {
      const prompt = createTestPrompt({
        title: 'Test Prompt',
        content: 'This is a normal prompt with typical text. '.repeat(50),
        category: 'Test',
      });
      const encoded = encode(prompt);
      const decoded = decode(encoded);
      expect(decoded.title).toBe('Test Prompt');
      expect(decoded.content).toContain('normal prompt');
      expect(decoded.category).toBe('Test');
    });

    it('should accept maximum valid content', () => {
      const normalText = 'Lorem ipsum dolor sit amet. ';
      const repetitions = Math.floor(20_000 / normalText.length);
      const content = normalText.repeat(repetitions).substring(0, 20_000);

      const prompt = createTestPrompt({
        title: 'Maximum Size Prompt',
        content,
        category: 'Test',
      });

      const encoded = encode(prompt);
      const decoded = decode(encoded);
      expect(decoded.title).toBe('Maximum Size Prompt');
      expect(decoded.content.length).toBeGreaterThanOrEqual(19900);
      expect(decoded.content.length).toBeLessThanOrEqual(20_000);
      expect(decoded.category).toBe('Test');
    });

    it('should accept realistic repetitive content', () => {
      const codeExample = 'function test() {\n  return true;\n}\n';
      const repeatedCode = codeExample.repeat(100);

      const prompt = createTestPrompt({
        title: 'Code Examples',
        content: repeatedCode,
        category: 'Programming',
      });

      const encoded = encode(prompt);
      const decoded = decode(encoded);
      expect(decoded.title).toBe('Code Examples');
      expect(decoded.content).toContain('function test()');
      expect(decoded.category).toBe('Programming');
    });
  });
});
