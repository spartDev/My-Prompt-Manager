import { useState, useOptimistic, useTransition, useMemo, useCallback } from 'react';
import type { FC } from 'react';

import AddPromptForm from './components/AddPromptForm';
import CategoryManager from './components/CategoryManager';
import EditPromptForm from './components/EditPromptForm';
import LibraryView from './components/LibraryView';
import SettingsView from './components/SettingsView';
import StorageWarning from './components/StorageWarning';
import ToastContainer from './components/ToastContainer';
import { ThemeProvider } from './contexts/ThemeContext';
import { usePrompts, useCategories, useClipboard, useToast, useSearchWithDebounce } from './hooks';
import { Prompt, ErrorType, AppError, SortOrder, SortDirection } from './types';
import { Logger, toError } from './utils';

type ViewType = 'library' | 'add' | 'edit' | 'categories' | 'settings';

interface AppProps {
  context?: 'popup' | 'sidepanel';
}

const App: FC<AppProps> = ({ context = 'popup' }) => {
  // Check if we're in picker mode
  const urlParams = new URLSearchParams(window.location.search);
  const isPickerMode = urlParams.get('picker') === 'true';
  
  const [currentView, setCurrentView] = useState<ViewType>(isPickerMode ? 'settings' : 'library');
  const [selectedPrompt, setSelectedPrompt] = useState<Prompt | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [sortOrder, setSortOrder] = useState<SortOrder>('updatedAt');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [showStorageWarning, setShowStorageWarning] = useState<boolean>(false);

  // React 19 useTransition for managing optimistic updates
  const [, startTransition] = useTransition();

  const {
    prompts,
    loading: promptsLoading,
    error: promptsError,
    createPrompt,
    updatePrompt,
    deletePrompt,
    refreshPrompts
  } = usePrompts();

  // React 19 useOptimistic for instant UI updates on deletions
  const [optimisticPrompts, setOptimisticDeletePrompt] = useOptimistic(
    prompts,
    (state, deletedId: string) => state.filter(p => p.id !== deletedId)
  );

  const {
    categories,
    loading: categoriesLoading,
    createCategory,
    updateCategory,
    deleteCategory,
    refreshCategories
  } = useCategories();

  const { copyToClipboard } = useClipboard();
  const { toasts, showToast, hideToast, queueLength, settings, updateSettings } = useToast();

  // Sort optimistic prompts based on current sort settings
  const sortedPrompts = useMemo(() => {
    const prompts = [...optimisticPrompts];

    prompts.sort((a, b) => {
      let comparison = 0;

      switch (sortOrder) {
        case 'title':
          comparison = a.title.localeCompare(b.title);
          break;
        case 'createdAt':
          comparison = a.createdAt - b.createdAt;
          break;
        case 'updatedAt':
          comparison = a.updatedAt - b.updatedAt;
          break;
      }

      return sortDirection === 'asc' ? comparison : -comparison;
    });

    return prompts;
  }, [optimisticPrompts, sortOrder, sortDirection]);

  // Initialize search with debounce functionality using sorted prompts
  const searchWithDebounce = useSearchWithDebounce(sortedPrompts);

  const handleAddNew = () => {
    setCurrentView('add');
    setSelectedPrompt(null);
  };

  const handleEditPrompt = (prompt: Prompt) => {
    setSelectedPrompt(prompt);
    setCurrentView('edit');
  };

  const handleDeletePrompt = async (id: string) => {
    // React 19 useOptimistic: Remove from UI immediately for instant feedback
    // Wrap in startTransition as required by React for optimistic updates
    startTransition(() => {
      setOptimisticDeletePrompt(id);
    });

    try {
      await deletePrompt(id);
      Logger.info('Prompt deleted successfully', {
        component: 'App',
        promptId: id,
        operation: 'deletePrompt'
      });
      showToast('Prompt deleted successfully', 'success');
    } catch (err) {
      Logger.error('Failed to delete prompt', toError(err), {
        component: 'App',
        promptId: id,
        operation: 'deletePrompt'
      });

      // CRITICAL: useOptimistic only reconciles when base state changes
      // Refresh prompts to update base state, triggering automatic revert
      try {
        await refreshPrompts();
        Logger.info('Prompts refreshed after delete failure', {
          component: 'App',
          operation: 'deletePrompt-recovery'
        });
      } catch (refreshErr) {
        // If refresh fails, log the error - React will still attempt reconciliation
        // when prompts state eventually updates from other operations
        Logger.error('Failed to refresh prompts after delete failure', toError(refreshErr), {
          component: 'App',
          operation: 'deletePrompt-recovery',
          originalError: (err as Error).message
        });
      }

      showToast('Failed to delete prompt', 'error');
    }
  };

  const handleSortChange = useCallback((order: SortOrder, direction: SortDirection) => {
    setSortOrder(order);
    setSortDirection(direction);
  }, []);

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
        Logger.info('Prompt created successfully', {
          component: 'App',
          operation: 'createPrompt',
          category: data.category
        });
        showToast('Prompt created successfully', 'success');
      } else if (currentView === 'edit' && selectedPrompt) {
        await updatePrompt(selectedPrompt.id, data);
        Logger.info('Prompt updated successfully', {
          component: 'App',
          operation: 'updatePrompt',
          promptId: selectedPrompt.id,
          category: data.category
        });
        showToast('Prompt updated successfully', 'success');
      }
      setCurrentView('library');
      setSelectedPrompt(null);
    } catch (error: unknown) {
      const appError = error as AppError;
      Logger.error('Failed to save prompt', toError(appError), {
        component: 'App',
        operation: currentView === 'add' ? 'createPrompt' : 'updatePrompt',
        errorType: appError.type,
        category: data.category
      });

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
      // Refresh prompts to show the updated category names
      if (updates.name) {
        await refreshPrompts();
      }
      showToast('Category updated successfully', 'success');
    } catch (error) {
      showToast('Failed to update category', 'error');
      throw error;
    }
  };

  const handleDeleteCategory = async (id: string) => {
    try {
      await deleteCategory(id);
      // Refresh prompts to show them as Uncategorized after category deletion
      await refreshPrompts();
      showToast('Category deleted successfully', 'success');
    } catch (error) {
      showToast('Failed to delete category', 'error');
      throw error;
    }
  };

  const loading = promptsLoading || categoriesLoading;

  if (promptsError) {
    return (
      <ThemeProvider>
        <div className="h-full w-full p-4 bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
          <div className="text-center">
            <h2 className="text-xl font-semibold text-red-600 dark:text-red-400 mb-2">Error Loading Data</h2>
            <p className="text-gray-600 dark:text-gray-400">{promptsError.message}</p>
          </div>
        </div>
      </ThemeProvider>
    );
  }

  return (
    <ThemeProvider>
      <div className={`h-full w-full bg-gray-50 dark:bg-gray-900 relative ${context === 'sidepanel' ? 'sidepanel' : ''}`}>
      {currentView === 'library' && (
        <LibraryView
          prompts={optimisticPrompts}
          categories={categories}
          searchWithDebounce={searchWithDebounce}
          selectedCategory={selectedCategory}
          sortOrder={sortOrder}
          sortDirection={sortDirection}
          onSortChange={handleSortChange}
          onAddNew={handleAddNew}
          onEditPrompt={handleEditPrompt}
          onDeletePrompt={(id: string) => { void handleDeletePrompt(id); }}
          onCopyPrompt={(content: string) => { void handleCopyPrompt(content); }}
          showToast={showToast}
          onCategoryChange={setSelectedCategory}
          onManageCategories={() => {
            setCurrentView('categories');
          }}
          onSettings={() => {
            setCurrentView('settings');
          }}
          loading={loading}
          context={context}
        />
      )}

      {currentView === 'add' && (
        <AddPromptForm
          categories={categories}
          onSubmit={(data) => { void handleFormSubmit(data); }}
          onCancel={handleFormCancel}
        />
      )}

      {currentView === 'edit' && selectedPrompt && (
        <EditPromptForm
          prompt={selectedPrompt}
          categories={categories}
          onSubmit={(data) => { void handleFormSubmit(data); }}
          onCancel={handleFormCancel}
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

      {currentView === 'settings' && (
        <SettingsView
          onBack={() => {
            setCurrentView('library');
            // Refresh data to ensure imported prompts/categories are visible
            void refreshPrompts();
            void refreshCategories();
          }}
          showToast={showToast}
          toastSettings={settings}
          onToastSettingsChange={updateSettings}
        />
      )}

      {showStorageWarning && (
        <StorageWarning onClose={() => {
          setShowStorageWarning(false);
        }} />
      )}

      <ToastContainer
        toasts={toasts}
        onDismiss={hideToast}
        position={settings.position}
        queueLength={queueLength}
      />
      </div>
    </ThemeProvider>
  );
};

export default App;
