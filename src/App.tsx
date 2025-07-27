import { useState } from 'react';
import type { FC } from 'react';

import AddPromptForm from './components/AddPromptForm';
import CategoryManager from './components/CategoryManager';
import EditPromptForm from './components/EditPromptForm';
import LibraryView from './components/LibraryView';
import StorageWarning from './components/StorageWarning';
import ToastContainer from './components/ToastContainer';
import { usePrompts, useCategories, useClipboard, useToast } from './hooks';
import { Prompt, ErrorType, AppError } from './types';

type ViewType = 'library' | 'add' | 'edit' | 'categories';

const App: FC = () => {
  const [currentView, setCurrentView] = useState<ViewType>('library');
  const [selectedPrompt, setSelectedPrompt] = useState<Prompt | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [showStorageWarning, setShowStorageWarning] = useState<boolean>(false);

  const { 
    prompts, 
    loading: promptsLoading, 
    error: promptsError,
    createPrompt, 
    updatePrompt, 
    deletePrompt 
  } = usePrompts();

  const { 
    categories, 
    loading: categoriesLoading,
    createCategory,
    updateCategory,
    deleteCategory 
  } = useCategories();

  const { copyToClipboard } = useClipboard();
  const { toasts, showToast } = useToast();

  const handleAddNew = () => {
    setCurrentView('add');
    setSelectedPrompt(null);
  };

  const handleEditPrompt = (prompt: Prompt) => {
    setSelectedPrompt(prompt);
    setCurrentView('edit');
  };

  const handleDeletePrompt = async (id: string) => {
    try {
      await deletePrompt(id);
      showToast('Prompt deleted successfully', 'success');
    } catch {
      showToast('Failed to delete prompt', 'error');
    }
  };

  const handleCopyPrompt = async (content: string) => {
    const success = await copyToClipboard(content);
    if (success) {
      showToast('Prompt copied to clipboard', 'success');
    } else {
      showToast('Failed to copy prompt', 'error');
    }
  };

  const handleFormSubmit = async (data: { title: string; content: string; category: string }) => {
    try {
      if (currentView === 'add') {
        await createPrompt(data);
        showToast('Prompt created successfully', 'success');
      } else if (currentView === 'edit' && selectedPrompt) {
        await updatePrompt(selectedPrompt.id, data);
        showToast('Prompt updated successfully', 'success');
      }
      setCurrentView('library');
      setSelectedPrompt(null);
    } catch (error: unknown) {
      const appError = error as AppError;
      if (appError.type === ErrorType.STORAGE_QUOTA_EXCEEDED) {
        setShowStorageWarning(true);
      } else {
        showToast(appError.message || 'Failed to save prompt', 'error');
      }
    }
  };

  const handleFormCancel = () => {
    setCurrentView('library');
    setSelectedPrompt(null);
  };

  const handleCreateCategory = async (categoryData: { name: string; color?: string }) => {
    try {
      await createCategory(categoryData);
      showToast('Category created successfully', 'success');
    } catch (error: unknown) {
      const appError = error as AppError;
      if (appError.type === ErrorType.STORAGE_QUOTA_EXCEEDED) {
        setShowStorageWarning(true);
      } else {
        showToast(appError.message || 'Failed to create category', 'error');
      }
      throw new Error(appError.message || 'Failed to create category');
    }
  };

  const handleUpdateCategory = async (id: string, updates: Partial<{ name: string; color?: string }>) => {
    try {
      await updateCategory(id, updates);
      showToast('Category updated successfully', 'success');
    } catch (error) {
      showToast('Failed to update category', 'error');
      throw error;
    }
  };

  const handleDeleteCategory = async (id: string) => {
    try {
      await deleteCategory(id);
      showToast('Category deleted successfully', 'success');
    } catch (error) {
      showToast('Failed to delete category', 'error');
      throw error;
    }
  };

  const loading = promptsLoading || categoriesLoading;

  if (promptsError) {
    return (
      <div className="h-full w-full p-4 bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-xl font-semibold text-red-600 mb-2">Error Loading Data</h2>
          <p className="text-gray-600">{promptsError.message}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full w-full bg-gray-50 relative">
      {currentView === 'library' && (
        <LibraryView
          prompts={prompts}
          categories={categories}
          searchQuery={searchQuery}
          selectedCategory={selectedCategory}
          onAddNew={handleAddNew}
          onEditPrompt={handleEditPrompt}
          onDeletePrompt={(id: string) => { void handleDeletePrompt(id); }}
          onCopyPrompt={(content: string) => { void handleCopyPrompt(content); }}
          onSearchChange={setSearchQuery}
          onCategoryChange={setSelectedCategory}
          onManageCategories={() => {
            setCurrentView('categories');
          }}
          loading={loading}
        />
      )}

      {currentView === 'add' && (
        <AddPromptForm
          categories={categories}
          onSubmit={(data) => { void handleFormSubmit(data); }}
          onCancel={handleFormCancel}
          isLoading={loading}
        />
      )}

      {currentView === 'edit' && selectedPrompt && (
        <EditPromptForm
          prompt={selectedPrompt}
          categories={categories}
          onSubmit={(data) => { void handleFormSubmit(data); }}
          onCancel={handleFormCancel}
          isLoading={loading}
        />
      )}

      {currentView === 'categories' && (
        <CategoryManager
          categories={categories}
          onCreateCategory={handleCreateCategory}
          onUpdateCategory={handleUpdateCategory}
          onDeleteCategory={handleDeleteCategory}
          isOpen={true}
          onClose={() => {
            setCurrentView('library');
          }}
        />
      )}

      {showStorageWarning && (
        <StorageWarning onClose={() => {
          setShowStorageWarning(false);
        }} />
      )}

      <ToastContainer toasts={toasts} />
    </div>
  );
};

export default App;