import { useActionState, useRef, useState } from 'react';
import type { FC } from 'react';

import { MAX_CONTENT_LENGTH, MAX_TITLE_LENGTH, formatCharacterCount } from '../constants/validation';
import { Category } from '../types';
import { EditPromptFormProps } from '../types/components';
import { toError } from '../utils/error';
import * as Logger from '../utils/logger';
import { validatePromptFields, type FieldErrors } from '../utils/validation';

import ViewHeader from './ViewHeader';

const EditPromptForm: FC<EditPromptFormProps> = ({
  prompt,
  categories,
  onSubmit,
  onCancel
}) => {
  // Refs to form elements (for focus management if needed)
  const titleRef = useRef<HTMLInputElement>(null);
  const contentRef = useRef<HTMLTextAreaElement>(null);

  // Track character counts in state (updated on change)
  const [titleLength, setTitleLength] = useState(prompt.title.length);
  const [contentLength, setContentLength] = useState(prompt.content.length);

  // Track form dirty state (has unsaved changes)
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  // React 19 useActionState for automatic loading/error handling
  const [errors, submitAction, isPending] = useActionState(
    async (_prevState: FieldErrors | null, formData: FormData) => {
      // Validation
      const title = formData.get('title') as string;
      const content = formData.get('content') as string;
      const category = formData.get('category') as string;

      // Validation using shared utility
      const validationErrors = validatePromptFields(title, content, {
        component: 'EditPromptForm',
        promptId: prompt.id
      });

      // Return validation errors if any
      if (Object.keys(validationErrors).length > 0) {
        return validationErrors;
      }

      // Check if there are changes
      if (
        title === prompt.title &&
        content === prompt.content &&
        category === prompt.category
      ) {
        Logger.warn('Form validation failed: No changes to save', {
          component: 'EditPromptForm',
          promptId: prompt.id
        });
        return { general: 'No changes to save' };
      }

      // Submit data
      try {
        await onSubmit({
          title,
          content,
          category
        });
        Logger.info('Prompt form submitted successfully', {
          component: 'EditPromptForm',
          promptId: prompt.id,
          category,
          hasTitle: !!title.trim()
        });
        return null; // Success, no error
      } catch (err) {
        Logger.error('Failed to submit prompt form', toError(err), {
          component: 'EditPromptForm',
          promptId: prompt.id,
          category,
          hasTitle: !!title.trim()
        });
        return { general: (err as Error).message || 'Failed to update prompt' };
      }
    },
    null // Initial error state
  );

  // Track form changes to show unsaved changes indicator
  const handleFieldChange = (field: 'title' | 'content' | 'category', value: string) => {
    const isDirty =
      field === 'title' ? value !== prompt.title :
      field === 'content' ? value !== prompt.content :
      value !== prompt.category;

    setHasUnsavedChanges(isDirty || hasUnsavedChanges);

    // Update character counts when title or content changes
    if (field === 'title') {
      setTitleLength(value.length);
    } else if (field === 'content') {
      setContentLength(value.length);
    }
  };

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleString();
  };

  return (
    <div className="h-full flex flex-col bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <ViewHeader
        icon="edit"
        title="Edit Prompt"
        subtitle="Update your text snippet"
      >
        <ViewHeader.Actions>
          <ViewHeader.BackButton onClick={onCancel} />
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
        <form id="edit-prompt-form" action={submitAction}>
          {/* Title Section */}
          <div className="bg-white/70 dark:bg-gray-800/70 backdrop-blur-sm border-b border-purple-100 dark:border-gray-700 p-5">
            <div className="flex items-center space-x-2 mb-4">
              <label htmlFor="title" className="block text-sm font-bold text-gray-900 dark:text-gray-100">
                Title
              </label>
            </div>
            <input
              ref={titleRef}
              type="text"
              id="title"
              name="title"
              defaultValue={prompt.title}
              onChange={(e) => { handleFieldChange('title', e.target.value); }}
              placeholder="Enter a descriptive title"
              className={`w-full px-4 py-3 border rounded-xl focus-input bg-white/60 dark:bg-gray-700/60 backdrop-blur-sm transition-all duration-200 text-sm text-gray-900 dark:text-gray-100 ${
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

          {/* Category Section */}
          <div className="bg-white/70 dark:bg-gray-800/70 backdrop-blur-sm border-b border-purple-100 dark:border-gray-700 p-5">
            <div className="flex items-center space-x-2 mb-4">
              <label htmlFor="category" className="block text-sm font-bold text-gray-900 dark:text-gray-100">
                Category
              </label>
            </div>
            <div className="relative">
              <select
                id="category"
                name="category"
                defaultValue={prompt.category}
                className="w-full px-4 py-3 pr-10 border border-purple-200 dark:border-gray-600 rounded-xl focus-input bg-white/60 dark:bg-gray-700/60 backdrop-blur-sm transition-all duration-200 text-sm text-gray-900 dark:text-gray-100 appearance-none cursor-pointer"
                disabled={isPending}
              >
                {(categories).map((category: Category) => (
                  <option key={category.id} value={category.name}>
                    {category.name}
                  </option>
                ))}
              </select>
              <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
                <svg className="w-4 h-4 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </div>
            </div>
          </div>

          {/* Content Section */}
          <div className="bg-white/70 dark:bg-gray-800/70 backdrop-blur-sm border-b border-purple-100 dark:border-gray-700 p-5">
            <div className="flex items-center space-x-2 mb-4">
              <label htmlFor="content" className="block text-sm font-bold text-gray-900 dark:text-gray-100">
                Content *
              </label>
            </div>
            <textarea
              ref={contentRef}
              id="content"
              name="content"
              defaultValue={prompt.content}
              onChange={(e) => { handleFieldChange('content', e.target.value); }}
              placeholder="Enter your prompt content here..."
              rows={10}
              className={`w-full px-4 py-3 border rounded-xl focus-input resize-none bg-white/60 dark:bg-gray-700/60 backdrop-blur-sm transition-all duration-200 text-sm text-gray-900 dark:text-gray-100 ${
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
        </form>
        
        {/* Metadata */}
        <div className="bg-white/70 dark:bg-gray-800/70 backdrop-blur-sm border-b border-purple-100 dark:border-gray-700 p-5">
          <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Prompt Information</h4>
          <div className="text-xs text-gray-600 dark:text-gray-400 space-y-2 font-medium">
            <div className="flex items-center space-x-2">
              <span>Created:</span>
              <span>{formatDate((prompt).createdAt)}</span>
            </div>
            <div className="flex items-center space-x-2">
              <span>Last modified:</span>
              <span>{formatDate((prompt).updatedAt)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="flex-shrink-0 p-6 bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm border-t border-purple-100 dark:border-gray-700">
        {/* Unsaved changes indicator */}
        {hasUnsavedChanges && !isPending && (
          <div className="mb-4 text-xs text-amber-600 dark:text-amber-400 font-medium flex items-center space-x-2 bg-amber-50/80 dark:bg-amber-900/20 backdrop-blur-sm border border-amber-200 dark:border-amber-700 rounded-lg px-3 py-2">
            <span>⚡</span>
            <span>You have unsaved changes</span>
          </div>
        )}

        {/* Action buttons - full width for better spacing */}
        <div className="flex space-x-3">
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 px-6 py-3 text-sm font-semibold text-gray-700 dark:text-gray-300 bg-white/60 dark:bg-gray-700/60 backdrop-blur-sm border border-purple-200 dark:border-gray-600 rounded-xl hover:bg-white/80 dark:hover:bg-gray-700/80 transition-all duration-200 focus-secondary"
            disabled={isPending}
          >
            Cancel
          </button>
          <button
            type="submit"
            form="edit-prompt-form"
            className="flex-1 px-6 py-3 text-sm font-semibold text-white bg-gradient-to-r from-purple-600 to-indigo-600 rounded-xl hover:from-purple-700 hover:to-indigo-700 transition-all duration-200 shadow-lg hover:shadow-xl disabled:opacity-50 focus-primary"
            disabled={isPending}
          >
            {isPending ? (
              <div className="flex items-center justify-center space-x-2">
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                <span>Saving...</span>
              </div>
            ) : (
              'Save Changes'
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default EditPromptForm;