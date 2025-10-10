import { useActionState, useState } from 'react';
import type { FC } from 'react';

import { Category } from '../types';
import { EditPromptFormProps } from '../types/components';

import ViewHeader from './ViewHeader';

const EditPromptForm: FC<EditPromptFormProps> = ({
  prompt,
  categories,
  onSubmit,
  onCancel,
  isLoading: _isLoading = false // Deprecated, now managed internally
}) => {
  // Local state for character count tracking (initialized with existing prompt values)
  const [titleLength, setTitleLength] = useState(prompt.title.length);
  const [contentLength, setContentLength] = useState(prompt.content.length);

  // React 19 useActionState for automatic loading/error handling
  const [error, submitAction, isPending] = useActionState(
    async (_prevState: string | null, formData: FormData) => {
      // Validation
      const title = formData.get('title') as string;
      const content = formData.get('content') as string;
      const category = formData.get('category') as string;

      if (!content.trim()) {
        return 'Content is required';
      }

      if (content.length > 10000) {
        return 'Content cannot exceed 10000 characters';
      }

      if (title.length > 100) {
        return 'Title cannot exceed 100 characters';
      }

      // Check if there are changes
      if (
        title === prompt.title &&
        content === prompt.content &&
        category === prompt.category
      ) {
        return 'No changes to save';
      }

      // Submit data
      try {
        await (onSubmit as (data: { title: string; content: string; category: string }) => Promise<void>)({
          title,
          content,
          category
        });
        return null; // Success, no error
      } catch (err) {
        return (err as Error).message || 'Failed to update prompt';
      }
    },
    null // Initial error state
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
          <ViewHeader.BackButton onClick={onCancel as () => void} />
        </ViewHeader.Actions>
      </ViewHeader>

      {/* Error Display */}
      {error && (
        <div className="flex-shrink-0 p-4 text-sm text-red-600 dark:text-red-400 bg-red-50/80 dark:bg-red-900/20 backdrop-blur-sm border-b border-red-200 dark:border-red-700 font-medium">
          ⚠️ {error}
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
              onChange={(e) => { setTitleLength(e.target.value.length); }}
              placeholder="Enter a descriptive title"
              className="w-full px-4 py-3 border border-purple-200 dark:border-gray-600 rounded-xl focus-input bg-white/60 dark:bg-gray-700/60 backdrop-blur-sm transition-all duration-200 text-sm text-gray-900 dark:text-gray-100"
              disabled={isPending}
              maxLength={100}
            />
            <p className="mt-2 text-xs text-gray-500 dark:text-gray-400 font-medium">
              {titleLength}/100 characters
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
              id="content"
              name="content"
              defaultValue={prompt.content}
              onChange={(e) => { setContentLength(e.target.value.length); }}
              placeholder="Enter your prompt content here..."
              rows={10}
              className="w-full px-4 py-3 border border-purple-200 dark:border-gray-600 rounded-xl focus-input resize-none bg-white/60 dark:bg-gray-700/60 backdrop-blur-sm transition-all duration-200 text-sm text-gray-900 dark:text-gray-100"
              disabled={isPending}
              maxLength={10000}
              required
            />
            <p className="mt-2 text-xs text-gray-500 dark:text-gray-400 font-medium">
              {contentLength}/10,000 characters
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
        {/* Action buttons - full width for better spacing */}
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