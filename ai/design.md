# Design Document

## Overview

The Chrome Extension Prompt Library is a browser extension that provides users with a personal repository for storing, organizing, and managing text prompts. The extension uses a popup-based interface accessible through the browser toolbar, with local data persistence using Chrome's storage APIs.

## Architecture

The extension follows Chrome's Manifest V3 architecture with the following components:

- **Popup Interface**: Primary user interface for interacting with the prompt library
- **Background Script**: Handles storage operations and extension lifecycle events
- **Content Scripts**: Not required for this extension as it operates independently of web pages
- **Storage Layer**: Uses Chrome's `chrome.storage.local` API for data persistence

### Technology Stack
- **Frontend**: React with TypeScript, Tailwind CSS
- **Storage**: Chrome Storage API
- **Build**: Vite with @crxjs/vite-plugin for Chrome extension development
- **Manifest**: Version 3

## Components and Interfaces

### 1. React Components

**Main Components:**
- **App Component** (`App.tsx`): Root component managing global state
- **LibraryView Component** (`LibraryView.tsx`): Default view showing saved prompts
- **AddPromptForm Component** (`AddPromptForm.tsx`): Form for creating new prompts
- **EditPromptForm Component** (`EditPromptForm.tsx`): Form for modifying existing prompts
- **PromptCard Component** (`PromptCard.tsx`): Individual prompt display with actions
- **SearchBar Component** (`SearchBar.tsx`): Search input with real-time filtering
- **CategoryFilter Component** (`CategoryFilter.tsx`): Category dropdown/filter

**Key UI Elements:**
- Search bar with real-time filtering (styled with Tailwind)
- Category dropdown/filter with custom styling
- Prompt cards with hover effects and action buttons
- Modal dialogs for add/edit forms
- Toast notifications for user feedback

### 2. Storage Manager (`storage.ts`)

**Interface:**
```typescript
interface Prompt {
  id: string;
  title: string;
  content: string;
  category: string;
  createdAt: number;
  updatedAt: number;
}

interface Category {
  id: string;
  name: string;
  color?: string;
}

class StorageManager {
  async savePrompt(prompt: Omit<Prompt, 'id' | 'createdAt' | 'updatedAt'>): Promise<Prompt>;
  async getPrompts(): Promise<Prompt[]>;
  async updatePrompt(id: string, prompt: Partial<Prompt>): Promise<Prompt>;
  async deletePrompt(id: string): Promise<void>;
  async getCategories(): Promise<Category[]>;
  async saveCategory(category: Omit<Category, 'id'>): Promise<Category>;
}
```

### 3. Prompt Manager (`promptManager.ts`)

**Interface:**
```typescript
class PromptManager {
  async createPrompt(title: string, content: string, category: string): Promise<Prompt>;
  async searchPrompts(query: string): Promise<Prompt[]>;
  async filterByCategory(category: string): Promise<Prompt[]>;
  generateTitle(content: string): string;
  validatePrompt(prompt: Partial<Prompt>): boolean;
}
```

### 4. React Hooks and Context (`hooks/`, `context/`)

**Custom Hooks:**
```typescript
// usePrompts.ts
const usePrompts = () => {
  const [prompts, setPrompts] = useState<Prompt[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  
  const createPrompt = async (prompt: Omit<Prompt, 'id' | 'createdAt' | 'updatedAt'>) => Promise<void>;
  const updatePrompt = async (id: string, updates: Partial<Prompt>) => Promise<void>;
  const deletePrompt = async (id: string) => Promise<void>;
  const searchPrompts = (query: string) => Prompt[];
  
  return { prompts, loading, createPrompt, updatePrompt, deletePrompt, searchPrompts };
};

// useCategories.ts
const useCategories = () => {
  const [categories, setCategories] = useState<Category[]>([]);
  const createCategory = async (category: Omit<Category, 'id'>) => Promise<void>;
  return { categories, createCategory };
};

// useClipboard.ts
const useClipboard = () => {
  const copyToClipboard = async (text: string) => Promise<void>;
  return { copyToClipboard };
};
```

**Context Providers:**
```typescript
// AppContext.tsx
interface AppContextType {
  prompts: Prompt[];
  categories: Category[];
  currentView: 'library' | 'add' | 'edit';
  selectedPrompt: Prompt | null;
}
```

## Data Models

### TypeScript Interfaces

```typescript
interface Prompt {
  id: string; // uuid-v4-string
  title: string; // max 100 chars
  content: string; // max 5000 chars
  category: string; // default: 'Uncategorized'
  createdAt: number; // timestamp
  updatedAt: number; // timestamp
}

interface Category {
  id: string; // uuid-v4-string
  name: string; // max 50 chars
  color?: string; // hex color code (optional)
}

interface Settings {
  defaultCategory: string;
  sortOrder: 'createdAt' | 'updatedAt' | 'title';
  viewMode: 'grid' | 'list';
}

interface StorageData {
  prompts: Prompt[];
  categories: Category[];
  settings: Settings;
}
```

## Error Handling

### Storage Errors
- **Quota Exceeded**: Show user notification and prevent new saves
- **Storage Unavailable**: Fallback to session storage with warning
- **Data Corruption**: Attempt to recover valid entries, show error for corrupted data

### User Input Validation
- **Empty Content**: Prevent saving prompts with empty content
- **Title Length**: Truncate or warn about titles exceeding limits
- **Content Length**: Warn users approaching storage limits

### Network/Extension Errors
- **Extension Context Lost**: Reload popup interface
- **Permission Denied**: Show appropriate error message
- **Update Conflicts**: Use last-write-wins strategy with user notification

## Testing Strategy

### Unit Tests
- Storage operations (save, retrieve, update, delete)
- Prompt validation and title generation
- Search and filtering functionality
- Data model validation

### Integration Tests
- End-to-end prompt creation workflow
- Category management workflow
- Search and filter combinations
- Storage persistence across browser sessions

### Manual Testing Scenarios
1. **Basic CRUD Operations**: Create, read, update, delete prompts
2. **Category Management**: Create categories, assign prompts, filter by category
3. **Search Functionality**: Search by title and content, verify highlighting
4. **Copy to Clipboard**: Verify clipboard functionality across different websites
5. **Data Persistence**: Verify data survives browser restart and extension updates
6. **Edge Cases**: Test with maximum content length, special characters, empty states
7. **Error Scenarios**: Test storage quota exceeded, corrupted data recovery

### Browser Compatibility
- Test on Chrome (primary target)
- Verify Manifest V3 compliance
- Test storage API functionality
- Verify popup behavior across different screen sizes

## Build Configuration

**Vite Configuration (`vite.config.ts`):**
- @crxjs/vite-plugin for Chrome extension development
- React plugin for JSX transformation
- TypeScript support with strict type checking
- Tailwind CSS integration
- Automatic manifest.json processing and validation
- Hot module replacement (HMR) support for extension development

**Build Process:**
- Vite development server with extension-specific HMR
- TypeScript compilation with React JSX support
- Tailwind CSS processing and optimization
- @crxjs/vite-plugin handles extension bundling and manifest processing
- Automatic content script and background script handling
- Generate source maps for debugging
- Live reloading during development

**Package Dependencies:**
- React 18+ with TypeScript
- @crxjs/vite-plugin for Chrome extension support
- Tailwind CSS with PostCSS
- Chrome extension types (@types/chrome)
- UUID library for ID generation
- Vite with React and TypeScript plugins

## Security Considerations

### Data Privacy
- All data stored locally using Chrome's storage API
- No external network requests or data transmission
- User data remains on their device

### Content Security Policy
- Implement strict CSP in manifest.json compatible with React
- Configure CSP to allow React's runtime requirements
- No inline scripts or eval() usage
- Sanitize user input to prevent XSS using React's built-in protections

### Permissions
- Minimal permissions requested (storage only)
- No host permissions required
- No content script injection needed