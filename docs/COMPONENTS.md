# Component Catalog

Which component does which job in the popup and the side panel, and the conventions they share. This page does not copy Props or code: the source file is the reference. Most components declare their Props interface at the top of the file; `LibraryView`, `PromptCard`, `PromptEditor`, `SearchBar` and `SearchEmptyState` import theirs from `src/types/components.ts`. Open them before you use or change a component.

---

## Where things live

`src/App.tsx` is the shell: it holds the Prompts and Categories (`usePrompts`, `useCategories`), the Notification (`useToast`) and the current section, and renders one view plus the `TabBar`. Arriving on a Section from the tab bar slides it 26px in from the side of its tab with a fade (`animate-section-forward` or `animate-section-back`, by the order of `SECTION_ORDER`); the first Section shows at once. The editor is a sheet above them: it rises from the bottom (`animate-sheet-in`), the Section and the `TabBar` wait `inert` beneath it, receding a little under a scrim (`animate-recede-in`, `animate-scrim-in`), and on close it leaves to the bottom and unmounts after its animation (`useAnimatedPresence`), when the keyboard returns to what opened it. The same `App` runs in the popup and in the side panel; it receives the context as a prop. While the launch decision shows the Welcome, `App` renders `WelcomeHost` alone, with no Section and no tab bar, and the Notification over it (a refused add of the Packs keeps the Welcome on screen). The primary button of the Welcome's last step leaves it through `useWelcomeExit`: the Packs added, then the Library on All with a Notification of what was added and the keyboard on the first card's Copy, so one Enter copies; or, with no Pack, the Library, then the editor on a new Prompt 250ms later, the keyboard in its title field. An exit that starts hides the Notification on screen, so the failure Notification of a refused add never stays over the Library with a Start empty that does nothing.

| Folder | What is in it |
|--------|---------------|
| `src/components/` | The views of the four sections, the forms and the shared primitives |
| `src/components/settings/` | The sections and cards of the Settings view |
| `src/components/analytics/` | The Analytics section, its full-page view and that view's two charts (`charts/`) |
| `src/components/icons/` | Inline SVG icons, one file per area |
| `src/components/whatsNew/` | What's new: the sheet that lists the Release notes of a Release after an update |
| `src/components/welcome/` | The Welcome: its frame and the content of its three steps, shown in place of the Library at the first opening after a first install |

## Which component for which job

### Views (one per section of the `TabBar`)

| Component | Job |
|-----------|-----|
| `src/components/LibraryView.tsx` | The Library: search, the Library filter pills, the Prompt cards, the empty states. Asked by `App` after the Welcome's exit with Packs (`focusFirstPrompt`), it gives the keyboard to the first card's Copy as the cards are listed, only when the keyboard is on no element, then says it is done (`onFirstPromptFocused`) |
| `src/components/CategoryManager.tsx` | The Categories section: the list of Categories, each row (but the default one) opening `CategorySheet` to rename, recolor or delete it, and "Add category" below the list to create one. Steps the screen back while the sheet is open, out of reach with App's tab bar (`onSheetOpenChange`), and pops in a Category that appears (created, or back from Undo) |
| `src/components/CategorySheet.tsx` | The bottom sheet that creates or edits a Category (`mode: 'create' \| 'edit'`): name, one of the 12 `PRESET_COLORS`, a live preview. Its state (open, closing, draft) is `useCategorySheet`; its keyboard is `useModalFocus` |
| `src/components/analytics/AnalyticsTab.tsx` | The Analytics section (Atelier 1C): `StatsHero` (total and weekday bars), the Top platform and Top category cards, `MostUsedCard`, `TidyUpCard`, and Clear history |
| `src/components/analytics/AnalyticsDashboard.tsx` | The full-page Analytics view the tab expands to (`src/analytics.html`): the same hero (`wide`), stat cards, Most used (10 rows, read not pressed) and Tidy up, then the Platforms and Categories as `RankedRows` and the Daily use and Time of day charts. Review in Tidy up opens the side panel on the Library filter through `src/services/libraryReview.ts` |
| `src/components/SettingsView.tsx` | Settings: assembles the sections of `src/components/settings/`, and runs Backup restore (`handleImportData`, passed down as `onImport`) |
| `src/components/TabBar.tsx` | The bottom tab bar; its `Section` type names the four sections, `SECTION_ORDER` their order left to right |

### Prompts

| Component | Job |
|-----------|-----|
| `src/components/PromptCard.tsx` | One Prompt in the Library: title, preview, Category, use count, copy and the actions menu. Memoized with its own props comparison. Its Copy button takes `copyButtonRef`, for the Library to give it the keyboard, draws its ring on `:focus-visible` only, and ignores a repeated Enter, so a held key copies once |
| `src/components/PromptEditor.tsx` | The one editor for a Prompt: new (typed, or opened from a Share code) and edit. Header bar Cancel / heading / Save, Cmd/Ctrl+S saves, Escape asks before discarding changes. Save shows "Saved" for `MOTION.savedPause`, then closes; the title has the keyboard on open |
| `src/components/editor/CategoryChips.tsx` | The Category of a Prompt as a radio group of chips, with "New category" to create one in place |
| `src/components/editor/LookalikeCallout.tsx` | "This looks familiar": the Prompt of the Library the text being written looks like (60% alike or more), with the first lines of both and Keep both. Never blocks Save |
| `src/components/editor/VariableTextarea.tsx` | The Prompt text field: Variables highlighted by a mirror under a transparent textarea; the field grows with its text |
| `src/components/LibraryFilterBar.tsx` | The Library filter pills (All, Pinned, Most Used, one per non-empty Category, and while one is active the Never used or Possible duplicates pill reached from Analytics, with a button back to All); the filter logic is `src/services/libraryFilter.ts` |
| `src/components/NewPromptButton.tsx` | The main action of the Library: the round button that ends the search row and opens the editor on a new Prompt. Not shown in an empty Library, whose empty state offers to write the first Prompt |
| `src/components/SearchBar.tsx` | The search field of the Library, a pill with the badge of its shortcut or a clear button. Presentation only: the debounce is in `useSearchWithDebounce`, the Cmd/Ctrl+K shortcut in `App` |
| `src/components/emptyStates/EmptyState.tsx` | The base of an empty state: illustration, title, explanation, actions. `LibraryEmpty` (no Prompt) and `CategoriesEmpty` (only the Default Category, with the starter Categories) build on it; `analytics/StatsEmpty.tsx` (no Insertion in the period) has its own shape. The conditions are the selectors of `src/utils/emptyStates.ts` |
| `src/components/SearchEmptyState.tsx` | What a search that finds nothing shows: the search, Create it (the editor opens titled with it) and, under a Library filter, Search all prompts |
| `src/components/CategoryBadge.tsx` | A Category name on its color, with readable text contrast |

### Shared primitives

| Component | Job |
|-----------|-----|
| `src/components/ViewHeader.tsx` | The header of every view. Compound component: `ViewHeader.Actions`, `ViewHeader.BackButton`, `ViewHeader.SettingsButton`, `ViewHeader.CloseButton` |
| `src/components/Dropdown.tsx` | Every menu and popover: a list of items, or custom content that reads the controls through `useDropdown()`. Positioning and closing come from `useEnhancedFloatingPosition` and `useDropdownClose` |
| `src/components/ConfirmDialog.tsx` | Confirmation modal; its `variant` sets the confirm button's color |
| `src/components/ToastContainer.tsx` | Renders the one Notification of `useToast`, as the top-center pill |
| `src/components/StorageWarning.tsx` | "Storage Limit Reached": App opens it when storage refuses a save (`STORAGE_QUOTA_EXCEEDED`); usage is shown through `describeStorageUsage`, like the Settings storage bar |
| `src/components/ErrorBoundary.tsx` | Catches a render error and shows a fallback instead of a blank popup |

### What's new

| Component | Job |
|-----------|-----|
| `src/components/whatsNew/WhatsNewHost.tsx` | What's new in `App`, over the Library of the popup and the side panel (not in picker mode): the sheet and its grid while `notes` (the Release notes the launch decision of `useLaunchScreen` gives, or null) has some, then their exit (`useAnimatedPresence`, `MOTION.whatsNewSheetOut`). Every close (Got it, backdrop, Escape, Enter, a tile) calls `onClose` (the hook's `closeWhatsNew()`) at once, once even for two closing events in one task, so the Release is marked seen before the exit ends. A tile closes, then calls `onOpen(destination, item)`: `App` maps `library`, `categories`, `analytics`, `settings` to that Section, `library-search` to the Library with the keyboard in its search field (as Cmd/Ctrl+K), `prompt-editor-new` to the editor on a new Prompt. Knows nothing of Debug mode |
| `src/components/whatsNew/WhatsNewSheet.tsx` | The What's new bottom sheet: backdrop, handle, the pill "New in {version}", the title, a scrolling body for the tile grid (its `children`), itself a tab stop, the region "Release notes", so it scrolls with the keyboard when no tile takes focus, and Got it. Rises with `animate-whats-new-sheet-in`; while `open` is false it plays its exit, inert, and its caller unmounts it after `MOTION.whatsNewSheetOut` (`useAnimatedPresence`). Its keyboard is `useModalFocus` (focus on Got it at open); `onClose` says how it closed (`got-it`, `backdrop`, `escape`, `enter`). Enter on a tile button keeps the tile's own activation. The digits 1 to 9 click the tile carrying that `data-whats-new-tile-index` (not with Cmd, Ctrl or Alt, nor in a text field), so a number key behaves as a click and the sheet stays unaware of destinations. It knows nothing of Debug mode or storage |
| `src/components/whatsNew/WhatsNewGrid.tsx` | The two-column grid of a Release's notes (`items`, `onOpen(destination, item)`): the hero (the first Feature, full width), the other Features, then the Critical fixes; no hero without a Feature; with an odd number of tiles under the hero, the last spans both columns. `placeTiles` computes that order. The Feature tiles that open something carry `data-whats-new-tile-index`, from 1 for the hero, in display order, for the number keys of the sheet |
| `src/components/whatsNew/WhatsNewTile.tsx` | One tile: the hero (example sentence, each `{{word}}` a pill, then title and description), a Feature (icon square, title, description) or a Critical fix (the Fixed pill in place of the icon). A Feature with a destination is a `<button>` named by its title and description, described by the hero's example, with its number key in `aria-keyshortcuts`; a Feature without one and a Critical fix are plain tiles that take no focus, a Critical fix read "Fixed: {title}". Each rises `MOTION.tileStagger` after the one before, all at once under reduced motion |
| `src/components/icons/WhatsNewIcons.tsx` | `WhatsNewIconGlyph`: one glyph per key of the closed set `WhatsNewIcon` (`src/whatsNew/types.ts`), `search` as its ⌘K key chip, hidden from screen readers |

### Welcome

| Component | Job |
|-----------|-----|
| `src/components/welcome/WelcomeHost.tsx` | The Welcome in `App`, alone on the screen while the launch decision of `useLaunchScreen` shows it (nothing of the Library is rendered behind it). Holds the Welcome's state, moved only by the pure reducer of `src/welcome/reducer.ts` (step, direction, Packs selected). Records each step change at once through the hook's `saveStep`, in the handler: the step is stored a median under 50ms after the click and always under 100ms (guarded by `tests/e2e/welcome/welcome-frame.spec.ts`), so a popup closed after that reopens on it, and only a close inside that window, faster than a person closes a popup, loses it (the write takes the Welcome lock and reads the record first, which keeps a done record final; routing the step writes through the service worker would remove the window); a Pack toggled records the step with the new selection. The primary button of the last step calls `onFinish` with the Packs selected (`finishWelcome` when left out); `App` passes the way out of `useWelcomeExit`, which adds the Packs before it finishes the Welcome and ignores a second press while it is under way. Close calls `window.close()` and records nothing |
| `src/components/welcome/WelcomeFrame.tsx` | The frame of the three steps: header (logo, name, Skip before the last step, the round close button), the step slot centered in the room left and scrolling there when taller (it may shrink to that room, so a step can scroll a part of itself instead), three progress dots (buttons named "Step N of 3", `aria-current` on the active one, each a target of 24 x 24px at least, WCAG 2.5.8), Back from the second step, outlined at 3:1, and the primary button, ink in light and the accent in dark. Enter presses the primary button unless the keyboard is on another control; ArrowLeft and ArrowRight change step (ArrowRight never finishes). A step change is announced in a polite status and moves the keyboard to the step's title. The screen fades in at the opening, a step slides in from the side it comes from, Back pops in; none of it holds the primary button, and none plays under reduced motion. Exports `WelcomeTitle` and `WelcomeText`, the title and text of a step |
| `src/components/welcome/WelcomeSteps.tsx` | What fills the step slot for each step (`WelcomeStepContent`), with the texts of the spec word for word: step 1 the floating Prompt cards, step 2 the blank being filled, step 3 the Packs and the Platforms. And the primary button's label (`primaryLabelOf`): Next, then on the last step "Add N prompts", N the Prompts of the Packs selected (`promptCountOf` of `src/welcome/reducer.ts`), or "Start empty" with none |
| `src/components/welcome/WelcomeCards.tsx` | Step 1's illustration: two light Prompt cards tilted -9° and +8° behind an ink one whose text holds a dashed blank, each floating 8px up and back at its own pace (`animate-welcome-float-*`). Decorative (`aria-hidden`), still under reduced motion, drawn at 88% in a side panel under 360px wide so its edges are not cut |
| `src/components/welcome/BlankDemo.tsx` | Step 2's demonstration: "Write a follow-up email to [blank] and end with one clear next step.", "Claire, Head of Sales" typed into the blank one letter every `MOTION.welcomeTypeLetter` and held about `MOTION.welcomeTypePause` before it starts again, a caret blinking after it. One interval, cleared on unmount, so leaving the step stops it. The card keeps the whole sentence's height while the name grows, so nothing under it moves. The typing is `aria-hidden`; a `sr-only` paragraph holds the whole sentence. Under reduced motion the whole name shows at once, with no timer and no caret |
| `src/components/welcome/PackPicker.tsx` | Step 3's Packs (`src/welcome/packs.ts`) in two columns, each a toggle button (`aria-pressed`) with its color dot, name and "N prompts", a card outlined at 3:1 until selected; selected, it takes the Category chip tint of its color and the chip's text (a Pack's color is user data), a border of its color and a round check that pops in. Its colors come from `packColors` of `src/welcome/packColors.ts`: the color as is in light, lifted toward white in dark, 3:1 or more on the frame and the tint in both. The Packs line up with the title and the pills, a focused one's outline whole. The grid scrolls within itself when the Packs do not fit (a short side panel, more Packs), and while Packs remain beyond its top or bottom that edge fades out with a line along it (`welcome-packs-*` of `src/popup.css`), so a selected Pack is never out of view unseen; a Pack the keyboard reaches scrolls into view with its outline, and while a Pack has the focus the fades step aside and the lines stay, so its outline is whole even in a 320 x 420 side panel. Under it, the Platforms the extension works on as a row of pills named "Works on", from `welcomePlatformNames` of `src/welcome/platforms.ts`: every Platform of `src/config/platforms.ts` by priority, by its short name (its display name when it has none), linked Platforms once |

### Settings

| Component | Job |
|-----------|-----|
| `src/components/settings/SettingsGroup.tsx` | A Settings group: its label, then one card that holds its rows |
| `src/components/settings/SettingsRow.tsx` | One setting in a group: label (and grey detail) at the left, control at the right, an optional status or confirmation under it |
| `src/components/settings/SegmentedControl.tsx` | A choice among two or three options (theme, popup or side panel): a radio group with a sliding puck |
| `src/components/settings/Switch.tsx` | The switch for every boolean setting, named by its row's label |
| `src/components/settings/AppearanceSection.tsx`, `LibrarySection.tsx`, `NotificationSection.tsx`, `HelpSection.tsx`, `AdvancedSection.tsx` | One Settings group each (Advanced holds Debug mode, whose hint says the Welcome then What's new show at every opening, recording no progress, while Packs added stay in the Library, and the reset) |
| `src/components/settings/DataStorageSection.tsx` | The Your data group: storage use, Backup export (`handleExport` builds and writes the file; off while the Library cannot be read, so no empty Backup is saved), the restore file picker, Clear All Data |
| `src/components/settings/SiteIntegrationSection.tsx` | Platforms and custom sites: lists, add flow, element picker, import and export of a site configuration |
| `src/components/settings/SiteRow.tsx` | One Platform or custom site: logo, name, domain and switch; a custom site's Export and Remove in its ⋯ menu |

### Analytics charts

`DailyUseChart` and `TimeOfDayChart` (`src/components/analytics/charts/`) are the two charts of the full-page view, both drawn by `PillBarChart`: plain elements, no chart library. A pill bar per entry in the accent (`bg-accent`), sized against the busiest and growing from the bottom like the hero's, axis labels in `text-tertiary` (Daily use names every seventh day back from today), a muted band and a `ChartTooltip` in the hero's dark pill on hover, data from `useUsageStats`, and an `aria-label` that says what the bars show. Everything else on both surfaces is plain elements too: the weekday bars of `StatsHero`, and the ranked rows of `MostUsedCard` and `RankedRows` (`RankRowContent`), computed by `src/services/usageInsights.ts`. The row counts are in `src/components/analytics/constants.ts`: 3 Most used rows in the tab, 10 in the full-page view, 6 per Platforms or Categories card.

---

## Conventions

- **Colors:** token classes only (`bg-card`, `text-secondary`, `border-default`…), never a raw palette class or a `dark:` color variant. The rule is in `CODING_STANDARDS.md`, the tokens in [DESIGN_GUIDELINES.md](./DESIGN_GUIDELINES.md), and `src/theme/__tests__/rawColors.test.ts` enforces it on migrated components and on this page.
- **Focus:** the focus classes of `tailwind.config.js` (`focus-primary`, `focus-input`…); see "Focus States" in DESIGN_GUIDELINES.md.
- **Verbatim Prompt text:** a component shows a Prompt's title and content exactly as stored. React renders them as text; nothing sanitizes or rewrites them (`CONTEXT.md`, ADR-001).
- **Forms:** submit with React 19's `useActionState`, as `src/components/PromptEditor.tsx` does (`CODING_STANDARDS.md`). Character counters read `PROMPT_LIMITS`, and storage runs Admission on save: a form never keeps its own copy of the limits or the rules.
- **Memo:** `PromptCard` uses a custom props comparison. Adding a prop to it means adding it to its comparison, or the component will not re-render when the prop changes.
- **Accessibility:** icon-only buttons carry an `aria-label`; dialogs use `useModalFocus` (`src/hooks/useModalFocus.ts`): focus moves in, Tab wraps inside, Escape closes and the focus returns to the opener; menus are keyboard-navigable (`Dropdown` does it for you).

## Adding a component

1. Put it in the folder of its area (table above), with an explicit Props interface at the top of the file.
2. Reuse `Dropdown`, `ConfirmDialog`, `Switch`, `SegmentedControl`, `ViewHeader` rather than building another menu, dialog, switch or header.
3. Style it with the token classes and the patterns of [DESIGN_GUIDELINES.md](./DESIGN_GUIDELINES.md) ("Component Patterns").
4. Test it in a `__tests__/` folder next to it ([TESTING.md](./TESTING.md)). If it is on the tokens, add it to `MIGRATED` in `src/theme/__tests__/rawColors.test.ts`.
5. Add a row to the table of this page: one line on its job, no Props.
