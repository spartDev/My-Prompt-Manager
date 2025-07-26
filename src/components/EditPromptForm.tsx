import React, { useState } from 'react';
import { EditPromptFormProps } from '../types/components';

const EditPromptForm: React.FC<EditPromptFormProps> = ({
  prompt,
  categories,
  onSubmit,
  onCancel,
  isLoading = false
}) => {
  const [formData, setFormData] = useState({
    title: prompt.title,
    content: prompt.content,
    category: prompt.category
  });
  const [errors, setErrors] = useState<{ [key: string]: string }>({});

  const validateForm = () => {
    const newErrors: { [key: string]: string } = {};

    if (!formData.content.trim()) {
      newErrors.content = 'Content is required';
    }

    if (formData.content.length > 5000) {
      newErrors.content = 'Content cannot exceed 5000 characters';
    }

    if (formData.title.length > 100) {
      newErrors.title = 'Title cannot exceed 100 characters';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }

    onSubmit(formData);
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
      formData.title !== prompt.title ||
      formData.content !== prompt.content ||
      formData.category !== prompt.category
    );
  };

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleString();
  };

  return (
    <div className="h-full flex flex-col bg-gradient-to-br from-purple-50 via-white to-blue-50">
      {/* Header */}
      <div className="flex-shrink-0 p-6 bg-white/80 backdrop-blur-sm border-b border-purple-100">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-indigo-600 rounded-xl flex items-center justify-center">
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-900">Edit Prompt</h2>
              <p className="text-sm text-gray-500">Update your text snippet</p>
            </div>
          </div>
          <button
            onClick={onCancel}
            className="text-gray-400 hover:text-purple-600 p-2 rounded-lg hover:bg-purple-50 transition-colors"
            disabled={isLoading}
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        
        {/* Metadata */}
        <div className="mt-4 p-3 bg-white/50 backdrop-blur-sm rounded-xl border border-purple-100">
          <div className="text-xs text-gray-600 space-y-1 font-medium">
            <div className="flex items-center space-x-2">
              <span>📅 Created:</span>
              <span>{formatDate(prompt.createdAt)}</span>
            </div>
            <div className="flex items-center space-x-2">
              <span>⏰ Last modified:</span>
              <span>{formatDate(prompt.updatedAt)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Form */}
      <div className="flex-1 overflow-auto p-6 space-y-6">
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Title Section */}
          <div className="bg-white/70 backdrop-blur-sm rounded-2xl p-5 border border-purple-100">
            <div className="flex items-center space-x-2 mb-4">
              <span className="text-lg">📝</span>
              <label htmlFor="title" className="block text-sm font-bold text-gray-900">
                Title
              </label>
            </div>
            <input
              type="text"
              id="title"
              value={formData.title}
              onChange={(e) => handleInputChange('title', e.target.value)}
              placeholder="Enter a descriptive title"
              className={`w-full px-4 py-3 border rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-purple-500 bg-white/60 backdrop-blur-sm transition-all duration-200 text-sm ${
                errors.title ? 'border-red-300 focus:ring-red-500' : 'border-purple-200'
              }`}
              disabled={isLoading}
            />
            {errors.title && (
              <p className="mt-2 text-sm text-red-600 font-medium">⚠️ {errors.title}</p>
            )}
            <p className="mt-2 text-xs text-gray-500 font-medium">
              {formData.title.length}/100 characters
            </p>
          </div>

          {/* Category Section */}
          <div className="bg-white/70 backdrop-blur-sm rounded-2xl p-5 border border-purple-100">
            <div className="flex items-center space-x-2 mb-4">
              <span className="text-lg">📁</span>
              <label htmlFor="category" className="block text-sm font-bold text-gray-900">
                Category
              </label>
            </div>
            <select
              id="category"
              value={formData.category}
              onChange={(e) => handleInputChange('category', e.target.value)}
              className="w-full px-4 py-3 border border-purple-200 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-purple-500 bg-white/60 backdrop-blur-sm transition-all duration-200 text-sm"
              disabled={isLoading}
            >
              {categories.map((category) => (
                <option key={category.id} value={category.name}>
                  {category.name}
                </option>
              ))}
            </select>
          </div>

          {/* Content Section */}
          <div className="bg-white/70 backdrop-blur-sm rounded-2xl p-5 border border-purple-100">
            <div className="flex items-center space-x-2 mb-4">
              <span className="text-lg">✨</span>
              <label htmlFor="content" className="block text-sm font-bold text-gray-900">
                Content *
              </label>
            </div>
            <textarea
              id="content"
              value={formData.content}
              onChange={(e) => handleInputChange('content', e.target.value)}
              placeholder="Enter your prompt content here..."
              rows={10}
              className={`w-full px-4 py-3 border rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-purple-500 resize-none bg-white/60 backdrop-blur-sm transition-all duration-200 text-sm ${
                errors.content ? 'border-red-300 focus:ring-red-500' : 'border-purple-200'
              }`}
              disabled={isLoading}
            />
            {errors.content && (
              <p className="mt-2 text-sm text-red-600 font-medium">⚠️ {errors.content}</p>
            )}
            <p className="mt-2 text-xs text-gray-500 font-medium">
              {formData.content.length}/5000 characters
            </p>
          </div>
        </form>
      </div>

      {/* Footer */}
      <div className="flex-shrink-0 p-6 bg-white/80 backdrop-blur-sm border-t border-purple-100">
        {/* Status indicator - only show when there are changes */}
        {hasChanges() && (
          <div className="mb-4 text-xs text-amber-600 font-medium flex items-center space-x-2 bg-amber-50/80 backdrop-blur-sm border border-amber-200 rounded-lg px-3 py-2">
            <span>⚡</span>
            <span>You have unsaved changes</span>
          </div>
        )}
        
        {/* Action buttons - full width for better spacing */}
        <div className="flex space-x-3">
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 px-6 py-3 text-sm font-semibold text-gray-700 bg-white/60 backdrop-blur-sm border border-purple-200 rounded-xl hover:bg-white/80 transition-all duration-200"
            disabled={isLoading}
          >
            Cancel
          </button>
          <button
            type="submit"
            onClick={handleSubmit}
            className="flex-1 px-6 py-3 text-sm font-semibold text-white bg-gradient-to-r from-purple-500 to-indigo-600 rounded-xl hover:from-purple-600 hover:to-indigo-700 transition-all duration-200 shadow-lg shadow-purple-500/25 hover:shadow-purple-500/40 transform hover:scale-105 disabled:opacity-50 disabled:transform-none"
            disabled={isLoading || !formData.content.trim() || !hasChanges()}
          >
            {isLoading ? (
              <div className="flex items-center justify-center space-x-2">
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                <span>Saving...</span>
              </div>
            ) : (
              'Save Changes ✨'
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default EditPromptForm;