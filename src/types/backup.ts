export interface BackupMetadata {
  version: string;
  createdAt: number;
  promptCount: number;
  categoryCount: number;
  settingsIncluded: boolean;
  encrypted: boolean;
  checksum: string;
  fileSize: number;
}

import type { Prompt, Category, Settings } from './index';

export interface BackupCategory extends Omit<Category, 'id'> {
  id?: string;
}

export interface BackupDataset {
  prompts: Prompt[];
  categories: BackupCategory[];
  settings?: Settings;
}

export interface BackupFileV2 {
  metadata: BackupMetadata;
  data: BackupDataset;
}

export interface EncryptedBackupFileV2 {
  metadata: BackupMetadata;
  payload: string; // base64 encoded encrypted data
  salt: string; // base64 salt
  iv: string;   // base64 iv
}

export type RawBackupFile = BackupFileV2 | EncryptedBackupFileV2 | Record<string, unknown>;

export interface BackupOptions {
  includeSettings: boolean;
  includePrivatePrompts: boolean;
  encryption: {
    enabled: boolean;
    password?: string;
  };
}

export type RestoreMode = 'merge' | 'replace';
export type ConflictResolutionStrategy = 'skip' | 'rename' | 'overwrite';

export interface RestoreOptions {
  mode: RestoreMode;
  conflictResolution: ConflictResolutionStrategy;
  selectedCategoryIds: string[];
  password?: string;
}

export interface BackupPreviewCategory {
  id: string;
  name: string;
  promptCount: number;
  selected: boolean;
  existsInLibrary: boolean;
  existingLibraryPromptCount: number;
  duplicatePromptCount: number;
  newPromptCount: number;
}

export interface BackupPreview {
  metadata: BackupMetadata;
  categories: BackupPreviewCategory[];
}

export type BackupValidationIssueSeverity = 'error' | 'warning';

export interface BackupValidationIssue {
  field: string;
  message: string;
  severity: BackupValidationIssueSeverity;
}

export interface BackupValidationResult {
  valid: boolean;
  issues: BackupValidationIssue[];
  metadata?: BackupMetadata;
}

export interface RestoreSummary {
  metadata: BackupMetadata;
  importedPrompts: number;
  importedCategories: number;
  updatedPrompts: number;
  updatedCategories: number;
  skippedPrompts: number;
  skippedCategories: number;
}

export interface BackupHistoryEntry {
  id: string;
  filename: string;
  createdAt: number;
  metadata: BackupMetadata;
}

export interface BackupCreationResult {
  fileName: string;
  blob: Blob;
  metadata: BackupMetadata;
  raw: BackupFileV2 | EncryptedBackupFileV2;
}
