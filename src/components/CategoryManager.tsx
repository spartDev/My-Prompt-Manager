import type { FC, FormEvent } from 'react';
import { useCallback, useId, useRef, useState } from 'react';

import { DEFAULT_CATEGORY_COLOR, getColorName } from '../constants/colors';
import { PROMPT_LIMITS } from '../services/promptAdmission';
import type { Category } from '../types';
import { Logger, toError } from '../utils';

import ColorPicker from './ColorPicker';
import ConfirmDialog from './ConfirmDialog';
import ViewHeader from './ViewHeader';

interface CategoryManagerProps {
  categories: Category[];
  onCreateCategory: (category: { name: string; color?: string }) => Promise<void>;
  onUpdateCategory: (id: string, updates: Partial<Category>) => Promise<void>;
  onDeleteCategory: (id: string) => Promise<void>;
  context?: 'popup' | 'sidepanel';
}

const CategoryManager: FC<CategoryManagerProps> = ({
  categories,
  onCreateCategory,
  onUpdateCategory,
  onDeleteCategory,
  context = 'popup'
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
  const addTitleId = useId();
  const listTitleId = useId();

  const handleCreateCategory = useCallback(async (e: FormEvent) => {
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
  }, [newCategoryName, newCategoryColor, categories, onCreateCategory]);

  const handleUpdateCategory = useCallback(async () => {
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
  }, [editingCategory, onUpdateCategory]);

  const handleDeleteCategory = useCallback((category: Category) => {
    if (category.name === 'Uncategorized') {
      setError('Cannot delete the default category');
      return;
    }

    setDeleteConfirm({ isOpen: true, category });
  }, []);

  const handleConfirmDelete = useCallback(async () => {
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
  }, [deleteConfirm.category, onDeleteCategory]);

  const handleCancelDelete = useCallback(() => {
    setDeleteConfirm({ isOpen: false, category: null });
  }, []);


  return (
    <div className="h-full flex flex-col bg-app">
      {/* Header */}
      <ViewHeader
        icon={
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
          </svg>
        }
        title="Categories"
        subtitle={`${String(categories.length)} ${categories.length === 1 ? 'category' : 'categories'}`}
        context={context}
      >
        {context === 'sidepanel' && (
          <ViewHeader.Actions>
            <ViewHeader.CloseButton onClick={() => { window.close(); }} context="sidepanel" />
          </ViewHeader.Actions>
        )}
      </ViewHeader>

      {/* Content: two cards on bg-app */}
      <div className="flex-1 overflow-auto p-4 space-y-4" data-scroll-container>
          {/* Error Display */}
          {error && (
            <div className="p-4 text-sm font-medium text-danger bg-danger-subtle border border-danger rounded-xl">
              ⚠️ {error}
            </div>
          )}

          {/* Add New Category Form */}
          <section aria-labelledby={addTitleId} className="relative bg-card border border-default rounded-2xl shadow-sm p-5">
            <form onSubmit={(e) => { void handleCreateCategory(e); }} className="space-y-4">
              <h3 id={addTitleId} className="font-bold text-primary flex items-center space-x-2">
                <svg className="w-5 h-5 text-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
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
                    className="flex-1 min-w-0 px-4 py-3 h-12 border border-input rounded-xl focus-input text-sm text-primary bg-subtle transition-all duration-200 placeholder:text-tertiary"
                    disabled={loading}
                    maxLength={PROMPT_LIMITS.category}
                  />
                  
                  <button
                    type="submit"
                    className="px-6 py-3 h-12 bg-accent hover:bg-accent-hover text-on-accent rounded-xl transition-all duration-200 text-sm font-semibold shadow-lg hover:shadow-xl disabled:opacity-50 flex items-center justify-center shrink-0 min-w-[80px] focus-primary"
                    disabled={loading || !newCategoryName.trim()}
                  >
                    {loading ? (
                      <div className="w-4 h-4 border-2 border-current/30 border-t-current rounded-full animate-spin"></div>
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
          </section>

          {/* Category List: rows split by dividers */}
          <section aria-labelledby={listTitleId} className="bg-card border border-default rounded-2xl shadow-sm overflow-hidden divide-y divide-divider">
            <h3 id={listTitleId} className="font-bold text-primary flex items-center space-x-2 p-5">
              <svg className="w-5 h-5 text-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
              </svg>
              <span className='text-sm'>Your Categories</span>
            </h3>
            
            {categories.length === 0 ? (
              <div className="p-8 text-center">
                <svg className="w-12 h-12 mx-auto text-faint mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                </svg>
                <p className="text-tertiary text-sm">No categories yet. Create your first category above!</p>
              </div>
            ) : (
              categories.map((category) => (
                <div key={category.id} data-testid="category-row" data-category-name={category.name} className={`relative group flex items-center justify-between p-5 transition-colors duration-200 ${editingCategory ? '' : 'hover:bg-muted'}`}>
                  {editingCategory?.category.id === category.id ? (
                    // Edit Mode - Show both color and name editors
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center space-x-3">
                        <div className="relative shrink-0" style={{ zIndex: 100 }}>
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
                          className="flex-1 min-w-0 text-sm border border-input rounded-lg px-3 py-2.5 focus-input bg-subtle font-medium text-primary placeholder:text-tertiary"
                          maxLength={PROMPT_LIMITS.category}
                          disabled={loading}
                        />
                        <div className="flex items-center space-x-1 shrink-0">
                          <button
                            onClick={() => { void handleUpdateCategory(); }}
                            onMouseDown={() => { ignoreBlurRef.current = true; }}
                            className="p-2 bg-accent hover:bg-accent-hover text-on-accent rounded-lg transition-all shadow-sm hover:shadow-md disabled:opacity-50 focus-primary"
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
                            className="p-2 text-tertiary hover:text-primary hover:bg-muted rounded-lg transition-colors focus-interactive"
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
                        className="w-8 h-8 rounded-lg border border-default shadow-sm"
                        style={{ backgroundColor: category.color || '#6B7280' }}
                        title={getColorName(category.color || '#6B7280')}
                      />
                      <div className="flex-1">
                        <span className="text-sm font-semibold text-primary">{category.name}</span>
                        {category.name === 'Uncategorized' && (
                          <span className="ml-2 text-xs text-tertiary italic">Default</span>
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
                            className="p-2 text-tertiary hover:text-accent hover:bg-accent-subtle rounded-lg transition-colors focus-interactive"
                            disabled={loading}
                            title="Edit category"
                          >
                            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                            </svg>
                          </button>
                          
                          <button
                            onClick={() => { handleDeleteCategory(category); }}
                            className="p-2 text-tertiary hover:text-danger hover:bg-danger-subtle rounded-lg transition-colors focus-danger"
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
          </section>
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