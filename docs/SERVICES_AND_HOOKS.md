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

One exception: the Reset Data action of `src/components/ErrorBoundary.tsx` clears storage directly with `clearStorageKeepingRecords()` of `src/services/clearStorage.ts`, under the What's new and Welcome locks only (`withKeptRecordLocks`), outside `StorageManager` and its locks, so it is not serialized with other writes; when the records cannot be kept it falls back to `chrome.storage.local.clear()`. `clearAllData()` of `StorageManager` is the serialized way to clear. Both keep the `whatsNew` and `welcome` records and empty every other key: they remove the other keys in one call, so neither record leaves storage, even for a moment. The one exception is the Reset Data fallback: when the other keys cannot be removed, its `chrome.storage.local.clear()` removes both records too.

Other keys of `chrome.storage.local` belong to the code that owns them, which writes them directly:

| Key | Owner |
|-----|-------|
| `usageHistory` | `src/services/UsageTracker.ts` |
| `toast_settings` | `src/hooks/useToast.ts` |
| `promptLibrarySettings` (the Site settings) | `src/services/siteSettings.ts`, the only reader and the only writer; the launch decision reads the key in its one get (`src/hooks/useLaunchScreen.ts`) and parses it with `parseSiteSettings` |
| `iconPlacementRepairs` | `src/services/iconPlacementRepairs.ts`; written by the service worker only |
| `interfaceMode` | `src/components/SettingsView.tsx` |
| `grantedPermissions` | `src/background/background.ts` |
| `whatsNew` (`installedVersion`: the Release of install; `lastSeenVersion`: the Last seen Release) | `src/whatsNew/storage.ts`, the only reader and writer; the launch decision reads the key in its one get with `welcome` and the Site settings (`src/hooks/useLaunchScreen.ts`) and parses it with `parseWhatsNewRecord`. The service worker records the Release of a first install (`recordInstall`) and, on an update, the Release the update came from when the record has none yet, as for an install older than What's new (`recordUpdateFrom`). A record with no `installedVersion` counts as a first install (`isFirstInstall` of `src/whatsNew/decide.ts`): a popup opened before the service worker's write shows nothing, and What's new shows at a later opening after an update. `markReleaseSeen` is the only writer of the Last seen Release; only the launch writer (`writeLaunchState`, `src/launch/write.ts`) calls it, the service worker included, and that writer writes nothing in Debug mode. Outside the Site settings, so Reset settings leaves it; Clear All Data and the error screen's Reset Data keep it too (`src/services/clearStorage.ts`), so What's new does not come back for a seen Release nor show after a first install |
| `welcome` (`{status: 'pending', step, packs?}`: the Welcome to resume at `step` 0, 1 or 2, with the Packs selected; `{status: 'done'}`: the Welcome finished) | `src/welcome/storage.ts`, the only reader and the low-level writer; a value that is not a record reads as none (`parseWelcomeRecord`), which the launch decision takes as unreadable, never the Welcome. The launch decision reads the key in its one get with `whatsNew` and the Site settings (`src/hooks/useLaunchScreen.ts`) and parses it with `parseWelcomeRecord`. The service worker writes the facts of the install: on a first install the Welcome as pending at step 0 (`recordWelcomePending`), on an update the Welcome as done when there is no record, as for every install from before the Welcome (`markExistingUserDone`); both keep a record already stored, so a pending Welcome resumes after an update (decision Q2 of My-Prompt-Manager-ojz) and a finished one stays finished when Chromium fires 'install' again at each launch of an extension loaded from the command line (the e2e tests). `writeWelcomeRecord` is the low-level writer of the launch writer of the popup and side panel (`writeLaunchState`, `src/launch/write.ts`), and nothing else calls it, the service worker included: it writes a step only over a pending record, so the popup and side panel never make a record the service worker did not, keeps the stored Packs when a step comes without any, writes the end over anything but the end, and never replaces a done record. Outside the Site settings, so Reset settings leaves it; Clear All Data and the error screen's Reset Data keep it too (`src/services/clearStorage.ts`), so the Welcome never comes back after a clear |

---

## Services

| File | Job |
|------|-----|
| `src/services/storage.ts` | `StorageManager`, a singleton: the only writer of the Prompts, the Categories and the settings, and the read API the popup and side panel use for them (direct readers too: the content script in `src/content/utils/storage.ts` and `src/content/utils/theme-manager.ts`, `SettingsView`'s `loadSettings`, and `useLaunchScreen`, which reads the `prompts` key (`STORAGE_KEYS.PROMPTS`) itself to tell an empty Library from one storage cannot read); Backup import and export, adding the Packs of the Welcome, storage use, the upgrade pass. Prompt text goes through Admission inside its writing methods |
| `src/services/promptAdmission.ts` | Admission: the one place Prompt text is checked, the one reader of stored Prompts, the limits (`PROMPT_LIMITS`). Pure, no `chrome.*`; shared by the popup, the service worker and the content script |
| `src/services/siteSettings.ts` | The Site settings, for the popup, the service worker and the content script (no `StorageManager`, no React). Reading: their one shape (`SiteSettings`, with the `CustomSite` of `src/types/index.ts`), the defaults, the validated read (`parseSiteSettings`, and `readSiteSettings` over `chrome.storage.local`, which rejects when storage cannot be read), and the one rule for whether the extension works on a hostname (`isHostnameEnabled`, `isPlatformEnabled`, `enabledPlatforms`, `enabledCustomSite`, `enabledHostnames`). Stored shape: the Platform choices (`platformChoices`, what the user turned on or off, by hostname), the Custom sites and the debug switch, with beside them the list of the Platforms that are on (`enabledSites`), written for a rollback to a release before the Platform choices, and a copy of it (`enabledSitesWritten`): such a release saves the whole object back, changing only the list, so a list that no longer matches its copy carries the switches made there, which win over the Platform choices on the next update; a Platform without a choice takes its `defaultEnabled`, so a Platform added in a later release is on for every user. A store of a release before that holds the list of the Platforms that were on (`enabledSites`): it is read as the choices it stands for, against the frozen `PLATFORMS_OF_THE_ENABLED_LIST` (one of those Platforms missing from the list is off, M365 Copilot following Copilot: maintainer decision of 2026-11-15, ticket My-Prompt-Manager-dx8), and `upgradeStoredSiteSettings()` writes it back as Platform choices under the Site settings lock (the service worker runs it on update and at every browser startup). One of the other hosts of a Platform (`otherHostnames`, such as `copilot.cloud.microsoft` for M365 Copilot) holds no choice and is not on the list for a rollback: it is on or off as its Platform is, whatever a store says of it. A Custom site entry with no hostname, display name, switch or date is left out, and so is one at a host that is now a Platform's: the Platform's switch decides there. Saving: `changeSiteSettings(change)` applies one change (a Platform with its linked Platforms, a Custom site added, removed or switched, the debug switch, a reset) to what storage holds, under its own lock, and sends no message: the content script follows the key in storage. It rejects, with storage untouched, when storage cannot be read or written; a change that changes nothing writes nothing; a reset removes the key. `onSiteSettingsChanged` follows the key in `chrome.storage.onChanged`: Settings shows what it gives, and the content script starts on its site, stops, or starts over when the Custom site of its hostname changes (a write that leaves both as they were, like `upgradeStoredSiteSettings()`, changes nothing there). `SettingsView` shows what these return and never saves a copy of its own |
| `src/launch/write.ts` | `writeLaunchState(change, {debugMode})`: the one writer of the launch state from the popup and side panel, which writes nothing, and reads nothing, in Debug mode: the one Debug check of these writes, the low-level writers having none. Changes: `welcome-step` (the step reached and the Packs selected, over a pending record only), `welcome-done` (the Welcome finished, and the installed Release as the Last seen Release, so What's new never follows the Welcome at a later opening), `welcome-found-done` (the Welcome record alone as done, for a Welcome an opening found finished: a pending record over a Library with Prompts; the Last seen Release is left to What's new, which may show at that opening), `release-seen` (What's new closed). A done record is never turned back to pending. `src/test/guardrails/launch-state-guardrails.test.ts` fails when a module of `src/` other than it, the service worker included, names `writeWelcomeRecord` or `markReleaseSeen`, or when a module other than the service worker names the writers of the install (`recordWelcomePending`, `markExistingUserDone`, `recordInstall`, `recordUpdateFrom`) |
| `src/services/clearStorage.ts` | What Clear All Data and the error screen's Reset Data keep: the What's new and Welcome records (`KEPT_BY_CLEAR`); `withKeptRecordLocks` takes their locks in order, and `clearStorageKeepingRecords` removes every other key in one call |
| `src/services/iconPlacementRepairs.ts` | Icon placement repairs of the built-in Platforms (design §6), apart from the Site settings: how each content script last placed the icon when not in the Toolbar (`overlay`, `override`) and the element the user picked in Settings (an override, the shape of a Custom site's positioning). `applyIconPlacementRepairChange` is the lifecycle, pure: a report of the Anchored overlay records it, a pick stores the override, a report of the Toolbar drops the Platform's entry, override included, unless another tab of the Platform is off the Toolbar or reported `waiting` (its icon waits within the grace period, never a status). After an extension update or a browser restart, which empty the tabs' placements, `expectIconPlacementReports` counts each open tab of a Platform with a repair as `waiting` until it reports again. Repairs are kept per host: a tab's report from a host a Platform redirects to drops the repair of the host that redirects there when it has no tab open (`redirectSourcesOf`: m365.cloud.microsoft to copilot.cloud.microsoft, never the reverse), and `repairForHostnames` shows a row the newest repair written (each entry keeps a write count, `written`, since `chrome.storage` returns keys sorted). A content script reports its Toolbar while its host, or a host that redirects to it, has a repair, so the repair of that host is cleared. `changeIconPlacementRepairs` applies a change under its own lock; the service worker calls it on `ICON_PLACEMENT_REPORTED` (hostname of the sender tab, built-in Platforms only) and on a pick started with `repairHostname`. No `StorageManager`, no React: the content script reads it |
| `src/services/promptManager.ts` | `PromptManager`, a singleton over `StorageManager`: creating and updating Prompts, search with highlights, sorting, statistics, duplicate detection, title generation |
| `src/services/SearchIndex.ts` | The inverted index behind `PromptManager`'s search |
| `src/services/SimilarityAlgorithms.ts` | The string similarity behind duplicate detection and `promptLookalike.ts` |
| `src/services/promptLookalike.ts` | `searchLookalike` (one Prompt per step) and `findLookalike` (all at once): the Prompt of the Library the editor's text looks like (60% alike or more, text over 20 characters, the edited Prompt left out). A text over 1,000 characters is compared by the runs of 4 characters the two texts share, in linear time, capped by the ratio of the two lengths. Pure |
| `src/services/libraryFilter.ts` | The Library filter (All, Pinned, Most Used, one Category, and from Analytics Never used and Possible duplicates): which Categories get a pill, and which Prompts a filter keeps |
| `src/services/libraryReview.ts` | A review asked from the full-page Analytics view: `requestLibraryReview` opens the side panel of the window within the click and leaves the Library filter under a key of that window (`pendingLibraryReview:<windowId>`) in `chrome.storage.session`; the side panel takes it once (`takePendingLibraryReview`, on opening and through `onLibraryReviewRequested`) |
| `src/services/usageInsights.ts` | What Analytics shows, as pure functions: Insertions per weekday (Monday first) and the busiest one, the Platforms and the Categories ranked by Insertions (`platformRanking`, `categoryRanking`, the first of each being the top one), the busiest entry of any counted series (`busiest`), Prompts ranked by Insertions in the period, the Never used count, and the Duplicate pairs counted from `PromptManager.findDuplicatePrompts` groups |
| `src/services/UsageTracker.ts` | Usage events for Analytics: one per insertion into a Platform (the service worker records it). Analytics reads the last 30 days; storage drops older events only once the history reaches 9,000 events, and keeps at most 10,000 (`cleanup()` has no production caller) |
| `src/services/promptEncoder.ts` | Share codes: one Prompt as compact text, decoded without changing the text (Admission happens when the Prompt is saved) |
| `src/services/configurationEncoder.ts` | Import and export codes of a custom site configuration: compression, checksum, validation of the decoded configuration |

Helpers the services lean on: `src/utils/asyncMutex.ts` (locks), `src/utils/storageQuota.ts` (`describeStorageUsage`, the one way to show storage use), the types of `src/types/index.ts` (`Prompt`, `Category`, `Settings`, `ElementFingerprint`…).

### StorageManager: locks

`AsyncMutex` queues operations per key. `StorageManager` creates it with a `scope`, so `withLock(key, operation)` runs `navigator.locks.request('StorageManager:' + key, operation)`: the popup, the side panel and the service worker (same extension origin) exclude each other on the Prompts, Categories and settings keys. The operation's result or error comes back unchanged and the lock is released either way. Where the Web Locks API is missing, or refuses the request without running the operation (it throws, or rejects with a `SecurityError` in an opaque origin), the in-memory queue is used (tests, old browsers).

- Nested keys are taken in the fixed order CATEGORIES → PROMPTS → SETTINGS, and nothing under a lock awaits another context.
- The Site settings have a lock of their own, in `src/services/siteSettings.ts` (`withSiteSettingsLock`, scope `SiteSettings`), and so do the icon placement repairs, in `src/services/iconPlacementRepairs.ts` (`withIconPlacementRepairsLock`, scope `IconPlacementRepairs`), and so does the What's new record, in `src/whatsNew/storage.ts` (`withWhatsNewLock`, scope `WhatsNew`), and the Welcome record, in `src/welcome/storage.ts` (`withWelcomeLock`, scope `Welcome`), all shared across contexts the same way. `clearAllData()` takes them after SETTINGS, the Site settings lock first, then the icon placement repairs lock, then the What's new lock, the Welcome lock last (innermost), so a change waiting in another context cannot write any of them back after the clear. The error screen's Reset Data takes the What's new lock then the Welcome lock. Nothing else takes them together with another lock.
- Clear All Data takes all seven, so a write from another context lands wholly before or after it.
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
| The routes that produce a Prompt to store | `admitNew` (create, and each Prompt of a Pack), `admitEdit` (edit: only the fields in the patch are checked, so a legacy over-limit Prompt stays editable), `admitRestored` (Backup restore: keeps id, usage and timestamps) |
| Non-text changes that keep the `StoredPrompt` type | `recordUse`, `togglePin`, `repointPrompt` |
| Read stored Prompts | `readPrompt`, `readPrompts` |
| Upgrade pass over raw stored data | `scrubStored`, `scrubStoredCategories`, `scrubStoredSettings`, `planCategoryMerge` |
| Restore, adding a Pack | `matchStoredCategory` |
| Refusal | `AdmissionRefusedError`: an `AppError` of type `VALIDATION_ERROR` whose `errors` hold one refusal per field, each with a message ready to show |
| Limits | `PROMPT_LIMITS`, read by the forms, `PromptManager` and `StorageManager` |

A refusal keeps its type through `StorageManager` and `PromptManager`, so a caller can check `error instanceof AdmissionRefusedError` (the Backup restore in `SettingsView` does, to skip and report a refused Prompt and restore the rest).

### Upgrade pass

`StorageManager.upgradeStoredData()` runs once per extension update (the service worker calls it from `chrome.runtime.onInstalled` when the reason is `update`), and again at every browser startup. It runs `scrubStoredCategories`, then `scrubStored` and `scrubStoredSettings` with its merges, over the raw stored values, under the CATEGORIES, PROMPTS and SETTINGS locks in that order, and writes every key that changed in one atomic set. Beside it, apart from its locks, the service worker runs `upgradeStoredSiteSettings()` (`src/services/siteSettings.ts`), which writes Site settings stored as the list of the Platforms that were on back as the Platform choices, under the Site settings lock.

- It never trims Prompt text; it trims the labels that Admission trims.
- Categories whose names become the same ignoring case are merged into the first; their Prompts move to the kept Category.
- It is the only code that writes raw, untyped entries to the prompts key, because it must keep malformed or over-limit entries rather than drop them.

### Backup restore

- `importCategory` matches a Backup's Category to a stored one by admitted name; the stored Category keeps its id and name and takes the other fields (color) from the Backup. Matched by id, it never renames the default Category and never renames a Category into another's name, and a rename it does apply moves the Prompts with it (`repointPrompt`), in one atomic write under CATEGORIES then PROMPTS. A Category without a string id is given one; a color that is not a hex color is dropped.
- `deleteCategory` moves the Category's Prompts to the default Category in one atomic write and resolves to a `DeletedCategory` (the Category, its place, the Prompts it moved with their last edit before and after). `restoreCategory` takes it to undo the deletion: the Category comes back at its place with its id and color, its name admitted again and refused if another Category took it meanwhile, and the Prompts still in the default Category move back (`returnPrompt`), those not edited since getting back their last edit from before the move. CATEGORIES then PROMPTS.
- `importPrompt` uses `matchStoredCategory`, so a Prompt whose Category the Library spells differently takes the stored spelling. A Category that neither the Backup nor the Library has is created from the admitted name, in one atomic write with the Prompt (CATEGORIES then PROMPTS).

### Adding Packs

`addPacks(packs)` adds the Packs the Welcome's last step chose (the type is in `src/welcome/types.ts`), under CATEGORIES then PROMPTS, and resolves to `{ added, skipped, packNames }`: the Prompts added, those skipped, and the names of the Packs that added at least one, for the Notification.

- Each Prompt is admitted as a new Prompt (`admitNew`) and each Pack's name as a Category name.
- A Prompt whose content the Library already has, or an earlier Prompt of the Packs, is skipped: the same content, surrounding spaces aside, as `findDuplicatePrompts` compares it. Nothing is stored to remember a Pack, so adding the same Packs again, as the owner does when finishing the Welcome again in Debug mode, adds nothing and writes nothing.
- A Pack's Prompts go into the Category with the Pack's name ignoring case, as the Library spells it (`matchStoredCategory`), which keeps its color; else into a Category created with the Pack's color (dropped when it is not a hex color), only when at least one Prompt of the Pack is added.
- All or nothing: a refused Prompt or name, the Prompt limit, the Library cap or the quota (checked as `savePrompt` checks them, for every Prompt at once) refuses the whole add before anything is written. Otherwise the Categories and the Prompts are written in one atomic set, the default Category first among them when it is missing.

---

## Hooks

| File | Job | Used by |
|------|-----|---------|
| `src/hooks/usePrompts.ts` | The Prompts with loading and error state; create, update, delete, pin | `App` |
| `src/hooks/useCategories.ts` | The Categories with loading and error state; create, update, delete, and restore (the Undo of a delete) | `App` |
| `src/hooks/useAddPacks.ts` | The add the Welcome's last step calls: `StorageManager.addPacks`, then the Prompts and the Categories read again (the `refreshPrompts` and `refreshCategories` it is given), so the Library lists them as soon as it resolves; a refusal rejects to the caller with nothing reloaded | The Welcome, through `App` |
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
| `src/hooks/useIconPlacementRepairs.ts` | The icon placement repairs, kept up to date from storage, and `placeIcon`: the Element picker on a tab of the Platform, the pick kept by the service worker; in the action popup (popup.html in no tab, not the picker window), the popup then closes so it does not cover the page | `SiteIntegrationSection` (Place the icon) |
| `src/hooks/useUsageStats.ts` | Usage history, Prompts and Categories, loaded once, with the Insertions per day and per time of day for the charts | Analytics, its full-page view |
| `src/hooks/useNow.ts` | The current time, refreshed at an interval, for relative dates | Full-page Analytics view |
| `src/hooks/useCountUp.ts` | A number counting up from 0 with an ease-out (`MOTION.countUp`); the value at once under reduced motion | Analytics hero |
| `src/hooks/useLookalike.ts` | The Lookalike of the editor's text, searched once typing pauses (400 ms), 8 ms of comparisons per task (at least one); a search is dropped when the text changes | `PromptEditor` (This looks familiar) |
| `src/hooks/useDuplicateGroups.ts` | The Duplicate pairs of the Library, looked for after the first paint; null while looking or when the finder gives up (over 1,000 Prompts, timeout) | Analytics Tidy up |
| `src/hooks/useRadioGroup.ts` | Keyboard behavior of a WAI-ARIA radio group: one tab stop, arrows, Home and End move focus and selection, `locked` ignores input. `src/components/__tests__/radioGroups.test.ts` fails when a component renders `role="radio"` without it | `LibraryFilterBar`, `AppearanceSection`, `InterfaceModeSelector` |
| `src/hooks/useAnimatedPresence.ts` | Keeps a panel in the document for its exit animation (`MOTION.sheetOut`): `shown` is what to render, `exiting` says to play the exit; reopening while leaving cancels the unmount, and the timer is cleared on unmount. Instant under `prefers-reduced-motion` | `App` (the editor sheet) |
| `src/hooks/useLaunchScreen.ts` | What an opening shows first, decided once on mount by `decideLaunch` of `src/launch/decide.ts`, the one pure rule for the Welcome and What's new (it wraps `decideWhatsNew` of `src/whatsNew/decide.ts`, unchanged): `screen` is the Welcome at a step (with the Packs selected at an earlier opening, when there are some), What's new with its Release notes, or nothing over the Library; `loading` is true until then. Reads the `welcome` and `whatsNew` records and the Site settings (Debug mode) in one `chrome.storage.local.get`, and the Library (the `prompts` key) only when the Welcome is pending: none stored is an empty Library, a value that is not a list, or a list with no readable Prompt, is a doubt in which the Welcome does not show; a failed read shows nothing and is logged, never the Welcome. A read that ends after the unmount decides nothing. A pending record over a Library with Prompts, which the decision reads as a Welcome finished (`isWelcomeFoundDone` of `src/launch/decide.ts`), is recorded done at the opening (`welcome-found-done`), so the Welcome cannot come back once that Library is emptied. Every write goes through `writeLaunchState` of `src/launch/write.ts`, bound to the Debug mode of the opening, started at once and not waited for, its failure logged: `saveStep(step, packs?)` records the step the Welcome is at, so a Welcome closed by accident resumes there (only while the Welcome shows); `finishWelcome()` shows at once what follows the Welcome, decided again with `welcomeFinishedThisOpening` (the Library; in Debug mode What's new, as Debug mode forces it, so the Welcome comes first and What's new after in the same opening) and records the Welcome finished and the installed Release seen (once, only while the Welcome shows); `closeWhatsNew()` hides What's new and marks the Release as seen (once, only while What's new shows). `enabled: false` (the element picker's Settings window) reads nothing. Debug mode stays inside: nothing it returns names it | `App`, which shows only the background until the decision, then the Welcome full-screen or the Library, with What's new through `src/components/whatsNew/WhatsNewHost.tsx` |
| `src/hooks/useModalFocus.ts` | Keyboard behavior of a modal dialog: focus moves in, Tab and Shift+Tab wrap inside (onto the panel when every control is disabled), Escape closes, the focus returns to the opener. Beneath a confirmation (`isOpen` false while the panel stays in the document, `inert`) it pauses, keeps its opener, and resumes where the confirmation leaves the focus | `ConfirmDialog`, `AnalyticsTab`, `StorageWarning`, `ConfigurationPreview`, `CategorySheet` |

Components read the theme through `useThemeContext()` of `src/contexts/ThemeContext.tsx`, never `useTheme()` directly: `ThemeProvider` calls `useTheme` once, so every component sees the same theme.

## Adding a service or hook

1. Write the Prompts, the Categories and the settings only through `StorageManager`; a new route that brings Prompt text into the Library goes through an Admission route. Another key belongs to the one module that owns it: add it to the table of owners above.
2. Take locks in the order CATEGORIES → PROMPTS → SETTINGS (then the Site settings lock, then the icon placement repairs lock, then the What's new lock, then the Welcome lock, which only `clearAllData()` and the error screen's Reset Data nest), and await nothing from another context under a lock.
3. Test it in the `__tests__/` folder next to it ([TESTING.md](./TESTING.md)).
4. Add a row to the table of this page: one line on its job, no signature.
