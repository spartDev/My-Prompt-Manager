# Services and Hooks

Which service or hook does which job, and the rules the code cannot say by itself: locking, Admission, the upgrade pass, restore. This page does not copy signatures: open the source file for the exact methods and types, and its tests (`__tests__/` next to it) for worked examples.

---

## Layers

```
React components
   │  hooks (src/hooks/): React state over the services
   ▼
Services (src/services/): PromptManager, ConfigurationEncoder, promptEncoder, libraryFilter…
   │
   ▼
StorageManager (src/services/storage.ts): the only writer of the Prompts, Categories and settings
   │  Admission (src/services/promptAdmission.ts) on every write of Prompt text
   ▼
chrome.storage.local
```

The popup, the side panel and the service worker each have their own `StorageManager` instance, and share the stored data. The content script reads Prompts with `readPrompts()` of `promptAdmission.ts`, and never writes them.

One exception: the reset action of `src/components/ErrorBoundary.tsx` calls `chrome.storage.local.clear()` directly, outside `StorageManager` and its locks, so it is not serialized with other writes. `clearAllData()` of `StorageManager` is the serialized way to clear.

Other keys of `chrome.storage.local` belong to the code that owns them, which writes them directly:

| Key | Owner |
|-----|-------|
| `usageHistory` | `src/services/UsageTracker.ts` |
| `toast_settings` | `src/hooks/useToast.ts` |
| `promptLibrarySettings` (site integration settings), `interfaceMode` | `src/components/SettingsView.tsx` |
| `grantedPermissions` | `src/background/background.ts` |

---

## Services

| File | Job |
|------|-----|
| `src/services/storage.ts` | `StorageManager`, a singleton: every read and write of the Prompts, the Categories and the settings, Backup import and export, storage use, the upgrade pass. Prompt text goes through Admission inside its writing methods |
| `src/services/promptAdmission.ts` | Admission: the one place Prompt text is checked, the one reader of stored Prompts, the limits (`PROMPT_LIMITS`). Pure, no `chrome.*`; shared by the popup, the service worker and the content script |
| `src/services/promptManager.ts` | `PromptManager`, a singleton over `StorageManager`: creating and updating Prompts, search with highlights, sorting, statistics, duplicate detection, title generation |
| `src/services/SearchIndex.ts` | The inverted index behind `PromptManager`'s search |
| `src/services/SimilarityAlgorithms.ts` | The string similarity behind duplicate detection |
| `src/services/libraryFilter.ts` | The Library filter (All, Pinned, Most Used, one Category): which Categories get a pill, and which Prompts a filter keeps |
| `src/services/UsageTracker.ts` | Usage events for Analytics: one per insertion into a Platform (the service worker records it), kept 30 days |
| `src/services/promptEncoder.ts` | Share codes: one Prompt as compact text, decoded without changing the text (Admission happens when the Prompt is saved) |
| `src/services/configurationEncoder.ts` | Import and export codes of a custom site configuration: compression, checksum, validation of the decoded configuration |

Helpers the services lean on: `src/utils/asyncMutex.ts` (locks), `src/utils/storageQuota.ts` (`describeStorageUsage`, the one way to show storage use), the types of `src/types/index.ts` (`Prompt`, `Category`, `Settings`, `ElementFingerprint`…).

### StorageManager: locks

`AsyncMutex` queues operations per key. `StorageManager` creates it with a `scope`, so `withLock(key, operation)` runs `navigator.locks.request('StorageManager:' + key, operation)`: the popup, the side panel and the service worker (same extension origin) exclude each other on the Prompts, Categories and settings keys. The operation's result or error comes back unchanged and the lock is released either way. Where the Web Locks API is missing, or refuses the request without running the operation (it throws, or rejects with a `SecurityError` in an opaque origin), the in-memory queue is used (tests, old browsers).

- Nested keys are taken in the fixed order CATEGORIES → PROMPTS → SETTINGS, and nothing under a lock awaits another context.
- Clear All Data takes all three, so a write from another context lands wholly before or after it.
- Reads take no lock, except reading the Categories, which takes CATEGORIES only to write a missing default Category.
- Settings writes take only the SETTINGS key, so a toggle never waits on a Prompt write.
- `UsageTracker` keeps a plain in-memory `AsyncMutex`.

### StorageManager: quota

Sizes are the bytes Chrome stores (the JSON in UTF-8, as `getBytesInUse` counts them). The Prompts may take 8 MB, and a write must leave Chrome's 10 MB quota under 98%. A write refused for space throws an error of type `STORAGE_QUOTA_EXCEEDED`; App then opens the `StorageWarning`. Show storage use through `describeStorageUsage`, so the Settings bar and the warning give the same figures.

### Admission

The terms (Admission, Verbatim, Hidden character) are defined in [`CONTEXT.md`](../CONTEXT.md); the decision is [ADR-001](./adr/ADR-001-store-and-deliver-prompts-verbatim.md).

- **Once, at the write path:** Hidden characters removed, title and Category trimmed, empty or over-limit text refused, never shortened.
- **Verbatim afterwards:** text is never changed when it is read, shown, copied or inserted.
- **One reader:** `readPrompts()` is shared by `StorageManager` and the content script; reading never writes.
- **Enforced by the compiler:** `StoredPrompt` and `AdmittedPrompt` are nominal types, and `StorageManager`'s private writer accepts only those, so a route that skips Admission does not compile.

What `promptAdmission.ts` exports, by job (the doc comment above each export gives the details):

| Job | Exports |
|-----|---------|
| Check text without saving (the form's dry check and live counter) | `admit` |
| The routes that produce a Prompt to store | `admitNew` (create), `admitEdit` (edit: only the fields in the patch are checked, so a legacy over-limit Prompt stays editable), `admitRestored` (Backup restore: keeps id, usage and timestamps) |
| Non-text changes that keep the `StoredPrompt` type | `recordUse`, `togglePin`, `repointPrompt` |
| Read stored Prompts | `readPrompt`, `readPrompts` |
| Upgrade pass over raw stored data | `scrubStored`, `scrubStoredCategories`, `scrubStoredSettings`, `planCategoryMerge` |
| Restore | `matchStoredCategory` |
| Refusal | `AdmissionRefusedError`: an `AppError` of type `VALIDATION_ERROR` whose `errors` hold one refusal per field, each with a message ready to show |
| Limits | `PROMPT_LIMITS`, read by the forms, `PromptManager` and `StorageManager` |

A refusal keeps its type through `StorageManager` and `PromptManager`, so a caller can check `error instanceof AdmissionRefusedError` (the Backup restore in `SettingsView` does, to skip and report a refused Prompt and restore the rest).

### Upgrade pass

`StorageManager.upgradeStoredData()` runs once per extension update (the service worker calls it from `chrome.runtime.onInstalled` when the reason is `update`). It runs `scrubStoredCategories`, then `scrubStored` and `scrubStoredSettings` with its merges, over the raw stored values, under the CATEGORIES, PROMPTS and SETTINGS locks in that order, and writes every key that changed in one atomic set.

- It never trims Prompt text; it trims the labels that Admission trims.
- Categories whose names become the same ignoring case are merged into the first; their Prompts move to the kept Category.
- It is the only code that writes raw, untyped entries to the prompts key, because it must keep malformed or over-limit entries rather than drop them.

### Backup restore

- `importCategory` matches a Backup's Category to a stored one by admitted name; the stored Category keeps its id and name and takes the other fields (color) from the Backup. Matched by id, it never renames the default Category and never renames a Category into another's name, and a rename it does apply moves the Prompts with it (`repointPrompt`), in one atomic write under CATEGORIES then PROMPTS. A Category without a string id is given one; a color that is not a hex color is dropped.
- `importPrompt` uses `matchStoredCategory`, so a Prompt whose Category the Library spells differently takes the stored spelling. A Category that neither the Backup nor the Library has is created from the admitted name, in one atomic write with the Prompt (CATEGORIES then PROMPTS).

---

## Hooks

| File | Job | Used by |
|------|-----|---------|
| `src/hooks/usePrompts.ts` | The Prompts with loading and error state; create, update, delete, pin | `App` |
| `src/hooks/useCategories.ts` | The Categories with loading and error state; create, update, delete | `App` |
| `src/hooks/useSearchWithDebounce.ts` | Search field state: the typed query at once, the search after a debounce | `App` |
| `src/hooks/useSearch.ts` | The filtering and highlights behind `useSearchWithDebounce` | `useSearchWithDebounce` |
| `src/hooks/useToast.ts` | Toast queue and the toast settings | `App` |
| `src/hooks/useTheme.ts` | Theme (light, dark, system), applied to `<html>` and stored | `src/contexts/ThemeContext.tsx` only |
| `src/hooks/useClipboard.ts` | Copy to the clipboard, with a status that resets | `App`, site integration Settings |
| `src/hooks/useExtensionContext.ts` | Popup or side panel, detected once | `ViewHeader` |
| `src/hooks/useDropdownClose.ts` | Close a menu on outside click or Escape | `Dropdown` |
| `src/hooks/useEnhancedFloatingPosition.ts` | Keep a menu in the viewport (flip, shift) | `Dropdown` |
| `src/hooks/useSitePermissions.ts` | Check and request host permissions for a site | site integration Settings, `usePickerWindow` |
| `src/hooks/usePickerWindow.ts` | The element picker flow for a custom site | `SiteIntegrationSection` |
| `src/hooks/useUsageStats.ts` | Usage history and Prompts aggregated for Analytics | Analytics |
| `src/hooks/useSummaryMetrics.ts` | Top Platform, peak day and top Category from those stats | Analytics |
| `src/hooks/useNow.ts` | The current time, refreshed at an interval, for relative dates | Analytics |

Components read the theme through `useThemeContext()` of `src/contexts/ThemeContext.tsx`, never `useTheme()` directly: `ThemeProvider` calls `useTheme` once, so every component sees the same theme.

## Adding a service or hook

1. Write the Prompts, the Categories and the settings only through `StorageManager`; a new route that brings Prompt text into the Library goes through an Admission route. Another key belongs to the one module that owns it: add it to the table of owners above.
2. Take locks in the order CATEGORIES → PROMPTS → SETTINGS, and await nothing from another context under a lock.
3. Test it in the `__tests__/` folder next to it ([TESTING.md](./TESTING.md)).
4. Add a row to the table of this page: one line on its job, no signature.
