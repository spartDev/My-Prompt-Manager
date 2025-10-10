import { useActionState, useState } from 'react';
import type { FC } from 'react';

import { DEFAULT_CATEGORY, Category } from '../types';
import { AddPromptFormProps } from '../types/components';
import { Logger, toError } from '../utils';

import ViewHeader from './ViewHeader';

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
  // Local state for character count tracking
  const [titleLength, setTitleLength] = useState(0);
  const [contentLength, setContentLength] = useState(0);

  // React 19 useActionState for automatic loading/error handling
  const [errors, submitAction, isPending] = useActionState(
    async (_prevState: FieldErrors | null, formData: FormData) => {
      // Validation
      const title = formData.get('title') as string;
      const content = formData.get('content') as string;
      const category = formData.get('category') as string;

      const validationErrors: FieldErrors = {};

      if (!content.trim()) {
        Logger.warn('Form validation failed: Content is required', {
          component: 'AddPromptForm',
          field: 'content'
        });
        validationErrors.content = 'Content is required';
      }

      if (content.length > 10000) {
        Logger.warn('Form validation failed: Content exceeds limit', {
          component: 'AddPromptForm',
          field: 'content',
          length: content.length,
          limit: 10000
        });
        validationErrors.content = 'Content cannot exceed 10,000 characters';
      }

      if (title.length > 100) {
        Logger.warn('Form validation failed: Title exceeds limit', {
          component: 'AddPromptForm',
          field: 'title',
          length: title.length,
          limit: 100
        });
        validationErrors.title = 'Title cannot exceed 100 characters';
      }

      // Return validation errors if any
      if (Object.keys(validationErrors).length > 0) {
        return validationErrors;
      }

      // Submit data
      try {
        await (onSubmit as (data: { title: string; content: string; category: string }) => Promise<void>)({
          title,
          content,
          category
        });
        Logger.info('Prompt form submitted successfully', {
          component: 'AddPromptForm',
          category,
          hasTitle: !!title.trim()
        });
        return null; // Success, no error
      } catch (err) {
        Logger.error('Failed to submit prompt form', toError(err), {
          component: 'AddPromptForm',
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
                maxLength={100}
              />
              {errors?.title && (
                <p className="mt-2 text-sm text-red-600 dark:text-red-400 font-medium">⚠️ {errors.title}</p>
              )}
              <p className="mt-2 text-xs text-gray-500 dark:text-gray-400 font-medium">
                {titleLength}/100 characters
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
                maxLength={10000}
                required
              />
              {errors?.content && (
                <p className="mt-2 text-sm text-red-600 dark:text-red-400 font-medium">⚠️ {errors.content}</p>
              )}
              <p className="mt-2 text-xs text-gray-500 dark:text-gray-400 font-medium">
                {contentLength}/10,000 characters
              </p>
            </div>

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
            disabled={isPending}
          >
            {isPending ? (
              <div className="flex items-center justify-center space-x-2">
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                <span>Saving...</span>
              </div>
            ) : (
              'Save Prompt'
            )}
          </button>
        </div>
      </div>

    </div>
  );
};

export default AddPromptForm;