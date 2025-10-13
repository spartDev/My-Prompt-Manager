# Security Configuration

## Overview

Basic security measures for prompt sharing. Since this is the first shared data feature in the extension, we keep it simple and practical.

## Why Minimal Security?

1. **Chrome auto-updates** - All users get security fixes automatically
2. **First shared feature** - No legacy compatibility concerns
3. **User-to-user sharing** - Not accepting untrusted external data
4. **Offline processing** - All encoding/decoding happens locally

## Core Security Principles

1. **Input validation** - Enforce size limits
2. **Basic sanitization** - Strip HTML tags (prompts are plain text)
3. **Data integrity** - Checksum to detect corruption
4. **Simple = Secure** - Less code = fewer vulnerabilities

## DOMPurify Configuration

```typescript
import DOMPurify from 'isomorphic-dompurify';

const SANITIZATION_CONFIG = {
  ALLOWED_TAGS: [],      // Strip all HTML
  ALLOWED_ATTR: [],      // Strip all attributes
  KEEP_CONTENT: true,    // Keep text content
} as const;

function sanitizeText(text: string): string {
  return DOMPurify.sanitize(text.trim(), SANITIZATION_CONFIG);
}
```

## Size Limits

```typescript
export const SIZE_LIMITS = {
  TITLE_MAX: 100,
  CONTENT_MAX: 10_000,    // ~2-3 pages of text
  CATEGORY_MAX: 50,
  ENCODED_MAX: 50_000,    // ~50KB (clipboard limit safety)
} as const;

function validatePrompt(data: SharedPromptData): void {
  if (!data.title?.trim()) {
    throw new Error('Title is required');
  }
  if (!data.content?.trim()) {
    throw new Error('Content is required');
  }
  if (!data.category?.trim()) {
    throw new Error('Category is required');
  }

  if (data.title.length > SIZE_LIMITS.TITLE_MAX) {
    throw new Error(`Title too long (max ${SIZE_LIMITS.TITLE_MAX} chars)`);
  }
  if (data.content.length > SIZE_LIMITS.CONTENT_MAX) {
    throw new Error(`Content too long (max ${SIZE_LIMITS.CONTENT_MAX} chars)`);
  }
  if (data.category.length > SIZE_LIMITS.CATEGORY_MAX) {
    throw new Error(`Category too long (max ${SIZE_LIMITS.CATEGORY_MAX} chars)`);
  }
}
```

## Checksum (Data Integrity)

Simple hash to detect accidental corruption (copy/paste errors, truncation):

```typescript
// Same algorithm as ConfigurationEncoder (consistency)
function calculateChecksum(data: string): string {
  let hash = 0;
  for (let i = 0; i < data.length; i++) {
    const char = data.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(36);
}

function verifyChecksum(data: string, expected: string): void {
  if (calculateChecksum(data) !== expected) {
    throw new Error('Sharing code appears corrupted');
  }
}
```

## Complete Encode/Decode

```typescript
interface EncodedPromptPayload {
  v: '1.0';         // version
  t: string;        // title
  c: string;        // content
  cat: string;      // category
  cs: string;       // checksum
}

export function encode(prompt: Prompt): string {
  // 1. Sanitize
  const sanitized = {
    title: sanitizeText(prompt.title),
    content: sanitizeText(prompt.content),
    category: sanitizeText(prompt.category),
  };

  // 2. Validate
  validatePrompt(sanitized);

  // 3. Create payload
  const payload: EncodedPromptPayload = {
    v: '1.0',
    t: sanitized.title,
    c: sanitized.content,
    cat: sanitized.category,
    cs: calculateChecksum(`${sanitized.title}|${sanitized.content}|${sanitized.category}`)
  };

  // 4. Compress
  const encoded = LZString.compressToEncodedURIComponent(JSON.stringify(payload));

  // 5. Check size
  if (encoded.length > SIZE_LIMITS.ENCODED_MAX) {
    throw new Error('Prompt too large to share');
  }

  return encoded;
}

export function decode(encoded: string): SharedPromptData {
  // 1. Decompress
  const json = LZString.decompressFromEncodedURIComponent(encoded);
  if (!json) throw new Error('Invalid sharing code');

  // 2. Parse
  const payload = JSON.parse(json) as EncodedPromptPayload;

  // 3. Verify version
  if (payload.v !== '1.0') {
    throw new Error(`Unsupported version: ${payload.v}`);
  }

  // 4. Verify checksum
  verifyChecksum(`${payload.t}|${payload.c}|${payload.cat}`, payload.cs);

  // 5. Return sanitized data
  return {
    title: sanitizeText(payload.t),
    content: sanitizeText(payload.c),
    category: sanitizeText(payload.cat),
  };
}
```

## Testing

```typescript
describe('PromptEncoder Security', () => {
  it('should strip HTML tags', () => {
    const prompt = { title: '<script>bad</script>Good', content: 'Test', category: 'Cat' };
    const encoded = encode(prompt);
    const decoded = decode(encoded);
    expect(decoded.title).toBe('badGood');  // Tags stripped, content kept
  });

  it('should reject oversized prompts', () => {
    const huge = { title: 'A', content: 'x'.repeat(20_000), category: 'Cat' };
    expect(() => encode(huge)).toThrow('too long');
  });

  it('should detect corrupted data', () => {
    const valid = encode({ title: 'Test', content: 'Content', category: 'Cat' });
    const corrupted = valid.slice(0, -5);  // Truncate
    expect(() => decode(corrupted)).toThrow();
  });

  it('should reject empty fields', () => {
    const empty = { title: '', content: 'Test', category: 'Cat' };
    expect(() => encode(empty)).toThrow('required');
  });
});
```
