# Component Catalog

Which component does which job in the popup and the side panel, and the conventions they share. This page does not copy Props or code: the source file is the reference. Most components declare their Props interface at the top of the file; `LibraryView`, `PromptCard`, `PromptEditor` and `SearchBar` import theirs from `src/types/components.ts`. Open them before you use or change a component.

---

## Where things live

`src/App.tsx` is the shell: it holds the Prompts and Categories (`usePrompts`, `useCategories`), the Notification (`useToast`) and the current section, and renders one view plus the `TabBar`. Arriving on a Section from the tab bar slides it 26px in from the side of its tab with a fade (`animate-section-forward` or `animate-section-back`, by the order of `SECTION_ORDER`); the first Section shows at once. The editor is a sheet above them: it rises from the bottom (`animate-sheet-in`), the Section and the `TabBar` wait `inert` beneath it, receding a little under a scrim (`animate-recede-in`, `animate-scrim-in`), and on close it leaves to the bottom and unmounts after its animation (`useAnimatedPresence`), when the keyboard returns to what opened it. The same `App` runs in the popup and in the side panel; it receives the context as a prop.

| Folder | What is in it |
|--------|---------------|
| `src/components/` | The views of the four sections, the forms and the shared primitives |
| `src/components/settings/` | The sections and cards of the Settings view |
| `src/components/analytics/` | The Analytics section, its full-page view and that view's two charts (`charts/`) |
| `src/components/icons/` | Inline SVG icons, one file per area |

## Which component for which job

### Views (one per section of the `TabBar`)

| Component | Job |
|-----------|-----|
| `src/components/LibraryView.tsx` | The Library: search, the Library filter pills, the Prompt cards, the empty states |
| `src/components/CategoryManager.tsx` | The Categories section: the list of Categories, each row (but the default one) opening `CategorySheet` to rename, recolor or delete it, and "Add category" below the list to create one. Steps the screen back while the sheet is open, out of reach with App's tab bar (`onSheetOpenChange`), and pops in a Category that appears (created, or back from Undo) |
| `src/components/CategorySheet.tsx` | The bottom sheet that creates or edits a Category (`mode: 'create' \| 'edit'`): name, one of the 12 `PRESET_COLORS`, a live preview. Its state (open, closing, draft) is `useCategorySheet`; its keyboard is `useModalFocus` |
| `src/components/analytics/AnalyticsTab.tsx` | The Analytics section (Atelier 1C): `StatsHero` (total and weekday bars), the Top platform and Top category cards, `MostUsedCard`, `TidyUpCard`, and Clear history |
| `src/components/analytics/AnalyticsDashboard.tsx` | The full-page Analytics view the tab expands to (`src/analytics.html`): the same hero (`wide`), stat cards, Most used (10 rows, read not pressed) and Tidy up, then the Platforms and Categories as `RankedRows` and the Daily use and Time of day charts. Review in Tidy up opens the side panel on the Library filter through `src/services/libraryReview.ts` |
| `src/components/SettingsView.tsx` | Settings: assembles the sections of `src/components/settings/`, and runs Backup restore (`handleImportData`, passed down as `onImport`) |
| `src/components/TabBar.tsx` | The bottom tab bar; its `Section` type names the four sections, `SECTION_ORDER` their order left to right |

### Prompts

| Component | Job |
|-----------|-----|
| `src/components/PromptCard.tsx` | One Prompt in the Library: title, preview, Category, use count, copy and the actions menu. Memoized with its own props comparison |
| `src/components/PromptEditor.tsx` | The one editor for a Prompt: new (typed, or opened from a Share code) and edit. Header bar Cancel / heading / Save, Cmd/Ctrl+S saves, Escape asks before discarding changes. Save shows "Saved" for `MOTION.savedPause`, then closes; the title has the keyboard on open |
| `src/components/editor/CategoryChips.tsx` | The Category of a Prompt as a radio group of chips, with "New category" to create one in place |
| `src/components/editor/VariableTextarea.tsx` | The Prompt text field: Variables highlighted by a mirror under a transparent textarea; the field grows with its text |
| `src/components/LibraryFilterBar.tsx` | The Library filter pills (All, Pinned, Most Used, one per non-empty Category, and while one is active the Never used or Possible duplicates pill reached from Analytics, with a button back to All); the filter logic is `src/services/libraryFilter.ts` |
| `src/components/SearchBar.tsx` | The search field; the debounce is in `useSearchWithDebounce`, not here |
| `src/components/CategoryBadge.tsx` | A Category name on its color, with readable text contrast |

### Shared primitives

| Component | Job |
|-----------|-----|
| `src/components/ViewHeader.tsx` | The header of every view. Compound component: `ViewHeader.Actions`, `ViewHeader.BackButton`, `ViewHeader.SettingsButton`, `ViewHeader.NewButton`, `ViewHeader.CloseButton` |
| `src/components/Dropdown.tsx` | Every menu and popover: a list of items, or custom content that reads the controls through `useDropdown()`. Positioning and closing come from `useEnhancedFloatingPosition` and `useDropdownClose` |
| `src/components/ConfirmDialog.tsx` | Confirmation modal; its `variant` sets the confirm button's color |
| `src/components/ToastContainer.tsx` | Renders the one Notification of `useToast`, as the top-center pill |
| `src/components/StorageWarning.tsx` | "Storage Limit Reached": App opens it when storage refuses a save (`STORAGE_QUOTA_EXCEEDED`); usage is shown through `describeStorageUsage`, like the Settings storage bar |
| `src/components/ErrorBoundary.tsx` | Catches a render error and shows a fallback instead of a blank popup |

### Settings

| Component | Job |
|-----------|-----|
| `src/components/settings/SettingsGroup.tsx` | A Settings group: its label, then one card that holds its rows |
| `src/components/settings/SettingsRow.tsx` | One setting in a group: label (and grey detail) at the left, control at the right, an optional status or confirmation under it |
| `src/components/settings/SegmentedControl.tsx` | A choice among two or three options (theme, popup or side panel): a radio group with a sliding puck |
| `src/components/settings/Switch.tsx` | The switch for every boolean setting, named by its row's label |
| `src/components/settings/AppearanceSection.tsx`, `LibrarySection.tsx`, `NotificationSection.tsx`, `HelpSection.tsx`, `AdvancedSection.tsx` | One Settings group each (Advanced holds the reset) |
| `src/components/settings/DataStorageSection.tsx` | The Your data group: storage use, Backup export (`handleExport` builds and writes the file; off while the Library cannot be read, so no empty Backup is saved), the restore file picker, Clear All Data |
| `src/components/settings/SiteIntegrationSection.tsx` | Platforms and custom sites: lists, add flow, element picker, import and export of a site configuration |
| `src/components/settings/SiteRow.tsx` | One Platform or custom site: logo, name, domain and switch; a custom site's Export and Remove in its ⋯ menu |

### Analytics charts

`DailyUseChart` and `TimeOfDayChart` (`src/components/analytics/charts/`, recharts) are the two charts of the full-page view: pill bars in the accent, colors from `src/theme/chartColors.ts`, data from `useUsageStats`, a `ChartTooltip` in the hero's dark pill, and an `aria-label` that says what the bars show. Everything else on both surfaces is plain elements: the weekday bars of `StatsHero`, and the ranked rows of `MostUsedCard` and `RankedRows` (`RankRowContent`), computed by `src/services/usageInsights.ts`. The row counts are in `src/components/analytics/constants.ts`: 3 Most used rows in the tab, 10 in the full-page view, 6 per Platforms or Categories card.

---

## Conventions

- **Colors:** token classes only (`bg-card`, `text-secondary`, `border-default`…), never a raw palette class or a `dark:` color variant. The rule is in `CODING_STANDARDS.md`, the tokens in [DESIGN_GUIDELINES.md](./DESIGN_GUIDELINES.md), and `src/theme/__tests__/rawColors.test.ts` enforces it on migrated components and on this page.
- **Focus:** the focus classes of `tailwind.config.js` (`focus-primary`, `focus-input`…); see "Focus States" in DESIGN_GUIDELINES.md.
- **Verbatim Prompt text:** a component shows a Prompt's title and content exactly as stored. React renders them as text; nothing sanitizes or rewrites them (`CONTEXT.md`, ADR-001).
- **Forms:** submit with React 19's `useActionState`, as `src/components/PromptEditor.tsx` does (`CODING_STANDARDS.md`). Character counters read `PROMPT_LIMITS`, and storage runs Admission on save: a form never keeps its own copy of the limits or the rules.
- **Memo:** `PromptCard` and `SearchBar` use a custom props comparison. Adding a prop to one of them means adding it to its comparison, or the component will not re-render when the prop changes.
- **Accessibility:** icon-only buttons carry an `aria-label`; dialogs use `useModalFocus` (`src/hooks/useModalFocus.ts`): focus moves in, Tab wraps inside, Escape closes and the focus returns to the opener; menus are keyboard-navigable (`Dropdown` does it for you).

## Adding a component

1. Put it in the folder of its area (table above), with an explicit Props interface at the top of the file.
2. Reuse `Dropdown`, `ConfirmDialog`, `Switch`, `SegmentedControl`, `ViewHeader` rather than building another menu, dialog, switch or header.
3. Style it with the token classes and the patterns of [DESIGN_GUIDELINES.md](./DESIGN_GUIDELINES.md) ("Component Patterns").
4. Test it in a `__tests__/` folder next to it ([TESTING.md](./TESTING.md)). If it is on the tokens, add it to `MIGRATED` in `src/theme/__tests__/rawColors.test.ts`.
5. Add a row to the table of this page: one line on its job, no Props.
