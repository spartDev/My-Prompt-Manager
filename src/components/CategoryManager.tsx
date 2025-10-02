import { useState, useRef } from 'react';
import type { FC, FormEvent } from 'react';

import { DEFAULT_CATEGORY_COLOR, getColorName } from '../constants/colors';
import { Category } from '../types';
import { Logger, toError } from '../utils';

import ColorPicker from './ColorPicker';
import ConfirmDialog from './ConfirmDialog';

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
  const [newCategoryColor, setNewCategoryColor] = useState(DEFAULT_CATEGORY_COLOR);
  const [editingCategory, setEditingCategory] = useState<{ category: Category; name: string; color: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<{ isOpen: boolean; category: Category | null }>({
    isOpen: false,
    category: null
  });
  const ignoreBlurRef = useRef(false);

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
      setNewCategoryColor(DEFAULT_CATEGORY_COLOR);
    } catch {
      setError('Failed to create category');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateCategory = async () => {
    if (!editingCategory) {return;}
    
    const { category, name, color } = editingCategory;
    
    // Check if there are actual changes
    if (name === category.name && color === (category.color || DEFAULT_CATEGORY_COLOR)) {
      setEditingCategory(null);
      return;
    }
    
    try {
      setLoading(true);
      setError(null);
      
      const updates: Partial<Category> = {};
      if (name !== category.name) {updates.name = name.trim();}
      if (color !== category.color) {updates.color = color;}
      
      await onUpdateCategory(category.id, updates);
      setEditingCategory(null);
    } catch {
      setError('Failed to update category');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteCategory = (category: Category) => {
    if (category.name === 'Uncategorized') {
      setError('Cannot delete the default category');
      return;
    }

    setDeleteConfirm({ isOpen: true, category });
  };

  const handleConfirmDelete = async () => {
    if (!deleteConfirm.category) {return;}

    try {
      setLoading(true);
      setError(null);
      
      await onDeleteCategory(deleteConfirm.category.id);
      setDeleteConfirm({ isOpen: false, category: null });
    } catch {
      setError('Failed to delete category');
    } finally {
      setLoading(false);
    }
  };

  const handleCancelDelete = () => {
    setDeleteConfirm({ isOpen: false, category: null });
  };

  if (!isOpen) {return null;}

  return (
    <div className="h-full flex flex-col bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <div className="flex-shrink-0 p-6 bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm border-b border-purple-100 dark:border-gray-700">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-gradient-to-br from-purple-600 to-indigo-600 rounded-xl flex items-center justify-center">
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
              </svg>
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">Manage Categories</h2>
              <p className="text-sm text-gray-500 dark:text-gray-400 dark:text-gray-500">Organize your prompt collection</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 dark:text-gray-500 dark:text-gray-500 hover:text-purple-600 dark:hover:text-purple-400 dark:hover:text-purple-400 p-2 rounded-lg hover:bg-purple-50 dark:hover:bg-purple-900/20 transition-colors"
            disabled={loading}
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto">
          {/* Error Display */}
          {error && (
            <div className="p-5 text-sm text-red-600 dark:text-red-400 bg-red-50/80 dark:bg-red-900/20 backdrop-blur-sm border-b border-red-200 dark:border-red-700 font-medium">
              ⚠️ {error}
            </div>
          )}

          {/* Add New Category Form */}
          <div className="relative bg-white/70 dark:bg-gray-800/70 backdrop-blur-sm border-b border-purple-100 dark:border-gray-700 p-5" style={{ zIndex: 100 }}>
            <form onSubmit={(e) => { void handleCreateCategory(e); }} className="space-y-4">
              <h3 className="font-bold text-gray-900 dark:text-gray-100 flex items-center space-x-2">
                <svg className="w-5 h-5 text-purple-600 dark:text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                </svg>
                <span className='text-sm'>Add New Category</span>
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
                    placeholder="Enter category name..."
                    className="flex-1 px-4 py-3 h-12 border border-purple-200 dark:border-gray-600 rounded-xl focus:outline-none focus-within:ring-2 focus-within:ring-purple-500 focus-within:border-purple-500 text-sm text-gray-900 dark:text-gray-100 bg-white/60 dark:bg-gray-700/60 backdrop-blur-sm transition-all duration-200 placeholder-gray-400 dark:placeholder-gray-500"
                    disabled={loading}
                    maxLength={50}
                  />
                  
                  <button
                    type="submit"
                    className="px-6 py-3 h-12 bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-xl hover:from-purple-700 hover:to-indigo-700 transition-all duration-200 text-sm font-semibold shadow-lg hover:shadow-xl disabled:opacity-50 flex items-center justify-center flex-shrink-0 min-w-[80px]"
                    disabled={loading || !newCategoryName.trim()}
                  >
                    {loading ? (
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                    ) : (
                      <>
                        <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                        </svg>
                        Add
                      </>
                    )}
                  </button>
                </div>
                
                <div className="relative" style={{ zIndex: 200 }}>
                  <ColorPicker
                    value={newCategoryColor}
                    onChange={setNewCategoryColor}
                    label="Category Color"
                    disabled={loading}
                  />
                </div>
              </div>
            </form>
          </div>

          {/* Category List */}
          <div>
            <h3 className="font-bold text-gray-900 dark:text-gray-100 flex items-center justify-between p-5 bg-white/70 dark:bg-gray-800/70 backdrop-blur-sm border-b border-purple-100 dark:border-gray-700">
              <div className="flex items-center space-x-2">
                <svg className="w-5 h-5 text-purple-600 dark:text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                </svg>
                <span className='text-sm'>Your Categories</span>
              </div>
              <span className="text-sm text-gray-500 dark:text-gray-400">
                {categories.length} {categories.length === 1 ? 'category' : 'categories'}
              </span>
            </h3>
            
            {categories.length === 0 ? (
              <div className="p-8 text-center bg-white/70 dark:bg-gray-800/70">
                <svg className="w-12 h-12 mx-auto text-gray-300 dark:text-gray-600 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                </svg>
                <p className="text-gray-500 dark:text-gray-400 text-sm">No categories yet. Create your first category above!</p>
              </div>
            ) : (
              categories.map((category, index) => (
                <div key={category.id} className="relative group flex items-center justify-between p-5 bg-white/70 dark:bg-gray-800/70 backdrop-blur-sm border-b border-purple-100 dark:border-gray-700 hover:bg-white/90 dark:hover:bg-gray-800/90 transition-all duration-200" style={{ zIndex: editingCategory?.category.id === category.id ? 90 : 10 - index }}>
                  {editingCategory?.category.id === category.id ? (
                    // Edit Mode - Show both color and name editors
                    <div className="flex-1">
                      <div className="flex items-center space-x-3">
                        <div className="relative flex-shrink-0" style={{ zIndex: 100 }}>
                          <ColorPicker
                            value={editingCategory.color}
                            onChange={(newColor) => { setEditingCategory({ ...editingCategory, color: newColor }); }}
                            label=""
                            disabled={loading}
                            compact={true}
                          />
                        </div>
                        <input
                          type="text"
                          value={editingCategory.name}
                          onChange={(e) => { setEditingCategory({ ...editingCategory, name: e.target.value }); }}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' && editingCategory.name.trim()) {
                              e.preventDefault();
                              void handleUpdateCategory();
                            } else if (e.key === 'Escape') {
                              e.preventDefault();
                              setEditingCategory(null);
                            }
                          }}
                          onBlur={() => {
                            // Don't auto-save if user is clicking on action buttons
                            if (!ignoreBlurRef.current && editingCategory.name.trim()) {
                              void handleUpdateCategory();
                            }
                            // Reset the flag after handling blur
                            ignoreBlurRef.current = false;
                          }}
                          placeholder="Category name"
                          className="flex-1 text-sm border border-purple-200 dark:border-gray-600 rounded-lg px-3 py-2.5 focus:outline-none focus-within:ring-2 focus-within:ring-purple-500 focus-within:border-purple-500 bg-white/80 dark:bg-gray-700/80 backdrop-blur-sm font-medium text-gray-900 dark:text-gray-100"
                          maxLength={50}
                          disabled={loading}
                        />
                        <div className="flex items-center space-x-1 flex-shrink-0">
                          <button
                            onClick={() => { void handleUpdateCategory(); }}
                            onMouseDown={() => { ignoreBlurRef.current = true; }}
                            className="p-2 bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 text-white rounded-lg transition-all shadow-sm hover:shadow disabled:opacity-50"
                            disabled={loading || !editingCategory.name.trim()}
                            title="Save changes (Enter)"
                            type="button"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                          </button>
                          <button
                            onClick={() => { setEditingCategory(null); }}
                            onMouseDown={() => { ignoreBlurRef.current = true; }}
                            className="p-2 text-gray-500 hover:text-red-600 dark:text-gray-400 dark:hover:text-red-400 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
                            title="Cancel (Esc)"
                            type="button"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          </button>
                        </div>
                      </div>
                    </div>
                  ) : (
                    // Display Mode - Show color swatch and name
                    <div className="flex items-center space-x-4 flex-1">
                      <div
                        className="w-8 h-8 rounded-lg border-2 border-white dark:border-gray-700 shadow-sm"
                        style={{ backgroundColor: category.color || '#6B7280' }}
                        title={getColorName(category.color || '#6B7280')}
                      />
                      <div className="flex-1">
                        <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">{category.name}</span>
                        {category.name === 'Uncategorized' && (
                          <span className="ml-2 text-xs text-gray-500 dark:text-gray-400 italic">Default</span>
                        )}
                      </div>
                    </div>
                  )}

                  {!editingCategory && (
                    <div className="flex items-center space-x-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      {category.name !== 'Uncategorized' && (
                        <>
                          <button
                            onClick={() => { 
                              setEditingCategory({ 
                                category, 
                                name: category.name, 
                                color: category.color || DEFAULT_CATEGORY_COLOR 
                              }); 
                            }}
                            className="p-2 text-gray-400 dark:text-gray-500 hover:text-purple-600 dark:hover:text-purple-400 rounded-lg hover:bg-purple-50 dark:hover:bg-purple-900/20 transition-colors"
                            disabled={loading}
                            title="Edit category"
                          >
                            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                            </svg>
                          </button>
                          
                          <button
                            onClick={() => { handleDeleteCategory(category); }}
                            className="p-2 text-gray-400 dark:text-gray-500 hover:text-red-600 dark:hover:text-red-400 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                            disabled={loading}
                            title="Delete category"
                          >
                            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                          </button>
                        </>
                      )}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
      </div>

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        isOpen={deleteConfirm.isOpen}
        onConfirm={() => { handleConfirmDelete().catch((err: unknown) => { Logger.error('Failed to delete category', toError(err)); }); }}
        onCancel={handleCancelDelete}
        title="Delete Category"
        message={deleteConfirm.category ? 
          `Delete category "${deleteConfirm.category.name}"? All prompts in this category will be moved to "Uncategorized".` : 
          'Are you sure you want to delete this category?'
        }
        confirmText="Delete"
        cancelText="Cancel"
        variant="warning"
      />
    </div>
  );
};

export default CategoryManager;