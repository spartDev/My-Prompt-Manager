# Codebase Audit Areas

This document organizes the codebase into logical sections for systematic auditing. Each area is small enough to be reviewed effectively in isolation.

---

## 1. Entry Points & Application Shell (6 files)

Bootstrap files that initialize the extension.

```
src/popup.tsx
src/sidepanel.tsx
src/App.tsx
src/analytics.tsx
src/background/background.ts
src/content/index.ts
```

---

## 2. Configuration Files (9 files)

Build, lint, test, and extension configuration.

```
manifest.json
package.json
vite.config.ts
vitest.config.ts
tsconfig.json
eslint.config.js
playwright.config.ts
tailwind.config.js
postcss.config.js
```

---

## 3. Services - Core Business Logic (7 files)

Singleton services handling data persistence, search, and encoding.

```
src/services/storage.ts
src/services/promptManager.ts
src/services/SearchIndex.ts
src/services/SimilarityAlgorithms.ts
src/services/UsageTracker.ts
src/services/promptEncoder.ts
src/services/configurationEncoder.ts
```

---

## 4. React Hooks (13 files)

Custom hooks for state management and side effects.

```
src/hooks/index.ts
src/hooks/usePrompts.ts
src/hooks/useCategories.ts
src/hooks/useSearch.ts
src/hooks/useSearchWithDebounce.ts
src/hooks/useSort.ts
src/hooks/useClipboard.ts
src/hooks/useToast.ts
src/hooks/useTheme.ts
src/hooks/useUsageStats.ts
src/hooks/useDropdownClose.ts
src/hooks/useEnhancedFloatingPosition.ts
src/hooks/useExtensionContext.ts
```

---

## 5. React Context (1 file)

Application-wide context providers.

```
src/contexts/ThemeContext.tsx
```

---

## 6. Utility Functions - Popup (11 files)

Helper functions used by the popup/sidepanel UI.

```
src/utils/index.ts
src/utils/cn.ts
src/utils/debounce.ts
src/utils/validation.ts
src/utils/error.ts
src/utils/logger.ts
src/utils/base64.ts
src/utils/storageQuota.ts
src/utils/textHighlight.ts
src/utils/formatPlatformName.ts
src/utils/configurationSecurity.ts
```

---

## 7. Type Definitions (6 files)

TypeScript type definitions for the application.

```
src/types/index.ts
src/types/components.ts
src/types/context.ts
src/types/hooks.ts
src/types/test-helpers.ts
```

---

## 8. Components - Forms & Input (5 files)

Components handling user input and form submission.

```
src/components/AddPromptForm.tsx
src/components/EditPromptForm.tsx
src/components/SearchBar.tsx
src/components/ColorPicker.tsx
src/components/Dropdown.tsx
```

---

## 9. Components - Display & Layout (8 files)

Components for displaying data and managing layout.

```
src/components/LibraryView.tsx
src/components/PromptCard.tsx
src/components/CategoryBadge.tsx
src/components/CategoryManager.tsx
src/components/ViewHeader.tsx
src/components/FilterSortControls.tsx
src/components/ConfirmDialog.tsx
src/components/InterfaceModeSelector.tsx
```

---

## 10. Components - Feedback & State (4 files)

Components for user feedback, errors, and global state display.

```
src/components/ToastContainer.tsx
src/components/ErrorBoundary.tsx
src/components/StorageWarning.tsx
src/components/ThemeToggle.tsx
```

---

## 11. Components - Settings View (14 files)

Settings page and its sub-sections.

```
src/components/SettingsView.tsx
src/components/settings/SettingsSection.tsx
src/components/settings/AboutSection.tsx
src/components/settings/AdvancedSection.tsx
src/components/settings/AppearanceSection.tsx
src/components/settings/DataStorageSection.tsx
src/components/settings/NotificationSection.tsx
src/components/settings/SiteIntegrationSection.tsx
src/components/settings/SiteCard.tsx
src/components/settings/AddCustomSiteCard.tsx
src/components/settings/ConfigurationPreview.tsx
src/components/settings/ImportSection.tsx
src/components/settings/ExportButton.tsx
src/components/settings/ToggleSwitch.tsx
```

---

## 12. Components - Analytics (11 files)

Analytics dashboard and chart components.

```
src/components/analytics/index.ts
src/components/analytics/AnalyticsDashboard.tsx
src/components/analytics/AnalyticsTab.tsx
src/components/analytics/SummaryCard.tsx
src/components/analytics/charts/index.ts
src/components/analytics/charts/UsageLineChart.tsx
src/components/analytics/charts/CategoryBarChart.tsx
src/components/analytics/charts/PlatformPieChart.tsx
src/components/analytics/charts/TimeOfDayChart.tsx
src/components/analytics/charts/DayOfWeekChart.tsx
```

---

## 13. Components - Icons (3 files)

SVG icon components.

```
src/components/icons/HeaderIcons.tsx
src/components/icons/SiteIcons.tsx
src/components/icons/UIIcons.tsx
```

---

## 14. Content Script - Core (4 files)

Core injection logic for content scripts.

```
src/content/index.ts
src/content/core/index.ts
src/content/core/injector.ts
src/content/core/insertion-manager.ts
```

---

## 15. Content Script - Platform Strategies Base (5 files)

Base classes and strategy pattern infrastructure.

```
src/content/platforms/index.ts
src/content/platforms/constants.ts
src/content/platforms/platform-manager.ts
src/content/platforms/base-strategy.ts
src/content/platforms/react-platform-strategy.ts
```

---

## 16. Content Script - Platform Implementations (8 files)

Concrete platform strategy implementations for each AI site.

```
src/content/platforms/claude-strategy.ts
src/content/platforms/chatgpt-strategy.ts
src/content/platforms/gemini-strategy.ts
src/content/platforms/perplexity-strategy.ts
src/content/platforms/copilot-strategy.ts
src/content/platforms/m365copilot-strategy.ts
src/content/platforms/mistral-strategy.ts
src/content/platforms/default-strategy.ts
```

---

## 17. Content Script - UI Components (5 files)

UI elements injected into AI platforms.

```
src/content/ui/index.ts
src/content/ui/element-factory.ts
src/content/ui/event-manager.ts
src/content/ui/keyboard-navigation.ts
src/content/modules/element-picker.ts
```

---

## 18. Content Script - Utilities (8 files)

Helper functions for content scripts.

```
src/content/utils/index.ts
src/content/utils/dom.ts
src/content/utils/logger.ts
src/content/utils/storage.ts
src/content/utils/styles.ts
src/content/utils/theme-manager.ts
src/content/utils/element-fingerprint.ts
```

---

## 19. Content Script - Types (4 files)

Type definitions specific to content scripts.

```
src/content/types/index.ts
src/content/types/platform.ts
src/content/types/ui.ts
src/content/types/css-anchor-api.d.ts
```

---

## 20. Test Infrastructure (11 files)

Shared test utilities, mocks, and builders.

```
src/test/setup.ts
src/test/mocks.ts
src/test/types.d.ts
src/test/builders/index.ts
src/test/builders/buildPrompt.ts
src/test/builders/buildCategory.ts
src/test/helpers/index.ts
src/test/helpers/encoder-helpers.ts
src/test/helpers/test-platform-manager.ts
src/test/helpers/theme-helpers.ts
src/test/utils/index.ts
src/test/utils/InMemoryStorage.ts
```

---

## Summary Table

| # | Area | Files | Focus |
|---|------|-------|-------|
| 1 | Entry Points | 6 | App bootstrap |
| 2 | Configuration | 9 | Build/lint/test config |
| 3 | Services | 7 | Business logic |
| 4 | Hooks | 13 | React state management |
| 5 | Context | 1 | Theme context |
| 6 | Utils (Popup) | 11 | Helper functions |
| 7 | Types | 6 | Type definitions |
| 8 | Forms Components | 5 | User input |
| 9 | Display Components | 8 | UI display |
| 10 | Feedback Components | 4 | Toasts, errors |
| 11 | Settings Components | 14 | Settings UI |
| 12 | Analytics Components | 11 | Charts/analytics |
| 13 | Icon Components | 3 | SVG icons |
| 14 | Content Core | 4 | Injector core |
| 15 | Platform Base | 5 | Strategy pattern base |
| 16 | Platform Impls | 8 | AI site integrations |
| 17 | Content UI | 5 | Injected UI |
| 18 | Content Utils | 8 | Content helpers |
| 19 | Content Types | 4 | Content type defs |
| 20 | Test Infra | 11 | Test utilities |

**Total: 20 audit areas, ~138 source files** (excluding test files)

---

## Audit Status Tracking

| # | Area | Status | Notes |
|---|------|--------|-------|
| 1 | Entry Points | ⬜ Pending | |
| 2 | Configuration | ⬜ Pending | |
| 3 | Services | ⬜ Pending | |
| 4 | Hooks | ⬜ Pending | |
| 5 | Context | ⬜ Pending | |
| 6 | Utils (Popup) | ⬜ Pending | |
| 7 | Types | ⬜ Pending | |
| 8 | Forms Components | ⬜ Pending | |
| 9 | Display Components | ⬜ Pending | |
| 10 | Feedback Components | ⬜ Pending | |
| 11 | Settings Components | ⬜ Pending | |
| 12 | Analytics Components | ⬜ Pending | |
| 13 | Icon Components | ⬜ Pending | |
| 14 | Content Core | ⬜ Pending | |
| 15 | Platform Base | ⬜ Pending | |
| 16 | Platform Impls | ⬜ Pending | |
| 17 | Content UI | ⬜ Pending | |
| 18 | Content Utils | ⬜ Pending | |
| 19 | Content Types | ⬜ Pending | |
| 20 | Test Infra | ⬜ Pending | |

**Legend:** ⬜ Pending | 🔄 In Progress | ✅ Complete | ⚠️ Issues Found
