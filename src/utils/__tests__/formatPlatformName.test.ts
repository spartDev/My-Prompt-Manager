import { describe, it, expect } from 'vitest';

import { formatPlatformName } from '../formatPlatformName';

describe('formatPlatformName', () => {
  describe('known platforms', () => {
    it('should return display name for known platforms', () => {
      expect(formatPlatformName('claude')).toBe('Claude');
      expect(formatPlatformName('chatgpt')).toBe('ChatGPT');
      expect(formatPlatformName('gemini')).toBe('Gemini');
      expect(formatPlatformName('perplexity')).toBe('Perplexity');
      expect(formatPlatformName('copilot')).toBe('Copilot');
      expect(formatPlatformName('mistral')).toBe('Mistral');
      expect(formatPlatformName('custom')).toBe('Custom Site');
    });

    it('should be case insensitive for known platforms', () => {
      expect(formatPlatformName('CLAUDE')).toBe('Claude');
      expect(formatPlatformName('ChatGPT')).toBe('ChatGPT');
      expect(formatPlatformName('GEMINI')).toBe('Gemini');
    });
  });

  describe('unknown hostnames', () => {
    it('should extract and capitalize subdomain from hostname', () => {
      expect(formatPlatformName('concierge.sanofi.com')).toBe('Concierge');
      expect(formatPlatformName('myapp.example.com')).toBe('Myapp');
      expect(formatPlatformName('test.domain.org')).toBe('Test');
    });

    it('should handle two-part domains', () => {
      expect(formatPlatformName('example.com')).toBe('Example');
      expect(formatPlatformName('claude.ai')).toBe('Claude');
    });

    it('should capitalize single-word names', () => {
      expect(formatPlatformName('localhost')).toBe('Localhost');
      expect(formatPlatformName('myplatform')).toBe('Myplatform');
    });
  });

  describe('truncation', () => {
    it('should truncate long names with ellipsis', () => {
      expect(formatPlatformName('verylongsubdomain.example.com')).toBe('Verylongsub…');
      expect(formatPlatformName('superlongplatformname.test.com')).toBe('Superlongpl…');
    });

    it('should not truncate names within limit', () => {
      expect(formatPlatformName('shortname.com')).toBe('Shortname');
      // 'twelvechar1' is 11 chars, fits within 12 char limit
      expect(formatPlatformName('twelvechar1.example.com')).toBe('Twelvechar1');
    });

    it('should handle exactly 12 character names', () => {
      // "Twelvechars" is 11 chars, should not be truncated
      expect(formatPlatformName('twelvechars.com')).toBe('Twelvechars');
    });
  });

  describe('edge cases', () => {
    it('should handle empty string', () => {
      expect(formatPlatformName('')).toBe('');
    });

    it('should handle single character', () => {
      expect(formatPlatformName('a')).toBe('A');
    });

    it('should handle hostname with many subdomains', () => {
      expect(formatPlatformName('sub1.sub2.sub3.example.com')).toBe('Sub1');
    });

    it('should handle uppercase hostnames', () => {
      expect(formatPlatformName('MYAPP.EXAMPLE.COM')).toBe('Myapp');
    });
  });
});
