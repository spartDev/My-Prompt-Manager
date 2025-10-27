# useState to useActionState Migration Guide

## Overview

This guide provides step-by-step instructions for converting form components from traditional `useState` pattern to React 19's `useActionState` pattern. This migration applies to all form components in the project, particularly those handling async operations like imports, exports, and data submissions.

**Target Pattern:** React 19's `useActionState` hook with FormData API
**Project Standard:** Per CLAUDE.md, all forms must use `useActionState` for consistency and progressive enhancement

---

## Table of Contents

1. [When to Migrate](#when-to-migrate)
2. [Migration Steps](#migration-steps)
3. [Pattern Comparison](#pattern-comparison)
4. [Specific Scenarios](#specific-scenarios)
5. [Error Handling Integration](#error-handling-integration)
6. [Testing Implications](#testing-implications)
7. [Common Pitfalls](#common-pitfalls)

---

## When to Migrate

Migrate forms that:
- ✅ Have async submission logic
- ✅ Need loading states during operations
- ✅ Require validation before submission
- ✅ Use manual error state management
- ✅ Handle file uploads
- ✅ Perform button-triggered actions (export, clear, etc.)

Examples from this codebase:
- ✅ `DataStorageSection.tsx` - File upload imports, button-triggered exports
- ✅ `AddPromptForm.tsx` - Already migrated (reference implementation)
- ✅ `EditPromptForm.tsx` - Already migrated (reference implementation)

---

## Migration Steps

### Step 1: Identify Current State Variables

**Before Migration - Identify:**
```typescript
const [importing, setImporting] = useState(false);        // Loading state
const [clearing, setClearing] = useState(false);          // Loading state
const [showConfirm, setShowConfirm] = useState(false);   // UI state (keep as-is)
const [error, setError] = useState<string | null>(null); // Error state
```

**Classification:**
- **Loading states** → Replace with `isPending` from `useActionState`
- **Error states** → Replace with `errors` from `useActionState`
- **UI-only states** → Keep as local `useState` (modals, character counts, etc.)

---

### Step 2: Define Error State Type

Create a TypeScript interface for field-specific and general errors:

```typescript
interface FieldErrors {
  // Field-specific errors (keyed by field name)
  fileName?: string;
  fileContent?: string;

  // General errors (not tied to specific field)
  general?: string;
}
```

**Rules:**
- Use `general` for non-field-specific errors (network failures, business logic errors)
- Use field names for validation errors on specific inputs
- All fields are optional (`?`) - `null` state means no errors

---

### Step 3: Convert to useActionState

#### Pattern A: Form Submission

**Before (useState):**
```typescript
const [isLoading, setIsLoading] = useState(false);
const [error, setError] = useState<string | null>(null);

const handleSubmit = async (e: React.FormEvent) => {
  e.preventDefault();
  setIsLoading(true);
  setError(null);

  try {
    const formData = new FormData(e.target as HTMLFormElement);
    const value = formData.get('field') as string;

    // Validation
    if (!value.trim()) {
      setError('Field is required');
      setIsLoading(false);
      return;
    }

    await onSubmit(value);
  } catch (err) {
    setError((err as Error).message);
  } finally {
    setIsLoading(false);
  }
};
```

**After (useActionState):**
```typescript
const [errors, submitAction, isPending] = useActionState(
  async (_prevState: FieldErrors | null, formData: FormData) => {
    const value = formData.get('field') as string;

    // Validation
    const validationErrors: FieldErrors = {};
    if (!value.trim()) {
      validationErrors.field = 'Field is required';
    }

    // Return validation errors early (no submission)
    if (Object.keys(validationErrors).length > 0) {
      return validationErrors;
    }

    // Submission
    try {
      await onSubmit(value);
      return null; // Success
    } catch (err) {
      return { general: (err as Error).message };
    }
  },
  null // Initial error state
);
```

**Key Changes:**
- No manual `e.preventDefault()` - handled by `action={submitAction}`
- No manual loading state - use `isPending`
- No manual error state - use `errors`
- Return `null` on success, `FieldErrors` on failure

---

#### Pattern B: Button-Triggered Actions (Non-Form)

For actions triggered by buttons (export, clear data), wrap in a hidden form or call the action directly:

**Before (useState):**
```typescript
const [exporting, setExporting] = useState(false);

const handleExport = async () => {
  setExporting(true);
  try {
    // Export logic
    const data = generateExportData();
    downloadFile(data);
  } catch (err) {
    alert(`Export failed: ${(err as Error).message}`);
  } finally {
    setExporting(false);
  }
};
```

**After (useActionState) - Option 1: Hidden Form:**
```typescript
const [errors, exportAction, isExporting] = useActionState(
  async (_prevState: FieldErrors | null, _formData: FormData) => {
    try {
      const data = generateExportData();
      downloadFile(data);
      return null; // Success
    } catch (err) {
      Logger.error('Export failed', toError(err), {
        component: 'DataStorageSection',
        operation: 'export'
      });
      return { general: (err as Error).message };
    }
  },
  null
);

// In JSX:
<form action={exportAction}>
  <button
    type="submit"
    disabled={isExporting}
    className="..."
  >
    {isExporting ? 'Exporting...' : 'Export'}
  </button>
</form>
```

**After (useActionState) - Option 2: Manual Call:**
```typescript
// Same useActionState setup as above

// In JSX:
<button
  onClick={() => {
    const formData = new FormData();
    void exportAction(null, formData); // Call action directly
  }}
  disabled={isExporting}
>
  {isExporting ? 'Exporting...' : 'Export'}
</button>
```

**Recommendation:** Option 1 (hidden form) is preferred for semantic HTML and progressive enhancement.

---

### Step 4: Update JSX Structure

#### Before (Manual Event Handlers):
```tsx
<form onSubmit={(e) => void handleSubmit(e)}>
  {error && (
    <div className="error-banner">
      {error}
    </div>
  )}

  <input
    name="field"
    disabled={isLoading}
    className={error ? 'border-red-300' : 'border-purple-200'}
  />

  <button type="submit" disabled={isLoading}>
    {isLoading ? 'Saving...' : 'Save'}
  </button>
</form>
```

#### After (useActionState):
```tsx
<form action={submitAction}>
  {/* General error banner */}
  {errors?.general && (
    <div
      role="alert"
      aria-live="polite"
      className="error-banner"
    >
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
      </svg>
      <span>{errors.general}</span>
    </div>
  )}

  {/* Input with field-specific error */}
  <input
    name="field"
    disabled={isPending}
    className={errors?.field ? 'border-red-300' : 'border-purple-200'}
  />
  {errors?.field && (
    <p className="text-red-600 text-sm mt-2">
      ⚠️ {errors.field}
    </p>
  )}

  <button type="submit" disabled={isPending}>
    {isPending ? 'Saving...' : 'Save'}
  </button>
</form>
```

**Critical Changes:**
1. Replace `onSubmit={handler}` with `action={submitAction}`
2. Replace `isLoading` with `isPending`
3. Replace single `error` string with `errors` object
4. Add `role="alert"` and `aria-live="polite"` for accessibility
5. Add field-specific error display below each input

---

### Step 5: Preserve UI-Only State

Keep `useState` for:
- Character counters
- Modal visibility (confirmation dialogs)
- Toggle states
- Preview states

**Example:**
```typescript
// Keep these as useState
const [charCount, setCharCount] = useState(0);
const [showConfirm, setShowConfirm] = useState(false);

// Migrate to useActionState
const [errors, submitAction, isPending] = useActionState(/* ... */);

// Character count updates on input change
<input
  name="content"
  onChange={(e) => setCharCount(e.target.value.length)}
  disabled={isPending}
/>
<p>{charCount}/1000 characters</p>

// Confirmation modal state
{showConfirm ? (
  <ConfirmDialog onConfirm={submitAction} />
) : (
  <button onClick={() => setShowConfirm(true)}>Delete</button>
)}
```

---

## Pattern Comparison

### File Upload Import Form

#### Before (useState):
```typescript
const [importing, setImporting] = useState(false);
const fileInputRef = useRef<HTMLInputElement>(null);

const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
  const file = event.target.files?.[0];
  if (!file) return;

  setImporting(true);
  try {
    const text = await file.text();
    let data: unknown;

    try {
      data = JSON.parse(text);
    } catch {
      throw new Error('Invalid JSON format');
    }

    // Validation
    if (!isValidData(data)) {
      throw new Error('Invalid data structure');
    }

    await onImport(data);

    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  } catch (error) {
    Logger.error('Import failed', toError(error));
    alert(`Import failed: ${(error as Error).message}`);
  } finally {
    setImporting(false);
  }
};
```

#### After (useActionState):
```typescript
const fileInputRef = useRef<HTMLInputElement>(null);

const [errors, importAction, isImporting] = useActionState(
  async (_prevState: FieldErrors | null, formData: FormData) => {
    const file = formData.get('file') as File | null;

    // Validation
    if (!file) {
      return { general: 'Please select a file' };
    }

    try {
      const text = await file.text();

      // Parse JSON
      let data: unknown;
      try {
        data = JSON.parse(text);
      } catch {
        return {
          general: 'Invalid JSON format. Please select a valid backup file.'
        };
      }

      // Validate structure
      if (!isValidData(data)) {
        return {
          general: 'Invalid backup file: missing or invalid data structure.'
        };
      }

      // Submit
      await onImport(data);

      // Reset file input on success
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }

      return null; // Success
    } catch (err) {
      Logger.error('Import failed', toError(err), {
        component: 'DataStorageSection',
        operation: 'import'
      });
      return { general: (err as Error).message };
    }
  },
  null
);

// JSX:
{errors?.general && (
  <div role="alert" className="error-banner">
    ⚠️ {errors.general}
  </div>
)}

<form action={importAction}>
  <input
    ref={fileInputRef}
    type="file"
    name="file"
    accept=".json"
    className="hidden"
  />

  <button
    type="button"
    onClick={() => fileInputRef.current?.click()}
    disabled={isImporting}
  >
    {isImporting ? (
      <>
        <Spinner />
        <span>Importing...</span>
      </>
    ) : (
      <>
        <UploadIcon />
        <span>Import</span>
      </>
    )}
  </button>
</form>
```

**Key Points:**
- File input has `name="file"` attribute for FormData
- Use `formData.get('file') as File | null` to extract file
- Keep `fileInputRef` for programmatic click and reset
- Clear file input on success inside action function
- All errors go through `FieldErrors` return value

---

### Button Action with Confirmation Flow

#### Before (useState):
```typescript
const [clearing, setClearing] = useState(false);
const [showClearConfirm, setShowClearConfirm] = useState(false);

const handleClearData = async () => {
  if (!showClearConfirm) {
    setShowClearConfirm(true);
    return;
  }

  setClearing(true);
  try {
    await onClearData();
    setShowClearConfirm(false);
  } catch (error) {
    Logger.error('Failed to clear data', toError(error));
    alert('Failed to clear data');
  } finally {
    setClearing(false);
  }
};
```

#### After (useActionState):
```typescript
// Keep UI state for confirmation modal
const [showClearConfirm, setShowClearConfirm] = useState(false);

const [errors, clearAction, isClearing] = useActionState(
  async (_prevState: FieldErrors | null, _formData: FormData) => {
    try {
      await onClearData();

      // Close confirmation on success
      setShowClearConfirm(false);

      return null; // Success
    } catch (err) {
      Logger.error('Failed to clear data', toError(err), {
        component: 'DataStorageSection',
        operation: 'clear'
      });
      return { general: 'Failed to clear data. Please try again.' };
    }
  },
  null
);

// Two-stage button interaction
const handleClearClick = () => {
  if (!showClearConfirm) {
    setShowClearConfirm(true);
  } else {
    // Trigger form submission
    const formData = new FormData();
    void clearAction(null, formData);
  }
};

// JSX:
{showClearConfirm ? (
  <div className="confirmation-panel">
    {errors?.general && (
      <div role="alert" className="error-banner">
        ⚠️ {errors.general}
      </div>
    )}

    <p className="warning-text">
      ⚠️ This will permanently delete all data. This action cannot be undone.
    </p>

    <div className="button-group">
      <button
        onClick={handleClearClick}
        disabled={isClearing}
        className="danger-button"
      >
        {isClearing ? 'Clearing...' : 'Yes, Clear All Data'}
      </button>

      <button
        onClick={() => setShowClearConfirm(false)}
        disabled={isClearing}
        className="secondary-button"
      >
        Cancel
      </button>
    </div>
  </div>
) : (
  <button onClick={handleClearClick} className="secondary-button">
    Clear All Data
  </button>
)}
```

**Key Points:**
- Keep `showClearConfirm` as local `useState` (UI-only state)
- First click shows confirmation (handled by local state)
- Second click triggers `clearAction` (async operation)
- Success closes confirmation modal via `setShowClearConfirm(false)` inside action
- Errors display in confirmation panel via `errors?.general`

---

## Error Handling Integration

### Project Logger Integration

This project uses centralized logging (see CLAUDE.md "Logging Guidelines"). Always integrate with the Logger utility:

```typescript
import { Logger, toError } from '../utils';

const [errors, submitAction, isPending] = useActionState(
  async (_prevState: FieldErrors | null, formData: FormData) => {
    try {
      await onSubmit(data);

      // Log success (dev-only)
      Logger.info('Operation completed successfully', {
        component: 'MyComponent',
        operation: 'submit'
      });

      return null;
    } catch (err) {
      // Log error (production + dev)
      Logger.error('Operation failed', toError(err), {
        component: 'MyComponent',
        operation: 'submit',
        additionalContext: 'value'
      });

      return { general: (err as Error).message };
    }
  },
  null
);
```

**Logger Levels:**
- `Logger.error()` - Critical errors (always logged, even production)
- `Logger.warn()` - Non-critical issues (dev-only)
- `Logger.info()` - Informational (dev-only)
- `Logger.debug()` - Debugging details (dev-only)

**Always include:**
- `component` field in context object (required)
- Use `toError()` utility for error type safety
- Add operation-specific context

---

### User-Facing Error Messages

**Best Practices:**

1. **Validation Errors (Field-Specific):**
```typescript
const validationErrors: FieldErrors = {};

if (!content.trim()) {
  validationErrors.content = 'Content is required';
}

if (content.length > MAX_LENGTH) {
  validationErrors.content = `Content cannot exceed ${MAX_LENGTH} characters`;
}

if (Object.keys(validationErrors).length > 0) {
  return validationErrors; // No logging needed for validation
}
```

2. **Business Logic Errors (General):**
```typescript
try {
  await onSubmit(data);
  return null;
} catch (err) {
  Logger.error('Submission failed', toError(err), {
    component: 'MyForm'
  });

  // User-friendly message (not raw error)
  return {
    general: 'Failed to save. Please check your connection and try again.'
  };
}
```

3. **File Import Errors (Specific):**
```typescript
try {
  data = JSON.parse(text);
} catch {
  return {
    general: 'Invalid JSON format. Please select a valid backup file.'
  };
}

if (!isValidStructure(data)) {
  return {
    general: 'Invalid backup file: missing required data fields.'
  };
}
```

**Rules:**
- Validation errors → field-specific, no logging
- Submission errors → general error, always log with `Logger.error()`
- User messages should be actionable ("Please check X and try again")
- Don't expose internal error details to users in production

---

## Testing Implications

### Manual Browser Testing Required

**From CLAUDE.md:**
> **Note**: React 19 hooks (`useActionState`, `useOptimistic`) tested manually in browser (not supported in Node.js test environments)

**Why No Unit Tests:**
- `useActionState` relies on browser FormData API
- Progressive enhancement features require real form submission
- jsdom/happy-dom don't support React 19's form action interception

**Testing Strategy:**

1. **Manual Browser Testing (Primary):**
   - Test form submission with valid data
   - Test form submission with invalid data
   - Test loading states (`isPending`)
   - Test error display (field-specific and general)
   - Test form reset after success
   - Test disabled states during submission
   - Test accessibility (keyboard navigation, screen readers)

2. **Integration Tests (Playwright - Future):**
   - End-to-end flows in real browser
   - File upload scenarios
   - Multi-step confirmation flows

3. **Unit Tests (Business Logic Only):**
   - Test validation logic in isolation
   - Test data parsing/formatting utilities
   - Test service layer functions

**Testing Checklist (Manual):**
```markdown
## Form Testing Checklist

### Happy Path
- [ ] Submit form with valid data
- [ ] Loading indicator appears
- [ ] Success callback fires
- [ ] Form resets or closes
- [ ] No errors displayed

### Validation
- [ ] Empty required fields show errors
- [ ] Max length validation works
- [ ] Field-specific errors appear below fields
- [ ] Errors clear on valid input

### Error Handling
- [ ] Network errors show general error
- [ ] Error persists until fixed or dismissed
- [ ] Logger.error() called (check console)

### UX
- [ ] Submit button disabled during submission
- [ ] All inputs disabled during submission
- [ ] Loading text appears on submit button
- [ ] Keyboard navigation works (Tab, Enter)
- [ ] Screen reader announces errors

### File Upload (if applicable)
- [ ] File selection works
- [ ] Invalid file types rejected
- [ ] File input resets after success
- [ ] Large files handled gracefully
```

---

## Common Pitfalls

### ❌ Pitfall 1: Missing `name` Attributes

**Problem:**
```tsx
<input id="title" /> {/* FormData can't extract this */}
```

**Solution:**
```tsx
<input name="title" id="title" /> {/* name is required */}
```

**Why:** FormData API uses `name` attribute, not `id`

---

### ❌ Pitfall 2: Using `onSubmit` Instead of `action`

**Problem:**
```tsx
<form onSubmit={submitAction}> {/* Won't work with useActionState */}
```

**Solution:**
```tsx
<form action={submitAction}> {/* Correct */}
```

**Why:** `useActionState` requires native form `action` attribute for progressive enhancement

---

### ❌ Pitfall 3: Not Returning `null` on Success

**Problem:**
```typescript
const [errors, submitAction, isPending] = useActionState(
  async (_, formData) => {
    await onSubmit(data);
    // Missing return - errors won't clear
  },
  null
);
```

**Solution:**
```typescript
const [errors, submitAction, isPending] = useActionState(
  async (_, formData) => {
    await onSubmit(data);
    return null; // Clears errors
  },
  null
);
```

**Why:** Returning `null` signals success and clears error state

---

### ❌ Pitfall 4: Controlled Components with FormData

**Problem:**
```tsx
const [value, setValue] = useState('');

<input
  value={value}
  onChange={(e) => setValue(e.target.value)}
  name="field"
/>
```

**Solution:**
```tsx
<input
  defaultValue=""
  name="field"
/>
```

**Why:** FormData works with uncontrolled inputs. Use `defaultValue` for initial values, not `value` + `onChange`

**Exception:** Character counters and live validation still need `onChange`:
```tsx
const [charCount, setCharCount] = useState(0);

<input
  name="content"
  defaultValue=""
  onChange={(e) => setCharCount(e.target.value.length)} // OK for UI state
/>
<p>{charCount}/1000 characters</p>
```

---

### ❌ Pitfall 5: Calling Action Outside Form

**Problem:**
```tsx
<button onClick={() => submitAction()}>Submit</button>
```

**Solution (Preferred):**
```tsx
<form action={submitAction}>
  <button type="submit">Submit</button>
</form>
```

**Solution (Alternative):**
```tsx
<button onClick={() => {
  const formData = new FormData();
  void submitAction(null, formData);
}}>
  Submit
</button>
```

**Why:** Forms provide better semantics and progressive enhancement

---

### ❌ Pitfall 6: Not Disabling Inputs During Submission

**Problem:**
```tsx
<input name="field" /> {/* Can be edited during submission */}
<button type="submit" disabled={isPending}>Submit</button>
```

**Solution:**
```tsx
<input name="field" disabled={isPending} />
<button type="submit" disabled={isPending}>Submit</button>
```

**Why:** Prevents user from changing data mid-submission, which can cause race conditions

---

### ❌ Pitfall 7: Forgetting ARIA Attributes

**Problem:**
```tsx
{errors?.general && (
  <div className="error-banner">
    {errors.general}
  </div>
)}
```

**Solution:**
```tsx
{errors?.general && (
  <div
    role="alert"
    aria-live="polite"
    className="error-banner"
  >
    {errors.general}
  </div>
)}
```

**Why:** Screen readers need `role="alert"` and `aria-live` to announce errors

---

### ❌ Pitfall 8: Not Logging Errors

**Problem:**
```typescript
try {
  await onSubmit(data);
  return null;
} catch (err) {
  return { general: 'Failed' }; // No logging
}
```

**Solution:**
```typescript
try {
  await onSubmit(data);
  return null;
} catch (err) {
  Logger.error('Submit failed', toError(err), {
    component: 'MyForm',
    operation: 'submit'
  });
  return { general: 'Failed to save' };
}
```

**Why:** Production debugging requires error logging. Always use `Logger.error()` for submission failures.

---

## DataStorageSection.tsx Specific Migration

### Current Implementation Analysis (Lines 55-144)

**File Upload Import (Lines 55-144):**
- Uses `useState` for `importing` loading state
- Uses manual `handleFileChange` async function
- Uses `try/catch/finally` pattern
- Shows errors via `alert()` (should be inline)

**Export Button (Lines 32-49):**
- Synchronous operation (generates + downloads file)
- No loading state (could add for large exports)
- No error handling

**Clear Data Button (Lines 146-161):**
- Uses `useState` for `clearing` loading state
- Uses `showClearConfirm` for confirmation flow (keep as-is)
- Uses `try/catch/finally` pattern

### Recommended Migration Approach

1. **Import Form (High Priority):**
   - Convert to `useActionState` for loading/error states
   - Replace `alert()` with inline error display
   - Add field-specific error for file validation

2. **Export Button (Low Priority):**
   - Currently synchronous - no immediate need to migrate
   - If export becomes async (e.g., API upload), migrate then

3. **Clear Data Button (High Priority):**
   - Convert to `useActionState` for loading/error states
   - Keep `showClearConfirm` as local `useState`
   - Add inline error display in confirmation panel

### Migration Code Example for Import

**Current (Lines 55-144):**
```typescript
const [importing, setImporting] = useState(false);

const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
  const file = event.target.files?.[0];
  if (!file) return;

  setImporting(true);
  try {
    const text = await file.text();
    // ... validation logic ...
    await onImport({ prompts, categories });
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  } catch (error) {
    Logger.error('Import failed', toError(error));
    alert(`Import failed: ${errorMessage}`);
  } finally {
    setImporting(false);
  }
};
```

**After (useActionState):**
```typescript
const [errors, importAction, isImporting] = useActionState(
  async (_prevState: FieldErrors | null, formData: FormData) => {
    const file = formData.get('file') as File | null;

    if (!file) {
      return { general: 'Please select a file to import' };
    }

    try {
      const text = await file.text();

      // Parse JSON
      let data: unknown;
      try {
        data = JSON.parse(text);
      } catch {
        return {
          general: 'Invalid JSON format. Please select a valid backup file.'
        };
      }

      // Type validation
      const typedData = data as { prompts?: unknown; categories?: unknown };

      if (!typedData.prompts || !Array.isArray(typedData.prompts)) {
        return {
          general: 'Invalid backup file: missing or invalid prompts data.'
        };
      }

      if (typedData.categories && !Array.isArray(typedData.categories)) {
        return {
          general: 'Invalid backup file: categories data is not in valid format.'
        };
      }

      // Structure validation (keep existing validation logic)
      const invalidPrompt = typedData.prompts.find(/* ... */);
      if (invalidPrompt) {
        return {
          general: 'Invalid backup file: one or more prompts have invalid structure.'
        };
      }

      // Submit
      await onImport({
        prompts: typedData.prompts,
        categories: typedData.categories || []
      });

      // Reset file input on success
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }

      Logger.info('Import successful', {
        component: 'DataStorageSection',
        promptCount: typedData.prompts.length,
        categoryCount: typedData.categories?.length || 0
      });

      return null; // Success
    } catch (err) {
      Logger.error('Import failed', toError(err), {
        component: 'DataStorageSection',
        operation: 'import'
      });

      const errorMessage = err instanceof Error
        ? err.message
        : 'Unknown error occurred';

      return {
        general: `Import failed: ${errorMessage}\n\nPlease ensure you are selecting a valid backup file exported from this extension.`
      };
    }
  },
  null
);

// JSX:
<div className="bg-white dark:bg-gray-800 rounded-lg p-4 border">
  <h3>Backup & Restore</h3>

  {/* Error display - replace alert() */}
  {errors?.general && (
    <div
      role="alert"
      aria-live="polite"
      className="mb-3 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg"
    >
      <p className="text-sm text-red-700 dark:text-red-300">
        ⚠️ {errors.general}
      </p>
    </div>
  )}

  <form action={importAction}>
    <input
      ref={fileInputRef}
      type="file"
      name="file"
      accept=".json"
      className="hidden"
    />

    <div className="flex gap-2">
      <button
        type="button"
        onClick={handleExport}
        className="flex-1 ... "
      >
        <DownloadIcon />
        <span>Export</span>
      </button>

      <button
        type="button"
        onClick={() => fileInputRef.current?.click()}
        disabled={isImporting}
        className="flex-1 ..."
      >
        {isImporting ? (
          <>
            <Spinner />
            <span>Importing...</span>
          </>
        ) : (
          <>
            <UploadIcon />
            <span>Import</span>
          </>
        )}
      </button>
    </div>
  </form>
</div>
```

**Key Migration Points:**
1. Replace `useState(importing)` with `isImporting` from `useActionState`
2. Move validation logic into action function
3. Replace `alert()` with inline error banner
4. Add `name="file"` to file input
5. Extract file via `formData.get('file')`
6. Return `FieldErrors` for all error cases
7. Return `null` on success
8. Log with `Logger.error()` and `Logger.info()`

---

## Summary Checklist

When migrating a form to `useActionState`:

- [ ] Identify all loading states (`useState<boolean>`) → replace with `isPending`
- [ ] Identify all error states (`useState<string | null>`) → replace with `errors`
- [ ] Keep UI-only states as `useState` (modals, counters, toggles)
- [ ] Define `FieldErrors` interface
- [ ] Create `useActionState` hook with validation and submission logic
- [ ] Update JSX: `onSubmit` → `action`, add `name` attributes
- [ ] Add error display with ARIA attributes
- [ ] Integrate `Logger.error()` for submission failures
- [ ] Return `null` on success, `FieldErrors` on failure
- [ ] Disable all inputs with `disabled={isPending}`
- [ ] Update button text based on `isPending`
- [ ] Test manually in browser (see Testing Checklist above)
- [ ] Run `npm run lint` and `npm test` after migration

---

## References

- **Project Standards:** `CLAUDE.md` - "Creating New Form Components (React 19)"
- **Migration Examples:** `docs/REACT_19_MIGRATION.md`
- **Existing Implementations:**
  - `/src/components/AddPromptForm.tsx` (lines 107-205)
  - `/src/components/EditPromptForm.tsx` (lines 29-85)
- **Logging Guidelines:** `CLAUDE.md` - "Logging Guidelines"
- **Design System:** `docs/DESIGN_GUIDELINES.md`
- **React 19 Docs:** https://react.dev/reference/react/useActionState

---

## Questions or Issues?

If you encounter migration challenges:

1. Reference existing form implementations (`AddPromptForm.tsx`, `EditPromptForm.tsx`)
2. Check `REACT_19_MIGRATION.md` for additional patterns
3. Review React 19 official documentation
4. Test thoroughly in browser (unit tests not supported)
5. Ensure all forms follow project design system (see `DESIGN_GUIDELINES.md`)

---

**Document Version:** 1.0
**Last Updated:** 2025-10-27
**Author:** Migration guide for My-Prompt-Manager project
