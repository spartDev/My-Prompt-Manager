# Component Catalog

Which component does which job in the popup and the side panel, and the conventions they share. This page does not copy Props or code: the source file is the reference. Most components declare their Props interface at the top of the file; `LibraryView`, `PromptCard`, `AddPromptForm`, `EditPromptForm` and `SearchBar` import theirs from `src/types/components.ts`. Open them before you use or change a component.

---

## Where things live

`src/App.tsx` is the shell: it holds the Prompts and Categories (`usePrompts`, `useCategories`), the toasts (`useToast`) and the current section, and renders one view plus the `TabBar`. The same `App` runs in the popup and in the side panel; it receives the context as a prop.

| Folder | What is in it |
|--------|---------------|
| `src/components/` | The views of the four sections, the forms and the shared primitives |
| `src/components/settings/` | The sections and cards of the Settings view |
| `src/components/analytics/` | The Analytics section, its full dashboard and the charts (`charts/`) |
| `src/components/icons/` | Inline SVG icons, one file per area |

## Which component for which job

### Views (one per section of the `TabBar`)

| Component | Job |
|-----------|-----|
| `src/components/LibraryView.tsx` | The Library: search, the Library filter pills, the Prompt cards, the empty states |
| `src/components/CategoryManager.tsx` | The Categories section: create, rename, recolor and delete Categories |
| `src/components/analytics/AnalyticsTab.tsx` | The Analytics section; `src/components/analytics/AnalyticsDashboard.tsx` is the full page it expands to |
| `src/components/SettingsView.tsx` | Settings: assembles the sections of `src/components/settings/`, and runs Backup restore (`handleImportData`, passed down as `onImport`) |
| `src/components/TabBar.tsx` | The bottom tab bar; its `Section` type names the four sections |

### Prompts

| Component | Job |
|-----------|-----|
| `src/components/PromptCard.tsx` | One Prompt in the Library: title, preview, Category, use count, copy and the actions menu. Memoized with its own props comparison |
| `src/components/AddPromptForm.tsx` | New Prompt, typed or imported from a Share code |
| `src/components/EditPromptForm.tsx` | Edit a stored Prompt |
| `src/components/LibraryFilterBar.tsx` | The Library filter pills (All, Pinned, Most Used, one per non-empty Category); the filter logic is `src/services/libraryFilter.ts` |
| `src/components/SearchBar.tsx` | The search field; the debounce is in `useSearchWithDebounce`, not here |
| `src/components/CategoryBadge.tsx` | A Category name on its color, with readable text contrast |

### Shared primitives

| Component | Job |
|-----------|-----|
| `src/components/ViewHeader.tsx` | The header of every view. Compound component: `ViewHeader.Actions`, `ViewHeader.BackButton`, `ViewHeader.SettingsButton`, `ViewHeader.NewButton`, `ViewHeader.CloseButton` |
| `src/components/Dropdown.tsx` | Every menu and popover: a list of items, or custom content that reads the controls through `useDropdown()`. Positioning and closing come from `useEnhancedFloatingPosition` and `useDropdownClose` |
| `src/components/ConfirmDialog.tsx` | Confirmation modal; its `variant` sets the confirm button's color |
| `src/components/ToastContainer.tsx` | Renders the toasts of `useToast` |
| `src/components/StorageWarning.tsx` | "Storage Limit Reached": App opens it when storage refuses a save (`STORAGE_QUOTA_EXCEEDED`); usage is shown through `describeStorageUsage`, like the Settings storage bar |
| `src/components/ColorPicker.tsx` | Category color: the presets of `src/constants/colors.ts`, or a custom hex ([CATEGORY_COLOR_IMPLEMENTATION.md](./CATEGORY_COLOR_IMPLEMENTATION.md)) |
| `src/components/InterfaceModeSelector.tsx` | Popup or side panel |
| `src/components/ErrorBoundary.tsx` | Catches a render error and shows a fallback instead of a blank popup |

### Settings

| Component | Job |
|-----------|-----|
| `src/components/settings/SettingsSection.tsx` | The frame of every Settings section |
| `src/components/settings/ToggleSwitch.tsx` | The switch for every boolean setting |
| `src/components/settings/AppearanceSection.tsx`, `LibrarySection.tsx`, `NotificationSection.tsx`, `AdvancedSection.tsx`, `AboutSection.tsx` | One Settings section each |
| `src/components/settings/DataStorageSection.tsx` | Storage use, Backup export (`handleExport` builds and writes the file), the restore file picker, Clear All Data |
| `src/components/settings/SiteIntegrationSection.tsx` | Platforms and custom sites: lists, add flow, element picker, import and export of a site configuration |
| `src/components/settings/SiteCard.tsx` | One Platform or custom site, with its switch |

### Analytics charts

Imported from `src/components/analytics/index.ts`. Each chart takes its data from `useUsageStats` and its colors from `src/theme/chartColors.ts`; `src/components/analytics/SummaryCard.tsx` shows one metric of `useSummaryMetrics`.

---

## Conventions

- **Colors:** token classes only (`bg-card`, `text-secondary`, `border-default`…), never a raw palette class or a `dark:` color variant. The rule is in `CODING_STANDARDS.md`, the tokens in [DESIGN_GUIDELINES.md](./DESIGN_GUIDELINES.md), and `src/theme/__tests__/rawColors.test.ts` enforces it on migrated components and on this page.
- **Focus:** the focus classes of `tailwind.config.js` (`focus-primary`, `focus-input`…); see "Focus States" in DESIGN_GUIDELINES.md.
- **Verbatim Prompt text:** a component shows a Prompt's title and content exactly as stored. React renders them as text; nothing sanitizes or rewrites them (`CONTEXT.md`, ADR-001).
- **Forms:** submit with React 19's `useActionState` (`CODING_STANDARDS.md`, [REACT_19_MIGRATION.md](./REACT_19_MIGRATION.md)). Character counters read `PROMPT_LIMITS`, and storage runs Admission on save: a form never keeps its own copy of the limits or the rules.
- **Memo:** `PromptCard`, `SearchBar` and `ToastContainer` use a custom props comparison. Adding a prop to one of them means adding it to its comparison, or the component will not re-render when the prop changes.
- **Accessibility:** icon-only buttons carry an `aria-label`; dialogs trap focus and close on Escape (exception today: the clear-history dialog of `AnalyticsTab` does neither); menus are keyboard-navigable (`Dropdown` does it for you).

## Adding a component

1. Put it in the folder of its area (table above), with an explicit Props interface at the top of the file.
2. Reuse `Dropdown`, `ConfirmDialog`, `ToggleSwitch`, `ViewHeader` rather than building another menu, dialog, switch or header.
3. Style it with the token classes and the patterns of [DESIGN_GUIDELINES.md](./DESIGN_GUIDELINES.md) ("Component Patterns").
4. Test it in a `__tests__/` folder next to it ([TESTING.md](./TESTING.md)). If it is on the tokens, add it to `MIGRATED` in `src/theme/__tests__/rawColors.test.ts`.
5. Add a row to the table of this page: one line on its job, no Props.
