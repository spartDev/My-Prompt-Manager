# Testing Notes

This directory contains shared utilities for Vitest along with guidance for exercising
critical workflows in the extension.

## Current Coverage Gaps

The last `npm test -- --coverage` run highlighted several untested areas that the
new suites target:

- `src/App.tsx` – popup workflow orchestration and toast handling.
- `src/hooks/*` – debounce search logic, clipboard helper, and toast reducer.
- `src/background/background.ts` – `ContentScriptInjector` error paths and cleanup.
- `src/content/core/injector.ts` – prompt injector lifecycle and resilience.

## Workflow → Module Mapping

| Workflow | Primary Modules |
| --- | --- |
| Prompt CRUD (create/edit/delete/copy) | `src/App.tsx`, `src/components/AddPromptForm.tsx`, `src/components/EditPromptForm.tsx`, `src/components/PromptCard.tsx`, `src/hooks/usePrompts.ts` |
| Category CRUD & validation | `src/components/CategoryManager.tsx`, `src/hooks/useCategories.ts`, `src/services/storage.ts` |
| Settings import/export & interface mode | `src/components/SettingsView.tsx`, `src/components/settings/DataStorageSection.tsx`, `src/components/InterfaceModeSelector.tsx`, `src/services/storage.ts` |
| Toast notifications | `src/hooks/useToast.ts`, `src/components/ToastContainer.tsx` |
| Background injection error handling | `src/background/background.ts` (`ContentScriptInjector`) |

Aligning tests with the table above ensures every user-facing flow has a concrete
target in the codebase.

## Test Helper Utilities

`src/test/setup.ts` exposes reusable mocks for the singleton managers and Chrome API.
Import helpers from `src/test/mocks.ts` to access them:

```ts
import { getMockStorageManager, getMockPromptManager, getChromeMock, triggerChromeStorageChange } from '@/test/mocks';

const storage = getMockStorageManager();
storage.getPrompts.mockResolvedValue([...]);

const promptManager = getMockPromptManager();
promptManager.createPrompt.mockRejectedValue(appError);

const chromeMock = getChromeMock();
chromeMock.tabs.get.mockResolvedValue(/* ... */);

triggerChromeStorageChange({ settings: { newValue: { theme: 'dark' } } });
```

Each helper returns the live mock instance for the current test so state can be
seeded or assertions can be made without re-importing singletons.
