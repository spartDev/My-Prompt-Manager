import { forwardRef, useActionState, useMemo, useState } from 'react';
import type { FC } from 'react';

import { formatCharacterCount } from '../constants/validation';
import { PROMPT_LIMITS } from '../services/promptAdmission';
import type { EditPromptFormProps } from '../types/components';
import { Logger, toError, validatePromptFields, type FieldErrors } from '../utils';

import ConfirmDialog from './ConfirmDialog';
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

const EditPromptForm: FC<EditPromptFormProps> = ({
  prompt,
  categories,
  onSubmit,
  onCancel,
  onDelete
}) => {
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // Track character counts in state (updated on change)
  const [titleLength, setTitleLength] = useState(prompt.title.length);
  const [contentLength, setContentLength] = useState(prompt.content.length);

  // Track current form values for dirty checking. They are also the inputs' defaultValue: React 19
  // resets a form's uncontrolled fields once its action completes, and the reset restores the
  // defaultValue, so a refused save keeps exactly what the user typed instead of the stored text.
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
        promptId: prompt.id,
        requireTitle: true
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
    <div className="h-full flex flex-col bg-app">
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
          className="shrink-0 p-4 text-sm text-danger bg-danger-subtle border-y border-danger font-medium"
        >
          ⚠️ {errors.general}
        </div>
      )}

      {/* Form */}
      <div className="flex-1 overflow-auto custom-scrollbar p-4" data-scroll-container>
        <div className="bg-card border border-default rounded-2xl shadow-sm overflow-hidden divide-y divide-divider">
        <form id="edit-prompt-form" action={submitAction} className="divide-y divide-divider">
          {/* Title Section */}
          <div className="p-5">
            <div className="flex items-center space-x-2 mb-4">
              <label htmlFor="title" className="block text-sm font-bold text-primary">
                Title
              </label>
            </div>
            <input
              type="text"
              id="title"
              name="title"
              defaultValue={currentValues.title}
              onChange={(e) => { handleFieldChange('title', e.target.value); }}
              placeholder="Enter a descriptive title"
              className={`w-full px-4 py-3 border rounded-xl focus-input bg-subtle transition-all duration-200 text-sm text-primary placeholder:text-tertiary ${
                errors?.title ? 'border-error' : 'border-input'
              }`}
              disabled={isPending}
            />
            {errors?.title && (
              <p className="mt-2 text-sm text-danger font-medium">⚠️ {errors.title}</p>
            )}
            <p className={`mt-2 text-xs font-medium ${titleLength > PROMPT_LIMITS.title ? 'text-danger' : 'text-tertiary'}`}>
              {formatCharacterCount(titleLength, PROMPT_LIMITS.title)}
            </p>
          </div>

          {/* Category Section */}
          <div className="p-5">
            <div className="flex items-center space-x-2 mb-4">
              {/* Label uses aria-labelledby on the button instead of htmlFor -
                  this is the correct accessible pattern for custom dropdown triggers
                  since buttons don't respond to label clicks like native form controls */}
              <label id="category-label" className="block text-sm font-bold text-primary">
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
          <div className="p-5">
            <div className="flex items-center space-x-2 mb-4">
              <label htmlFor="content" className="block text-sm font-bold text-primary">
                Content *
              </label>
            </div>
            <textarea
              id="content"
              name="content"
              defaultValue={currentValues.content}
              onChange={(e) => { handleFieldChange('content', e.target.value); }}
              placeholder="Enter your prompt content here..."
              rows={10}
              className={`w-full px-4 py-3 border rounded-xl focus-input resize-none bg-subtle transition-all duration-200 text-sm text-primary placeholder:text-tertiary ${
                errors?.content ? 'border-error' : 'border-input'
              }`}
              disabled={isPending}
              required
            />
            {errors?.content && (
              <p className="mt-2 text-sm text-danger font-medium">⚠️ {errors.content}</p>
            )}
            <p className={`mt-2 text-xs font-medium ${contentLength > PROMPT_LIMITS.content ? 'text-danger' : 'text-tertiary'}`}>
              {formatCharacterCount(contentLength, PROMPT_LIMITS.content)}
            </p>
          </div>
        </form>
        
        {/* Metadata */}
        <div className="p-5">
          <h4 className="text-sm font-semibold text-secondary mb-3">Prompt Information</h4>
          <div className="text-xs text-tertiary space-y-2 font-medium">
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
      </div>

      {/* Footer */}
      <div className="shrink-0 p-6 bg-app border-t border-transparent scroll-edge-bottom">
        {/* Unsaved changes indicator */}
        {hasUnsavedChanges && !isPending && (
          <div className="mb-4 text-xs text-warning font-medium flex items-center space-x-2 bg-warning-subtle border border-warning rounded-lg px-3 py-2">
            <span>⚡</span>
            <span>You have unsaved changes</span>
          </div>
        )}

        {/* Action buttons - full width for better spacing */}
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
            form="edit-prompt-form"
            className="flex-1 px-6 py-3 text-sm font-semibold text-on-accent bg-accent rounded-xl hover:bg-accent-hover transition-all duration-200 shadow-lg hover:shadow-xl disabled:opacity-50 focus-primary"
            disabled={isPending}
          >
            {isPending ? (
              <div className="flex items-center justify-center space-x-2">
                <div className="w-4 h-4 border-2 border-current/30 border-t-current rounded-full animate-spin"></div>
                <span>Saving...</span>
              </div>
            ) : (
              'Save Changes'
            )}
          </button>
        </div>

        {/* Delete - kept apart from Save/Cancel to avoid accidental clicks */}
        <div className="mt-4 pt-4 border-t border-strong text-center">
          <button
            type="button"
            onClick={() => { setShowDeleteConfirm(true); }}
            className="px-3 py-1.5 text-sm font-medium text-danger hover:bg-danger-subtle rounded-lg transition-colors focus-danger"
            disabled={isPending}
          >
            Delete prompt
          </button>
        </div>
      </div>

      <ConfirmDialog
        isOpen={showDeleteConfirm}
        onConfirm={() => {
          setShowDeleteConfirm(false);
          onDelete(prompt.id);
        }}
        onCancel={() => { setShowDeleteConfirm(false); }}
        title="Delete Prompt"
        message={`Are you sure you want to delete "${prompt.title}"? This action cannot be undone.`}
        confirmText="Delete"
        cancelText="Cancel"
        variant="danger"
      />
    </div>
  );
};

export default EditPromptForm;