# Services - Core Business Logic Audit

**Date:** 2026-01-19
**Scope:** 7 files in `src/services/`
**Reviewer:** Claude (Linus Torvalds-style review)
**Total Lines:** ~3,364

---

## Files Reviewed

| File | Lines | Purpose |
|------|-------|---------|
| `storage.ts` | 1,203 | Data persistence, quota management, import/export |
| `promptManager.ts` | 521 | Prompt CRUD, search, validation, statistics |
| `SearchIndex.ts` | 415 | Inverted index for fast prompt searching |
| `SimilarityAlgorithms.ts` | 113 | Levenshtein distance for duplicate detection |
| `UsageTracker.ts` | 263 | Analytics tracking for prompt usage |
| `promptEncoder.ts` | 296 | URL-safe encoding for prompt sharing |
| `configurationEncoder.ts` | 553 | Custom site configuration encoding |

---

## Summary

Overall code quality is solid with good patterns (singletons, locking, validation). However, several issues were found ranging from subtle bugs to code duplication and potential performance problems.

| Severity | Count |
|----------|-------|
| Critical | 3 |
| Moderate | 3 |
| Minor | 4 |

---

## Critical Issues

### 1. Timezone Bug in `getPromptStatistics`

**File:** `promptManager.ts:379-388`

```typescript
for (let i = 6; i >= 0; i--) {
  const date = new Date(now - (i * 24 * 60 * 60 * 1000));
  const dateString = date.toISOString().split('T')[0];  // UTC date
  const dayStart = date.setHours(0, 0, 0, 0);          // LOCAL midnight
  const dayEnd = date.setHours(23, 59, 59, 999);
```

**Problem:** `toISOString()` returns UTC date string, but `setHours()` sets LOCAL time. In non-UTC timezones, `dateString` and the filter range can represent different calendar days.

**Example:** User in UTC+12 at 3am local (= previous day 3pm UTC):
- `dateString` = yesterday (UTC)
- Filter range = today (local)

The returned `date` field doesn't match what was actually filtered.

**Recommendation:** Use consistent UTC or local time throughout. Either:
- Use `date.toLocaleDateString()` for the string, or
- Use `Date.UTC()` for the filter boundaries

---

### 2. UsageTracker Missing Lock on `clearHistory`

**File:** `UsageTracker.ts:125-131`

```typescript
async clearHistory(): Promise<void> {
  try {
    await this.setHistory([]);  // No lock!
  } catch (error) {
    throw this.handleError(error);
  }
}
```

**Problem:** Every other write operation uses `withLock()` except this one. If `clearHistory()` races with `record()`, you could lose the clear or lose a new event depending on timing.

**Recommendation:** Wrap in `withLock()`:
```typescript
async clearHistory(): Promise<void> {
  return this.withLock(async () => {
    await this.setHistory([]);
  });
}
```

---

### 3. UsageTracker Has No Quota Protection

**File:** `UsageTracker.ts:59-63`

```typescript
const history = await this.getRawHistory();
history.push(event);
await this.setHistory(history);
```

**Problem:** Unlike `StorageManager` which has extensive quota checks, `UsageTracker` writes blindly. Heavy usage over 30 days could accumulate thousands of events. A malicious or buggy caller could fill storage.

**Recommendation:** Add either:
- A maximum event count (e.g., 10,000 events)
- Proactive cleanup when approaching limit
- Quota check before write (like StorageManager does)

---

## Moderate Issues

### 4. Massive Code Duplication

**`ensureStorageAvailable`** is copy-pasted identically in:
- `storage.ts:684-701`
- `UsageTracker.ts:92-109`

**`withLock`** mutex pattern duplicated:
- `storage.ts:779-817`
- `UsageTracker.ts:199-232`

**Problem:** Violates DRY and makes maintenance error-prone. A bug fix in one location won't propagate to the other.

**Recommendation:** Extract to shared utilities:
```
src/utils/chromeStorage.ts  // ensureStorageAvailable
src/utils/asyncMutex.ts     // withLock pattern
```

---

### 5. O(n^2) Performance Risk in Duplicate Detection

**File:** `promptManager.ts:404-474`

**Problem:** For 5,000 prompts (the storage limit), this does up to 12.5 million comparisons. Each comparison calls `calculateSimilarityOptimized` which is O(m*n) for string lengths.

Worst case with 20KB prompts: astronomical computation time.

The timeout at line 420-431 mitigates this, but the default 30 seconds is generous. Users could experience UI freeze.

**Recommendation:** Consider:
- Reducing timeout default
- Adding a prompt count limit before running
- Using content hashing for initial filtering
- Batching with yielding to keep UI responsive

---

### 6. Prefix Scan is O(vocabulary) per Term

**File:** `SearchIndex.ts:211-223`

```typescript
for (const [indexedTerm, promptIds] of this.index.terms.entries()) {
  if (indexedTerm.startsWith(term) && indexedTerm !== term) {
```

**Problem:** With 12K unique terms and a 3-word query, this does 36K string comparisons per search.

**Mitigation:** The comment acknowledges this: "<2ms for realistic data" - acceptable for current scale.

**Future Consideration:** If vocabulary grows significantly, consider a trie data structure for O(term_length) prefix lookup.

---

## Minor Issues

### 7. Semantic Confusion: `lastUsedAt` Set on New Prompts

**File:** `storage.ts:113`

```typescript
const newPrompt: Prompt = {
  ...prompt,
  lastUsedAt: timestamp  // Never been used, but has lastUsedAt
};
```

**Problem:** A prompt with `usageCount: 0` shouldn't have a meaningful `lastUsedAt`. The `normalizePrompt` method later treats this case, but setting it initially is confusing.

**Recommendation:** Set `lastUsedAt: undefined` or don't set it, letting `normalizePrompt` handle the default.

---

### 8. English-Only Stop Words

**File:** `SearchIndex.ts:24-28`

```typescript
const stopWords = new Set([
  'the', 'and', 'for', 'are', 'but', 'not', ...
]);
```

**Problem:** No internationalization. Non-English prompts will have poor search relevance because common words aren't filtered.

**Recommendation:** For future: consider language detection or configurable stop word lists.

---

### 9. Legacy Checksum Support Forever

**File:** `configurationEncoder.ts:518-525`

```typescript
const legacyMatch =
  receivedChecksum.length === LEGACY_CHECKSUM_LENGTH &&
  computeLegacyChecksum(canonicalBytes) === receivedChecksum;
```

**Problem:** The legacy 8-character checksum is much weaker than the 16-character SHA-256-based one. There's no deprecation path - these will be supported indefinitely.

**Recommendation:** Add deprecation timeline. Consider logging when legacy checksums are encountered to track usage before removal.

---

### 10. Falsy Value Edge Case

**File:** `storage.ts:706`

```typescript
return (result[key] as T) || null;
```

**Problem:** If `T` is `0`, `""`, or `false`, this returns `null` instead of the actual value.

**Current Risk:** Low - in practice, this only handles arrays/objects/settings. But the pattern is a code smell.

**Recommendation:** Use explicit undefined check:
```typescript
return result[key] !== undefined ? (result[key] as T) : null;
```

---

## Design Observations

### Good Patterns

| Pattern | Location | Notes |
|---------|----------|-------|
| Defense in depth | `promptEncoder.ts` | Sanitizes on both encode AND decode paths |
| Decompression bomb protection | `promptEncoder.ts:192-206`, `configurationEncoder.ts:494-510` | Size checks before LZ decompression |
| Rollback on import failure | `storage.ts:636-670` | Backup created before clear, restored on error |
| Exhaustiveness checks | `promptManager.ts:207-213` | TypeScript will error on new SortOrder values |
| Checksum integrity | `configurationEncoder.ts` | With backward compatibility for migrations |
| Queue-based mutex | `storage.ts:779-817` | Prevents race conditions on concurrent writes |
| Hard storage limits | `storage.ts:39-44` | Prevents quota exhaustion |
| Unicode-aware tokenization | `SearchIndex.ts:15` | Uses `\p{L}\p{N}` for international text |
| Space-optimized Levenshtein | `SimilarityAlgorithms.ts:39-40` | O(min(m,n)) memory with Uint32Array |

### Questionable Patterns

| Pattern | Location | Concern |
|---------|----------|---------|
| Type guard throws | `storage.ts:858-978` | `validateImportedData` signature suggests boolean return, but throws with detailed errors |
| Singleton everywhere | All services | Makes testing harder (though `resetSearchIndex` exists) |
| Mixed async patterns | `SearchIndex` sync, others async | Reasonable but creates cognitive load |

---

## File-by-File Summary

### storage.ts - Grade: A

**Strengths:**
- Excellent singleton pattern with lazy initialization
- Robust concurrency control via queue-based mutex
- Comprehensive quota management with hard limits
- Import/export with rollback using `Promise.allSettled`
- Deep validation on import with referential integrity checks

**Verdict:** Well-architected, production-ready

---

### promptManager.ts - Grade: B+

**Strengths:**
- Clean delegation to StorageManager
- Smart search integration with lazy index rebuild
- Efficient duplicate detection with early termination
- Proper exhaustive switch with TypeScript checking

**Issues:** Timezone bug in statistics calculation

**Verdict:** Good but has one bug that should be fixed

---

### SearchIndex.ts - Grade: A-

**Strengths:**
- Excellent documentation with Big-O complexity analysis
- Inverted index architecture for O(1) term lookup
- Intelligent rebuild detection handles backup/restore edge cases
- Prefix matching for autocomplete-style search

**Verdict:** Well-documented, efficient for typical use

---

### SimilarityAlgorithms.ts - Grade: A+

**Strengths:**
- Space-optimized Levenshtein using O(min(m,n)) memory
- Early termination when threshold exceeded
- Clear documentation with complexity analysis
- Uses Uint32Array for memory efficiency

**Verdict:** Elegant, efficient, well-documented - exemplary code

---

### UsageTracker.ts - Grade: B-

**Strengths:**
- Clean singleton pattern with mutex
- 30-day rolling window with automatic cleanup
- Lazy cleanup (only writes if events actually removed)

**Issues:**
- Missing lock on clearHistory
- No quota protection
- Code duplication with StorageManager

**Verdict:** Functional but has thread-safety and quota issues

---

### promptEncoder.ts - Grade: A

**Strengths:**
- Defense-in-depth security on both encode and decode
- DOMPurify integration with strict config
- LZ-string compression for 60-80% size reduction
- Decompression bomb protection
- Excellent JSDoc explaining the security model

**Verdict:** Security-conscious, well-documented

---

### configurationEncoder.ts - Grade: A-

**Strengths:**
- Version-aware encoding with migration path
- SHA-256 checksums with crypto fallback
- Canonical serialization for deterministic checksums
- DOS protection with fingerprint size limits
- Comprehensive security validation

**Verdict:** Excellent security design, slightly verbose

---

## Recommendations Summary

| Priority | Action |
|----------|--------|
| **High** | Fix timezone bug in `getPromptStatistics` |
| **High** | Add lock to `clearHistory` |
| **High** | Add quota checks to UsageTracker |
| Medium | Extract shared utilities for storage check and mutex |
| Medium | Consider performance limits on duplicate detection |
| Low | Add deprecation timeline for legacy checksum format |
| Low | Clean up `lastUsedAt` initialization semantic |

---

## Overall Assessment

### Grade: A-

The codebase demonstrates professional-quality engineering:

- **Strong singleton patterns** with proper lifecycle management
- **Excellent security practices** (DOMPurify, SHA-256 checksums, validation)
- **Good concurrency handling** with mutex locks
- **Clear documentation** with complexity analysis

The main issues are:
1. Thread-safety gap in UsageTracker
2. Timezone bug in statistics
3. Code duplication between services

The architecture is **scalable and maintainable**.

---

## Appendix: Test Coverage Recommendations

Based on the issues found, these test cases should be verified or added:

| Service | Edge Case |
|---------|-----------|
| StorageManager | Quota exceeded during import rollback |
| PromptManager | `getPromptStatistics` in different timezone offsets |
| PromptManager | Duplicate detection timeout with large datasets |
| SearchIndex | Rebuild with identical prompt count but different IDs |
| SearchIndex | Non-English/CJK text search |
| UsageTracker | Concurrent `record()` + `clearHistory()` calls |
| UsageTracker | Behavior at storage quota limits |
| PromptEncoder | Decompression bomb detection |
| ConfigurationEncoder | Legacy 8-char checksum with current version payload |
