import { forwardRef, useActionState, useMemo, useState } from 'react';
import type { FC } from 'react';

import { MAX_CONTENT_LENGTH, MAX_TITLE_LENGTH, formatCharacterCount } from '../constants/validation';
import { EditPromptFormProps } from '../types/components';
import { Logger, toError, validatePromptFields, type FieldErrors } from '../utils';

import { Dropdown, type DropdownItem } from './Dropdown';
import ViewHeader from './ViewHeader';

// Category dropdown trigger button component props
interface CategoryTriggerProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  selectedCategory: string;
}

// Category dropdown trigger button component
const CategoryTrigger = forwardRef<HTMLButtonElement, CategoryTriggerProps>(
  ({ selectedCategory, className, ...rest }, ref) => (
    <button
      ref={ref}
      type="button"
      {...rest}
      className={className ?? "w-full px-4 py-3 border border-purple-200 dark:border-gray-600 rounded-xl focus-input bg-white/60 dark:bg-gray-700/60 backdrop-blur-sm transition-all duration-200 font-medium cursor-pointer text-gray-900 dark:text-gray-100 text-left flex items-center justify-between disabled:opacity-50 disabled:cursor-not-allowed"}
    >
      <span>{selectedCategory}</span>
      <svg className="w-4 h-4 text-purple-400 dark:text-purple-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
      </svg>
    </button>
  )
);
CategoryTrigger.displayName = 'CategoryTrigger';

const EditPromptForm: FC<EditPromptFormProps> = ({
  prompt,
  categories,
  onSubmit,
  onCancel
}) => {
  // Track character counts in state (updated on change)
  const [titleLength, setTitleLength] = useState(prompt.title.length);
  const [contentLength, setContentLength] = useState(prompt.content.length);

  // Track current form values for dirty checking
  const [currentValues, setCurrentValues] = useState({
    title: prompt.title,
    content: prompt.content,
    category: prompt.category,
  });

  // Derive hasUnsavedChanges by comparing current values to original
  const hasUnsavedChanges =
    currentValues.title !== prompt.title ||
    currentValues.content !== prompt.content ||
    currentValues.category !== prompt.category;

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
    setCurrentValues(prev => ({ ...prev, [field]: value }));

    // Update character counts when title or content changes
    if (field === 'title') {
      setTitleLength(value.length);
    } else if (field === 'content') {
      setContentLength(value.length);
    }
  };

  // Generate dropdown items from categories
  const categoryItems = useMemo<DropdownItem[]>(
    () => categories.map(cat => ({
      id: cat.id,
      label: cat.name,
      onSelect: () => { handleFieldChange('category', cat.name); }
    })),
    [categories]
  );

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
          className="shrink-0 p-4 text-sm text-red-600 dark:text-red-400 bg-red-50/80 dark:bg-red-900/20 backdrop-blur-sm border-b border-red-200 dark:border-red-700 font-medium"
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
              {/* Label uses aria-labelledby on the button instead of htmlFor -
                  this is the correct accessible pattern for custom dropdown triggers
                  since buttons don't respond to label clicks like native form controls */}
              {/* eslint-disable-next-line jsx-a11y/label-has-associated-control */}
              <label id="category-label" className="block text-sm font-bold text-gray-900 dark:text-gray-100">
                Category
              </label>
            </div>
            <Dropdown
              trigger={
                <CategoryTrigger
                  selectedCategory={currentValues.category}
                  disabled={isPending}
                  id="category"
                  aria-labelledby="category-label"
                />
              }
              items={categoryItems}
              placement="bottom-start"
              ariaLabel="Select category"
              matchWidth
            />
            {/* Hidden input to submit category value with form */}
            <input type="hidden" name="category" value={currentValues.category} />
          </div>

          {/* Content Section */}
          <div className="bg-white/70 dark:bg-gray-800/70 backdrop-blur-sm border-b border-purple-100 dark:border-gray-700 p-5">
            <div className="flex items-center space-x-2 mb-4">
              <label htmlFor="content" className="block text-sm font-bold text-gray-900 dark:text-gray-100">
                Content *
              </label>
            </div>
            <textarea
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
      <div className="shrink-0 p-6 bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm border-t border-purple-100 dark:border-gray-700">
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