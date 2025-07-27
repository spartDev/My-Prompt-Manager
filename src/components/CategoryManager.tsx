import { useState } from 'react';
import type { FC, FormEvent } from 'react';

import { Category } from '../types';

interface CategoryManagerProps {
  categories: Category[];
  onCreateCategory: (category: { name: string; color?: string }) => Promise<void>;
  onUpdateCategory: (id: string, updates: Partial<Category>) => Promise<void>;
  onDeleteCategory: (id: string) => Promise<void>;
  isOpen: boolean;
  onClose: () => void;
}

const CategoryManager: FC<CategoryManagerProps> = ({
  categories,
  onCreateCategory,
  onUpdateCategory,
  onDeleteCategory,
  isOpen,
  onClose
}) => {
  const [newCategoryName, setNewCategoryName] = useState('');
  const [newCategoryColor, setNewCategoryColor] = useState('#3B82F6');
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleCreateCategory = async (e: FormEvent) => {
    e.preventDefault();
    
    if (!newCategoryName.trim()) {
      setError('Category name is required');
      return;
    }

    if (categories.some(c => c.name.toLowerCase() === newCategoryName.toLowerCase())) {
      setError('Category already exists');
      return;
    }

    try {
      setLoading(true);
      setError(null);
      
      await onCreateCategory({
        name: newCategoryName.trim(),
        color: newCategoryColor
      });
      
      setNewCategoryName('');
      setNewCategoryColor('#3B82F6');
    } catch {
      setError('Failed to create category');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateCategory = async (category: Category, updates: Partial<Category>) => {
    try {
      setLoading(true);
      setError(null);
      
      await onUpdateCategory(category.id, updates);
      setEditingCategory(null);
    } catch {
      setError('Failed to update category');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteCategory = async (category: Category) => {
    if (category.name === 'Uncategorized') {
      setError('Cannot delete the default category');
      return;
    }

    if (!confirm(`Delete category "${category.name}"? All prompts in this category will be moved to "Uncategorized".`)) {
      return;
    }

    try {
      setLoading(true);
      setError(null);
      
      await onDeleteCategory(category.id);
    } catch {
      setError('Failed to delete category');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) {return null;}

  return (
    <div className="h-full flex flex-col bg-gradient-to-br from-purple-50 via-white to-blue-50">
      {/* Header */}
      <div className="flex-shrink-0 p-6 bg-white/80 backdrop-blur-sm border-b border-purple-100">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-indigo-600 rounded-xl flex items-center justify-center">
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
              </svg>
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-900">Manage Categories</h2>
              <p className="text-sm text-gray-500">Organize your prompt collection</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-purple-600 p-2 rounded-lg hover:bg-purple-50 transition-colors"
            disabled={loading}
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-6 space-y-6">
          {/* Error Display */}
          {error && (
            <div className="p-4 text-sm text-red-600 bg-red-50/80 backdrop-blur-sm border border-red-200 rounded-xl font-medium">
              ⚠️ {error}
            </div>
          )}

          {/* Add New Category Form */}
          <div className="bg-white/50 backdrop-blur-sm rounded-2xl p-5 border border-purple-100">
            <form onSubmit={(e) => { void handleCreateCategory(e); }} className="space-y-4">
              <h3 className="font-bold text-gray-900 flex items-center space-x-2">
                <span>Add New Category</span>
              </h3>
              
              <div className="space-y-4">
                <div className="flex items-center space-x-3">
                  <input
                    type="text"
                    value={newCategoryName}
                    onChange={(e) => {
                      setNewCategoryName(e.target.value);
                      setError(null);
                    }}
                    placeholder="Category name"
                    className="flex-1 px-4 py-3 h-12 border border-purple-200 rounded-xl focus:outline-none focus-within:ring-2 focus-within:ring-purple-500 focus-within:border-purple-500 text-sm bg-white/60 backdrop-blur-sm transition-all duration-200"
                    disabled={loading}
                    maxLength={50}
                  />
                  
                  <button
                    type="submit"
                    className="px-6 py-3 h-12 bg-gradient-to-r from-purple-500 to-indigo-600 text-white rounded-xl hover:from-purple-600 hover:to-indigo-700 transition-all duration-200 text-sm font-semibold shadow-lg shadow-purple-500/25 hover:shadow-purple-500/40 transform hover:scale-105 disabled:opacity-50 disabled:transform-none flex items-center justify-center flex-shrink-0"
                    disabled={loading || !newCategoryName.trim()}
                  >
                    {loading ? (
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                    ) : (
                      'Add'
                    )}
                  </button>
                </div>
                
                <div className="flex items-center space-x-3">
                  <label htmlFor="category-color" className="text-sm font-medium text-gray-700">Category Color:</label>
                  <input
                    id="category-color"
                    type="color"
                    value={newCategoryColor}
                    onChange={(e) => { setNewCategoryColor(e.target.value); }}
                    className="w-10 h-10 border border-purple-200 rounded-lg cursor-pointer bg-white/60"
                    disabled={loading}
                  />
                  <div 
                    className="w-6 h-6 rounded-full border-2 border-white shadow-sm"
                    style={{ backgroundColor: newCategoryColor }}
                  />
                  <span className="text-xs text-gray-500">{newCategoryColor}</span>
                </div>
              </div>
            </form>
          </div>

          {/* Category List */}
          <div className="space-y-3">
            <h3 className="font-bold text-gray-900 flex items-center space-x-2">
              <span>Your Categories</span>
            </h3>
            
            {categories.map((category) => (
              <div key={category.id} className="flex items-center justify-between p-4 bg-white/60 backdrop-blur-sm rounded-xl border border-purple-100 hover:bg-white/80 transition-all duration-200">
                <div className="flex items-center space-x-4">
                  <div
                    className="w-5 h-5 rounded-full border-2 border-white shadow-sm"
                    style={{ backgroundColor: category.color || '#6B7280' }}
                  />
                  
                  {editingCategory?.id === category.id ? (
                    <input
                      type="text"
                      value={editingCategory.name}
                      onChange={(e) => { setEditingCategory({ ...editingCategory, name: e.target.value }); }}
                      className="text-sm border border-purple-200 rounded-lg px-3 py-2 focus:outline-none focus-within:ring-2 focus-within:ring-purple-500 focus-within:border-purple-500 bg-white/80 backdrop-blur-sm font-medium"
                      onBlur={() => {
                        if (editingCategory.name.trim() && editingCategory.name !== category.name) {
                          void handleUpdateCategory(category, { name: editingCategory.name.trim() });
                        } else {
                          setEditingCategory(null);
                        }
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.currentTarget.blur();
                        } else if (e.key === 'Escape') {
                          setEditingCategory(null);
                        }
                      }}
                      maxLength={50}
                    />
                  ) : (
                    <span className="text-sm font-semibold text-gray-900">{category.name}</span>
                  )}
                </div>

                <div className="flex items-center space-x-2">
                  {category.name !== 'Uncategorized' && (
                    <>
                      <button
                        onClick={() => { setEditingCategory(category); }}
                        className="p-2 text-gray-400 hover:text-purple-600 rounded-lg hover:bg-purple-50 transition-colors"
                        disabled={loading}
                      >
                        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                      </button>
                      
                      <button
                        onClick={() => { void handleDeleteCategory(category); }}
                        className="p-2 text-gray-400 hover:text-red-600 rounded-lg hover:bg-red-50 transition-colors"
                        disabled={loading}
                      >
                        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
      </div>

      {/* Footer */}
      <div className="flex-shrink-0 p-6 bg-white/80 backdrop-blur-sm border-t border-purple-100">
        <button
          onClick={onClose}
          className="w-full px-6 py-3 text-sm font-semibold text-white bg-gradient-to-r from-purple-500 to-indigo-600 rounded-xl hover:from-purple-600 hover:to-indigo-700 transition-all duration-200 shadow-lg shadow-purple-500/25 hover:shadow-purple-500/40 transform hover:scale-105"
          disabled={loading}
        >
          Back to Library
        </button>
      </div>
    </div>
  );
};

export default CategoryManager;