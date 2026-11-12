import type { RefObject } from 'react';

import type { ShowToast, UseSearchWithDebounceReturn } from './hooks';

import type { Category, LibraryFilter, Prompt } from './index';

// Shared toast type for consistent usage across components
export type ToastType = 'success' | 'error' | 'info' | 'warning';

// Component prop interfaces
export interface PromptCardProps {
  prompt: Prompt;
  categories: Category[];
  onEdit: (prompt: Prompt) => void;
  onCopy: (prompt: Prompt) => void;
  onTogglePin: (id: string) => void;
  showToast: ShowToast;
  isSelected?: boolean;
  searchQuery?: string;
}

export interface SearchBarProps {
  value: string;
  onChange: (value: string) => void;
  onClear: () => void;
  placeholder?: string;
  /** The field, for whoever moves the keyboard into it (the search shortcut) */
  inputRef?: RefObject<HTMLInputElement | null>;
}

export interface SearchEmptyStateProps {
  /** The search that found nothing, as it is shown and as Create it titles the new Prompt */
  query: string;
  /** Opens the editor on a new Prompt titled with the search */
  onCreate: () => void;
  /** The active Library filter, when it is not All: the search looked only inside it */
  filterLabel?: string;
  /** Searches the whole Library instead; given with filterLabel */
  onSearchAll?: () => void;
}

export interface PromptEditorProps {
  /** The Prompt to edit; omit to write a new one (or open a Share code) */
  prompt?: Prompt;
  /** A new Prompt starts with this title (Create it, from a search that found nothing) */
  initialTitle?: string;
  /** A new Prompt starts in this Category (the active Library filter) rather than the default one */
  initialCategory?: string;
  categories: Category[];
  /** The Prompts of the Library, to point out one the text looks like */
  library?: readonly Prompt[];
  /** Saves the Prompt; rejects with the reason when it is refused, and the editor stays open */
  onSubmit: (data: { title: string; content: string; category: string }) => Promise<void> | void;
  /** Leaves the editor: after a save, or on Cancel */
  onClose: () => void;
  /** Deletes the edited Prompt (edit only) */
  onDelete?: (id: string) => void;
  /** Creates a Category from the editor and resolves to it as stored */
  onCreateCategory?: (category: { name: string; color: string }) => Promise<Category>;
}

export interface LibraryViewProps {
  prompts: Prompt[];
  categories: Category[];
  searchWithDebounce: UseSearchWithDebounceReturn;
  libraryFilter: LibraryFilter;
  onAddNew: () => void;
  /** Opens the editor on a new Prompt titled with a search that found nothing, in the Category of the active Library filter if it is one */
  onCreateFromSearch: (title: string, category?: string) => void;
  /** Move the keyboard into the search field (the search shortcut), then call onSearchFocused */
  focusSearch?: boolean;
  onSearchFocused?: () => void;
  onEditPrompt: (prompt: Prompt) => void;
  onTogglePin: (id: string) => void;
  onCopyPrompt: (prompt: Prompt) => void;
  showToast: ShowToast;
  onLibraryFilterChange: (filter: LibraryFilter) => void;
  /** Move focus to the active Library filter pill (arriving from Review in Analytics), then call onLibraryFilterFocused */
  focusLibraryFilter?: boolean;
  onLibraryFilterFocused?: () => void;
  loading?: boolean;
  context?: 'popup' | 'sidepanel';
}

export interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
}

export interface ConfirmDialogProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  onConfirm: () => void;
  onCancel: () => void;
}

