# Versioning Strategy

## Current Approach

**Version 1.0** - No migration needed (this is the first version).

## Version Field

All encoded prompts include a version field:

```typescript
interface EncodedPromptPayload {
  v: '1.0';
  t: string;    // title
  c: string;    // content
  cat: string;  // category
  cs: string;   // checksum
}
```

## Future Schema Changes

**If we need to change the schema later:**

1. **Non-breaking changes** (optional fields) → Keep v1.0
   - Example: Add optional `tags?: string[]`
   - Old decoders ignore unknown fields
   - Just works

2. **Breaking changes** (required fields, renamed fields) → Bump to v2.0
   - Example: Rename `cat` to `categoryId`
   - Show user-friendly error: "This sharing code requires a newer version"
   - Users get auto-updated by Chrome
   - No migration needed (they'll reshare with new version)

## Implementation

```typescript
export function decode(encoded: string): SharedPromptData {
  const json = LZString.decompressFromEncodedURIComponent(encoded);
  if (!json) throw new Error('Invalid sharing code');

  const payload = JSON.parse(json);

  // Check version
  if (payload.v !== '1.0') {
    throw new Error(
      `This sharing code format (${payload.v}) is not supported. ` +
      `Please ask the sender to reshare using the latest extension version.`
    );
  }

  // Verify checksum and return data
  verifyChecksum(`${payload.t}|${payload.c}|${payload.cat}`, payload.cs);

  return {
    title: sanitizeText(payload.t),
    content: sanitizeText(payload.c),
    category: sanitizeText(payload.cat),
  };
}
```

## Why No Migration?

1. **Chrome auto-updates** - Everyone gets the latest version automatically
2. **First version** - Nothing to migrate from
3. **User-to-user sharing** - If version mismatch, just reshare (30 second fix)
4. **Simple = Better** - No complex version registry, decoder selection, or migration logic

## When to Bump Version

Only bump version if we need to make breaking changes to the schema. Until then, stay on v1.0.
