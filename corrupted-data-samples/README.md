# Corrupted Data Samples

This directory contains sample JSON files demonstrating various types of invalid import data. These files are used for testing the import validation logic.

## Test Files

### 1. `missing-fields.json`
Demonstrates missing required fields:
- Prompt missing `title`
- Prompt missing `content`
- Prompt missing `id`
- Category missing `name`
- Settings missing `defaultCategory`

### 2. `wrong-types.json`
Demonstrates incorrect data types:
- `id` as null instead of string
- `title` as number instead of string
- `content` as array instead of string
- `createdAt` as string instead of number
- `usageCount` as string instead of number

### 3. `duplicate-ids.json`
Demonstrates duplicate identifiers:
- Two prompts with the same ID
- Three categories with the same name (case-insensitive: "Test", "test", "TEST")

### 4. `broken-references.json`
Demonstrates referential integrity violations:
- Prompts referencing categories that don't exist
- Multiple prompts referencing different non-existent categories

### 5. `invalid-timestamps.json`
Demonstrates invalid timestamp values:
- Negative `createdAt` value
- Future timestamp (year 3000)
- `updatedAt` before `createdAt`
- Negative `usageCount`
- `lastUsedAt` before `createdAt`

### 6. `invalid-settings.json`
Demonstrates invalid settings values:
- Invalid `sortOrder` (not in allowed enum)
- Invalid `sortDirection` (not 'asc' or 'desc')
- Invalid `theme` (not in allowed themes)
- Invalid `interfaceMode` (not in allowed modes)

### 7. `length-violations.json`
Demonstrates field length violations:
- Title exceeding 100 characters
- Content exceeding 20,000 characters
- Category name exceeding 50 characters

## Expected Behavior

All these files should be **rejected** during import with detailed error messages explaining:
- Which items/fields are invalid
- What the validation error is
- How to fix the issue

The validation should collect **all errors** before throwing, not fail on the first error.
