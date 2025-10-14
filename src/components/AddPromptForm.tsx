import { useActionState, useRef, useState } from 'react';
import type { FC } from 'react';

import { MAX_CONTENT_LENGTH, MAX_TITLE_LENGTH, VALIDATION_MESSAGES, formatCharacterCount } from '../constants/validation';
import { decode } from '../services/promptEncoder';
import { DEFAULT_CATEGORY, Category, SharedPromptData } from '../types';
import { AddPromptFormProps } from '../types/components';
import { Logger, toError } from '../utils';

import ViewHeader from './ViewHeader';

// Form mode type
type FormMode = 'create' | 'import';

// Error state type for field-specific validation
interface FieldErrors {
  title?: string;
  content?: string;
  general?: string;
}

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

  // Character count state for validation feedback
  const [titleLength, setTitleLength] = useState(0);
  const [contentLength, setContentLength] = useState(0);
  
  // Ref for debounce timer
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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
        const decoded = decode(code);
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
        category = formData.get('category') as string;

        // Validation for create mode
        const validationErrors: FieldErrors = {};

        if (!content.trim()) {
          Logger.warn('Form validation failed: Content is required', {
            component: 'AddPromptForm',
            field: 'content'
          });
          validationErrors.content = VALIDATION_MESSAGES.CONTENT_REQUIRED;
        }

        if (content.length > MAX_CONTENT_LENGTH) {
          Logger.warn('Form validation failed: Content exceeds limit', {
            component: 'AddPromptForm',
            field: 'content',
            length: content.length,
            limit: MAX_CONTENT_LENGTH
          });
          validationErrors.content = VALIDATION_MESSAGES.CONTENT_TOO_LONG;
        }

        if (title.length > MAX_TITLE_LENGTH) {
          Logger.warn('Form validation failed: Title exceeds limit', {
            component: 'AddPromptForm',
            field: 'title',
            length: title.length,
            limit: MAX_TITLE_LENGTH
          });
          validationErrors.title = VALIDATION_MESSAGES.TITLE_TOO_LONG;
        }

        // Return validation errors if any
        if (Object.keys(validationErrors).length > 0) {
          return validationErrors;
        }
      }

      // Submit data (works for both modes)
      try {
        await (onSubmit as (data: { title: string; content: string; category: string }) => Promise<void>)({
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

  return (
    <div className="h-full flex flex-col bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <ViewHeader
        icon="add"
        title="Add New Prompt"
        subtitle="Create a reusable text snippet"
      >
        <ViewHeader.Actions>
          <ViewHeader.BackButton onClick={onCancel as () => void} />
        </ViewHeader.Actions>
      </ViewHeader>

      {/* Mode Selector */}
      <div className="flex-shrink-0 p-4 bg-white/70 dark:bg-gray-800/70 backdrop-blur-sm border-b border-purple-100 dark:border-gray-700">
        <div className="flex items-center gap-2 bg-gray-100 dark:bg-gray-700 rounded-xl p-1">
          <button
            type="button"
            onClick={() => {
              setMode('create');
            }}
            className={`flex-1 px-4 py-2 text-sm font-semibold rounded-lg transition-all duration-200 focus-interactive ${
              mode === 'create'
                ? 'bg-white dark:bg-gray-600 text-purple-600 dark:text-purple-400 shadow-sm'
                : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
            }`}
            disabled={isPending}
            aria-pressed={mode === 'create'}
          >
            📝 Create New
          </button>
          <button
            type="button"
            onClick={() => {
              setMode('import');
            }}
            className={`flex-1 px-4 py-2 text-sm font-semibold rounded-lg transition-all duration-200 focus-interactive ${
              mode === 'import'
                ? 'bg-white dark:bg-gray-600 text-purple-600 dark:text-purple-400 shadow-sm'
                : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
            }`}
            disabled={isPending}
            aria-pressed={mode === 'import'}
          >
            📥 Import Shared
          </button>
        </div>
      </div>

      {/* General Error Display */}
      {errors?.general && (
        <div
          role="alert"
          aria-live="polite"
          className="flex-shrink-0 p-4 text-sm text-red-600 dark:text-red-400 bg-red-50/80 dark:bg-red-900/20 backdrop-blur-sm border-b border-red-200 dark:border-red-700 font-medium"
        >
          ⚠️ {errors.general}
        </div>
      )}

      {/* Form */}
      <div className="flex-1 overflow-auto custom-scrollbar">
          <form id="add-prompt-form" action={submitAction}>
            {/* Import Mode UI */}
            {mode === 'import' && (
              <>
                {/* Instructions */}
                <div className="bg-blue-50/80 dark:bg-blue-900/20 backdrop-blur-sm border-b border-blue-200 dark:border-blue-800 p-5">
                  <div className="flex items-start space-x-3">
                    <div className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-500 dark:bg-blue-400 flex items-center justify-center">
                      <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                    <div className="flex-1">
                      <h3 className="text-sm font-semibold text-blue-900 dark:text-blue-100 mb-1">
                        How to Import
                      </h3>
                      <p className="text-xs text-blue-700 dark:text-blue-300 leading-relaxed">
                        Paste the sharing code you received from another user below. The code will be automatically validated and decoded.
                      </p>
                    </div>
                  </div>
                </div>

                {/* Import Code Text Area */}
                <div className="bg-white/70 dark:bg-gray-800/70 backdrop-blur-sm border-b border-purple-100 dark:border-gray-700 p-5">
                  <label htmlFor="import-code" className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
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
                    className={`w-full px-4 py-3 border rounded-xl focus-input resize-none bg-white/60 dark:bg-gray-700/60 backdrop-blur-sm transition-all duration-200 text-gray-900 dark:text-gray-100 font-mono text-sm ${
                      validationError ? 'border-red-300 dark:border-red-500' : 'border-purple-200 dark:border-gray-600'
                    }`}
                    disabled={isPending}
                  />
                  {/* Validation Status */}
                  {isValidating && (
                    <div className="mt-2 flex items-center space-x-2 text-sm text-purple-600 dark:text-purple-400">
                      <div className="w-4 h-4 border-2 border-purple-600/30 border-t-purple-600 rounded-full animate-spin"></div>
                      <span>Validating...</span>
                    </div>
                  )}
                  {validationError && (
                    <p className="mt-2 text-sm text-red-600 dark:text-red-400 font-medium">⚠️ {validationError}</p>
                  )}
                  {decodedPrompt && !validationError && (
                    <p className="mt-2 text-sm text-green-600 dark:text-green-400 font-medium flex items-center space-x-1">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      <span>Valid sharing code detected</span>
                    </p>
                  )}
                </div>

                {/* Preview Section */}
                {decodedPrompt && !validationError && (
                  <div className="bg-white/70 dark:bg-gray-800/70 backdrop-blur-sm border-b border-purple-100 dark:border-gray-700 p-5">
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                        Preview
                      </h3>
                      <span className="text-xs text-gray-500 dark:text-gray-400 font-medium">
                        Decoded from sharing code
                      </span>
                    </div>

                    {/* Preview Card */}
                    <div className="bg-white dark:bg-gray-700 rounded-xl border border-purple-100 dark:border-gray-600 p-4 space-y-3">
                      {/* Title Preview */}
                      <div>
                        <p className="text-xs text-gray-500 dark:text-gray-400 font-medium mb-1">
                          Title
                        </p>
                        <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                          {decodedPrompt.title}
                        </p>
                      </div>

                      {/* Content Preview */}
                      <div>
                        <p className="text-xs text-gray-500 dark:text-gray-400 font-medium mb-1">
                          Content
                        </p>
                        <div className="bg-gray-50 dark:bg-gray-600 rounded-lg p-3 max-h-40 overflow-y-auto custom-scrollbar">
                          <p className="text-sm text-gray-700 dark:text-gray-200 whitespace-pre-wrap break-words">
                            {decodedPrompt.content}
                          </p>
                        </div>
                        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400 font-medium">
                          {decodedPrompt.content.length} characters
                        </p>
                      </div>

                      {/* Original Category Preview */}
                      <div>
                        <p className="text-xs text-gray-500 dark:text-gray-400 font-medium mb-1">
                          Original Category
                        </p>
                        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300">
                          {decodedPrompt.category}
                        </span>
                      </div>
                    </div>

                    {/* Info Note */}
                    <p className="mt-3 text-xs text-gray-500 dark:text-gray-400 italic">
                      💡 You can select a different category below before importing
                    </p>
                  </div>
                )}

                {/* Category Selector for Import */}
                {decodedPrompt && !validationError && (
                  <div className="bg-white/70 dark:bg-gray-800/70 backdrop-blur-sm border-b border-purple-100 dark:border-gray-700 p-5">
                    <label htmlFor="import-category" className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
                      Import to Category
                    </label>
                    <div className="relative">
                      <select
                        id="import-category"
                        value={selectedCategory}
                        onChange={(e) => {
                          setSelectedCategory(e.target.value);
                        }}
                        className="w-full px-4 py-3 pr-10 border border-purple-200 dark:border-gray-600 rounded-xl focus-input bg-white/60 dark:bg-gray-700/60 backdrop-blur-sm transition-all duration-200 font-medium appearance-none cursor-pointer text-gray-900 dark:text-gray-100"
                        disabled={isPending}
                      >
                        {categories.map((category: Category) => (
                          <option key={category.id} value={category.name}>
                            {category.name}
                          </option>
                        ))}
                      </select>
                      <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
                        <svg className="w-4 h-4 text-purple-400 dark:text-purple-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                      </div>
                    </div>
                    <p className="mt-2 text-xs text-gray-500 dark:text-gray-400 font-medium">
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
            <div className="bg-white/70 dark:bg-gray-800/70 backdrop-blur-sm border-b border-purple-100 dark:border-gray-700 p-5">
              <label htmlFor="title" className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
                Title (optional)
              </label>
              <input
                type="text"
                id="title"
                name="title"
                defaultValue=""
                onChange={(e) => { setTitleLength(e.target.value.length); }}
                placeholder="Enter a descriptive title or leave blank to auto-generate"
                className={`w-full px-4 py-3 border rounded-xl focus-input bg-white/60 dark:bg-gray-700/60 backdrop-blur-sm transition-all duration-200 text-gray-900 dark:text-gray-100 ${
                  errors?.title ? 'border-red-300 dark:border-red-500' : 'border-purple-200 dark:border-gray-600'
                }`}
                disabled={isPending}
                maxLength={MAX_TITLE_LENGTH}
              />
              {errors?.title && (
                <p className="mt-2 text-sm text-red-600 dark:text-red-400 font-medium">⚠️ {errors.title}</p>
              )}
              <p className="mt-2 text-xs text-gray-500 dark:text-gray-400 font-medium">
                {formatCharacterCount(titleLength, MAX_TITLE_LENGTH)}
              </p>
            </div>

            {/* Category */}
            <div className="bg-white/70 dark:bg-gray-800/70 backdrop-blur-sm border-b border-purple-100 dark:border-gray-700 p-5">
              <label htmlFor="category" className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
                Category
              </label>
              <div className="relative">
                <select
                  id="category"
                  name="category"
                  defaultValue={DEFAULT_CATEGORY}
                  className="w-full px-4 py-3 pr-10 border border-purple-200 dark:border-gray-600 rounded-xl focus-input bg-white/60 dark:bg-gray-700/60 backdrop-blur-sm transition-all duration-200 font-medium appearance-none cursor-pointer text-gray-900 dark:text-gray-100"
                  disabled={isPending}
                >
                  {(categories).map((category: Category) => (
                    <option key={category.id} value={category.name}>
                      {category.name}
                    </option>
                  ))}
                </select>
                <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
                  <svg className="w-4 h-4 text-purple-400 dark:text-purple-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </div>
              </div>
            </div>

            {/* Content */}
            <div className="bg-white/70 dark:bg-gray-800/70 backdrop-blur-sm border-b border-purple-100 dark:border-gray-700 p-5">
              <label htmlFor="content" className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
                Content *
              </label>
              <textarea
                id="content"
                name="content"
                defaultValue=""
                onChange={(e) => { setContentLength(e.target.value.length); }}
                placeholder="Enter your prompt content here..."
                rows={8}
                className={`w-full px-4 py-3 border rounded-xl focus-input resize-none bg-white/60 dark:bg-gray-700/60 backdrop-blur-sm transition-all duration-200 text-gray-900 dark:text-gray-100 ${
                  errors?.content ? 'border-red-300 dark:border-red-500' : 'border-purple-200 dark:border-gray-600'
                }`}
                disabled={isPending}
                maxLength={MAX_CONTENT_LENGTH}
                required
              />
              {errors?.content && (
                <p className="mt-2 text-sm text-red-600 dark:text-red-400 font-medium">⚠️ {errors.content}</p>
              )}
              <p className="mt-2 text-xs text-gray-500 dark:text-gray-400 font-medium">
                {formatCharacterCount(contentLength, MAX_CONTENT_LENGTH)}
              </p>
            </div>
              </>
            )}

          </form>
      </div>

      {/* Footer */}
      <div className="flex-shrink-0 p-6 bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm border-t border-purple-100 dark:border-gray-700">
        <div className="flex space-x-3">
          <button
            type="button"
            onClick={onCancel as () => void}
            className="flex-1 px-6 py-3 text-sm font-semibold text-gray-700 dark:text-gray-300 bg-white/60 dark:bg-gray-700/60 backdrop-blur-sm border border-purple-200 dark:border-gray-600 rounded-xl hover:bg-white/80 dark:hover:bg-gray-700/80 transition-all duration-200 focus-secondary"
            disabled={isPending}
          >
            Cancel
          </button>
          <button
            type="submit"
            form="add-prompt-form"
            className="flex-1 px-6 py-3 text-sm font-semibold text-white bg-gradient-to-r from-purple-600 to-indigo-600 rounded-xl hover:from-purple-700 hover:to-indigo-700 transition-all duration-200 shadow-lg hover:shadow-xl disabled:opacity-50 focus-primary"
            disabled={isPending || (mode === 'import' && (!decodedPrompt || !!validationError))}
          >
            {isPending ? (
              <div className="flex items-center justify-center space-x-2">
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
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