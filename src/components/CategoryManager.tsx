import type { AnimationEvent, FC } from 'react';
import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { flushSync } from 'react-dom';

import { DEFAULT_CATEGORY_COLOR, getColorName, nextCategoryColor } from '../constants/colors';
import { useCategorySheet } from '../hooks/useCategorySheet';
import { type AppError, type Category, DEFAULT_CATEGORY, type Prompt } from '../types';
import { cn, Logger, toError } from '../utils';

import CategorySheet from './CategorySheet';
import ConfirmDialog from './ConfirmDialog';
import ViewHeader from './ViewHeader';

interface CategoryManagerProps {
  categories: Category[];
  /** The Library's Prompts, to tell how many each Category holds */
  prompts: Prompt[];
  /**
   * Creates a Category and resolves to it as stored; rejects with the AppError when it is refused
   * or fails. `trigger` gets the keyboard back if a full storage warning opens.
   */
  onCreateCategory: (category: { name: string; color: string }, trigger: HTMLElement | null) => Promise<Category>;
  onUpdateCategory: (id: string, updates: Partial<Category>) => Promise<void>;
  /** Deletes a Category; the Notification that confirms it offers Undo */
  onDeleteCategory: (category: Category) => Promise<void>;
  /** Ask before deleting: there is no Undo, the Notifications being off */
  confirmDelete?: boolean;
  /** Told when the sheet opens and closes, so App can put what it draws outside this view (the tab bar) out of reach */
  onSheetOpenChange?: (open: boolean) => void;
  context?: 'popup' | 'sidepanel';
}

/** The Category a deletion leaves the keyboard to: the next editable one, else the one before */
const neighbourOf = (categories: Category[], deleted: Category): Category | undefined => {
  const editable = categories.filter(category => category.name !== DEFAULT_CATEGORY);
  const index = editable.findIndex(category => category.id === deleted.id);
  return editable[index + 1] ?? editable[index - 1];
};

const isStorageFull = (error: unknown): boolean =>
  (error as Partial<AppError> | null)?.type === 'STORAGE_QUOTA_EXCEEDED';

const prefersReducedMotion = (): boolean =>
  typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const PlusIcon = (
  <svg className="size-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" aria-hidden="true">
    <path d="M12 5v14M5 12h14" />
  </svg>
);

/**
 * The Categories section: the list of Categories, each one opening the Category sheet to rename,
 * recolor or delete it, and "Add category" below, which opens the sheet to create one.
 */
const CategoryManager: FC<CategoryManagerProps> = ({
  categories,
  prompts,
  onCreateCategory,
  onUpdateCategory,
  onDeleteCategory,
  confirmDelete = false,
  onSheetOpenChange,
  context = 'popup'
}) => {
  const listTitleId = useId();
  const addButtonRef = useRef<HTMLButtonElement>(null);
  const rowRefs = useRef(new Map<string, HTMLElement>());
  const [confirming, setConfirming] = useState<Category | null>(null);

  // A Category that appears in the list pops in: one created here once the sheet has gone, or one
  // back from Undo at once. The first list is the one already there, which does not pop.
  const [knownIds, setKnownIds] = useState<ReadonlySet<string>>(() => new Set(categories.map(c => c.id)));
  const [appearing, setAppearing] = useState<{ id: string; waiting: boolean } | null>(null);

  const reveal = useCallback((id: string) => {
    rowRefs.current.get(id)?.scrollIntoView({ block: 'nearest', behavior: prefersReducedMotion() ? 'auto' : 'smooth' });
  }, []);

  const sheet = useCategorySheet({
    onClosed: () => {
      setAppearing(prev => (prev?.waiting ? { id: prev.id, waiting: false } : prev));
    }
  });

  // Open, the sheet is the one dialog: App's tab bar goes out of reach with this view, until it closes
  // or this view goes away
  useEffect(() => {
    if (!sheet.isOpen) {return;}
    onSheetOpenChange?.(true);
    return () => { onSheetOpenChange?.(false); };
  }, [sheet.isOpen, onSheetOpenChange]);

  const currentIds = categories.map(category => category.id);
  if (currentIds.length !== knownIds.size || currentIds.some(id => !knownIds.has(id))) {
    const added = knownIds.size > 0 ? currentIds.find(id => !knownIds.has(id)) : undefined;
    setKnownIds(new Set(currentIds));
    if (added !== undefined) {
      setAppearing({ id: added, waiting: sheet.isMounted });
    }
  }

  // The list scrolls to the row as it pops, which may be below the fold
  useEffect(() => {
    if (appearing && !appearing.waiting) {
      reveal(appearing.id);
    }
  }, [appearing, reveal]);

  const handleAppeared = (event: AnimationEvent<HTMLElement>) => {
    if (event.animationName === 'category-pop') {
      setAppearing(null);
    }
  };

  // One deletion at a time: a second click would fail, and its failure Notification would replace
  // the one that offers Undo
  const deletingRef = useRef(false);

  const handleSubmit = async (): Promise<void> => {
    // A deletion runs and closes the sheet when it ends: there is nothing left to save
    if (deletingRef.current) {return;}
    const { name, color, category } = sheet;

    if (sheet.mode === 'create') {
      try {
        await onCreateCategory({ name, color }, addButtonRef.current);
      } catch (error) {
        // A full storage opens its own warning, which takes the place of the sheet
        if (isStorageFull(error)) {
          sheet.close();
          return;
        }
        throw error;
      }
      sheet.close();
      return;
    }

    if (!category) {return;}
    // Admission trims the name, so spaces around it are no change
    const updates: Partial<Category> = {
      ...(name.trim() !== category.name && { name }),
      ...(color !== (category.color || DEFAULT_CATEGORY_COLOR) && { color })
    };
    if (Object.keys(updates).length > 0) {
      await onUpdateCategory(category.id, updates);
    }
    sheet.close();
  };

  // While a deletion runs, the sheet that started it stays open: its end closes that sheet, not another
  const closeSheet = useCallback(() => {
    if (!deletingRef.current) {
      sheet.close();
    }
  }, [sheet.close]);

  const deleteNow = async (category: Category): Promise<void> => {
    if (deletingRef.current) {return;}
    deletingRef.current = true;
    const neighbour = neighbourOf(categories, category);
    try {
      await onDeleteCategory(category);
    } catch (error) {
      // The failure Notification says why; the sheet stays open
      Logger.error('Failed to delete category', toError(error), { component: 'CategoryManager' });
      return;
    } finally {
      deletingRef.current = false;
    }
    // Closed now, so the screen behind is no longer inert when it takes the focus
    flushSync(() => { sheet.close(); });
    // The row that opened the sheet is gone: the keyboard goes to the one that took its place
    (neighbour ? rowRefs.current.get(neighbour.id) : addButtonRef.current)?.focus();
  };

  const handleDelete = () => {
    const category = sheet.category;
    if (!category) {return;}
    if (confirmDelete) {
      setConfirming(category);
      return;
    }
    void deleteNow(category);
  };

  const handleConfirmDelete = () => {
    const category = confirming;
    setConfirming(null);
    if (category) {
      void deleteNow(category);
    }
  };

  const editedId = sheet.isMounted ? sheet.category?.id : undefined;
  const promptCount = sheet.category
    ? prompts.filter(prompt => prompt.category === sheet.category?.name).length
    : 0;

  const setRowRef = (id: string) => (element: HTMLElement | null) => {
    if (element) {
      rowRefs.current.set(id, element);
    } else {
      rowRefs.current.delete(id);
    }
  };

  return (
    // Behind the open sheet, out of reach: only the sheet's dialog is there for assistive technology.
    // Not during the exit, so the focus can go back to the row or button that opened it.
    <div className="h-full flex flex-col bg-app sheet-behind" data-stepped-back={sheet.isOpen ? '' : undefined} inert={sheet.isOpen}>
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

      {/* Content: the list card on bg-app, "Add category" below it */}
      <div className="flex-1 overflow-auto p-4 space-y-4" data-scroll-container>
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
                <p className="text-tertiary text-sm">No categories yet. Create your first category below!</p>
              </div>
            ) : (
              categories.map((category) => {
                const isDefault = category.name === DEFAULT_CATEGORY;
                const swatchColor = category.color || '#6B7280';
                const content = (
                  <span className="flex items-center space-x-4 flex-1">
                    <span
                      className="w-8 h-8 rounded-lg border border-default shadow-sm"
                      style={{ backgroundColor: swatchColor }}
                      title={getColorName(swatchColor)}
                    />
                    <span className="flex-1">
                      <span className="text-sm font-semibold text-primary">{category.name}</span>
                      {isDefault && (
                        <span className="ml-2 text-xs text-tertiary italic">Default</span>
                      )}
                    </span>
                  </span>
                );
                const rowProps = {
                  'data-testid': 'category-row',
                  'data-category-name': category.name,
                  onAnimationEnd: handleAppeared,
                  className: cn(
                    'relative flex w-full items-center justify-between p-5 text-left transition-colors duration-200',
                    appearing?.id === category.id && (appearing.waiting ? 'opacity-0' : 'category-pop')
                  )
                };

                // The default Category is neither renamed, recolored nor deleted
                if (isDefault) {
                  return (
                    <div key={category.id} ref={setRowRef(category.id)} {...rowProps}>
                      {content}
                    </div>
                  );
                }

                return (
                  <button
                    key={category.id}
                    ref={setRowRef(category.id)}
                    type="button"
                    aria-haspopup="dialog"
                    aria-label={`Edit category ${category.name}`}
                    onClick={() => { sheet.openEdit(category); }}
                    {...rowProps}
                    className={cn(rowProps.className, 'cursor-pointer hover:bg-muted focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent')}
                    // While the sheet edits it, the row keeps a border of its color, seen behind the backdrop
                    style={editedId === category.id ? { boxShadow: `inset 0 0 0 2px ${swatchColor}` } : undefined}
                  >
                    {content}
                  </button>
                );
              })
            )}
          </section>

          <button
            ref={addButtonRef}
            type="button"
            aria-haspopup="dialog"
            onClick={() => { sheet.openCreate(nextCategoryColor(categories)); }}
            className="flex w-full h-14 items-center justify-center gap-2 rounded-2xl border-[1.5px] border-dashed border-accent text-sm font-bold text-accent hover:bg-card transition-colors focus-interactive"
          >
            {PlusIcon}
            Add category
          </button>
      </div>

      {sheet.isMounted && (
        <CategorySheet
          key={sheet.session}
          mode={sheet.mode}
          open={sheet.isOpen}
          paused={confirming !== null}
          name={sheet.name}
          color={sheet.color}
          promptCount={promptCount}
          onNameChange={sheet.setName}
          onColorChange={sheet.setColor}
          onSubmit={handleSubmit}
          onDelete={handleDelete}
          onClose={closeSheet}
        />
      )}

      {/* With the Notifications off there is no Undo, so a deletion is confirmed first */}
      <ConfirmDialog
        isOpen={confirming !== null}
        onConfirm={handleConfirmDelete}
        onCancel={() => { setConfirming(null); }}
        title="Delete Category"
        message={confirming
          ? `Delete category "${confirming.name}"? All prompts in this category will be moved to "Uncategorized".`
          : ''
        }
        confirmText="Delete"
        cancelText="Cancel"
        variant="warning"
      />
    </div>
  );
};

export default CategoryManager;
