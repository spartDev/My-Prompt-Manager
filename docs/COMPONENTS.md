# Component Catalog

**Version:** 1.5.0
**Last Updated:** 2025-10-09

This document provides a comprehensive catalog of all React components in the My Prompt Manager extension, including their purposes, APIs, and usage patterns.

---

## Table of Contents

- [Overview](#overview)
- [Component Hierarchy](#component-hierarchy)
- [View Components](#view-components)
- [Core Components](#core-components)
- [Form Components](#form-components)
- [UI Primitives](#ui-primitives)
- [Settings Components](#settings-components)
- [Icon Components](#icon-components)
- [Utility Components](#utility-components)

---

## Overview

The extension includes **40+ React components** organized using atomic design principles:

```
Components Architecture:
┌─────────────────────────────────────────┐
│  Views (Orchestrators)                  │
│  - LibraryView, SettingsView            │
└─────────────────┬───────────────────────┘
                  │
┌─────────────────▼───────────────────────┐
│  Core Components                        │
│  - PromptCard, ViewHeader, Forms        │
└─────────────────┬───────────────────────┘
                  │
┌─────────────────▼───────────────────────┐
│  UI Primitives                          │
│  - SearchBar, ColorPicker, Buttons      │
└─────────────────────────────────────────┘
```

---

## Component Hierarchy

### Directory Structure

```
src/components/
├── LibraryView.tsx              # Main prompt library
├── SettingsView.tsx             # Settings interface
├── ViewHeader.tsx               # Unified header (667 lines)
├── PromptCard.tsx               # Prompt display card
├── AddPromptForm.tsx            # Create prompt form
├── EditPromptForm.tsx           # Edit prompt form
├── CategoryManager.tsx          # Category CRUD
│
├── SearchBar.tsx                # Search input
├── CategoryFilter.tsx           # Category dropdown
├── ColorPicker.tsx              # Color selection widget
├── ConfirmDialog.tsx            # Confirmation modal
├── ToastContainer.tsx           # Notification system
├── ThemeToggle.tsx              # Dark/light mode toggle
├── StorageWarning.tsx           # Storage quota warning
├── InterfaceModeSelector.tsx    # Popup/sidepanel mode
├── ErrorBoundary.tsx            # Error handling
│
├── settings/                    # 12 settings components
│   ├── SettingsSection.tsx      # Section wrapper
│   ├── AppearanceSection.tsx    # Theme & interface settings
│   ├── DataStorageSection.tsx   # Import/export/clear data
│   ├── SiteIntegrationSection.tsx # Custom site management
│   ├── NotificationSection.tsx  # Toast preferences
│   ├── AboutSection.tsx         # Version & reset
│   ├── AdvancedSection.tsx      # Debug mode
│   ├── ToggleSwitch.tsx         # Reusable toggle
│   ├── SiteCard.tsx             # Site integration card
│   ├── AddCustomSiteCard.tsx    # Add site button
│   ├── ConfigurationPreview.tsx # Import preview modal
│   ├── ImportSection.tsx        # Import config flow
│   └── ExportButton.tsx         # Export functionality
│
└── icons/                       # Icon components
    ├── HeaderIcons.tsx          # Logo, Add, Edit, Settings
    └── SiteIcons.tsx            # Platform icons (Claude, ChatGPT, etc.)
```

---

## View Components

### LibraryView

**Purpose:** Main view for browsing, searching, and managing prompts.

**Props:**
```typescript
interface LibraryViewProps {
  prompts: Prompt[];
  categories: Category[];
  onAddPrompt: () => void;
  onEditPrompt: (prompt: Prompt) => void;
  onDeletePrompt: (id: string) => void;
  onOpenSettings: () => void;
}
```

**Key Features:**
- Search with debouncing (300ms delay)
- Category filtering
- Prompt CRUD operations
- Loading state management
- Empty state UI

**Usage:**
```tsx
<LibraryView
  prompts={prompts}
  categories={categories}
  onAddPrompt={handleAddPrompt}
  onEditPrompt={handleEditPrompt}
  onDeletePrompt={handleDeletePrompt}
  onOpenSettings={handleOpenSettings}
/>
```

**State Management:**
- Uses `useSearchWithDebounce` hook
- Local state for filtering
- Delegates CRUD to parent

**File:** `src/components/LibraryView.tsx`

---

### SettingsView

**Purpose:** Comprehensive settings interface for all extension configuration.

**Props:**
```typescript
interface SettingsViewProps {
  onBack: () => void;
}
```

**Sections:**
1. **Appearance** - Theme & interface mode
2. **Site Integration** - Manage enabled platforms
3. **Custom Sites** - Add/edit custom site configurations
4. **Data Storage** - Import/export/clear data
5. **Notifications** - Toast preferences
6. **Advanced** - Debug mode
7. **About** - Version info & reset

**Key Features:**
- Element picker for custom sites
- Import/export with validation
- Storage quota monitoring
- Settings persistence

**File:** `src/components/SettingsView.tsx`

---

## Core Components

### ViewHeader

**Purpose:** Unified, flexible header component for all views.

**Architecture:**
- **667 lines** of sophisticated logic
- **Compound component pattern** with subcomponents
- **Hybrid API**: Legacy callbacks + modern composition

**API:**

**Basic Usage (Legacy):**
```tsx
<ViewHeader
  icon="logo"
  title="My Prompts"
  onSettings={handleSettings}
/>
```

**Composable Usage (Modern):**
```tsx
<ViewHeader icon="logo" title="My Prompts">
  <ViewHeader.Actions>
    <ViewHeader.SettingsButton onClick={handleSettings} />
    <button>Custom Action</button>
  </ViewHeader.Actions>
</ViewHeader>
```

**Subcomponents:**
- `ViewHeader.Actions` - Action button container
- `ViewHeader.BackButton` - Back navigation
- `ViewHeader.SettingsButton` - Settings action
- `ViewHeader.CloseButton` - Close action

**Props:**
```typescript
interface ViewHeaderProps {
  icon?: IconType | ReactElement;
  title: string;
  onBack?: () => void;
  onSettings?: () => void;
  onClose?: () => void;
  children?: ReactNode;
}

type IconType = 'logo' | 'add' | 'edit' | 'settings';
```

**Context Awareness:**
- Auto-detects popup vs. sidepanel mode
- Adjusts layout based on context
- Provides consistent UX across views

**File:** `src/components/ViewHeader.tsx:1-667`

---

### PromptCard

**Purpose:** Display individual prompt with actions.

**Key Features:**
- **Custom memo comparison** (`arePropsEqual`) for performance
- **XSS protection** via DOMPurify sanitization
- **Search highlighting** with stable React keys
- **Full keyboard navigation** with arrow keys
- **Dropdown menu** with accessibility
- **Icon-only action buttons** for clean, minimal design

**Props:**
```typescript
interface PromptCardProps {
  prompt: Prompt;
  onCopy: (id: string) => void;
  onEdit: (prompt: Prompt) => void;
  onDelete: (id: string) => void;
  categoryColor?: string;
  searchTerm?: string;
}
```

**Performance:**
```typescript
const arePropsEqual = (prev: Props, next: Props): boolean => {
  if (prev.prompt.id !== next.prompt.id) return false;
  if (prev.prompt.title !== next.prompt.title) return false;
  if (prev.prompt.content !== next.prompt.content) return false;
  // ... granular comparison
  return true;
};

export default memo(PromptCard, arePropsEqual);
```

**Security:**
```typescript
// XSS prevention
const sanitizedText = DOMPurify.sanitize(text, {
  ALLOWED_TAGS: [],
  ALLOWED_ATTR: []
});
```

**Actions:**
- **Copy button**: Icon-only design matching menu button aesthetics (gray with purple hover)
- **Menu button**: 3-dot dropdown for Edit/Delete actions
- Both buttons use consistent icon-button styling pattern for visual harmony

**File:** `src/components/PromptCard.tsx:1-357`

---

## Form Components

### AddPromptForm

**Purpose:** Create new prompts with validation.

**Props:**
```typescript
interface AddPromptFormProps {
  onSave: (data: PromptFormData) => Promise<void>;
  onCancel: () => void;
  categories: Category[];
}
```

**Validation:**
- Title: 100 characters max (optional)
- Content: 10,000 characters max (required)
- Category: Must exist in category list

**Features:**
- Real-time character counts
- Keyboard shortcuts (Ctrl+Enter to submit)
- Loading states during submission
- Error display

**File:** `src/components/AddPromptForm.tsx`

---

### EditPromptForm

**Purpose:** Edit existing prompts.

**Props:**
```typescript
interface EditPromptFormProps {
  prompt: Prompt;
  onSave: (id: string, updates: Partial<Prompt>) => Promise<void>;
  onCancel: () => void;
  categories: Category[];
}
```

**Differences from AddPromptForm:**
- Pre-populates form with existing data
- Shows current values
- Updates instead of creates

**File:** `src/components/EditPromptForm.tsx`

---

### CategoryManager

**Purpose:** Full CRUD for categories.

**Features:**
- Create new categories
- Edit category names and colors
- Delete categories (with prompt reassignment)
- Duplicate name validation
- Color picker integration

**Props:**
```typescript
interface CategoryManagerProps {
  categories: Category[];
  onCreate: (data: CategoryFormData) => Promise<void>;
  onUpdate: (id: string, updates: Partial<Category>) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}
```

**File:** `src/components/CategoryManager.tsx`

---

## UI Primitives

### SearchBar

**Purpose:** Search input with debouncing.

**Props:**
```typescript
interface SearchBarProps {
  value: string;
  onChange: (value: string) => void;
  onClear: () => void;
  placeholder?: string;
}
```

**Features:**
- Debounced input (via parent hook)
- Clear button
- Search icon
- Accessibility (role="searchbox")

**Memo:** Custom comparison to prevent unnecessary re-renders

**File:** `src/components/SearchBar.tsx`

---

### ColorPicker

**Purpose:** Category color selection widget.

**Props:**
```typescript
interface ColorPickerProps {
  value: string;
  onChange: (color: string) => void;
  colors: Color[];
  compact?: boolean;
}
```

**Features:**
- 18 preset colors from `src/constants/colors.ts`
- Custom hex input
- Compact mode for smaller spaces
- Validation

**File:** `src/components/ColorPicker.tsx`

---

### ConfirmDialog

**Purpose:** Modal confirmation for destructive actions.

**Props:**
```typescript
interface ConfirmDialogProps {
  isOpen: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  isDangerous?: boolean;
}
```

**Features:**
- Focus trapping
- Keyboard navigation (Enter/Escape)
- Backdrop click to cancel
- Danger variant (red button)

**File:** `src/components/ConfirmDialog.tsx`

---

### ToastContainer

**Purpose:** Global notification system.

**Props:**
```typescript
interface ToastContainerProps {
  toasts: Toast[];
  position: ToastPosition;
  onDismiss: (id: string) => void;
}
```

**Features:**
- Auto-dismiss timers
- Icon mapping (success, error, warning, info)
- **Custom memo comparison**
- Accessibility (role="status", aria-live)
- Progress bar animation

**Memo:**
```typescript
const areToastContainerPropsEqual = (prev: Props, next: Props): boolean => {
  if (prev.toasts.length !== next.toasts.length) return false;
  if (prev.position !== next.position) return false;
  for (let i = 0; i < prev.toasts.length; i++) {
    if (prev.toasts[i].id !== next.toasts[i].id) return false;
  }
  return true;
};
```

**File:** `src/components/ToastContainer.tsx`

---

### StorageWarning

**Purpose:** Alert users when approaching storage quota.

**Props:**
```typescript
interface StorageWarningProps {
  usagePercent: number;
  onClearData: () => void;
}
```

**Display Conditions:**
- Shows when usage > 80%
- Critical warning at > 95%

**File:** `src/components/StorageWarning.tsx`

---

## Settings Components

### ToggleSwitch

**Purpose:** Reusable toggle switch for boolean settings.

**Props:**
```typescript
interface ToggleSwitchProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  label?: string;
}
```

**Design:**
- Purple-indigo gradient when enabled
- Gray when disabled
- Smooth animation (200ms transition)
- Focus ring for accessibility

**File:** `src/components/settings/ToggleSwitch.tsx`

---

### SiteCard

**Purpose:** Display single site integration with toggle.

**Props:**
```typescript
interface SiteCardProps {
  site: string;
  enabled: boolean;
  onToggle: (site: string, enabled: boolean) => void;
  icon: ReactElement;
  name: string;
  description: string;
}
```

**File:** `src/components/settings/SiteCard.tsx`

---

### ConfigurationPreview

**Purpose:** Preview imported custom site configuration.

**Props:**
```typescript
interface ConfigurationPreviewProps {
  config: CustomSiteConfiguration;
  onConfirm: () => void;
  onCancel: () => void;
}
```

**Features:**
- Shows all configuration fields
- Conflict detection
- Security validation warnings

**File:** `src/components/settings/ConfigurationPreview.tsx`

---

## Icon Components

All icons are inline SVG components for zero external dependencies.

### Header Icons

From `src/components/icons/HeaderIcons.tsx`:

- **LogoIcon** - Extension logo (purple-indigo gradient)
- **AddIcon** - Plus icon for creating prompts
- **EditIcon** - Pencil icon for editing
- **SettingsIcon** - Gear icon for settings

**Usage:**
```tsx
import { LogoIcon, AddIcon } from './icons/HeaderIcons';

<LogoIcon className="h-10 w-10" />
<AddIcon className="h-5 w-5" />
```

---

### Site Icons

From `src/components/icons/SiteIcons.tsx`:

- **ClaudeIcon** - Claude.ai logo
- **ChatGPTIcon** - ChatGPT logo (green)
- **GeminiIcon** - Google Gemini logo (gradient)
- **MistralIcon** - Mistral.ai logo (orange)
- **PerplexityIcon** - Perplexity logo (blue)
- **CustomSiteIcon** - First letter in styled div

**Props:**
```typescript
interface SiteIconProps {
  className?: string;
  disabled?: boolean;
}
```

**Usage:**
```tsx
import { ClaudeIcon, ChatGPTIcon } from './icons/SiteIcons';

<ClaudeIcon className="h-6 w-6" disabled={false} />
```

---

## Utility Components

### ErrorBoundary

**Purpose:** Catch and display React errors gracefully.

**Props:**
```typescript
interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactElement;
}
```

**Features:**
- Catches errors in child component tree
- Displays fallback UI
- Logs error details
- Prevents app crash

**File:** `src/components/ErrorBoundary.tsx`

---

## Component Patterns

### Performance Optimization

**Custom Memo Comparisons:**

Used in:
- `PromptCard` - Prevents re-renders on unrelated prop changes
- `ToastContainer` - Prevents re-renders when toast list unchanged
- `SearchBar` - Prevents re-renders on parent state changes
- `CategoryFilter` - Prevents re-renders on category list

**Pattern:**
```typescript
const arePropsEqual = (prevProps: Props, nextProps: Props): boolean => {
  // Only compare props that actually affect rendering
  if (prevProps.id !== nextProps.id) return false;
  if (prevProps.title !== nextProps.title) return false;
  // etc...
  return true;
};

export default memo(Component, arePropsEqual);
```

---

### Accessibility Patterns

All components follow WCAG AA standards:

**Semantic HTML:**
```tsx
<article aria-labelledby={`prompt-${id}`}>
  <h3 id={`prompt-${id}`}>Title</h3>
</article>
```

**Keyboard Navigation:**
```tsx
<button
  onKeyDown={(e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      handleClick();
    }
  }}
>
```

**ARIA Labels:**
```tsx
<button aria-label="Copy prompt to clipboard">
  <svg aria-hidden="true">{/* Icon */}</svg>
</button>
```

---

### State Management

**Local State Pattern:**
```tsx
const [loading, setLoading] = useState(false);
const [error, setError] = useState<string | null>(null);

const handleSubmit = async () => {
  setLoading(true);
  setError(null);
  try {
    await onSave(data);
  } catch (err) {
    setError((err as Error).message);
  } finally {
    setLoading(false);
  }
};
```

---

## Testing

All components are tested with React Testing Library.

**Test Categories:**
1. **Rendering Tests** - Component renders correctly
2. **Interaction Tests** - User interactions work
3. **State Tests** - State changes reflected in UI
4. **Accessibility Tests** - ARIA attributes present

**Example:**
```typescript
describe('PromptCard', () => {
  it('renders prompt title and content', () => {
    render(<PromptCard prompt={mockPrompt} {...handlers} />);
    expect(screen.getByText('Test Title')).toBeInTheDocument();
  });

  it('calls onCopy when copy button clicked', async () => {
    const onCopy = vi.fn();
    render(<PromptCard prompt={mockPrompt} onCopy={onCopy} {...} />);

    await userEvent.click(screen.getByLabelText('Copy'));
    expect(onCopy).toHaveBeenCalledWith(mockPrompt.id);
  });
});
```

---

## Design System Integration

All components adhere to design guidelines from `docs/DESIGN_GUIDELINES.md`:

- **Colors**: Purple-indigo gradient, predefined status colors
- **Typography**: text-sm (14px) for body, font-semibold for emphasis
- **Spacing**: p-5 for cards, p-6 for containers
- **Borders**: rounded-xl (12px) consistently
- **Effects**: backdrop-blur-xs with semi-transparent backgrounds
- **Dark Mode**: All components include dark: variants
- **Focus States**: Use predefined classes (.focus-primary, .focus-input)
- **Transitions**: transition-all duration-200

---

## Adding New Components

### Checklist

- [ ] Follow atomic design principles (place in correct directory)
- [ ] Use TypeScript with explicit prop interfaces
- [ ] Implement dark mode variants for all styles
- [ ] Add ARIA labels and semantic HTML
- [ ] Include keyboard navigation
- [ ] Use predefined focus classes
- [ ] Add custom memo comparison if needed
- [ ] Write comprehensive tests (15+ tests)
- [ ] Follow design guidelines (rounded-xl, backdrop-blur-sm, etc.)
- [ ] Document in this file

### Template

```tsx
import { memo, type FC } from 'react';

interface YourComponentProps {
  // Props here
}

const YourComponent: FC<YourComponentProps> = ({ ...props }) => {
  return (
    <div className="
      bg-white/70 dark:bg-gray-800/70 backdrop-blur-xs
      border border-purple-100 dark:border-gray-700
      rounded-xl p-5
      transition-all duration-200
    ">
      {/* Component content */}
    </div>
  );
};

// Optional custom memo
const arePropsEqual = (prev: YourComponentProps, next: YourComponentProps) => {
  // Compare only relevant props
  return prev.id === next.id;
};

export default memo(YourComponent, arePropsEqual);
```

---

## Quick Reference

### Most Used Components

| Component | Use Case | File |
|-----------|----------|------|
| `ViewHeader` | Page headers | `ViewHeader.tsx` |
| `PromptCard` | Display prompts | `PromptCard.tsx` |
| `SearchBar` | Search inputs | `SearchBar.tsx` |
| `ConfirmDialog` | Confirmations | `ConfirmDialog.tsx` |
| `ToastContainer` | Notifications | `ToastContainer.tsx` |
| `ToggleSwitch` | Boolean settings | `settings/ToggleSwitch.tsx` |
| `ColorPicker` | Color selection | `ColorPicker.tsx` |

### Component Counts

- **View Components**: 2 (LibraryView, SettingsView)
- **Core Components**: 8 (ViewHeader, PromptCard, Forms, etc.)
- **UI Primitives**: 8 (SearchBar, ColorPicker, etc.)
- **Settings Components**: 12 (sections, cards, toggles)
- **Icon Components**: 10+ (header icons, platform icons)
- **Total**: **40+ components**

---

**Last Updated:** 2025-10-09
**Version:** 1.5.0
