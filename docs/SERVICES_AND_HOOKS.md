# Services and Hooks

**Version:** 1.5.0
**Last Updated:** 2026-10-12

This document provides comprehensive documentation for the business logic layer, including core services, custom React hooks, and data flow patterns.

---

## Table of Contents

- [Architecture Overview](#architecture-overview)
- [Core Services](#core-services)
- [Custom React Hooks](#custom-react-hooks)
- [Data Flow Patterns](#data-flow-patterns)
- [Advanced Features](#advanced-features)

---

## Architecture Overview

### Layer Structure

```
┌─────────────────────────────────────────┐
│  React Components (Presentation)        │
└────────────────┬────────────────────────┘
                 │
┌────────────────▼────────────────────────┐
│  Custom Hooks (State Management)        │
│  - usePrompts, useCategories            │
│  - useSearch, useSearchWithDebounce     │
│  - useToast, useTheme, useClipboard     │
└────────────────┬────────────────────────┘
                 │
┌────────────────▼────────────────────────┐
│  Business Logic Services (Singletons)   │
│  - PromptManager                        │
│  - ConfigurationEncoder                 │
└────────────────┬────────────────────────┘
                 │
┌────────────────▼────────────────────────┐
│  Storage Service (Data Layer)           │
│  - StorageManager (with mutex locking)  │
└────────────────┬────────────────────────┘
                 │
┌────────────────▼────────────────────────┐
│  Chrome Storage API (Persistence)       │
└─────────────────────────────────────────┘
```

---

## Core Services

### 1. StorageManager

**File:** `src/services/storage.ts` (509 lines)

**Purpose:** Singleton service providing atomic, thread-safe operations for Chrome storage.local API.

**Pattern:** Singleton with mutex locking

**Key Features:**
- **Mutex-based concurrency control** - Prevents race conditions
- **Storage quota monitoring** - Tracks usage (5MB limit)
- **Import/export functionality** - Full data portability
- **Comprehensive error handling** - Custom `StorageError` class
- **Admission on write** - Prompt and Category text is admitted inside the text-writing methods (see [Prompt Admission](#4-prompt-admission))

**API:**

```typescript
class StorageManager {
  private static instance: StorageManager | null = null;
  private operationLocks: Map<string, Promise<void>> = new Map();

  static getInstance(): StorageManager;

  // Prompt Operations
  async savePrompt(prompt: Prompt): Promise<void>;
  async updatePrompt(id: string, updates: Partial<Prompt>): Promise<void>;
  async deletePrompt(id: string): Promise<void>;
  async getPrompts(): Promise<Prompt[]>;

  // Category Operations
  async saveCategory(categoryData: CategoryFormData): Promise<void>;
  async updateCategory(id: string, updates: Partial<Category>): Promise<void>;
  async deleteCategory(id: string): Promise<void>;
  async getCategories(): Promise<Category[]>;

  // Settings Operations
  async getSettings(): Promise<Settings>;
  async updateSettings(updates: Partial<Settings>): Promise<void>;

  // Data Management
  async getAllData(): Promise<StorageData>;
  async clearAllData(): Promise<void>;
  async exportData(): Promise<StorageData>;
  async importData(data: unknown): Promise<void>;
  async getStorageUsage(): Promise<{ used: number; total: number }>;

  // Protected - Mutex Locking
  private async withLock<T>(key: string, operation: () => Promise<T>): Promise<T>;
}
```

**Mutex Locking Implementation:**

```typescript
private async withLock<T>(key: string, operation: () => Promise<T>): Promise<T> {
  // Wait for any existing operation on this key
  const existingLock = this.operationLocks.get(key);
  if (existingLock) {
    await existingLock;
  }

  // Create new lock
  let resolveLock: () => void;
  const newLock = new Promise<void>((resolve) => {
    resolveLock = resolve;
  });
  this.operationLocks.set(key, newLock);

  try {
    return await operation();
  } finally {
    resolveLock!();
    this.operationLocks.delete(key);
  }
}
```

**Benefits:**
- Prevents concurrent modifications to same data
- Ensures data consistency
- Thread-safe operations

**Storage Keys:**
```typescript
const STORAGE_KEYS = {
  PROMPTS: 'prompts',
  CATEGORIES: 'categories',
  SETTINGS: 'settings'
};
```

**Usage:**
```typescript
const storage = StorageManager.getInstance();

// Save prompt
await storage.savePrompt({ id, title, content, categoryId });

// Get all prompts
const prompts = await storage.getPrompts();

// Check storage usage
const { used, total } = await storage.getStorageUsage();
const usagePercent = (used / total) * 100;
```

---

### 2. PromptManager

**File:** `src/services/promptManager.ts` (455 lines)

**Purpose:** Business logic layer for prompt operations, search, validation, and duplicate detection.

**Pattern:** Singleton with StorageManager dependency

**Key Features:**
- **Intelligent search** - Case-insensitive with highlighting
- **Duplicate detection** - Levenshtein distance algorithm
- **Auto-title generation** - Creates titles from content
- **Statistical analysis** - Usage metrics and trends

**API:**

```typescript
class PromptManager {
  private static instance: PromptManager | null = null;

  static getInstance(): PromptManager;

  // CRUD Operations
  async createPrompt(promptData: PromptFormData): Promise<void>;
  async updatePrompt(id: string, updates: Partial<Prompt>): Promise<void>;

  // Search & Filter
  async searchPrompts(query: string, categoryFilter?: string): Promise<Prompt[]>;
  async searchPromptsWithHighlights(query: string, categoryFilter?: string): Promise<SearchResultWithHighlights[]>;
  async filterByCategory(categoryId: string): Promise<Prompt[]>;
  async getPromptsByDateRange(startDate: number, endDate: number): Promise<Prompt[]>;

  // Organization
  async getSortedPrompts(sortOrder: Settings['sortOrder']): Promise<Prompt[]>;

  // Analytics
  async getPromptStatistics(): Promise<PromptStatistics>;
  async findDuplicatePrompts(threshold?: number): Promise<DuplicateGroup[]>;

  // Validation
  validatePromptData(data: Partial<PromptFormData>): ValidationError | null;
  validateCategoryData(data: Partial<CategoryFormData>): ValidationError | null;

  // Utilities
  generateTitle(content: string): string;
}
```

**Advanced Algorithms:**

**1. Levenshtein Distance (Edit Distance):**

```typescript
private levenshteinDistance(str1: string, str2: string): number {
  const m = str1.length;
  const n = str2.length;
  const dp: number[][] = Array(m + 1).fill(null).map(() => Array(n + 1).fill(0));

  // Initialize first row and column
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;

  // Fill the matrix
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (str1[i - 1] === str2[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1];
      } else {
        dp[i][j] = 1 + Math.min(
          dp[i - 1][j],     // deletion
          dp[i][j - 1],     // insertion
          dp[i - 1][j - 1]  // substitution
        );
      }
    }
  }

  return dp[m][n];
}
```

**Time Complexity:** O(m × n) where m, n are string lengths
**Space Complexity:** O(m × n)

**2. Similarity Scoring:**

```typescript
private calculateStringSimilarity(str1: string, str2: string): number {
  const normalized1 = str1.toLowerCase().trim();
  const normalized2 = str2.toLowerCase().trim();

  const distance = this.levenshteinDistance(normalized1, normalized2);
  const maxLength = Math.max(normalized1.length, normalized2.length);

  return 1 - (distance / maxLength); // Returns 0-1 (1 = identical)
}
```

**3. Duplicate Detection:**

```typescript
async findDuplicatePrompts(threshold: number = 0.85): Promise<DuplicateGroup[]> {
  const prompts = await this.storage.getPrompts();
  const duplicateGroups: DuplicateGroup[] = [];

  for (let i = 0; i < prompts.length; i++) {
    for (let j = i + 1; j < prompts.length; j++) {
      const titleSimilarity = this.calculateStringSimilarity(
        prompts[i].title,
        prompts[j].title
      );
      const contentSimilarity = this.calculateStringSimilarity(
        prompts[i].content,
        prompts[j].content
      );

      if (titleSimilarity >= threshold && contentSimilarity >= threshold) {
        duplicateGroups.push({
          prompts: [prompts[i], prompts[j]],
          similarity: (titleSimilarity + contentSimilarity) / 2
        });
      }
    }
  }

  return duplicateGroups;
}
```

**Default Threshold:** 85% similarity

**4. Text Highlighting:**

```typescript
private findTextHighlights(text: string, searchTerm: string): Highlight[] {
  const highlights: Highlight[] = [];
  const lowerText = text.toLowerCase();
  const lowerTerm = searchTerm.toLowerCase();

  let startIndex = 0;
  let index: number;

  while ((index = lowerText.indexOf(lowerTerm, startIndex)) !== -1) {
    highlights.push({
      start: index,
      end: index + searchTerm.length,
      text: text.substring(index, index + searchTerm.length) // Preserves original case
    });
    startIndex = index + 1; // Allow overlapping matches
  }

  return highlights;
}
```

**Validation Limits:** the Prompt text limits are `PROMPT_LIMITS` (see [Prompt Admission](#4-prompt-admission)); `validatePromptData` and `validateCategoryData` defer to `admit()`. PromptManager's own constant:
```typescript
const VALIDATION_LIMITS = {
  TITLE_GENERATION_LENGTH: 50 // length of a title generated from content
};
```

**Statistics Provided:**

```typescript
interface PromptStatistics {
  totalPrompts: number;
  categoryCounts: Record<string, number>;
  averageContentLength: number;
  recentActivity: Array<{
    date: string;
    count: number;
  }>;
}
```

**Usage:**
```typescript
const manager = PromptManager.getInstance();

// Create prompt
await manager.createPrompt({ title, content, categoryId });

// Search with highlights
const results = await manager.searchPromptsWithHighlights('React');

// Find duplicates
const duplicates = await manager.findDuplicatePrompts(0.90); // 90% threshold

// Get statistics
const stats = await manager.getPromptStatistics();
```

---

### 3. ConfigurationEncoder

**File:** `src/services/configurationEncoder.ts` (552 lines)

**Purpose:** Secure encoding/decoding service for sharing custom site configurations with compression, validation, and integrity checking.

**Key Features:**
- **URL-safe compression** - Uses lz-string (60-80% size reduction)
- **Cryptographic integrity** - SHA-256 checksums
- **Security validation** - XSS/injection attack detection
- **Fingerprint support** - Robust element identification
- **Version management** - Supports versioned payload format

**API:**

```typescript
const ConfigurationEncoder = {
  async encode(customSite: CustomSite): Promise<string>;
  async decode(encodedString: string): Promise<CustomSiteConfiguration>;
  validate(config: CustomSiteConfiguration): ConfigurationValidationResult;
};
```

**Security Layers:**

**Layer 1: Input Sanitization**
```typescript
function sanitizeConfiguration(config: CustomSiteConfiguration): CustomSiteConfiguration {
  return {
    ...config,
    displayName: config.displayName.trim().substring(0, 100),
    hostnamePattern: config.hostnamePattern.trim().toLowerCase(),
    selector: config.selector?.trim(),
    // Remove dangerous characters
    // Truncate oversized fields
    // Normalize whitespace
  };
}
```

**Layer 2: Malicious Content Detection**
```typescript
function detectMaliciousContent(config: CustomSiteConfiguration): string[] {
  const warnings: string[] = [];

  // Check for script tags
  if (/<script/i.test(JSON.stringify(config))) {
    warnings.push('Contains script tags');
  }

  // Detect event handlers
  if (/on(click|load|error|mouse|key)/i.test(JSON.stringify(config))) {
    warnings.push('Contains event handlers');
  }

  // Flag eval/Function patterns
  if (/(eval|Function)\s*\(/i.test(JSON.stringify(config))) {
    warnings.push('Contains eval or Function calls');
  }

  return warnings;
}
```

**Layer 3: Selector Validation**
```typescript
function isSelectorSafe(selector: string): boolean {
  const dangerousPatterns = [
    /javascript:/i,
    /data:/i,
    /<script/i,
    /[;{}\\`]/,  // Injection attempts
  ];

  return !dangerousPatterns.some(pattern => pattern.test(selector));
}
```

**Layer 4: Cryptographic Integrity**
```typescript
async function computeChecksum(data: string): Promise<string> {
  // Try SHA-256 (modern browsers)
  if (crypto.subtle) {
    const encoder = new TextEncoder();
    const data = encoder.encode(canonical);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('').substring(0, 16);
  }

  // Fallback to simple hash
  return simpleHash(data);
}
```

**Layer 5: Size Limits**
```typescript
const MAX_FINGERPRINT_SIZE = 10000; // 10KB - prevents DOS attacks
```

**Checksum Strategy (Progressive Fallback):**
1. **SHA-256** (16 hex chars) - Modern browsers with SubtleCrypto
2. **Fallback Hash** (16 hex chars) - Dual hash for older environments
3. **Legacy Hash** (8 hex chars) - Backward compatibility

**Validation Scope:**
- Hostname pattern matching (public domains only)
- Display name presence
- Selector OR fingerprint requirement
- Offset bounds (-500 to +500 pixels)
- Z-index range (0 to 2,147,483,647)
- Placement values (before/after/inside-start/inside-end)

**Error Codes:**
```typescript
type ConfigurationErrorCode =
  | 'INVALID_FORMAT'
  | 'UNSUPPORTED_VERSION'
  | 'CHECKSUM_FAILED'
  | 'SECURITY_VIOLATION'
  | 'VALIDATION_ERROR';
```

**Usage:**
```typescript
// Encode configuration
const encoded = await ConfigurationEncoder.encode(customSite);
// Result: compressed base64 string

// Decode configuration
const config = await ConfigurationEncoder.decode(encodedString);

// Validate configuration
const validation = ConfigurationEncoder.validate(config);
if (!validation.valid) {
  console.error('Validation errors:', validation.errors);
}
```

---

### 4. Prompt Admission

**File:** `src/services/promptAdmission.ts`

**Purpose:** The one place Prompt text is checked, and the one definition of a stored Prompt. A pure module (no `chrome.*` dependency) shared by the popup, the service worker and the content script. The terms (Admission, Verbatim, Hidden character) are defined in [`CONTEXT.md`](../CONTEXT.md); the decision is recorded in [ADR-001](./adr/ADR-001-store-and-deliver-prompts-verbatim.md).

**Key Features:**
- **Admission once, at the write path** - Hidden characters removed, title and Category trimmed, empty or over-limit text refused (never shortened)
- **Verbatim afterwards** - Text is never changed when it is read, shown, copied or inserted
- **One reader** - `readPrompts()` is shared by `StorageManager` and the content script; reading never writes
- **Compile-time enforcement** - `StoredPrompt` and `AdmittedPrompt` are nominal types and `StorageManager`'s private writer accepts only those, so a route that skips Admission does not compile

**Exports:**

| Export | Purpose |
|--------|---------|
| `admit(text)` / `admit(patch)` | Pure check of full text or a patch of some fields. Returns `{ ok: true, text }` or `{ ok: false, errors }` (a `Refusal` per field, with a `message` ready to show). Doubles as the form's dry check and live counter |
| `readPrompt(raw)` | Reads one stored entry into a `StoredPrompt`, or `null` if it is not a Prompt (no string `id`, `title` or `content`). Text is never altered; missing fields are filled in deterministically, with no clock |
| `readPrompts(raw)` | Reads the value stored under the prompts key into `StoredPrompt[]`, skipping entries that are not Prompts |
| `scrubStored(raw)` | Upgrade pass for raw stored Prompts: removes Hidden characters from title, content and category. Never refuses, trims, shortens or drops an entry. Returns `{ entries, changed }` |
| `scrubStoredCategories(raw)` | The same for raw stored Category names; Categories whose names become the same are merged into the first. Returns `{ entries, changed }` |
| `admitNew(text, { id, now })` | Create route. Returns `{ ok: true, prompt }` (an `AdmittedPrompt`) or `{ ok: false, errors }` |
| `admitEdit(current, patch, now)` | Edit route. Only the fields in the patch are checked; the rest is carried over (cleaned of Hidden characters, but not checked against the limits again, so a legacy over-limit Prompt stays editable) |
| `admitRestored(incoming, now, { replacing? })` | Backup restore route. Keeps id, usage and timestamps; a refusal means the restore skips and reports this Prompt |
| `recordUse(prompt, now)` | A non-text change (one more use) that keeps the result typed as a `StoredPrompt` |
| `AdmissionRefusedError` | Thrown by the write path when a route is refused. An `AppError` of type `VALIDATION_ERROR` whose `errors` hold the per-field refusals |
| `PROMPT_LIMITS` | `{ title: 100, content: 20000, category: 50 }`: the one definition of the limits, read by the forms, `PromptManager` and `StorageManager` |
| `StoredPrompt` / `AdmittedPrompt` | Nominal types (classes with a private member, so an object literal or spread cannot be assigned). Both widen to a plain `Prompt`; an `AdmittedPrompt` is a `StoredPrompt` whose text has just been through Admission |

**Usage: the form's dry check** (nothing is saved):

```typescript
import { admit } from '../services/promptAdmission';

const admission = admit({ title, content, category });

if (!admission.ok) {
  // e.g. "Content cannot exceed 20,000 characters"
  const message = Object.values(admission.errors)
    .flatMap((refusal) => (refusal ? [refusal.message] : []))
    .join('; ');
  setValidationError(message);
} else {
  // admission.text is exactly what would be saved
  // (Hidden characters removed, title and category trimmed)
  setPreview(admission.text);
}
```

**Usage: the StorageManager write path** (every text-writing method does this before touching storage):

```typescript
// StorageManager.savePrompt (src/services/storage.ts, simplified)
const admission = admitNew(prompt, { id: uuidv4(), now: Date.now() });
if (!admission.ok) {
  throw new AdmissionRefusedError(admission.errors);
}

// writePrompts() accepts only StoredPrompt / AdmittedPrompt values
await this.writePrompts([...existingPrompts, admission.prompt]);
```

Callers see the refusal as an `AdmissionRefusedError`; it keeps its type through `StorageManager` and `PromptManager`, so a caller can check `error instanceof AdmissionRefusedError` (the Backup restore in `SettingsView` does, to skip and report a refused Prompt and restore the rest).

**Upgrade pass:** `StorageManager.upgradeStoredData()` runs `scrubStored` and `scrubStoredCategories` over the raw stored values once per extension update (the service worker calls it from `chrome.runtime.onInstalled` when the reason is `update`). It is the only code that writes raw, untyped entries to the prompts key (through `writeScrubbed()` instead of the typed `writePrompts()`), because it must keep malformed or over-limit entries rather than drop them.

---

## Custom React Hooks

### 1. usePrompts

**File:** `src/hooks/usePrompts.ts` (118 lines)

**Purpose:** React hook wrapping PromptManager with loading/error state management.

**API:**
```typescript
const {
  prompts,           // Prompt[]
  loading,           // boolean
  error,             // string | null
  createPrompt,      // (data: PromptFormData) => Promise<void>
  updatePrompt,      // (id: string, updates: Partial<Prompt>) => Promise<void>
  deletePrompt,      // (id: string) => Promise<void>
  searchPrompts,     // (query: string, categoryFilter?: string) => Promise<Prompt[]>
  filterByCategory,  // (categoryId: string) => Promise<void>
  refreshPrompts     // () => Promise<void>
} = usePrompts();
```

**Features:**
- Auto-loads prompts on mount
- Manages loading states
- Error handling and display
- Refreshes local state after mutations

**Usage:**
```typescript
function LibraryView() {
  const { prompts, loading, error, createPrompt } = usePrompts();

  if (loading) return <Loading />;
  if (error) return <Error message={error} />;

  return <PromptList prompts={prompts} />;
}
```

---

### 2. useCategories

**File:** `src/hooks/useCategories.ts` (104 lines)

**Purpose:** React hook for category management with CRUD operations.

**API:**
```typescript
const {
  categories,        // Category[]
  loading,           // boolean
  error,             // string | null
  createCategory,    // (data: CategoryFormData) => Promise<void>
  updateCategory,    // (id: string, updates: Partial<Category>) => Promise<void>
  deleteCategory,    // (id: string) => Promise<void>
  refreshCategories  // () => Promise<void>
} = useCategories();
```

---

### 3. useSearch

**File:** `src/hooks/useSearch.ts` (47 lines)

**Purpose:** Real-time search with highlighting (no debounce).

**API:**
```typescript
const {
  query,              // string (current search query)
  filteredPrompts,    // Prompt[] (matching prompts)
  highlightedResults, // SearchResultWithHighlights[] (with highlight positions)
  clearSearch         // () => void
} = useSearch(prompts, searchQuery);
```

**Implementation:**
- Filters prompts based on query (title/content matching)
- Computes highlight positions using `findTextHighlights()`
- Returns both filtered list and highlighted results
- Used for instant search experiences

---

### 4. useSearchWithDebounce

**File:** `src/hooks/useSearchWithDebounce.ts` (71 lines)

**Purpose:** Debounced search with loading state (optimized for performance).

**API:**
```typescript
const {
  query,              // string (display query - immediate)
  debouncedQuery,     // string (actual search query - delayed)
  isSearching,        // boolean (debounce in progress)
  filteredPrompts,    // Prompt[]
  highlightedResults, // SearchResultWithHighlights[]
  setQuery,           // (query: string) => void
  clearSearch         // () => void
} = useSearchWithDebounce(prompts);
```

**Configuration:**
```typescript
const DEBOUNCE_DELAY = 300; // milliseconds
```

**Features:**
- Separates input query (immediate) from search query (debounced)
- Shows loading state during debounce period
- Prevents excessive re-renders and computations
- Ideal for large prompt libraries (100+ prompts)

**Usage:**
```typescript
function LibraryView({ prompts }: Props) {
  const {
    query,
    debouncedQuery,
    isSearching,
    filteredPrompts,
    setQuery
  } = useSearchWithDebounce(prompts);

  return (
    <>
      <SearchBar value={query} onChange={setQuery} />
      {isSearching && <SearchingIndicator />}
      <PromptList prompts={filteredPrompts} searchTerm={debouncedQuery} />
    </>
  );
}
```

---

### 5. useToast

**File:** `src/hooks/useToast.ts` (156 lines)

**Purpose:** Toast notification system with queue management and persistence.

**API:**
```typescript
const {
  toasts,           // Toast[] (currently visible toasts)
  queueLength,      // number (pending toasts in queue)
  settings,         // ToastSettings (user preferences)
  showToast,        // (message: string, type?: ToastType, duration?: number) => void
  hideToast,        // (id: string) => void
  clearAllToasts,   // () => void
  updateSettings    // (settings: Partial<ToastSettings>) => Promise<void>
} = useToast();
```

**Features:**
1. **Queue Management** - Limits visible toasts, queues excess
2. **Auto-dismiss** - Configurable timeout with cleanup
3. **Persistent Settings** - Stores user preferences in Chrome storage
4. **Toast Types** - Success, error, warning, info
5. **Default Configuration:**
```typescript
const DEFAULT_SETTINGS = {
  position: 'top-right',
  duration: 3000, // milliseconds
  maxVisible: 3,
  animations: true
};
```

**Storage Key:** `toastSettings`

**Usage:**
```typescript
function MyComponent() {
  const { showToast } = useToast();

  const handleSave = async () => {
    try {
      await saveData();
      showToast('Saved successfully!', 'success');
    } catch (error) {
      showToast('Save failed', 'error');
    }
  };
}
```

---

### 6. useTheme

**File:** `src/hooks/useTheme.ts` (137 lines)

**Purpose:** Theme management with system preference detection and persistence.

**API:**
```typescript
const {
  theme,          // Theme ('light' | 'dark' | 'system')
  resolvedTheme,  // 'light' | 'dark' (actual theme after system resolution)
  setTheme,       // (theme: Theme) => Promise<void>
  toggleTheme     // () => Promise<void>
} = useTheme();
```

**Features:**
1. **System Theme Detection** - Uses `window.matchMedia('(prefers-color-scheme: dark)')`
2. **Auto-sync** - Listens to system theme changes when theme is 'system'
3. **DOM Integration** - Applies theme class to document element
4. **Persistence** - Stores preference in Chrome storage
5. **Settings Integration** - Syncs with StorageManager settings

**Storage Key:** `theme`

**Usage:**
```typescript
function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();

  return (
    <button onClick={toggleTheme}>
      {theme === 'dark' ? '🌙' : '☀️'}
    </button>
  );
}
```

---

### 7. useClipboard

**File:** `src/hooks/useClipboard.ts` (68 lines)

**Purpose:** Clipboard operations with status tracking and timeout management.

**API:**
```typescript
const {
  copyStatus,       // 'idle' | 'copying' | 'success' | 'error'
  lastCopied,       // string | null (last copied text)
  copyToClipboard   // (text: string, timeout?: number) => Promise<void>
} = useClipboard();
```

**Features:**
1. **Multi-strategy Copying:**
   - Primary: `navigator.clipboard.writeText()` (modern)
   - Fallback: Legacy `document.execCommand('copy')` (older browsers)
2. **Status Tracking** - Visual feedback for copy operations
3. **Auto-reset** - Returns to 'idle' after configurable timeout (default: 2s)
4. **Error Handling** - Catches and reports clipboard API failures

**Usage:**
```typescript
function PromptCard({ prompt }: Props) {
  const { copyStatus, copyToClipboard } = useClipboard();

  return (
    <button onClick={() => copyToClipboard(prompt.content)}>
      {copyStatus === 'success' ? 'Copied!' : 'Copy'}
    </button>
  );
}
```

---

### 8. useExtensionContext

**File:** `src/hooks/useExtensionContext.ts` (97 lines)

**Purpose:** Detects extension runtime context (popup vs. sidepanel vs. content script).

**API:**
```typescript
const {
  isPopup,      // boolean
  isSidepanel,  // boolean
  isContentScript, // boolean
  context       // 'popup' | 'sidepanel' | 'content-script' | 'unknown'
} = useExtensionContext();
```

**Detection Logic:**
```typescript
// Popup: window.location.pathname === '/popup.html'
// Sidepanel: window.location.pathname === '/sidepanel.html'
// Content Script: !chrome.extension or injected environment
```

**Use Cases:**
- Conditional UI rendering based on context
- Feature availability checks
- Context-specific error handling

**Usage:**
```typescript
function ViewHeader() {
  const { isSidepanel } = useExtensionContext();

  return (
    <header>
      {isSidepanel ? <CloseButton /> : <SettingsButton />}
    </header>
  );
}
```

---

## Data Flow Patterns

### 1. CRUD Operation Flow

```
User Action (Create Prompt)
    │
    ▼
React Component
    │
    ├─► usePrompts hook
    │   │
    │   ├─► setLoading(true)
    │   │
    │   ▼
    │   PromptManager.createPrompt(data)
    │   │
    │   ├─► Validate data
    │   │
    │   ▼
    │   StorageManager.savePrompt(prompt)
    │   │
    │   ├─► withLock('prompts', async () => { ... })
    │   │   │
    │   │   ├─► Get existing prompts
    │   │   ├─► Add new prompt
    │   │   └─► Save to Chrome storage
    │   │
    │   ▼
    │   Success
    │
    ├─► refreshPrompts()
    │
    ├─► setLoading(false)
    │
    └─► showToast('Prompt created!', 'success')
```

### 2. Search Flow

```
User Types in SearchBar
    │
    ▼
useSearchWithDebounce
    │
    ├─► setQuery(value) - immediate
    │   │
    │   └─► Updates input field instantly
    │
    ├─► debounce(300ms)
    │   │
    │   └─► setDebouncedQuery(value) - delayed
    │
    ▼
useEffect triggered by debouncedQuery change
    │
    ├─► PromptManager.searchPromptsWithHighlights(query)
    │   │
    │   ├─► Filter prompts (title + content)
    │   │
    │   └─► Compute highlight positions
    │
    ▼
setFilteredPrompts(results)
    │
    └─► Component re-renders with results
```

### 3. Theme Change Flow

```
User Clicks Theme Toggle
    │
    ▼
useTheme.toggleTheme()
    │
    ├─► Determine new theme
    │   │
    │   ├─► light → dark
    │   ├─► dark → system
    │   └─► system → light
    │
    ├─► setTheme(newTheme)
    │   │
    │   ├─► Update local state
    │   │
    │   ├─► Apply to document element
    │   │   document.documentElement.classList.add('dark')
    │   │
    │   └─► Persist to storage
    │       StorageManager.updateSettings({ theme: newTheme })
    │
    └─► Notify content scripts
        chrome.tabs.sendMessage({ type: 'themeUpdated', theme })
```

---

## Advanced Features

### Element Fingerprinting System

**Location:** `src/types/index.ts` (lines 152-201)

**Purpose:** Robust element identification for custom site integrations.

**Structure:**
```typescript
interface ElementFingerprint {
  // Primary identifiers (highest confidence)
  primary: {
    id?: string;
    dataTestId?: string;
    dataId?: string;
    name?: string;
    ariaLabel?: string;
  };

  // Secondary identifiers
  secondary: {
    tagName: string;
    type?: string;
    role?: string;
    placeholder?: string;
  };

  // Content-based identification
  content: {
    textContent?: string;
    textHash?: string;
  };

  // Structural context
  context: {
    parentId?: string;
    parentDataTestId?: string;
    parentTagName?: string;
    siblingIndex?: number;
    siblingCount?: number;
    depth?: number;
  };

  // Additional attributes
  attributes: Record<string, string>;
  classPatterns?: string[];

  // Metadata
  meta: {
    generatedAt: number;
    url: string;
    confidence: 'high' | 'medium' | 'low';
  };
}
```

**Advantages over CSS Selectors:**
1. **Resilience** - Multiple identification strategies
2. **Confidence Scoring** - Indicates reliability
3. **Fallback Layers** - Primary → Secondary → Content → Structure
4. **Framework Agnostic** - Works with React, Vue, Angular, vanilla JS
5. **Dynamic Content** - Handles SPAs and AJAX updates

---

## Quick Reference

### Service Methods Summary

| Service | Key Methods | Purpose |
|---------|-------------|---------|
| **StorageManager** | `savePrompt`, `getPrompts`, `importData` | Chrome storage operations |
| **PromptManager** | `searchPrompts`, `findDuplicates`, `getStatistics` | Business logic |
| **ConfigurationEncoder** | `encode`, `decode`, `validate` | Configuration sharing |
| **promptAdmission** | `admit`, `readPrompts`, `admitNew`, `admitEdit`, `admitRestored` | Admission of Prompt text, the one reader |

### Hook Summary

| Hook | Returns | Purpose |
|------|---------|---------|
| **usePrompts** | `prompts`, `loading`, CRUD methods | Prompt management |
| **useCategories** | `categories`, CRUD methods | Category management |
| **useSearch** | `filteredPrompts`, `highlightedResults` | Instant search |
| **useSearchWithDebounce** | `debouncedQuery`, `isSearching` | Debounced search |
| **useToast** | `showToast`, `toasts` | Notifications |
| **useTheme** | `theme`, `setTheme`, `toggleTheme` | Theme management |
| **useClipboard** | `copyToClipboard`, `copyStatus` | Clipboard operations |
| **useExtensionContext** | `isPopup`, `isSidepanel` | Context detection |

---

**Last Updated:** 2026-10-12
**Version:** 1.5.0
