import { forwardRef, useActionState, useEffect, useMemo, useRef, useState } from 'react';
import type { FC } from 'react';

import { formatCharacterCount } from '../constants/validation';
import { admit, PROMPT_LIMITS } from '../services/promptAdmission';
import { decode } from '../services/promptEncoder';
import { DEFAULT_CATEGORY, type SharedPromptData } from '../types';
import type { AddPromptFormProps } from '../types/components';
import { Logger, toError, validatePromptFields, type FieldErrors } from '../utils';

import { Dropdown, type DropdownItem } from './Dropdown';
import ViewHeader from './ViewHeader';

// Form mode type
type FormMode = 'create' | 'import';

// Category dropdown trigger button component props
// Extends ButtonHTMLAttributes to inherit all standard button props (onClick, disabled, aria-*, etc.)
interface CategoryTriggerProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  selectedCategory: string;
}

// Category dropdown trigger button component
// Uses forwardRef to allow Dropdown to attach ref and event handlers
const CategoryTrigger = forwardRef<HTMLButtonElement, CategoryTriggerProps>(
  ({ selectedCategory, className, ...rest }, ref) => (
    <button
      ref={ref}
      type="button"
      {...rest}
      className={className ?? "w-full px-4 py-3 border border-input rounded-xl focus-input bg-subtle transition-all duration-200 font-medium cursor-pointer text-primary text-left flex items-center justify-between disabled:opacity-50 disabled:cursor-not-allowed"}
    >
      <span>{selectedCategory}</span>
      <svg className="w-4 h-4 text-tertiary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
      </svg>
    </button>
  )
);
CategoryTrigger.displayName = 'CategoryTrigger';

const AddPromptForm: FC<AddPromptFormProps> = ({
  categories,
  onSubmit,
  onCancel
}) => {
  // Mode state - controls whether user is creating or importing
  const [mode, setMode] = useState<FormMode>('create');

  // Import mode state
  const [importCode, setImportCode] = useState('');
  const [decodedPrompt, setDecodedPrompt] = useState<SharedPromptData | null>(null);
  const [validationError, setValidationError] = useState<string>('');
  const [isValidating, setIsValidating] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string>(DEFAULT_CATEGORY);

  // Create mode state
  const [createCategory, setCreateCategory] = useState<string>(DEFAULT_CATEGORY);

  // Create mode text, kept as the inputs' defaultValue: React 19 resets a form's uncontrolled
  // fields once its action completes, and the reset restores the defaultValue, so a refused save
  // keeps exactly what the user typed. The character counters derive from the same state.
  const [createTitle, setCreateTitle] = useState('');
  const [createContent, setCreateContent] = useState('');
  
  // Ref for debounce timer
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Cleanup when leaving import mode to prevent race conditions
  useEffect(() => {
    if (mode !== 'import') {
      // Clear any pending validation timer
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
        debounceTimerRef.current = null;
      }
      // Reset import state
      setImportCode('');
      setDecodedPrompt(null);
      setValidationError('');
      setIsValidating(false);
    }
  }, [mode]);

  // Handle import code change with debounced validation
  const handleImportCodeChange = (code: string) => {
    setImportCode(code);
    
    // Clear existing timer
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    // If empty, clear validation state immediately
    if (!code.trim()) {
      setDecodedPrompt(null);
      setValidationError('');
      setIsValidating(false);
      return;
    }

    // Set validating state
    setIsValidating(true);

    // Debounced validation (300ms)
    debounceTimerRef.current = setTimeout(() => {
      try {
        // Decoding only parses; whether the text is acceptable is Admission's call. Ask it now
        // (without saving) so the user hears about a refusal straight away. The result is what
        // will be saved, so the preview shows that rather than the raw text.
        const admission = admit(decode(code));
        if (!admission.ok) {
          const message = Object.values(admission.errors)
            .flatMap(refusal => (refusal ? [refusal.message] : []))
            .join('; ');
          setDecodedPrompt(null);
          setValidationError(message);
          Logger.warn('Import code would be refused at Admission', {
            component: 'AddPromptForm',
            mode: 'import',
            fields: Object.keys(admission.errors)
          });
          return;
        }
        const decoded = admission.text;
        setDecodedPrompt(decoded);
        setValidationError('');

        // Try to set the category to the decoded prompt's category if it exists
        const categoryExists = categories.find(c => c.name === decoded.category);
        if (categoryExists) {
          setSelectedCategory(decoded.category);
        } else {
          // If category doesn't exist, keep default
          setSelectedCategory(DEFAULT_CATEGORY);
        }

        Logger.info('Import code validated successfully', {
          component: 'AddPromptForm',
          mode: 'import'
        });
      } catch (err) {
        setDecodedPrompt(null);
        setValidationError((err as Error).message || 'Invalid sharing code');
        Logger.warn('Import code validation failed', {
          component: 'AddPromptForm',
          error: (err as Error).message
        });
      } finally {
        setIsValidating(false);
      }
    }, 300);
  };

  // React 19 useActionState for automatic loading/error handling
  const [errors, submitAction, isPending] = useActionState(
    async (_prevState: FieldErrors | null, formData: FormData) => {
      let title: string;
      let content: string;
      let category: string;

      // Handle import mode vs create mode
      if (mode === 'import') {
        // Import mode validation
        if (!decodedPrompt) {
          Logger.warn('Import failed: No valid prompt decoded', {
            component: 'AddPromptForm',
            mode: 'import'
          });
          return { general: 'Please enter a valid sharing code to import' };
        }

        if (validationError) {
          Logger.warn('Import failed: Validation error present', {
            component: 'AddPromptForm',
            mode: 'import',
            error: validationError
          });
          return { general: validationError };
        }

        // Use decoded prompt data
        title = decodedPrompt.title;
        content = decodedPrompt.content;
        category = selectedCategory;

        Logger.info('Importing prompt from sharing code', {
          component: 'AddPromptForm',
          mode: 'import',
          category: selectedCategory
        });
      } else {
        // Create mode - extract from form data
        title = formData.get('title') as string;
        content = formData.get('content') as string;
        category = createCategory;

        // Validation for create mode using shared utility
        const validationErrors = validatePromptFields(title, content, {
          component: 'AddPromptForm'
        });

        // Return validation errors if any
        if (Object.keys(validationErrors).length > 0) {
          return validationErrors;
        }
      }

      // Submit data (works for both modes)
      try {
        await onSubmit({
          title,
          content,
          category
        });
        Logger.info('Prompt form submitted successfully', {
          component: 'AddPromptForm',
          mode,
          category,
          hasTitle: !!title.trim()
        });
        // The form reset that follows a successful action then clears the fields, as before
        setCreateTitle('');
        setCreateContent('');
        return null; // Success, no error
      } catch (err) {
        Logger.error('Failed to submit prompt form', toError(err), {
          component: 'AddPromptForm',
          mode,
          category,
          hasTitle: !!title.trim()
        });
        return { general: (err as Error).message || 'Failed to save prompt' };
      }
    },
    null // Initial error state
  );

  // Generate dropdown items from categories
  const createCategoryItems = useMemo<DropdownItem[]>(
    () => categories.map(cat => ({
      id: cat.id,
      label: cat.name,
      onSelect: () => { setCreateCategory(cat.name); }
    })),
    [categories]
  );

  // Generate dropdown items for import mode
  const importCategoryItems = useMemo<DropdownItem[]>(
    () => categories.map(cat => ({
      id: cat.id,
      label: cat.name,
      onSelect: () => { setSelectedCategory(cat.name); }
    })),
    [categories]
  );

  return (
    <div className="h-full flex flex-col bg-app">
      {/* Header */}
      <ViewHeader
        icon="add"
        title="Add New Prompt"
        subtitle="Create a reusable text snippet"
      >
        <ViewHeader.Actions>
          <ViewHeader.BackButton onClick={onCancel} />
        </ViewHeader.Actions>
      </ViewHeader>

      {/* Mode Selector */}
      <div className="shrink-0 px-4 pb-4">
        <div className="flex items-center gap-2 bg-card border border-default rounded-xl p-1">
          <button
            type="button"
            onClick={() => {
              setMode('create');
            }}
            className={`flex-1 px-4 py-2 text-sm font-semibold rounded-lg border transition-all duration-200 focus-interactive ${
              mode === 'create'
                ? 'bg-accent-selected border-accent text-accent-strong'
                : 'border-transparent text-secondary hover:text-primary'
            }`}
            disabled={isPending}
            aria-pressed={mode === 'create'}
            aria-label="Create new prompt"
          >
            <div className="flex items-center justify-center space-x-2">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              <span>Create New</span>
            </div>
          </button>
          <button
            type="button"
            onClick={() => {
              setMode('import');
            }}
            className={`flex-1 px-4 py-2 text-sm font-semibold rounded-lg border transition-all duration-200 focus-interactive ${
              mode === 'import'
                ? 'bg-accent-selected border-accent text-accent-strong'
                : 'border-transparent text-secondary hover:text-primary'
            }`}
            disabled={isPending}
            aria-pressed={mode === 'import'}
            aria-label="Import shared prompt"
          >
            <div className="flex items-center justify-center space-x-2">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              <span>Import Shared</span>
            </div>
          </button>
        </div>
      </div>

      {/* General Error Display */}
      {errors?.general && (
        <div
          role="alert"
          aria-live="polite"
          className="shrink-0 p-4 text-sm text-danger bg-danger-subtle border-y border-danger font-medium"
        >
          <div className="flex items-center space-x-2">
            <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <span>{errors.general}</span>
          </div>
        </div>
      )}

      {/* Form */}
      <div className="flex-1 overflow-auto custom-scrollbar p-4" data-scroll-container>
          <form id="add-prompt-form" action={submitAction} className="bg-card border border-default rounded-2xl shadow-sm overflow-hidden divide-y divide-divider">
            {/* Import Mode UI */}
            {mode === 'import' && (
              <>
                {/* Instructions */}
                <div className="p-5">
                  <div className="flex items-start space-x-3 p-3 rounded-xl border border-accent bg-accent-subtle">
                    <div className="shrink-0 w-6 h-6 rounded-full bg-accent flex items-center justify-center">
                      <svg className="w-4 h-4 text-on-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                    <div className="flex-1">
                      <h3 className="text-sm font-semibold text-accent-strong mb-1">
                        How to Import
                      </h3>
                      <p className="text-xs text-accent-strong leading-relaxed">
                        Paste the sharing code you received from another user below. The code will be automatically validated and decoded.
                      </p>
                    </div>
                  </div>
                </div>

                {/* Import Code Text Area */}
                <div className="p-5">
                  <label htmlFor="import-code" className="block text-sm font-semibold text-secondary mb-3">
                    Sharing Code *
                  </label>
                  <textarea
                    id="import-code"
                    value={importCode}
                    onChange={(e) => {
                      handleImportCodeChange(e.target.value);
                    }}
                    placeholder="Paste the sharing code here..."
                    rows={6}
                    className={`w-full px-4 py-3 border rounded-xl focus-input resize-none bg-subtle transition-all duration-200 text-primary placeholder:text-tertiary font-mono text-sm ${
                      validationError ? 'border-error' : 'border-input'
                    }`}
                    disabled={isPending}
                  />
                  {/* Validation Status */}
                  {isValidating && (
                    <div className="mt-2 flex items-center space-x-2 text-sm text-accent">
                      <div className="w-4 h-4 border-2 border-current/30 border-t-current rounded-full animate-spin"></div>
                      <span>Validating...</span>
                    </div>
                  )}
                  {validationError && (
                    <p className="mt-2 text-sm text-danger font-medium flex items-center space-x-1">
                      <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                      </svg>
                      <span>{validationError}</span>
                    </p>
                  )}
                  {decodedPrompt && !validationError && (
                    <p className="mt-2 text-sm text-success font-medium flex items-center space-x-1">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      <span>Valid sharing code detected</span>
                    </p>
                  )}
                </div>

                {/* Preview Section */}
                {decodedPrompt && !validationError && (
                  <div className="p-5">
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="text-sm font-semibold text-secondary">
                        Preview
                      </h3>
                      <span className="text-xs text-tertiary font-medium">
                        Decoded from sharing code
                      </span>
                    </div>

                    {/* Preview Card */}
                    <div className="bg-raised rounded-xl border border-default p-4 space-y-3">
                      {/* Title Preview */}
                      <div>
                        <p className="text-xs text-tertiary font-medium mb-1">
                          Title
                        </p>
                        <p className="text-sm font-semibold text-primary">
                          {decodedPrompt.title}
                        </p>
                      </div>

                      {/* Content Preview */}
                      <div>
                        <p className="text-xs text-tertiary font-medium mb-1">
                          Content
                        </p>
                        <div className="bg-subtle rounded-lg p-3 max-h-40 overflow-y-auto custom-scrollbar">
                          <p className="text-sm text-secondary whitespace-pre-wrap break-words">
                            {decodedPrompt.content}
                          </p>
                        </div>
                        <p className="mt-1 text-xs text-tertiary font-medium">
                          {decodedPrompt.content.length} characters
                        </p>
                      </div>

                      {/* Original Category Preview */}
                      <div>
                        <p className="text-xs text-tertiary font-medium mb-1">
                          Original Category
                        </p>
                        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-accent-subtle text-accent">
                          {decodedPrompt.category}
                        </span>
                      </div>
                    </div>

                    {/* Info Note */}
                    <p className="mt-3 text-xs text-tertiary italic flex items-start space-x-1">
                      <svg className="w-3 h-3 mt-0.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <span>You can select a different category below before importing</span>
                    </p>
                  </div>
                )}

                {/* Category Selector for Import */}
                {decodedPrompt && !validationError && (
                  <div className="p-5">
                    {/* Label uses aria-labelledby on the button instead of htmlFor -
                        this is the correct accessible pattern for custom dropdown triggers
                        since buttons don't respond to label clicks like native form controls */}
                    <label id="import-category-label" className="block text-sm font-semibold text-secondary mb-3">
                      Import to Category
                    </label>
                    <Dropdown
                      trigger={
                        <CategoryTrigger
                          selectedCategory={selectedCategory}
                          disabled={isPending}
                          id="import-category"
                          aria-labelledby="import-category-label"
                        />
                      }
                      items={importCategoryItems}
                      placement="bottom-start"
                      ariaLabel="Select import category"
                      matchWidth
                    />
                    <p className="mt-2 text-xs text-tertiary font-medium">
                      {selectedCategory === decodedPrompt.category
                        ? 'Using original category'
                        : `Importing to "${selectedCategory}" instead of "${decodedPrompt.category}"`
                      }
                    </p>
                  </div>
                )}
              </>
            )}

            {/* Create Mode UI */}
            {mode === 'create' && (
              <>
            {/* Title */}
            <div className="p-5">
              <label htmlFor="title" className="block text-sm font-semibold text-secondary mb-3">
                Title (optional)
              </label>
              <input
                type="text"
                id="title"
                name="title"
                defaultValue={createTitle}
                onChange={(e) => { setCreateTitle(e.target.value); }}
                placeholder="Enter a descriptive title or leave blank to auto-generate"
                className={`w-full px-4 py-3 border rounded-xl focus-input bg-subtle transition-all duration-200 text-primary placeholder:text-tertiary ${
                  errors?.title ? 'border-error' : 'border-input'
                }`}
                disabled={isPending}
              />
              {errors?.title && (
                <p className="mt-2 text-sm text-danger font-medium flex items-center space-x-1">
                  <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                  <span>{errors.title}</span>
                </p>
              )}
              <p className={`mt-2 text-xs font-medium ${createTitle.length > PROMPT_LIMITS.title ? 'text-danger' : 'text-tertiary'}`}>
                {formatCharacterCount(createTitle.length, PROMPT_LIMITS.title)}
              </p>
            </div>

            {/* Category */}
            <div className="p-5">
              {/* Label uses aria-labelledby on the button instead of htmlFor -
                  this is the correct accessible pattern for custom dropdown triggers
                  since buttons don't respond to label clicks like native form controls */}
              <label id="category-label" className="block text-sm font-semibold text-secondary mb-3">
                Category
              </label>
              <Dropdown
                trigger={
                  <CategoryTrigger
                    selectedCategory={createCategory}
                    disabled={isPending}
                    id="category"
                    aria-labelledby="category-label"
                  />
                }
                items={createCategoryItems}
                placement="bottom-start"
                ariaLabel="Select category"
                matchWidth
              />
            </div>

            {/* Content */}
            <div className="p-5">
              <label htmlFor="content" className="block text-sm font-semibold text-secondary mb-3">
                Content *
              </label>
              <textarea
                id="content"
                name="content"
                defaultValue={createContent}
                onChange={(e) => { setCreateContent(e.target.value); }}
                placeholder="Enter your prompt content here..."
                rows={8}
                className={`w-full px-4 py-3 border rounded-xl focus-input resize-none bg-subtle transition-all duration-200 text-primary placeholder:text-tertiary ${
                  errors?.content ? 'border-error' : 'border-input'
                }`}
                disabled={isPending}
                required
              />
              {errors?.content && (
                <p className="mt-2 text-sm text-danger font-medium flex items-center space-x-1">
                  <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                  <span>{errors.content}</span>
                </p>
              )}
              <p className={`mt-2 text-xs font-medium ${createContent.length > PROMPT_LIMITS.content ? 'text-danger' : 'text-tertiary'}`}>
                {formatCharacterCount(createContent.length, PROMPT_LIMITS.content)}
              </p>
            </div>
              </>
            )}

          </form>
      </div>

      {/* Footer */}
      <div className="shrink-0 p-6 bg-app border-t border-transparent scroll-edge-bottom">
        <div className="flex space-x-3">
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 px-6 py-3 text-sm font-semibold text-secondary bg-card border border-strong rounded-xl hover:bg-muted transition-all duration-200 focus-secondary"
            disabled={isPending}
          >
            Cancel
          </button>
          <button
            type="submit"
            form="add-prompt-form"
            className="flex-1 px-6 py-3 text-sm font-semibold text-on-accent bg-accent rounded-xl hover:bg-accent-hover transition-all duration-200 shadow-lg hover:shadow-xl disabled:opacity-50 focus-primary"
            disabled={isPending || (mode === 'import' && (!decodedPrompt || !!validationError || isValidating))}
          >
            {isPending ? (
              <div className="flex items-center justify-center space-x-2">
                <div className="w-4 h-4 border-2 border-current/30 border-t-current rounded-full animate-spin"></div>
                <span>{mode === 'import' ? 'Importing...' : 'Saving...'}</span>
              </div>
            ) : (
              mode === 'import' ? 'Import Prompt' : 'Save Prompt'
            )}
          </button>
        </div>
      </div>

    </div>
  );
};

export default AddPromptForm;