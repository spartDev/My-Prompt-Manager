import { UseSearchWithDebounceReturn } from './hooks';

import { Prompt, Category, SortOrder, SortDirection } from './index';

// Component prop interfaces
export interface PromptCardProps {
  prompt: Prompt;
  categories: Category[];
  onEdit: (prompt: Prompt) => void;
  onDelete: (id: string) => void;
  onCopy: (content: string) => void;
  showToast: (message: string, type: 'success' | 'error' | 'info' | 'warning') => void;
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
}

export interface LibraryViewProps {
  prompts: Prompt[];
  categories: Category[];
  searchWithDebounce: UseSearchWithDebounceReturn;
  selectedCategory: string | null;
  sortOrder: SortOrder;
  sortDirection: SortDirection;
  onAddNew: () => void;
  onEditPrompt: (prompt: Prompt) => void;
  onDeletePrompt: (id: string) => void;
  onCopyPrompt: (content: string) => void;
  showToast: (message: string, type: 'success' | 'error' | 'info' | 'warning') => void;
  onCategoryChange: (category: string | null) => void;
  onSortChange: (order: SortOrder, direction: SortDirection) => void;
  onManageCategories: () => void;
  onSettings: () => void;
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
  type: 'success' | 'error' | 'info';
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

export interface FilterSortControlsProps {
  categories: Category[];
  selectedCategory: string | null;
  sortOrder: SortOrder;
  sortDirection: SortDirection;
  onCategoryChange: (category: string | null) => void;
  onSortChange: (order: SortOrder, direction: SortDirection) => void;
  onManageCategories: () => void;
  loading?: boolean;
}