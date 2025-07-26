import { Prompt, Category } from './index';

// Component prop interfaces
export interface PromptCardProps {
  prompt: Prompt;
  categories: Category[];
  onEdit: (prompt: Prompt) => void;
  onDelete: (id: string) => void;
  onCopy: (content: string) => void;
  isSelected?: boolean;
  searchQuery?: string;
}

export interface SearchBarProps {
  value: string;
  onChange: (value: string) => void;
  onClear: () => void;
  placeholder?: string;
}

export interface CategoryFilterProps {
  categories: Category[];
  selectedCategory: string | null;
  onChange: (category: string | null) => void;
  showAll?: boolean;
}

export interface AddPromptFormProps {
  categories: Category[];
  onSubmit: (data: { title: string; content: string; category: string }) => void;
  onCancel: () => void;
  isLoading?: boolean;
}

export interface EditPromptFormProps {
  prompt: Prompt;
  categories: Category[];
  onSubmit: (data: { title: string; content: string; category: string }) => void;
  onCancel: () => void;
  isLoading?: boolean;
}

export interface LibraryViewProps {
  prompts: Prompt[];
  categories: Category[];
  searchQuery: string;
  selectedCategory: string | null;
  onAddNew: () => void;
  onEditPrompt: (prompt: Prompt) => void;
  onDeletePrompt: (id: string) => void;
  onCopyPrompt: (content: string) => void;
  onSearchChange: (query: string) => void;
  onCategoryChange: (category: string | null) => void;
  onManageCategories: () => void;
  loading?: boolean;
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