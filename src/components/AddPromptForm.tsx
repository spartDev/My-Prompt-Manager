import { useState } from 'react';
import type { FC, FormEvent } from 'react';

import { DEFAULT_CATEGORY, Category } from '../types';
import { AddPromptFormProps } from '../types/components';

const AddPromptForm: FC<AddPromptFormProps> = ({
  categories,
  onSubmit,
  onCancel,
  isLoading = false
}) => {
  const [formData, setFormData] = useState({
    title: '',
    content: '',
    category: DEFAULT_CATEGORY
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

  return (
    <div className="h-full flex flex-col bg-gradient-to-br from-purple-50 via-white to-blue-50">
      {/* Header */}
      <div className="flex-shrink-0 p-6 bg-white/80 backdrop-blur-sm border-b border-purple-100">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-indigo-600 rounded-xl flex items-center justify-center">
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-900">Add New Prompt</h2>
              <p className="text-sm text-gray-500">Create a reusable text snippet</p>
            </div>
          </div>
          <button
            onClick={onCancel as () => void}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                (onCancel as () => void)();
              }
            }}
            className="text-gray-400 hover:text-purple-600 p-2 rounded-lg hover:bg-purple-50 transition-colors focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-1 disabled:opacity-50"
            disabled={isLoading}
            aria-label="Cancel and close form"
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>

      {/* Form */}
      <div className="flex-1 overflow-auto p-6">
        <div className="max-w-lg mx-auto">
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Title */}
            <div className="bg-white/70 backdrop-blur-sm rounded-2xl p-5 border border-purple-100">
              <label htmlFor="title" className="block text-sm font-semibold text-gray-700 mb-3">
                Title (optional)
              </label>
              <input
                type="text"
                id="title"
                value={formData.title}
                onChange={(e) => { handleInputChange('title', e.target.value); }}
                placeholder="Enter a descriptive title or leave blank to auto-generate"
                className={`w-full px-4 py-3 border rounded-xl focus:outline-none focus-within:ring-2 focus-within:ring-purple-500 focus-within:border-purple-500 bg-white/60 backdrop-blur-sm transition-all duration-200 ${
                  errors.title ? 'border-red-300' : 'border-purple-200'
                }`}
                disabled={isLoading}
              />
              {errors.title && (
                <p className="mt-2 text-sm text-red-600 font-medium">{errors.title}</p>
              )}
              <p className="mt-2 text-xs text-gray-500 font-medium">
                {formData.title.length}/100 characters
              </p>
            </div>

            {/* Category */}
            <div className="bg-white/70 backdrop-blur-sm rounded-2xl p-5 border border-purple-100">
              <label htmlFor="category" className="block text-sm font-semibold text-gray-700 mb-3">
                Category
              </label>
              <div className="relative">
                <select
                  id="category"
                  value={formData.category}
                  onChange={(e) => { handleInputChange('category', e.target.value); }}
                  className="w-full px-4 py-3 pr-10 border border-purple-200 rounded-xl focus:outline-none focus-within:ring-2 focus-within:ring-purple-500 focus-within:border-purple-500 bg-white/60 backdrop-blur-sm transition-all duration-200 font-medium appearance-none cursor-pointer"
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

            {/* Content */}
            <div className="bg-white/70 backdrop-blur-sm rounded-2xl p-5 border border-purple-100">
              <label htmlFor="content" className="block text-sm font-semibold text-gray-700 mb-3">
                Content *
              </label>
              <textarea
                id="content"
                value={formData.content}
                onChange={(e) => { handleInputChange('content', e.target.value); }}
                placeholder="Enter your prompt content here..."
                rows={8}
                className={`w-full px-4 py-3 border rounded-xl focus:outline-none focus-within:ring-2 focus-within:ring-purple-500 focus-within:border-purple-500 resize-none bg-white/60 backdrop-blur-sm transition-all duration-200 ${
                  errors.content ? 'border-red-300' : 'border-purple-200'
                }`}
                disabled={isLoading}
              />
              {errors.content && (
                <p className="mt-2 text-sm text-red-600 font-medium">{errors.content}</p>
              )}
              <p className="mt-2 text-xs text-gray-500 font-medium">
                {formData.content.length}/10000 characters
              </p>
            </div>

            {/* Form Actions */}
            <div className="flex justify-end space-x-4 pt-4">
              <button
                type="button"
                onClick={onCancel as () => void}
                className="px-6 py-3 text-sm font-semibold text-gray-700 bg-white/60 backdrop-blur-sm border border-purple-200 rounded-xl hover:bg-white/80 transition-all duration-200"
                disabled={isLoading}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-8 py-3 text-sm font-semibold text-white bg-gradient-to-r from-purple-500 to-indigo-600 rounded-xl hover:from-purple-600 hover:to-indigo-700 transition-all duration-200 shadow-lg shadow-purple-500/25 hover:shadow-purple-500/40 transform hover:scale-105 disabled:opacity-50 disabled:transform-none"
                disabled={isLoading || !formData.content.trim()}
              >
                {isLoading ? (
                  <span className="flex items-center space-x-2">
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                    <span>Saving...</span>
                  </span>
                ) : (
                  'Save Prompt'
                )}
              </button>
            </div>
          </form>
        </div>
      </div>

    </div>
  );
};

export default AddPromptForm;