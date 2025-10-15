export interface Prompt {
  id: string; // uuid-v4-string
  title: string; // max 100 chars
  content: string; // max 10000 chars
  category: string; // default: 'Uncategorized'
  createdAt: number; // timestamp
  updatedAt: number; // timestamp
}

export interface Category {
  id: string; // uuid-v4-string
  name: string; // max 50 chars
  color?: string; // hex color code (optional)
}

export interface Settings {
  defaultCategory: string;
  sortOrder: 'createdAt' | 'updatedAt' | 'title';
  theme: 'light' | 'dark' | 'system';
  interfaceMode?: 'popup' | 'sidepanel';
  analyticsEnabled?: boolean;
}

export interface StorageData {
  prompts: Prompt[];
  categories: Category[];
  settings: Settings;
}

// Form data interfaces for components
export interface PromptFormData {
  title: string;
  content: string;
  category: string;
}

export interface CategoryFormData {
  name: string;
  color?: string;
}

// Custom site interface for site integration
export interface CustomSite {
  hostname: string;
  displayName: string;
  icon?: string;
  enabled: boolean;
  dateAdded: number;
  positioning?: {
    mode: 'custom';
    // NEW: Robust element fingerprint (preferred)
    fingerprint?: ElementFingerprint;
    // Legacy: CSS selector (fallback only)
    selector?: string;
    placement: 'before' | 'after' | 'inside-start' | 'inside-end';
    offset?: { x: number; y: number };
    zIndex?: number;
    description?: string;
    // For backward compatibility with existing signature-based system
    anchorId?: string;
    signature?: unknown;
  };
}

export type CustomSitePositioning = NonNullable<CustomSite['positioning']>;

export interface CustomSiteConfiguration {
  hostname: string;
  displayName: string;
  positioning?: CustomSitePositioning;
}

export interface SecurityWarning {
  field: string;
  message: string;
  severity: 'warning' | 'error';
}

export interface ConfigurationValidationIssue {
  field: string;
  message: string;
  severity: 'error' | 'warning';
}

export interface ConfigurationValidationResult {
  isValid: boolean;
  issues: ConfigurationValidationIssue[];
  warnings: SecurityWarning[];
  sanitizedConfig: CustomSiteConfiguration;
}

export interface EncodedCustomSitePayloadV1 {
  v: string;
  h: string;
  n: string;
  p?: {
    s?: string;
    fp?: ElementFingerprint;
    pl: CustomSitePositioning['placement'];
    ox?: number;
    oy?: number;
    z?: number;
    d?: string;
  };
  c: string;
}

// UI state interfaces
export interface AppState {
  prompts: Prompt[];
  categories: Category[];
  currentView: 'library' | 'add' | 'edit';
  selectedPrompt: Prompt | null;
  searchQuery: string;
  selectedCategory: string | null;
  loading: boolean;
  error: string | null;
}

// Error types
export enum ErrorType {
  STORAGE_QUOTA_EXCEEDED = 'STORAGE_QUOTA_EXCEEDED',
  STORAGE_UNAVAILABLE = 'STORAGE_UNAVAILABLE',
  DATA_CORRUPTION = 'DATA_CORRUPTION',
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  PERMISSION_DENIED = 'PERMISSION_DENIED',
  EXTENSION_CONTEXT_LOST = 'EXTENSION_CONTEXT_LOST'
}

export interface AppError {
  type: ErrorType;
  message: string;
  details?: unknown;
}

// Validation constants
export const VALIDATION_LIMITS = {
  PROMPT_TITLE_MAX: 100,
  PROMPT_CONTENT_MAX: 10000,
  CATEGORY_NAME_MAX: 50,
  TITLE_GENERATION_LENGTH: 50
} as const;

// Default values
export const DEFAULT_CATEGORY = 'Uncategorized';
export const DEFAULT_SETTINGS: Settings = {
  defaultCategory: DEFAULT_CATEGORY,
  sortOrder: 'updatedAt',
  theme: 'system',
  interfaceMode: 'sidepanel'
};

// Prompt Sharing types
export interface SharedPromptData {
  title: string;
  content: string;
  category: string;
}

export const PROMPT_SHARING_SIZE_LIMITS = {
  TITLE_MAX: 100,
  CONTENT_MAX: 10_000,
  CATEGORY_MAX: 50,
  ENCODED_MAX: 20_000,
} as const;

// Element Fingerprinting for robust element identification
export interface ElementFingerprint {
  // Primary identifiers (highest confidence, most stable)
  primary: {
    id?: string;
    dataTestId?: string;
    dataId?: string;
    name?: string;
    ariaLabel?: string;
  };
  
  // Secondary identifiers (medium confidence)
  secondary: {
    tagName: string; // Required - always present
    type?: string;
    role?: string;
    placeholder?: string;
  };
  
  // Content-based identifiers (for uniqueness)
  content: {
    textContent?: string; // Normalized, trimmed, max 50 chars
    textHash?: string; // Hash of text content for quick comparison
  };
  
  // Structural context (for disambiguation when multiple matches)
  context: {
    parentId?: string;
    parentDataTestId?: string;
    parentTagName?: string;
    siblingIndex?: number; // Position among same-type siblings
    siblingCount?: number; // Total same-type siblings in parent
    depth?: number; // Depth in DOM tree from body
  };
  
  // Stable attributes (framework/library specific, non-sensitive only)
  attributes: {
    [key: string]: string;
  };
  
  // Semantic class patterns (e.g., ["button", "primary"])
  classPatterns?: string[];
  
  // Metadata about fingerprint generation
  meta: {
    generatedAt: number; // Timestamp when fingerprint was created
    url: string; // URL where element was selected
    confidence: 'high' | 'medium' | 'low'; // Estimated uniqueness
  };
}
