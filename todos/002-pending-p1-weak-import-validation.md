---
status: pending
priority: p1
issue_id: "002"
tags: [code-review, data-integrity, security, validation, pr-156]
dependencies: []
---

# Strengthen Import Data Validation

## Problem Statement

The `validateImportedData()` function in StorageManager only performs shallow structure checks (verifies that arrays and objects exist) but doesn't validate actual data integrity. This critical security gap allows corrupted data with invalid IDs, wrong types, negative timestamps, and broken references to pass validation and corrupt user storage.

**Current validation:**
- ✅ Checks if `prompts` array exists
- ✅ Checks if `categories` array exists
- ✅ Checks if `settings` object exists
- ❌ Does NOT validate prompt/category data structure
- ❌ Does NOT validate field types
- ❌ Does NOT validate referential integrity
- ❌ Does NOT check for duplicates
- ❌ Does NOT validate timestamps
- ❌ Does NOT validate string lengths

## Findings

**Discovered during code review by:**
- data-integrity-guardian agent
- security-sentinel agent
- Manual analysis of validation logic

**Location:** `src/services/storage.ts:741-756`

**Current Implementation:**
```typescript
private validateImportedData(data: unknown): data is StorageData {
  if (!data || typeof data !== 'object') return false;

  const obj = data as Record<string, unknown>;
  return (
    'prompts' in obj &&
    'categories' in obj &&
    'settings' in obj &&
    Array.isArray(obj.prompts) &&
    Array.isArray(obj.categories) &&
    typeof obj.settings === 'object' &&
    obj.settings !== null
  );
}
```

**Example of Invalid Data That Passes Validation:**
```json
{
  "prompts": [
    {
      "id": null,
      "title": 123,
      "content": ["array", "of", "strings"],
      "category": "NonExistentCategory",
      "createdAt": -1000,
      "updatedAt": "not-a-number",
      "usageCount": "five"
    }
  ],
  "categories": [
    {"id": "cat-1", "name": "Category 1"},
    {"id": "cat-1", "name": "Duplicate ID"}
  ],
  "settings": {}
}
```

**All of these issues would pass current validation!**

## Impact

**Severity:** CRITICAL - Production data corruption possible

**Attack Vectors:**
1. User imports corrupted JSON file → storage corrupted
2. Manual JSON file editing → invalid data accepted
3. Export from older version → missing fields not caught
4. Malicious file shared → could crash extension

**User Impact:**
- Loss of prompt data due to invalid IDs
- App crashes with malformed data (wrong types)
- Inability to recover from corrupted imports
- Broken category references causing display errors
- Negative timestamps causing date display issues

**Real-World Scenarios:**
- User edits exported JSON manually and makes a typo
- User imports file from different prompt manager tool
- Browser extension bug creates malformed data
- User restores old backup with incompatible format

## Proposed Solutions

### Option 1: Comprehensive Validation with Specific Errors (Recommended)

**Approach:** Add detailed validation for each field with descriptive error messages

```typescript
private validateImportedData(data: unknown): data is StorageData {
  if (!data || typeof data !== 'object') {
    throw new ValidationError('Import data must be an object');
  }

  const obj = data as Record<string, unknown>;

  // Structure validation
  if (!('prompts' in obj) || !Array.isArray(obj.prompts)) {
    throw new ValidationError('Missing or invalid prompts array');
  }
  if (!('categories' in obj) || !Array.isArray(obj.categories)) {
    throw new ValidationError('Missing or invalid categories array');
  }
  if (!('settings' in obj) || typeof obj.settings !== 'object') {
    throw new ValidationError('Missing or invalid settings object');
  }

  // Validate each prompt with detailed errors
  obj.prompts.forEach((prompt, index) => {
    const errors = this.validatePrompt(prompt);
    if (errors.length > 0) {
      throw new ValidationError(
        `Invalid prompt at index ${index}: ${errors.join(', ')}`
      );
    }
  });

  // Check for duplicate prompt IDs
  const promptIds = new Set();
  const duplicateIds = new Set();
  obj.prompts.forEach(p => {
    if (promptIds.has(p.id)) {
      duplicateIds.add(p.id);
    }
    promptIds.add(p.id);
  });
  if (duplicateIds.size > 0) {
    throw new ValidationError(
      `Duplicate prompt IDs: ${Array.from(duplicateIds).join(', ')}`
    );
  }

  // Validate categories
  obj.categories.forEach((category, index) => {
    const errors = this.validateCategory(category);
    if (errors.length > 0) {
      throw new ValidationError(
        `Invalid category at index ${index}: ${errors.join(', ')}`
      );
    }
  });

  // Check for duplicate category IDs/names
  const categoryNames = new Set();
  obj.categories.forEach(c => {
    if (categoryNames.has(c.name.toLowerCase())) {
      throw new ValidationError(`Duplicate category name: ${c.name}`);
    }
    categoryNames.add(c.name.toLowerCase());
  });

  // Validate referential integrity
  const validCategoryNames = new Set(obj.categories.map(c => c.name));
  const invalidRefs = obj.prompts.filter(
    p => !validCategoryNames.has(p.category)
  );
  if (invalidRefs.length > 0) {
    throw new ValidationError(
      `${invalidRefs.length} prompts reference non-existent categories`
    );
  }

  // Validate settings
  const settingsErrors = this.validateSettings(obj.settings);
  if (settingsErrors.length > 0) {
    throw new ValidationError(
      `Invalid settings: ${settingsErrors.join(', ')}`
    );
  }

  return true;
}

private validatePrompt(p: unknown): string[] {
  const errors: string[] = [];

  if (!p || typeof p !== 'object') {
    return ['Prompt must be an object'];
  }

  // ID validation
  if (!('id' in p) || typeof p.id !== 'string' || p.id.length === 0) {
    errors.push('Missing or invalid ID');
  }

  // Title validation
  if (!('title' in p) || typeof p.title !== 'string') {
    errors.push('Missing or invalid title');
  } else if (p.title.length === 0) {
    errors.push('Title cannot be empty');
  } else if (p.title.length > 100) {
    errors.push('Title exceeds 100 characters');
  }

  // Content validation
  if (!('content' in p) || typeof p.content !== 'string') {
    errors.push('Missing or invalid content');
  } else if (p.content.length === 0) {
    errors.push('Content cannot be empty');
  } else if (p.content.length > 20000) {
    errors.push('Content exceeds 20,000 characters');
  }

  // Category validation
  if (!('category' in p) || typeof p.category !== 'string') {
    errors.push('Missing or invalid category');
  }

  // Timestamp validation
  if (!('createdAt' in p) || typeof p.createdAt !== 'number') {
    errors.push('Missing or invalid createdAt timestamp');
  } else if (p.createdAt <= 0) {
    errors.push('createdAt must be positive');
  } else if (p.createdAt > Date.now()) {
    errors.push('createdAt cannot be in the future');
  }

  if (!('updatedAt' in p) || typeof p.updatedAt !== 'number') {
    errors.push('Missing or invalid updatedAt timestamp');
  } else if (p.updatedAt < p.createdAt) {
    errors.push('updatedAt cannot be before createdAt');
  }

  // Optional fields validation
  if ('usageCount' in p) {
    if (typeof p.usageCount !== 'number' || p.usageCount < 0) {
      errors.push('usageCount must be a non-negative number');
    }
  }

  if ('lastUsedAt' in p) {
    if (typeof p.lastUsedAt !== 'number' || p.lastUsedAt < p.createdAt) {
      errors.push('lastUsedAt must be >= createdAt');
    }
  }

  return errors;
}

private validateCategory(c: unknown): string[] {
  const errors: string[] = [];

  if (!c || typeof c !== 'object') {
    return ['Category must be an object'];
  }

  if (!('id' in c) || typeof c.id !== 'string' || c.id.length === 0) {
    errors.push('Missing or invalid ID');
  }

  if (!('name' in c) || typeof c.name !== 'string' || c.name.length === 0) {
    errors.push('Missing or invalid name');
  }

  if ('color' in c && c.color !== undefined) {
    if (typeof c.color !== 'string' || !c.color.match(/^#[0-9A-Fa-f]{6}$/)) {
      errors.push('Invalid color format (must be #RRGGBB)');
    }
  }

  return errors;
}

private validateSettings(s: unknown): string[] {
  const errors: string[] = [];

  if (!s || typeof s !== 'object') {
    return ['Settings must be an object'];
  }

  // Validate required fields exist
  const requiredFields = ['defaultCategory', 'sortOrder', 'sortDirection', 'theme'];
  requiredFields.forEach(field => {
    if (!(field in s)) {
      errors.push(`Missing required field: ${field}`);
    }
  });

  // Validate enum values
  const validSortOrders = ['createdAt', 'updatedAt', 'title', 'usageCount'];
  if ('sortOrder' in s && !validSortOrders.includes(s.sortOrder)) {
    errors.push(`Invalid sortOrder: ${s.sortOrder}`);
  }

  const validDirections = ['asc', 'desc'];
  if ('sortDirection' in s && !validDirections.includes(s.sortDirection)) {
    errors.push(`Invalid sortDirection: ${s.sortDirection}`);
  }

  const validThemes = ['light', 'dark', 'system'];
  if ('theme' in s && !validThemes.includes(s.theme)) {
    errors.push(`Invalid theme: ${s.theme}`);
  }

  return errors;
}
```

**Pros:**
- Comprehensive validation
- Specific error messages help users fix issues
- Catches all data integrity problems
- Prevents referential integrity violations

**Cons:**
- More complex code
- Larger effort to implement
- Need extensive testing

**Effort:** Large (4-6 hours)
**Risk:** Medium

---

### Option 2: TypeScript Runtime Validation with Zod

**Approach:** Use Zod schema validation library

```typescript
import { z } from 'zod';

const PromptSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1).max(100),
  content: z.string().min(1).max(20000),
  category: z.string(),
  createdAt: z.number().positive(),
  updatedAt: z.number().positive(),
  usageCount: z.number().nonnegative().optional(),
  lastUsedAt: z.number().optional()
}).refine(data => data.updatedAt >= data.createdAt, {
  message: "updatedAt must be >= createdAt"
});

const CategorySchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional()
});

const SettingsSchema = z.object({
  defaultCategory: z.string(),
  sortOrder: z.enum(['createdAt', 'updatedAt', 'title', 'usageCount']),
  sortDirection: z.enum(['asc', 'desc']),
  theme: z.enum(['light', 'dark', 'system'])
});

const StorageDataSchema = z.object({
  prompts: z.array(PromptSchema),
  categories: z.array(CategorySchema),
  settings: SettingsSchema
});

private validateImportedData(data: unknown): data is StorageData {
  try {
    StorageDataSchema.parse(data);
    // Additional referential integrity check...
    return true;
  } catch (error) {
    throw new ValidationError(error.message);
  }
}
```

**Pros:**
- Type-safe validation
- Less code to maintain
- Automatic error messages
- Industry standard library

**Cons:**
- Adds dependency (Zod)
- Need to learn Zod API
- Bundle size increase (~10KB)

**Effort:** Medium (3-4 hours)
**Risk:** Low

## Recommended Action

**Option 1** - Comprehensive manual validation

While Option 2 (Zod) is elegant, Option 1 gives more control over error messages and doesn't add dependencies. For a Chrome extension where bundle size matters, manual validation is preferred.

## Technical Details

**Files to Modify:**
- `src/services/storage.ts` (lines 741-756) - Replace validation
- `src/services/storage.ts` (new) - Add helper validation functions
- `src/types/index.ts` (potential) - Add ValidationError type

**Files to Create:**
- `src/services/__tests__/storage.validation.test.ts` - Comprehensive validation tests

**Test Cases Needed:**
1. Valid data import (should pass)
2. Invalid prompt ID (null, empty, wrong type)
3. Invalid title (empty, too long, wrong type)
4. Invalid content (empty, too long, wrong type)
5. Invalid timestamps (negative, future, updatedAt < createdAt)
6. Invalid usageCount (negative, wrong type)
7. Duplicate prompt IDs
8. Duplicate category names
9. Referential integrity (prompt with non-existent category)
10. Invalid settings enum values
11. Missing required settings fields

## Acceptance Criteria

- [ ] All invalid data examples in this document are rejected
- [ ] Validation provides specific error messages
- [ ] Valid data continues to import successfully
- [ ] No false positives (valid data rejected)
- [ ] Duplicate ID/name detection works
- [ ] Referential integrity validated
- [ ] Timestamp logic validated
- [ ] String length limits enforced
- [ ] 100+ validation test cases added
- [ ] Error messages guide users to fix issues

## Work Log

### 2025-11-06 - Code Review Discovery
**By:** Claude Code Review System
**Actions:**
- Discovered during comprehensive data integrity review
- Analyzed by data-integrity-guardian agent
- Confirmed by security-sentinel agent
- Created example corrupted data that passes validation

**Learnings:**
- Current validation only checks structure (arrays/objects exist)
- No field-level validation (types, ranges, formats)
- No referential integrity checks
- No duplicate detection
- Import feature is a data corruption vector

## Notes

**Priority Justification:**
- P1 (Critical) because allows production data corruption
- User data loss possible through import feature
- No way to recover from corrupted imports
- Extension could crash with malformed data

**Related Issues:**
- Finding #1: InMemoryStorage not being used (makes testing validation harder)
- Finding #6: Hook tests bypass storage layer (validation not tested end-to-end)

**Testing Strategy:**
Create `corrupted-data-samples/` directory with real-world examples:
- `missing-fields.json`
- `wrong-types.json`
- `duplicate-ids.json`
- `broken-references.json`
- `invalid-timestamps.json`

Test that all of these are properly rejected with helpful error messages.
