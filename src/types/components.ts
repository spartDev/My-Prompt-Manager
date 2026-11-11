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
}

export interface PromptEditorProps {
  /** The Prompt to edit; omit to write a new one (or open a Share code) */
  prompt?: Prompt;
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

