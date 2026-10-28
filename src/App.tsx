import type { FC } from 'react';
import { useCallback, useOptimistic, useRef, useState, useTransition } from 'react';

import AddPromptForm from './components/AddPromptForm';
import { AnalyticsTab } from './components/analytics';
import CategoryManager from './components/CategoryManager';
import EditPromptForm from './components/EditPromptForm';
import LibraryView from './components/LibraryView';
import SettingsView from './components/SettingsView';
import StorageWarning from './components/StorageWarning';
import TabBar, { type Section } from './components/TabBar';
import ToastContainer from './components/ToastContainer';
import { ThemeProvider } from './contexts/ThemeContext';
import { useCategories } from './hooks/useCategories';
import { useClipboard } from './hooks/useClipboard';
import { usePrompts } from './hooks/usePrompts';
import { useSearchWithDebounce } from './hooks/useSearchWithDebounce';
import { useToast } from './hooks/useToast';
import { ALL_PROMPTS } from './services/libraryFilter';
import type { AppError, LibraryFilter, Prompt, ViewType } from './types';
import { Logger, toError } from './utils';

type ExtendedViewType = ViewType | Section;

const SECTIONS: readonly ExtendedViewType[] = ['library', 'categories', 'analytics', 'settings'];

const isSection = (view: ExtendedViewType): view is Section => SECTIONS.includes(view);

interface AppProps {
  context?: 'popup' | 'sidepanel';
}

const App: FC<AppProps> = ({ context = 'popup' }) => {
  // Check if we're in picker mode
  const urlParams = new URLSearchParams(window.location.search);
  const isPickerMode = urlParams.get('picker') === 'true';
  
  const [currentView, setCurrentView] = useState<ExtendedViewType>(isPickerMode ? 'settings' : 'library');
  const [selectedPrompt, setSelectedPrompt] = useState<Prompt | null>(null);
  // The Library filter lasts while the popup or side panel stays open, across Sections
  const [libraryFilter, setLibraryFilter] = useState<LibraryFilter>(ALL_PROMPTS);
  // Why the last save was refused for lack of storage: the storage warning shows it
  const [storageRefusal, setStorageRefusal] = useState<string | null>(null);
  // What had the keyboard when the refused save started (Save, or the field where Enter was
  // pressed): it gets the keyboard back when the warning closes
  const storageRefusalTriggerRef = useRef<HTMLElement | null>(null);
  const sectionContentRef = useRef<HTMLDivElement>(null);

  // React 19 useTransition for managing optimistic updates
  const [, startTransition] = useTransition();

  const {
    prompts,
    loading: promptsLoading,
    error: promptsError,
    createPrompt,
    updatePrompt,
    deletePrompt,
    togglePin,
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

  // Initialize search with debounce functionality using optimistic prompts
  const searchWithDebounce = useSearchWithDebounce(optimisticPrompts);

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

  const handleDeleteFromEdit = (id: string) => {
    setCurrentView('library');
    setSelectedPrompt(null);
    void handleDeletePrompt(id);
  };

  const handleTogglePin = useCallback((id: string) => {
    togglePin(id).catch((err: unknown) => {
      Logger.error('Failed to toggle pin', toError(err), {
        component: 'App',
        promptId: id,
        operation: 'togglePin'
      });
      showToast('Failed to update pin', 'error');
    });
  }, [togglePin, showToast]);

  const handleCopyPrompt = async (content: string) => {
    const success = await copyToClipboard(content);
    if (success) {
      showToast('Prompt copied to clipboard', 'success');
    } else {
      showToast('Failed to copy prompt', 'error');
    }
  };

  const handleFormSubmit = async (data: { title: string; content: string; category: string }) => {
    // The form calls this before Save is disabled, so Save (or the field) still has the keyboard
    const trigger = document.activeElement instanceof HTMLElement ? document.activeElement : null;
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

      if (appError.type === 'STORAGE_QUOTA_EXCEEDED') {
        storageRefusalTriggerRef.current = trigger;
        setStorageRefusal(appError.message || 'Failed to save prompt');
      }
      // The form shows the refusal and keeps what the user typed
      throw error;
    }
  };

  const handleFormCancel = () => {
    setCurrentView('library');
    setSelectedPrompt(null);
  };

  const handleCreateCategory = async (categoryData: { name: string; color?: string }) => {
    const trigger = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    try {
      await createCategory(categoryData);
      showToast('Category created successfully', 'success');
    } catch (error: unknown) {
      const appError = error as AppError;
      if (appError.type === 'STORAGE_QUOTA_EXCEEDED') {
        storageRefusalTriggerRef.current = trigger;
        setStorageRefusal(appError.message || 'Failed to create category');
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

  const handleSelectSection = useCallback((section: Section) => {
    if (section === currentView) {
      // iOS convention: pressing the active tab scrolls its content back to the top
      sectionContentRef.current
        ?.querySelector('[data-scroll-container]')
        ?.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    if (currentView === 'settings') {
      // Settings may have imported prompts/categories: refresh so other Sections show them
      void refreshPrompts();
      void refreshCategories();
    }
    setCurrentView(section);
  }, [currentView, refreshPrompts, refreshCategories]);

  const handleExpandDashboard = useCallback(() => {
    // Open full analytics dashboard in a new tab
    void chrome.tabs.create({ url: chrome.runtime.getURL('src/analytics.html') });
  }, []);

  const handleCloseStorageWarning = useCallback(() => {
    const trigger = storageRefusalTriggerRef.current;
    storageRefusalTriggerRef.current = null;
    setStorageRefusal(null);
    if (trigger?.isConnected) {
      trigger.focus();
    }
  }, []);

  const loading = promptsLoading || categoriesLoading;
  const showTabBar = isSection(currentView);

  if (promptsError) {
    return (
      <ThemeProvider>
        <div className="h-full w-full p-4 bg-app flex items-center justify-center">
          <div className="text-center">
            <h2 className="text-xl font-semibold text-danger mb-2">Error Loading Data</h2>
            <p className="text-secondary">{promptsError.message}</p>
          </div>
        </div>
      </ThemeProvider>
    );
  }

  return (
    <ThemeProvider>
      <div className={`h-full w-full bg-app section-scroll-scope relative flex flex-col ${context === 'sidepanel' ? 'sidepanel' : ''}`}>
      <div ref={sectionContentRef} className="flex-1 min-h-0">
      {currentView === 'library' && (
        <LibraryView
          prompts={optimisticPrompts}
          categories={categories}
          searchWithDebounce={searchWithDebounce}
          libraryFilter={libraryFilter}
          onAddNew={handleAddNew}
          onEditPrompt={handleEditPrompt}
          onTogglePin={handleTogglePin}
          onCopyPrompt={(content: string) => { void handleCopyPrompt(content); }}
          showToast={showToast}
          onLibraryFilterChange={setLibraryFilter}
          loading={loading}
          context={context}
        />
      )}

      {currentView === 'add' && (
        <AddPromptForm
          categories={categories}
          onSubmit={handleFormSubmit}
          onCancel={handleFormCancel}
        />
      )}

      {currentView === 'edit' && selectedPrompt && (
        <EditPromptForm
          prompt={selectedPrompt}
          categories={categories}
          onSubmit={handleFormSubmit}
          onCancel={handleFormCancel}
          onDelete={handleDeleteFromEdit}
        />
      )}

      {currentView === 'categories' && (
        <CategoryManager
          categories={categories}
          onCreateCategory={handleCreateCategory}
          onUpdateCategory={handleUpdateCategory}
          onDeleteCategory={handleDeleteCategory}
          context={context}
        />
      )}

      {currentView === 'settings' && (
        <SettingsView
          context={context}
          showToast={showToast}
          toastSettings={settings}
          onToastSettingsChange={updateSettings}
        />
      )}

      {currentView === 'analytics' && (
        <AnalyticsTab
          onExpandDashboard={handleExpandDashboard}
          context={context}
        />
      )}
      </div>

      {showTabBar && (
        <TabBar activeSection={currentView} onSelect={handleSelectSection} />
      )}

      {storageRefusal !== null && (
        <StorageWarning reason={storageRefusal} onClose={handleCloseStorageWarning} />
      )}

      <ToastContainer
        toasts={toasts}
        onDismiss={hideToast}
        position={settings.position}
        queueLength={queueLength}
        aboveTabBar={showTabBar}
      />
      </div>
    </ThemeProvider>
  );
};

export default App;
