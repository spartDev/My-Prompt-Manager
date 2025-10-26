# Design Document

## Overview

This design enhances My Prompt Manager's backup and restore functionality with improved security, user experience, and category color management. The solution builds upon the existing storage architecture while introducing encryption capabilities, selective restore options, and visual category organization through color coding.

## Architecture

### Core Components

```
Enhanced Backup/Restore System
├── BackupManager (Service Layer)
│   ├── EncryptionService
│   ├── CompressionService
│   └── ValidationService
├── CategoryColorManager (Service Layer)
├── BackupRestoreView (UI Component)
│   ├── BackupSection
│   ├── RestoreSection
│   └── BackupHistorySection
└── ColorPicker (UI Component)
```

### Data Flow

1. **Backup Creation**: User initiates backup → BackupManager encrypts/compresses data → File generated with metadata
2. **Restore Process**: User selects backup → ValidationService validates → Preview shown → Selective restore applied
3. **Category Colors**: User selects color → CategoryColorManager updates → UI reflects changes across components

## Components and Interfaces

### 1. BackupManager Service

```typescript
interface BackupMetadata {
  version: string;
  createdAt: number;
  promptCount: number;
  categoryCount: number;
  encrypted: boolean;
  checksum: string;
  fileSize: number;
}

interface BackupData {
  metadata: BackupMetadata;
  data: {
    prompts: Prompt[];
    categories: Category[];
    settings: Settings;
  };
}

interface EncryptedBackupData {
  metadata: BackupMetadata;
  encryptedData: string;
  salt: string;
  iv: string;
}

class BackupManager {
  async createBackup(options: BackupOptions): Promise<string>
  async validateBackup(backupContent: string): Promise<BackupValidationResult>
  async previewBackup(backupContent: string, password?: string): Promise<BackupPreview>
  async restoreBackup(backupContent: string, options: RestoreOptions): Promise<void>
}
```

### 2. EncryptionService

```typescript
interface EncryptionOptions {
  password: string;
  algorithm: 'AES-GCM';
  keyLength: 256;
}

class EncryptionService {
  async encrypt(data: string, password: string): Promise<EncryptedData>
  async decrypt(encryptedData: EncryptedData, password: string): Promise<string>
  private async deriveKey(password: string, salt: Uint8Array): Promise<CryptoKey>
  private generateSalt(): Uint8Array
  private generateIV(): Uint8Array
}
```

### 3. CategoryColorManager

```typescript
interface CategoryColor {
  id: string;
  name: string;
  color: string; // hex color code
}

interface ColorPalette {
  primary: string[];
  secondary: string[];
  custom: string[];
}

class CategoryColorManager {
  async updateCategoryColor(categoryId: string, color: string): Promise<void>
  async getCategoryColor(categoryId: string): Promise<string>
  getDefaultColorPalette(): ColorPalette
  validateColorContrast(color: string, background: string): boolean
}
```

### 4. UI Components

#### BackupRestoreView Component
```typescript
interface BackupRestoreViewProps {
  onBackupCreated: (filename: string) => void;
  onRestoreCompleted: (summary: RestoreSummary) => void;
}

interface BackupOptions {
  includeSettings: boolean;
  includePrivatePrompts: boolean;
  encryption: {
    enabled: boolean;
    password?: string;
  };
  compression: boolean;
  cloudStorage?: {
    enabled: boolean;
    provider: 'google-drive' | 'onedrive' | 'local';
    autoSync: boolean;
  };
}

interface RestoreOptions {
  mode: 'merge' | 'replace';
  selectedCategories: string[];
  conflictResolution: 'skip' | 'rename' | 'overwrite';
  source: 'local' | 'google-drive' | 'onedrive';
}
```

### 5. Cloud Storage Integration

#### CloudStorageManager
```typescript
interface CloudProvider {
  name: 'google-drive' | 'onedrive';
  displayName: string;
  authRequired: boolean;
  maxFileSize: number;
}

interface CloudStorageOptions {
  provider: CloudProvider['name'];
  filename: string;
  content: string;
  metadata: BackupMetadata;
}

class CloudStorageManager {
  async authenticate(provider: CloudProvider['name']): Promise<boolean>
  async uploadBackup(options: CloudStorageOptions): Promise<string>
  async listBackups(provider: CloudProvider['name']): Promise<CloudBackupInfo[]>
  async downloadBackup(provider: CloudProvider['name'], fileId: string): Promise<string>
  async deleteBackup(provider: CloudProvider['name'], fileId: string): Promise<void>
  isAuthenticated(provider: CloudProvider['name']): boolean
}

interface CloudBackupInfo {
  id: string;
  filename: string;
  createdAt: number;
  size: number;
  provider: CloudProvider['name'];
  metadata: BackupMetadata;
}
```

#### ColorPicker Component
```typescript
interface ColorPickerProps {
  value: string;
  onChange: (color: string) => void;
  palette: ColorPalette;
  showCustomColors: boolean;
}
```

## Data Models

### Enhanced Category Interface
```typescript
interface Category {
  id: string;
  name: string;
  color: string; // Required field with default value
  createdAt?: number;
  updatedAt?: number;
}
```

### Backup File Format
```typescript
interface BackupFileV2 {
  version: '2.0';
  metadata: BackupMetadata;
  payload: EncryptedBackupData | BackupData;
}
```

### Color Palette Configuration
```typescript
interface ColorConfiguration {
  defaultPalette: {
    primary: [
      '#3B82F6', // Blue
      '#10B981', // Green
      '#F59E0B', // Yellow
      '#EF4444', // Red
      '#8B5CF6', // Purple
      '#06B6D4', // Cyan
      '#F97316', // Orange
      '#84CC16'  // Lime
    ];
    secondary: [
      '#6B7280', // Gray
      '#EC4899', // Pink
      '#14B8A6', // Teal
      '#A855F7'  // Violet
    ];
  };
  contrastThresholds: {
    light: 4.5;
    dark: 3.0;
  };
}
```

## Error Handling

### Backup/Restore Error Types
```typescript
enum BackupErrorType {
  ENCRYPTION_FAILED = 'ENCRYPTION_FAILED',
  DECRYPTION_FAILED = 'DECRYPTION_FAILED',
  INVALID_PASSWORD = 'INVALID_PASSWORD',
  CORRUPTED_BACKUP = 'CORRUPTED_BACKUP',
  UNSUPPORTED_VERSION = 'UNSUPPORTED_VERSION',
  STORAGE_QUOTA_EXCEEDED = 'STORAGE_QUOTA_EXCEEDED',
  VALIDATION_FAILED = 'VALIDATION_FAILED'
}

interface BackupError extends AppError {
  type: BackupErrorType;
  recoverable: boolean;
  suggestions: string[];
}
```

### Error Recovery Strategies
1. **Corrupted Backup**: Attempt partial recovery, suggest re-download
2. **Wrong Password**: Clear retry with password strength indicator
3. **Storage Quota**: Show usage breakdown, suggest cleanup
4. **Version Mismatch**: Automatic migration with user consent

## Testing Strategy

### Unit Tests
- **EncryptionService**: Test encryption/decryption roundtrip, password validation
- **BackupManager**: Test backup creation, validation, restore operations
- **CategoryColorManager**: Test color assignment, contrast validation
- **ColorPicker**: Test color selection, palette rendering

### Integration Tests
- **Backup/Restore Flow**: End-to-end backup creation and restoration
- **Category Color Persistence**: Color assignment across app restart
- **Error Scenarios**: Invalid backups, wrong passwords, storage limits

### Security Tests
- **Encryption Strength**: Verify AES-256-GCM implementation
- **Password Handling**: Ensure passwords are not stored in memory
- **Data Sanitization**: Validate backup content sanitization

## Implementation Phases

### Phase 1: Category Colors
1. Extend Category interface with color field
2. Implement ColorPicker component
3. Update CategoryManager to handle colors
4. Modify UI components to display category colors

### Phase 2: Enhanced Backup Creation
1. Implement EncryptionService with Web Crypto API
2. Create BackupManager with metadata generation
3. Build BackupSection UI with encryption options
4. Add progress indicators and validation

### Phase 3: Advanced Restore Features
1. Implement backup validation and preview
2. Create RestoreSection with selective restore
3. Add conflict resolution UI
4. Implement rollback mechanism

### Phase 4: Cloud Integration & Polish
1. Add cloud storage connectors (Google Drive API, OneDrive API)
2. Implement automatic backup scheduling
3. Create backup history management
4. Add comprehensive error handling

## Security Considerations

### Encryption Implementation
- **Algorithm**: AES-256-GCM for authenticated encryption
- **Key Derivation**: PBKDF2 with 100,000 iterations
- **Salt Generation**: Cryptographically secure random values
- **IV Management**: Unique IV per encryption operation

### Data Protection
- **Password Handling**: Never store passwords, clear from memory after use
- **Backup Validation**: Checksum verification before processing
- **Content Sanitization**: DOMPurify for all user-generated content
- **Access Control**: Validate user permissions before operations

### Privacy Controls
- **Selective Export**: Option to exclude sensitive categories
- **Metadata Minimization**: Only include necessary metadata
- **Secure Deletion**: Overwrite sensitive data in memory
- **Audit Trail**: Log security-relevant operations

### Cloud Storage Security
- **OAuth 2.0**: Secure authentication with Google Drive and OneDrive APIs
- **Minimal Permissions**: Request only necessary file access permissions
- **Token Management**: Secure storage and refresh of access tokens
- **End-to-End Encryption**: Data encrypted before cloud upload
- **No Cloud Passwords**: Never store cloud service passwords locally
- **Revocation Support**: Easy disconnection from cloud services

## Cloud Storage Implementation Details

### Supported Providers

#### Google Drive Integration
- **API**: Google Drive API v3
- **Authentication**: OAuth 2.0 with PKCE
- **Permissions**: `https://www.googleapis.com/auth/drive.file` (app-created files only)
- **File Storage**: Backup files stored in app-specific folder
- **Limitations**: 15GB free storage, 750GB daily upload limit

#### OneDrive Integration
- **API**: Microsoft Graph API (OneDrive)
- **Authentication**: OAuth 2.0 with PKCE (Microsoft Identity Platform)
- **Permissions**: `Files.ReadWrite.AppFolder` (app folder access only)
- **File Storage**: Backup files in app-specific folder `/me/drive/special/approot`
- **Limitations**: 5GB free storage, API throttling limits apply

### Implementation Strategy
1. **Progressive Enhancement**: Cloud features are optional, local backups always available
2. **Graceful Degradation**: Fallback to local storage if cloud services unavailable
3. **User Control**: Clear opt-in for cloud features with privacy explanation
4. **Offline Support**: Full functionality without internet connection
5. **Cross-Platform**: Works across different devices with same cloud account

## Performance Optimizations

### Backup Operations
- **Streaming Compression**: Process large datasets without memory spikes
- **Background Processing**: Use Web Workers for encryption/compression
- **Progress Tracking**: Real-time progress updates for long operations
- **Chunked Processing**: Handle large prompt libraries efficiently

### UI Responsiveness
- **Lazy Loading**: Load backup history on demand
- **Virtual Scrolling**: Handle large category lists efficiently
- **Debounced Operations**: Prevent excessive API calls during color selection
- **Optimistic Updates**: Immediate UI feedback with rollback capability

## Accessibility Compliance

### Color Management
- **Contrast Validation**: Ensure WCAG AA compliance for all color combinations
- **Color Blind Support**: Provide alternative visual indicators beyond color
- **High Contrast Mode**: Support system high contrast preferences
- **Screen Reader**: Proper ARIA labels for color selections

### Backup/Restore Interface
- **Keyboard Navigation**: Full keyboard accessibility for all operations
- **Screen Reader Support**: Descriptive labels and status announcements
- **Focus Management**: Proper focus handling during multi-step processes
- **Error Announcements**: Clear error communication for assistive technologies