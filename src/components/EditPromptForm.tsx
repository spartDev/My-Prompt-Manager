import { useState } from 'react';
import type { FC, FormEvent } from 'react';

import { Category } from '../types';
import { EditPromptFormProps } from '../types/components';

import ViewHeader from './ViewHeader';

const EditPromptForm: FC<EditPromptFormProps> = ({
  prompt,
  categories,
  onSubmit,
  onCancel,
  isLoading = false
}) => {
  const [formData, setFormData] = useState({
    title: (prompt).title,
    content: (prompt).content,
    category: (prompt).category
  });
  const [errors, setErrors] = useState<{ [key: string]: string }>({});

  const validateForm = () => {
    const newErrors: { [key: string]: string } = {};

    if (!formData.content.trim()) {
      newErrors.content = 'Content is required';
    }

    if (formData.content.length > 10000) {
      newErrors.content = 'Content cannot exceed 10000 characters';
    }

    if (formData.title.length > 100) {
      newErrors.title = 'Title cannot exceed 100 characters';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
     
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }

    (onSubmit as (data: typeof formData) => void)(formData);
  };

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    
    // Clear error when user starts typing
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }));
    }
  };

  const hasChanges = () => {
    return (
      formData.title !== (prompt).title ||
      formData.content !== (prompt).content ||
      formData.category !== (prompt).category
    );
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
        onBack={onCancel as () => void}
      />

      {/* Form */}
      <div className="flex-1 overflow-auto custom-scrollbar">
        <form id="edit-prompt-form" onSubmit={handleSubmit}>
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
              value={formData.title}
              onChange={(e) => { handleInputChange('title', e.target.value); }}
              placeholder="Enter a descriptive title"
              className={`w-full px-4 py-3 border rounded-xl focus-input bg-white/60 dark:bg-gray-700/60 backdrop-blur-sm transition-all duration-200 text-sm text-gray-900 dark:text-gray-100 ${
                errors.title ? 'border-red-300 dark:border-red-500' : 'border-purple-200 dark:border-gray-600'
              }`}
              disabled={isLoading}
            />
            {errors.title && (
              <p className="mt-2 text-sm text-red-600 dark:text-red-400 font-medium">⚠️ {errors.title}</p>
            )}
            <p className="mt-2 text-xs text-gray-500 dark:text-gray-400 font-medium">
              {formData.title.length}/100 characters
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
                value={formData.category}
                onChange={(e) => { handleInputChange('category', e.target.value); }}
                className="w-full px-4 py-3 pr-10 border border-purple-200 dark:border-gray-600 rounded-xl focus-input bg-white/60 dark:bg-gray-700/60 backdrop-blur-sm transition-all duration-200 text-sm text-gray-900 dark:text-gray-100 appearance-none cursor-pointer"
                disabled={isLoading}
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
              value={formData.content}
              onChange={(e) => { handleInputChange('content', e.target.value); }}
              placeholder="Enter your prompt content here..."
              rows={10}
              className={`w-full px-4 py-3 border rounded-xl focus-input resize-none bg-white/60 dark:bg-gray-700/60 backdrop-blur-sm transition-all duration-200 text-sm text-gray-900 dark:text-gray-100 ${
                errors.content ? 'border-red-300 dark:border-red-500' : 'border-purple-200 dark:border-gray-600'
              }`}
              disabled={isLoading}
            />
            {errors.content && (
              <p className="mt-2 text-sm text-red-600 dark:text-red-400 font-medium">⚠️ {errors.content}</p>
            )}
            <p className="mt-2 text-xs text-gray-500 dark:text-gray-400 font-medium">
              {formData.content.length}/10000 characters
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
        {/* Status indicator - only show when there are changes */}
        {hasChanges() && (
          <div className="mb-4 text-xs text-amber-600 dark:text-amber-400 font-medium flex items-center space-x-2 bg-amber-50/80 dark:bg-amber-900/20 backdrop-blur-sm border border-amber-200 dark:border-amber-700 rounded-lg px-3 py-2">
            <span>⚡</span>
            <span>You have unsaved changes</span>
          </div>
        )}
        
        {/* Action buttons - full width for better spacing */}
        <div className="flex space-x-3">
          <button
            type="button"
            onClick={onCancel as () => void}
            className="flex-1 px-6 py-3 text-sm font-semibold text-gray-700 dark:text-gray-300 bg-white/60 dark:bg-gray-700/60 backdrop-blur-sm border border-purple-200 dark:border-gray-600 rounded-xl hover:bg-white/80 dark:hover:bg-gray-700/80 transition-all duration-200 focus-secondary"
            disabled={isLoading}
          >
            Cancel
          </button>
          <button
            type="submit"
            form="edit-prompt-form"
            className="flex-1 px-6 py-3 text-sm font-semibold text-white bg-gradient-to-r from-purple-600 to-indigo-600 rounded-xl hover:from-purple-700 hover:to-indigo-700 transition-all duration-200 shadow-lg hover:shadow-xl disabled:opacity-50 focus-primary"
            disabled={isLoading || !formData.content.trim() || !hasChanges()}
          >
            {isLoading ? (
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