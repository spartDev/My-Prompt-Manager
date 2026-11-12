import type { FC } from 'react';
import { useCallback, useEffect, useOptimistic, useRef, useState, useTransition } from 'react';

import { AnalyticsTab } from './components/analytics';
import CategoryManager from './components/CategoryManager';
import LibraryView from './components/LibraryView';
import PromptEditor from './components/PromptEditor';
import SettingsView from './components/SettingsView';
import StorageWarning from './components/StorageWarning';
import TabBar, { SECTION_ORDER, type Section } from './components/TabBar';
import ToastContainer from './components/ToastContainer';
import { ThemeProvider } from './contexts/ThemeContext';
import { useAnimatedPresence } from './hooks/useAnimatedPresence';
import { useCategories } from './hooks/useCategories';
import { useClipboard } from './hooks/useClipboard';
import { usePrompts } from './hooks/usePrompts';
import { useSearchWithDebounce } from './hooks/useSearchWithDebounce';
import { useToast } from './hooks/useToast';
import { ALL_PROMPTS } from './services/libraryFilter';
import { onLibraryReviewRequested, takePendingLibraryReview } from './services/libraryReview';
import { MOTION } from './theme/motion';
import type { AppError, Category, DeletedCategory, LibraryFilter, Prompt } from './types';
import { Logger, toError } from './utils';
import { cn } from './utils/cn';

/** The editor, open over the Library: writing a new Prompt, or editing one */
/** A new Prompt can open with a title and a Category: Create it, from a search that found nothing */
type EditorState = { mode: 'add'; title?: string; category?: string } | { mode: 'edit'; prompt: Prompt };

/** What the Notification says once the editor has closed after a save */
interface SavedNotice {
  message: string;
  sub: string;
}

/** How long the Notification of a deleted Category stays, so its Undo can be reached */
const UNDO_DURATION_MS = 6000;

/** A Category name refused (by Admission, or taken): the Category sheet shows why, so no failure Notification */
const isRefusal = (error: AppError): boolean => error.type === 'VALIDATION_ERROR';

interface AppProps {
  context?: 'popup' | 'sidepanel';
}

const App: FC<AppProps> = ({ context = 'popup' }) => {
  // Check if we're in picker mode
  const urlParams = new URLSearchParams(window.location.search);
  const isPickerMode = urlParams.get('picker') === 'true';
  
  const [currentView, setCurrentView] = useState<Section>(isPickerMode ? 'settings' : 'library');
  // Arriving on a Section slides it in from the side of its tab; the first Section shows at once
  const [sectionMotion, setSectionMotion] = useState<'forward' | 'back' | null>(null);
  // The editor rises as a sheet over the Section and leaves to the bottom: it stays in the
  // document for its exit animation, then unmounts
  const [editor, setEditor] = useState<EditorState | null>(null);
  const editorSheet = useAnimatedPresence(editor, MOTION.sheetOut);
  // One instance per opening: reopening while the sheet leaves starts from a blank editor
  const [editorKey, setEditorKey] = useState(0);
  // What had the keyboard when the editor opened (New, or Edit on a card): it gets it back once the sheet has left
  const editorTriggerRef = useRef<HTMLElement | null>(null);
  // The Notification of a save, shown when the editor closes, with the sheet
  const savedNoticeRef = useRef<SavedNotice | null>(null);
  // The Library filter lasts while the popup or side panel stays open, across Sections
  const [libraryFilter, setLibraryFilter] = useState<LibraryFilter>(ALL_PROMPTS);
  // Ask the Library to focus its active filter pill: after Review, or when the card that opened the
  // editor has left the list
  const [focusLibraryFilter, setFocusLibraryFilter] = useState(false);
  // The same in Analytics, when the Prompt opened from Most used has gone
  const [focusAnalytics, setFocusAnalytics] = useState(false);
  const handleAnalyticsFocused = useCallback(() => { setFocusAnalytics(false); }, []);
  // Why the last save or Settings import was refused for lack of storage: the storage warning shows it
  const [storageRefusal, setStorageRefusal] = useState<string | null>(null);
  // The Category sheet is open: the tab bar is out of reach behind it
  const [categorySheetOpen, setCategorySheetOpen] = useState(false);
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
    restoreCategory,
    refreshCategories
  } = useCategories();

  const { copyToClipboard } = useClipboard();
  const { toast, showToast, hideToast, pauseToast, resumeToast, settings, settingsLoaded, updateSettings } = useToast();

  // Initialize search with debounce functionality using optimistic prompts
  const searchWithDebounce = useSearchWithDebounce(optimisticPrompts);

  const openEditor = (next: EditorState) => {
    editorTriggerRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    setEditorKey(key => key + 1);
    setEditor(next);
  };

  const handleAddNew = () => { openEditor({ mode: 'add' }); };

  const handleCreateFromSearch = (title: string, category?: string) => { openEditor({ mode: 'add', title, category }); };

  const handleEditPrompt = (prompt: Prompt) => { openEditor({ mode: 'edit', prompt }); };

  const editorShown = editorSheet.shown !== null;
  useEffect(() => {
    if (editorShown) { return; }
    const trigger = editorTriggerRef.current;
    editorTriggerRef.current = null;
    if (trigger?.isConnected) {
      trigger.focus();
    } else if (trigger && currentView === 'library') {
      // Deleted, or edited out of the active Library filter: focus goes to that filter's pill
      setFocusLibraryFilter(true);
    } else if (trigger && currentView === 'analytics') {
      // Deleted from a Most used row: focus goes to the rows left
      setFocusAnalytics(true);
    }
  }, [editorShown, currentView]);

  const handleDeletePrompt = async (id: string) => {
    const title = prompts.find(p => p.id === id)?.title;
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
      showToast('Prompt deleted', 'success', { sub: title });
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

      showToast("Couldn't delete Prompt", 'error', { sub: title });
    }
  };

  const handleDeleteFromEdit = (id: string) => {
    setEditor(null);
    void handleDeletePrompt(id);
  };

  const handleTogglePin = useCallback((id: string) => {
    togglePin(id).catch((err: unknown) => {
      Logger.error('Failed to toggle pin', toError(err), {
        component: 'App',
        promptId: id,
        operation: 'togglePin'
      });
      showToast("Couldn't update pin", 'error');
    });
  }, [togglePin, showToast]);

  const handleCopyPrompt = async (prompt: Prompt) => {
    const success = await copyToClipboard(prompt.content);
    if (success) {
      showToast('Prompt copied', 'success', { sub: prompt.title });
    } else {
      showToast("Couldn't copy Prompt", 'error', { sub: prompt.title });
    }
  };

  const handleFormSubmit = async (data: { title: string; content: string; category: string }) => {
    // The form calls this before Save is disabled, so Save (or the field) still has the keyboard
    const trigger = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    try {
      if (editor?.mode === 'edit') {
        await updatePrompt(editor.prompt.id, data);
        Logger.info('Prompt updated successfully', {
          component: 'App',
          operation: 'updatePrompt',
          promptId: editor.prompt.id,
          category: data.category
        });
        savedNoticeRef.current = { message: 'Prompt saved', sub: data.title };
      } else {
        await createPrompt(data);
        Logger.info('Prompt created successfully', {
          component: 'App',
          operation: 'createPrompt',
          category: data.category
        });
        savedNoticeRef.current = { message: 'Prompt created', sub: data.title };
      }
      // The editor shows "Saved", then closes itself (onClose), and the Notification comes with the close
    } catch (error: unknown) {
      const appError = error as AppError;
      Logger.error('Failed to save prompt', toError(appError), {
        component: 'App',
        operation: editor?.mode === 'edit' ? 'updatePrompt' : 'createPrompt',
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

  const handleEditorClose = () => {
    setEditor(null);
    const notice = savedNoticeRef.current;
    savedNoticeRef.current = null;
    if (notice) {
      showToast(notice.message, 'success', { sub: notice.sub });
    }
  };

  // From the Category sheet: a refusal is shown in the sheet, a full storage opens the storage
  // warning, which gives the keyboard back to `trigger`; the AppError goes back to the sheet
  const handleCreateCategory = async (categoryData: { name: string; color: string }, trigger: HTMLElement | null): Promise<Category> => {
    try {
      const created = await createCategory(categoryData);
      showToast('Category created', 'success', { sub: created.name });
      return created;
    } catch (error: unknown) {
      const appError = error as AppError;
      if (appError.type === 'STORAGE_QUOTA_EXCEEDED') {
        storageRefusalTriggerRef.current = trigger;
        setStorageRefusal(appError.message || 'Failed to create category');
      } else if (!isRefusal(appError)) {
        showToast("Couldn't create Category", 'error', { sub: appError.message });
      }
      throw error;
    }
  };

  // From the editor's "New category": the editor shows a refusal itself, so only a full storage
  // opens the storage warning, and success has its toast like in Categories
  const handleCreateCategoryFromEditor = async (categoryData: { name: string; color: string }): Promise<Category> => {
    const trigger = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    try {
      const created = await createCategory(categoryData);
      showToast('Category created', 'success', { sub: created.name });
      return created;
    } catch (error: unknown) {
      const appError = error as AppError;
      if (appError.type === 'STORAGE_QUOTA_EXCEEDED') {
        storageRefusalTriggerRef.current = trigger;
        setStorageRefusal(appError.message || 'Failed to create category');
      }
      throw new Error(appError.message || 'Failed to create category');
    }
  };

  const handleUpdateCategory = async (id: string, updates: Partial<{ name: string; color?: string }>) => {
    try {
      const updated = await updateCategory(id, updates);
      // Refresh prompts to show the updated category names
      if (updates.name !== undefined) {
        await refreshPrompts();
      }
      showToast('Category saved', 'success', { sub: updated.name });
    } catch (error: unknown) {
      const appError = error as AppError;
      if (!isRefusal(appError)) {
        showToast("Couldn't save Category", 'error', { sub: appError.message });
      }
      throw error;
    }
  };

  // Undo of a deletion: the Category comes back with its Prompts
  const handleRestoreCategory = async (deleted: DeletedCategory) => {
    try {
      await restoreCategory(deleted);
      await refreshPrompts();
    } catch (error: unknown) {
      showToast("Couldn't restore Category", 'error', { sub: toError(error).message });
    }
  };

  const handleDeleteCategory = async (category: Category) => {
    try {
      const deleted = await deleteCategory(category.id);
      // Refresh prompts to show them as Uncategorized after category deletion
      await refreshPrompts();
      showToast('Category deleted', 'success', {
        sub: category.name,
        duration: UNDO_DURATION_MS,
        action: { label: 'Undo', onClick: () => { void handleRestoreCategory(deleted); } }
      });
    } catch (error) {
      showToast("Couldn't delete Category", 'error', { sub: category.name });
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
    setSectionMotion(SECTION_ORDER.indexOf(section) > SECTION_ORDER.indexOf(currentView) ? 'forward' : 'back');
    setCurrentView(section);
  }, [currentView, refreshPrompts, refreshCategories]);

  // Cmd/Ctrl+K, from any Section: back to the Library if need be, and the keyboard goes into its search
  // field. Not while the editor or a dialog is open over the Section, nor in the element picker's Settings
  const [focusSearch, setFocusSearch] = useState(false);
  const handleSearchFocused = useCallback(() => { setFocusSearch(false); }, []);
  const editorOpen = editor !== null;
  useEffect(() => {
    if (isPickerMode) { return; }
    const handleKeyDown = (event: KeyboardEvent) => {
      if (!(event.metaKey || event.ctrlKey) || event.altKey || event.shiftKey || event.key.toLowerCase() !== 'k') { return; }
      if (editorOpen || document.querySelector('[aria-modal="true"]')) { return; }
      event.preventDefault();
      handleSelectSection('library');
      setFocusSearch(true);
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => { document.removeEventListener('keydown', handleKeyDown); };
  }, [isPickerMode, editorOpen, handleSelectSection]);

  // Tidy up in Analytics: the Library on the Prompts to review, with no search hiding any of them
  // Review's button leaves with Analytics, so focus lands on the review filter's pill
  const { clearSearch } = searchWithDebounce;
  const handleLibraryFilterFocused = useCallback(() => { setFocusLibraryFilter(false); }, []);
  // The Library is read again first: Analytics counts Insertions stored since this surface opened
  const handleReviewPrompts = useCallback((filter: LibraryFilter) => {
    clearSearch();
    void refreshPrompts();
    setLibraryFilter(filter);
    setFocusLibraryFilter(true);
    handleSelectSection('library');
  }, [clearSearch, refreshPrompts, handleSelectSection]);

  // A review asked from the full-page Analytics view opens the side panel and waits in session
  // storage: the side panel takes it, on opening or while it is already open
  useEffect(() => {
    if (context !== 'sidepanel') { return; }
    const apply = (): void => {
      takePendingLibraryReview()
        .then(filter => { if (filter) { handleReviewPrompts(filter); } })
        .catch((err: unknown) => { Logger.error('Could not read the pending review', toError(err), { component: 'App' }); });
    };
    apply();
    return onLibraryReviewRequested(apply);
  }, [context, handleReviewPrompts]);

  // "Import a backup" of the empty Library: Settings opens with the keyboard on its Import button,
  // where the import's report and the storage warning already show
  const [focusImport, setFocusImport] = useState(false);
  const handleImportFocused = useCallback(() => { setFocusImport(false); }, []);
  const handleImportBackup = useCallback(() => {
    handleSelectSection('settings');
    setFocusImport(true);
  }, [handleSelectSection]);

  // "Go to the library" of the empty Analytics
  // The button leaves with Analytics: the keyboard goes to the active Library filter, as for a review
  const handleGoToLibrary = useCallback(() => {
    setFocusLibraryFilter(true);
    handleSelectSection('library');
  }, [handleSelectSection]);

  const handleExpandDashboard = useCallback(() => {
    // Open full analytics dashboard in a new tab
    void chrome.tabs.create({ url: chrome.runtime.getURL('src/analytics.html') });
  }, []);

  // A Settings import stopped by storage: like a refused save, it opens the storage warning, and
  // what had the keyboard (Import) gets it back when the warning closes
  const handleImportRefused = useCallback((reason: string) => {
    storageRefusalTriggerRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    setStorageRefusal(reason);
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

  if (promptsError) {
    return (
      <ThemeProvider>
        <div className="h-full w-full p-4 bg-app flex items-center justify-center">
          <div className="text-center">
            <h2 className="text-xl font-semibold text-danger mb-2">Error Loading Data</h2>
            <p className="text-secondary">{promptsError.message}</p>
          </div>
        </div>
        {/* A Notification stays: the Undo of a deletion whose Prompts could not be read again is in it */}
        <ToastContainer toast={toast} onDismiss={hideToast} onPause={pauseToast} onResume={resumeToast} />
      </ThemeProvider>
    );
  }

  return (
    <ThemeProvider>
      <div className={`h-full w-full bg-app section-scroll-scope relative flex flex-col ${context === 'sidepanel' ? 'sidepanel' : ''}`}>
      {/* The Section and the tab bar wait, out of reach, while the editor is open above them; they
          recede a little as it rises and come back as it leaves */}
      <div
        data-testid="editor-beneath"
        className={cn(
          // Clips the 26px of a Section sliding in from the side, which would make the popup scroll
          // sideways; clip, unlike a transform, leaves the fixed dialogs inside it on the viewport
          'flex flex-1 min-h-0 flex-col origin-top overflow-x-clip',
          editorSheet.shown && (editorSheet.exiting ? 'animate-recede-out' : 'animate-recede-in')
        )}
        inert={editor !== null}
      >
      {/* Keyed by the Section, so that every arrival plays its slide */}
      <div
        ref={sectionContentRef}
        key={currentView}
        data-testid="section"
        className={cn('flex-1 min-h-0', sectionMotion && `animate-section-${sectionMotion}`)}
      >
      {currentView === 'library' && (
        <LibraryView
          prompts={optimisticPrompts}
          categories={categories}
          searchWithDebounce={searchWithDebounce}
          libraryFilter={libraryFilter}
          onAddNew={handleAddNew}
          onImportBackup={handleImportBackup}
          onCreateFromSearch={handleCreateFromSearch}
          focusSearch={focusSearch}
          onSearchFocused={handleSearchFocused}
          onEditPrompt={handleEditPrompt}
          onTogglePin={handleTogglePin}
          onCopyPrompt={(prompt: Prompt) => { void handleCopyPrompt(prompt); }}
          showToast={showToast}
          onLibraryFilterChange={setLibraryFilter}
          focusLibraryFilter={focusLibraryFilter}
          onLibraryFilterFocused={handleLibraryFilterFocused}
          loading={loading}
          context={context}
        />
      )}

      {currentView === 'categories' && (
        <CategoryManager
          categories={categories}
          prompts={prompts}
          onCreateCategory={handleCreateCategory}
          onUpdateCategory={handleUpdateCategory}
          onDeleteCategory={handleDeleteCategory}
          // No Undo without Notifications: confirm while they are off, or not known to be on yet
          confirmDelete={!settings.enabled || !settingsLoaded}
          onSheetOpenChange={setCategorySheetOpen}
          context={context}
        />
      )}

      {currentView === 'settings' && (
        <SettingsView
          context={context}
          showToast={showToast}
          toastSettings={settings}
          onToastSettingsChange={updateSettings}
          onStorageRefused={handleImportRefused}
          focusImport={focusImport}
          onImportFocused={handleImportFocused}
        />
      )}

      {currentView === 'analytics' && (
        <AnalyticsTab
          onExpandDashboard={handleExpandDashboard}
          context={context}
          prompts={optimisticPrompts}
          onEditPrompt={handleEditPrompt}
          onReviewPrompts={handleReviewPrompts}
          onGoToLibrary={handleGoToLibrary}
          onAddNew={handleAddNew}
          takeFocus={focusAnalytics}
          onFocusTaken={handleAnalyticsFocused}
        />
      )}
      </div>

      <TabBar activeSection={currentView} onSelect={handleSelectSection} inert={categorySheetOpen} onNew={handleAddNew} />
      </div>

      {editorSheet.shown && (
        <div
          data-testid="editor-scrim"
          aria-hidden="true"
          className={cn('absolute inset-0 z-20 bg-backdrop backdrop-blur-sm pointer-events-none', editorSheet.exiting ? 'animate-scrim-out' : 'animate-scrim-in')}
        />
      )}

      {editorSheet.shown && (
        <div
          data-testid="editor-sheet"
          inert={editorSheet.exiting}
          // Its own scroll scope: the editor's header line follows the editor's scrolling, not the Section's
          className={cn('absolute inset-0 z-30 bg-card section-scroll-scope', editorSheet.exiting ? 'animate-sheet-out' : 'animate-sheet-in')}
        >
          <PromptEditor
            key={editorKey}
            prompt={editorSheet.shown.mode === 'edit' ? editorSheet.shown.prompt : undefined}
            initialTitle={editorSheet.shown.mode === 'add' ? editorSheet.shown.title : undefined}
            initialCategory={editorSheet.shown.mode === 'add' ? editorSheet.shown.category : undefined}
            categories={categories}
            library={prompts}
            onSubmit={handleFormSubmit}
            onClose={handleEditorClose}
            onDelete={editorSheet.shown.mode === 'edit' ? handleDeleteFromEdit : undefined}
            onCreateCategory={handleCreateCategoryFromEditor}
          />
        </div>
      )}

      {storageRefusal !== null && (
        <StorageWarning reason={storageRefusal} onClose={handleCloseStorageWarning} />
      )}

      <ToastContainer toast={toast} onDismiss={hideToast} onPause={pauseToast} onResume={resumeToast} />
      </div>
    </ThemeProvider>
  );
};

export default App;
