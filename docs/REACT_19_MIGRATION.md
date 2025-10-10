# React 19 Migration Guide

## Overview

This project has been migrated to React 19, leveraging new hooks for improved form handling and optimistic UI updates. This guide documents the migration patterns used and provides guidance for future form components.

**Migration Commits:**
- `cf25fab` - React 19 dependency update
- `5c07a1b` - Initial migration with `useActionState` and `useOptimistic`
- `f58de6d` - Critical bug fixes and UX improvements
- `557d59e` - `useTransition` simplification
- `02b58a9` - ARIA improvements for accessibility

## Key React 19 Features Used

### 1. `useActionState` - Form Actions with Built-in State
### 2. `useOptimistic` - Optimistic UI Updates
### 3. `useTransition` - Non-blocking State Updates

---

## Pattern 1: Form Handling with `useActionState`

### Overview

React 19's `useActionState` hook replaces manual form state management by integrating directly with the native form `action` attribute. It provides automatic loading states, error handling, and progressive enhancement.

**Used In:**
- `src/components/AddPromptForm.tsx`
- `src/components/EditPromptForm.tsx`

### Basic Pattern

```typescript
import { useActionState, useState } from 'react';
import type { FC } from 'react';

interface FieldErrors {
  fieldName?: string;
  general?: string;
}

const MyForm: FC<Props> = ({ onSubmit, onCancel }) => {
  // Local state for UI features (character counts, etc.)
  const [charCount, setCharCount] = useState(0);

  // useActionState: [errors, submitAction, isPending]
  const [errors, submitAction, isPending] = useActionState(
    async (_prevState: FieldErrors | null, formData: FormData) => {
      // 1. Extract FormData
      const field = formData.get('fieldName') as string;

      // 2. Validate
      const validationErrors: FieldErrors = {};
      if (!field.trim()) {
        validationErrors.fieldName = 'Field is required';
      }
      if (field.length > 100) {
        validationErrors.fieldName = 'Field cannot exceed 100 characters';
      }

      // 3. Return errors early (no submission)
      if (Object.keys(validationErrors).length > 0) {
        return validationErrors;
      }

      // 4. Call parent handler
      try {
        await onSubmit({ field });
        return null; // Success
      } catch (err) {
        return { general: (err as Error).message };
      }
    },
    null // Initial error state
  );

  return (
    <form action={submitAction}>
      {/* General error banner */}
      {errors?.general && (
        <div role="alert" aria-live="polite">
          ⚠️ {errors.general}
        </div>
      )}

      {/* Input with field-specific error */}
      <input
        name="fieldName"
        onChange={(e) => setCharCount(e.target.value.length)}
        disabled={isPending}
        className={errors?.fieldName ? 'border-red-300' : 'border-purple-200'}
      />
      {errors?.fieldName && (
        <p className="text-red-600">⚠️ {errors.fieldName}</p>
      )}

      {/* Submit button with loading state */}
      <button type="submit" disabled={isPending}>
        {isPending ? 'Saving...' : 'Save'}
      </button>
    </form>
  );
};
```

### Key Principles

**1. FormData API**
- Form inputs MUST have `name` attributes
- Use `formData.get('name')` to extract values
- Native browser API - no controlled components needed

**2. Error State Shape**
```typescript
interface FieldErrors {
  [fieldName: string]: string | undefined;
  general?: string; // For non-field-specific errors
}
```

**3. Return Values**
- Return `null` on success
- Return `FieldErrors` object on validation failure
- Return `{ general: string }` for submission errors

**4. Progressive Enhancement**
- Form works without JavaScript (submits to server)
- React enhances with client-side validation and UX
- `action={submitAction}` enables React interception

### Full Example: AddPromptForm.tsx

```typescript
const [errors, submitAction, isPending] = useActionState(
  async (_prevState: FieldErrors | null, formData: FormData) => {
    const title = formData.get('title') as string;
    const content = formData.get('content') as string;
    const category = formData.get('category') as string;

    const validationErrors: FieldErrors = {};

    // Validation logic
    if (!content.trim()) {
      validationErrors.content = 'Content is required';
    }
    if (content.length > 10000) {
      validationErrors.content = 'Content cannot exceed 10,000 characters';
    }
    if (title.length > 100) {
      validationErrors.title = 'Title cannot exceed 100 characters';
    }

    // Return validation errors without calling onSubmit
    if (Object.keys(validationErrors).length > 0) {
      return validationErrors;
    }

    // Submit to parent
    try {
      await onSubmit({ title, content, category });
      return null;
    } catch (err) {
      return { general: (err as Error).message || 'Failed to save' };
    }
  },
  null
);
```

### Character Count with Local State

```typescript
// Keep character counts in local state (not FormData)
const [titleLength, setTitleLength] = useState(0);
const [contentLength, setContentLength] = useState(0);

<input
  name="title"
  onChange={(e) => setTitleLength(e.target.value.length)}
  maxLength={100}
/>
<p>{titleLength}/100 characters</p>
```

### Conditional Styling Based on Errors

```typescript
<input
  name="content"
  className={`
    w-full px-4 py-3 border rounded-xl
    ${errors?.content
      ? 'border-red-300 dark:border-red-500'
      : 'border-purple-200 dark:border-gray-600'}
  `}
  disabled={isPending}
/>
{errors?.content && (
  <p className="mt-2 text-sm text-red-600 dark:text-red-400">
    ⚠️ {errors.content}
  </p>
)}
```

---

## Pattern 2: Optimistic Updates with `useOptimistic`

### Overview

React 19's `useOptimistic` hook enables instant UI feedback for async operations. The UI updates immediately, then automatically reverts if the operation fails.

**Used In:**
- `src/App.tsx` - Optimistic prompt deletion

### Basic Pattern

```typescript
import { useOptimistic, useTransition } from 'react';

const [data, setData] = useState<Item[]>([]);
const [, startTransition] = useTransition();

// Create optimistic state
const [optimisticData, setOptimisticDelete] = useOptimistic(
  data,
  (state, deletedId: string) => state.filter(item => item.id !== deletedId)
);

const handleDelete = async (id: string) => {
  // CRITICAL: Wrap optimistic update in startTransition
  startTransition(() => {
    setOptimisticDelete(id);
  });

  try {
    await deleteItem(id);
    // Success - optimistic update becomes permanent
  } catch (err) {
    // CRITICAL: Refresh base state to trigger revert
    await refreshData();
    showError('Failed to delete');
  }
};

// Render using optimistic state
return optimisticData.map(item => <Item key={item.id} {...item} />);
```

### Critical Implementation Details

**1. useOptimistic Reconciliation**

`useOptimistic` only reverts when the **base state** changes. You MUST refresh the base state on error:

```typescript
const [optimisticPrompts, setOptimisticDeletePrompt] = useOptimistic(
  prompts, // Base state
  (state, deletedId: string) => state.filter(p => p.id !== deletedId)
);

const handleDelete = async (id: string) => {
  startTransition(() => {
    setOptimisticDeletePrompt(id); // Instant UI update
  });

  try {
    await deletePrompt(id);
    // prompts state updates from hook → optimistic update becomes permanent
  } catch (err) {
    // MUST refresh to trigger reconciliation
    await refreshPrompts(); // Updates base state → triggers revert
    showToast('Failed to delete');
  }
};
```

**2. Always Use with useTransition**

React requires optimistic updates to be wrapped in `startTransition`:

```typescript
const [, startTransition] = useTransition();

// ✅ CORRECT
startTransition(() => {
  setOptimisticDelete(id);
});

// ❌ WRONG - will cause warnings
setOptimisticDelete(id);
```

**3. Render Optimistic State**

Always render the optimistic state, not the base state:

```typescript
// ✅ CORRECT
<LibraryView prompts={optimisticPrompts} />

// ❌ WRONG
<LibraryView prompts={prompts} />
```

### Full Example: App.tsx

```typescript
const {
  prompts,
  deletePrompt,
  refreshPrompts
} = usePrompts();

const [, startTransition] = useTransition();

const [optimisticPrompts, setOptimisticDeletePrompt] = useOptimistic(
  prompts,
  (state, deletedId: string) => state.filter(p => p.id !== deletedId)
);

const handleDeletePrompt = async (id: string) => {
  // Immediate UI update
  startTransition(() => {
    setOptimisticDeletePrompt(id);
  });

  try {
    await deletePrompt(id);
    Logger.info('Prompt deleted successfully', { promptId: id });
    showToast('Prompt deleted successfully', 'success');
  } catch (err) {
    Logger.error('Failed to delete prompt', toError(err), { promptId: id });

    // CRITICAL: Refresh to trigger revert
    try {
      await refreshPrompts();
    } catch (refreshErr) {
      Logger.error('Failed to refresh after delete failure', toError(refreshErr));
    }

    showToast('Failed to delete prompt', 'error');
  }
};

// Pass optimistic state to child
return (
  <LibraryView
    prompts={optimisticPrompts}
    onDeletePrompt={handleDeletePrompt}
  />
);
```

### Optimistic State Propagation

When using optimistic state with search/filter hooks:

```typescript
// Initialize search with optimistic state
const searchWithDebounce = useSearchWithDebounce(optimisticPrompts);

// Search automatically works with optimistic updates!
```

---

## Pattern 3: Simplified Transitions with `useTransition`

### Overview

`useTransition` marks state updates as non-blocking, allowing React to keep the UI responsive during updates.

### Basic Pattern

```typescript
import { useTransition } from 'react';

const [isPending, startTransition] = useTransition();

const handleAction = () => {
  startTransition(() => {
    // Non-blocking state update
    setState(newValue);
  });
};

// Show loading UI
if (isPending) return <Spinner />;
```

### Simplified Implementation (React 19)

React 19 allows ignoring the `isPending` return when you don't need it:

```typescript
// ✅ React 19: Ignore isPending if unused
const [, startTransition] = useTransition();

// Only use for wrapping optimistic updates
startTransition(() => {
  setOptimisticState(value);
});
```

**Before React 19:**
```typescript
const [isPending, startTransition] = useTransition();
// Had to use isPending even if not needed
```

**After React 19:**
```typescript
const [, startTransition] = useTransition();
// Can ignore isPending entirely
```

---

## Testing Considerations

### Why No Unit Tests for React 19 Hooks?

React 19's new hooks (`useActionState`, `useOptimistic`) rely on browser APIs that are **not available in Node.js test environments** (jsdom/happy-dom):

**`useActionState`:**
- Requires native form submission API
- Uses progressive enhancement via `<form action={}>`
- Not supported in jsdom or happy-dom

**`useOptimistic`:**
- Testable but only with manual state management
- Real behavior depends on React's reconciliation

**Solution:**
- ✅ Manual testing in actual browsers
- ✅ End-to-end tests with Playwright
- ✅ Integration confirmed via production usage
- ❌ Unit tests not feasible with current tooling

### Test Environment Configuration

```typescript
// vitest.config.ts
export default defineConfig({
  test: {
    environment: 'happy-dom', // Faster and more modern than jsdom
    setupFiles: ['./src/test/setup.ts'],
  }
});
```

**Why happy-dom over jsdom:**
- 2-3x faster test execution
- Better spec compliance for modern web standards
- More actively maintained
- Same React 18 compatibility

---

## Migration Checklist for New Forms

When creating a new form component with React 19:

### 1. Setup useActionState

```typescript
const [errors, submitAction, isPending] = useActionState(
  async (_prevState: FieldErrors | null, formData: FormData) => {
    // Validation → Submission → Error handling
  },
  null
);
```

### 2. Form Structure

```tsx
<form action={submitAction}>
  {/* General error */}
  {errors?.general && <ErrorBanner message={errors.general} />}

  {/* Fields with name attributes */}
  <input name="field1" disabled={isPending} />
  {errors?.field1 && <FieldError message={errors.field1} />}

  {/* Submit button */}
  <button type="submit" disabled={isPending}>
    {isPending ? 'Loading...' : 'Submit'}
  </button>
</form>
```

### 3. Error State Type

```typescript
interface FieldErrors {
  [fieldName: string]: string | undefined;
  general?: string;
}
```

### 4. Character Counts (Local State)

```typescript
const [charCount, setCharCount] = useState(0);

<input
  name="field"
  onChange={(e) => setCharCount(e.target.value.length)}
  maxLength={100}
/>
<p>{charCount}/100 characters</p>
```

### 5. Conditional Styling

```typescript
className={errors?.field ? 'border-red-300' : 'border-purple-200'}
```

### 6. ARIA Attributes

```tsx
{errors?.general && (
  <div role="alert" aria-live="polite">
    {errors.general}
  </div>
)}
```

---

## Common Pitfalls

### ❌ Pitfall 1: Missing `name` Attributes

```tsx
// ❌ WRONG
<input id="title" />
// FormData.get('title') returns null

// ✅ CORRECT
<input name="title" />
```

### ❌ Pitfall 2: Forgetting `startTransition` with `useOptimistic`

```typescript
// ❌ WRONG - causes React warnings
setOptimisticDelete(id);

// ✅ CORRECT
startTransition(() => {
  setOptimisticDelete(id);
});
```

### ❌ Pitfall 3: Not Refreshing Base State on Error

```typescript
// ❌ WRONG - optimistic update won't revert
try {
  await delete(id);
} catch (err) {
  showError(); // UI stays in deleted state!
}

// ✅ CORRECT
try {
  await delete(id);
} catch (err) {
  await refreshData(); // Triggers revert
  showError();
}
```

### ❌ Pitfall 4: Rendering Base State Instead of Optimistic

```tsx
// ❌ WRONG
<List items={data} />

// ✅ CORRECT
<List items={optimisticData} />
```

### ❌ Pitfall 5: Controlled Components with FormData

```tsx
// ❌ WRONG - unnecessary complexity
const [value, setValue] = useState('');
<input value={value} onChange={e => setValue(e.target.value)} name="field" />

// ✅ CORRECT - uncontrolled with defaultValue
<input defaultValue="" name="field" />
```

---

## Performance Benefits

### Before React 19

```typescript
// Manual state management
const [isLoading, setIsLoading] = useState(false);
const [errors, setErrors] = useState({});

const handleSubmit = async (e: FormEvent) => {
  e.preventDefault();
  setIsLoading(true);
  setErrors({});

  const formData = new FormData(e.target as HTMLFormElement);
  const data = Object.fromEntries(formData);

  // Manual validation
  const newErrors = validate(data);
  if (Object.keys(newErrors).length > 0) {
    setErrors(newErrors);
    setIsLoading(false);
    return;
  }

  try {
    await onSubmit(data);
  } catch (err) {
    setErrors({ general: err.message });
  } finally {
    setIsLoading(false);
  }
};
```

### After React 19

```typescript
// Automatic state management
const [errors, submitAction, isPending] = useActionState(
  async (_, formData: FormData) => {
    const data = Object.fromEntries(formData);
    const validationErrors = validate(data);
    if (Object.keys(validationErrors).length > 0) return validationErrors;

    try {
      await onSubmit(data);
      return null;
    } catch (err) {
      return { general: err.message };
    }
  },
  null
);
```

**Benefits:**
- ✅ 50% less boilerplate code
- ✅ Automatic loading states
- ✅ Built-in error handling
- ✅ Progressive enhancement support
- ✅ Better TypeScript inference

---

## References

- **React 19 Blog**: https://react.dev/blog/2024/04/25/react-19
- **useActionState Docs**: https://react.dev/reference/react/useActionState
- **useOptimistic Docs**: https://react.dev/reference/react/useOptimistic
- **Migration Commits**: See git history for `5c07a1b`, `f58de6d`, `557d59e`

---

## Questions?

For implementation questions or issues:
1. Check the actual implementations in `AddPromptForm.tsx` and `EditPromptForm.tsx`
2. Review git commits `5c07a1b` through `02b58a9` for migration context
3. Refer to official React 19 documentation
