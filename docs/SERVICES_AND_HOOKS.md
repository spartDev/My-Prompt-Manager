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
| `src/services/storage.ts` | `StorageManager`, a singleton: the only writer of the Prompts, the Categories and the settings, and the read API the popup and side panel use for them (direct readers too: the content script in `src/content/utils/storage.ts` and `src/content/utils/theme-manager.ts`, and `SettingsView`'s `loadSettings`); Backup import and export, storage use, the upgrade pass. Prompt text goes through Admission inside its writing methods |
| `src/services/promptAdmission.ts` | Admission: the one place Prompt text is checked, the one reader of stored Prompts, the limits (`PROMPT_LIMITS`). Pure, no `chrome.*`; shared by the popup, the service worker and the content script |
| `src/services/promptManager.ts` | `PromptManager`, a singleton over `StorageManager`: creating and updating Prompts, search with highlights, sorting, statistics, duplicate detection, title generation |
| `src/services/SearchIndex.ts` | The inverted index behind `PromptManager`'s search |
| `src/services/SimilarityAlgorithms.ts` | The string similarity behind duplicate detection |
| `src/services/libraryFilter.ts` | The Library filter (All, Pinned, Most Used, one Category, and from Analytics Never used and Possible duplicates): which Categories get a pill, and which Prompts a filter keeps |
| `src/services/libraryReview.ts` | A review asked from the full-page Analytics view: `requestLibraryReview` opens the side panel of the window within the click and leaves the Library filter, with the window's id, under `pendingLibraryReview` in `chrome.storage.session`; the side panel takes it once (`takePendingLibraryReview`, on opening and through `onLibraryReviewRequested`) |
| `src/services/usageInsights.ts` | What Analytics shows, as pure functions: Insertions per weekday (Monday first) and the busiest one, the Platforms and the Categories ranked by Insertions (`platformRanking`, `categoryRanking`, the first of each being the top one), the busiest entry of any counted series (`busiest`), Prompts ranked by Insertions in the period, the Never used count, and the Duplicate pairs counted from `PromptManager.findDuplicatePrompts` groups |
| `src/services/UsageTracker.ts` | Usage events for Analytics: one per insertion into a Platform (the service worker records it). Analytics reads the last 30 days; storage drops older events only once the history reaches 9,000 events, and keeps at most 10,000 (`cleanup()` has no production caller) |
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
- `deleteCategory` moves the Category's Prompts to the default Category in one atomic write and resolves to a `DeletedCategory` (the Category, its place, the Prompts it moved with their last edit before and after). `restoreCategory` takes it to undo the deletion: the Category comes back at its place with its id and color, its name admitted again and refused if another Category took it meanwhile, and the Prompts still in the default Category move back (`returnPrompt`), those not edited since getting back their last edit from before the move. CATEGORIES then PROMPTS.
- `importPrompt` uses `matchStoredCategory`, so a Prompt whose Category the Library spells differently takes the stored spelling. A Category that neither the Backup nor the Library has is created from the admitted name, in one atomic write with the Prompt (CATEGORIES then PROMPTS).

---

## Hooks

| File | Job | Used by |
|------|-----|---------|
| `src/hooks/usePrompts.ts` | The Prompts with loading and error state; create, update, delete, pin | `App` |
| `src/hooks/useCategories.ts` | The Categories with loading and error state; create, update, delete, and restore (the Undo of a delete) | `App` |
| `src/hooks/useCategorySheet.ts` | State of the Category sheet, apart from its drawing: open, closing (`MOTION.categorySheetOut`, none under reduced motion; cancelled by opening again) or gone, the mode, the draft name and color | `CategoryManager` |
| `src/hooks/useSearchWithDebounce.ts` | Search field state: the typed query at once, the search after a debounce | `App` |
| `src/hooks/useSearch.ts` | The filtering and highlights behind `useSearchWithDebounce` | `useSearchWithDebounce` |
| `src/hooks/useToast.ts` | The one Notification on screen (a new one replaces it) and the on/off switch of `toast_settings` | `App` |
| `src/hooks/useTheme.ts` | Theme (light, dark, system), applied to `<html>` and stored | `src/contexts/ThemeContext.tsx` only |
| `src/hooks/useClipboard.ts` | Copy to the clipboard, with a status that resets | `App`, site integration Settings |
| `src/hooks/useExtensionContext.ts` | Popup or side panel, detected once | `ViewHeader` |
| `src/hooks/useDropdownClose.ts` | Close a menu on outside click or Escape | `Dropdown` |
| `src/hooks/useEnhancedFloatingPosition.ts` | Keep a menu in the viewport (flip, shift) | `Dropdown` |
| `src/hooks/useSitePermissions.ts` | Check and request host permissions for a site | site integration Settings, `usePickerWindow` |
| `src/hooks/usePickerWindow.ts` | The element picker flow for a custom site | `SiteIntegrationSection` |
| `src/hooks/useUsageStats.ts` | Usage history, Prompts and Categories, loaded once, with the Insertions per day and per time of day for the charts | Analytics, its full-page view |
| `src/hooks/useNow.ts` | The current time, refreshed at an interval, for relative dates | Full-page Analytics view |
| `src/hooks/useCountUp.ts` | A number counting up from 0 with an ease-out (`MOTION.countUp`); the value at once under reduced motion | Analytics hero |
| `src/hooks/useDuplicateGroups.ts` | The Duplicate pairs of the Library, looked for after the first paint; null while looking or when the finder gives up (over 1,000 Prompts, timeout) | Analytics Tidy up |
| `src/hooks/useRadioGroup.ts` | Keyboard behavior of a WAI-ARIA radio group: one tab stop, arrows, Home and End move focus and selection, `locked` ignores input. `src/components/__tests__/radioGroups.test.ts` fails when a component renders `role="radio"` without it | `LibraryFilterBar`, `AppearanceSection`, `InterfaceModeSelector` |
| `src/hooks/useAnimatedPresence.ts` | Keeps a panel in the document for its exit animation (`MOTION.sheetOut`): `shown` is what to render, `exiting` says to play the exit; reopening while leaving cancels the unmount, and the timer is cleared on unmount. Instant under `prefers-reduced-motion` | `App` (the editor sheet) |
| `src/hooks/useModalFocus.ts` | Keyboard behavior of a modal dialog: focus moves in, Tab and Shift+Tab wrap inside (onto the panel when every control is disabled), Escape closes, the focus returns to the opener. Beneath a confirmation (`isOpen` false while the panel stays in the document, `inert`) it pauses, keeps its opener, and resumes where the confirmation leaves the focus | `ConfirmDialog`, `AnalyticsTab`, `StorageWarning`, `ConfigurationPreview`, `CategorySheet` |

Components read the theme through `useThemeContext()` of `src/contexts/ThemeContext.tsx`, never `useTheme()` directly: `ThemeProvider` calls `useTheme` once, so every component sees the same theme.

## Adding a service or hook

1. Write the Prompts, the Categories and the settings only through `StorageManager`; a new route that brings Prompt text into the Library goes through an Admission route. Another key belongs to the one module that owns it: add it to the table of owners above.
2. Take locks in the order CATEGORIES → PROMPTS → SETTINGS, and await nothing from another context under a lock.
3. Test it in the `__tests__/` folder next to it ([TESTING.md](./TESTING.md)).
4. Add a row to the table of this page: one line on its job, no signature.
