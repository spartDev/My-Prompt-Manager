import type { UseSearchWithDebounceReturn } from './hooks';

import type { Category, LibraryFilter, Prompt } from './index';

// Shared toast type for consistent usage across components
export type ToastType = 'success' | 'error' | 'info' | 'warning';

// Component prop interfaces
export interface PromptCardProps {
  prompt: Prompt;
  categories: Category[];
  onEdit: (prompt: Prompt) => void;
  onCopy: (content: string) => void;
  onTogglePin: (id: string) => void;
  showToast: (message: string, type: ToastType) => void;
  isSelected?: boolean;
  searchQuery?: string;
}

export interface SearchBarProps {
  value: string;
  onChange: (value: string) => void;
  onClear: () => void;
  placeholder?: string;
}

export interface AddPromptFormProps {
  categories: Category[];
  onSubmit: (data: { title: string; content: string; category: string }) => Promise<void> | void;
  onCancel: () => void;
}

export interface EditPromptFormProps {
  prompt: Prompt;
  categories: Category[];
  onSubmit: (data: { title: string; content: string; category: string }) => Promise<void> | void;
  onCancel: () => void;
  onDelete: (id: string) => void;
}

export interface LibraryViewProps {
  prompts: Prompt[];
  categories: Category[];
  searchWithDebounce: UseSearchWithDebounceReturn;
  libraryFilter: LibraryFilter;
  onAddNew: () => void;
  onEditPrompt: (prompt: Prompt) => void;
  onTogglePin: (id: string) => void;
  onCopyPrompt: (content: string) => void;
  showToast: (message: string, type: ToastType) => void;
  onLibraryFilterChange: (filter: LibraryFilter) => void;
  loading?: boolean;
  context?: 'popup' | 'sidepanel';
}

export interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
}

export interface ToastProps {
  message: string;
  type: ToastType;
  duration?: number;
  onClose: () => void;
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

