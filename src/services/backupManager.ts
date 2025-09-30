/**
 * Backup Manager Service
 *
 * Provides comprehensive backup creation, validation, preview, and restoration
 * functionality for prompt libraries. Supports encrypted backups, conflict resolution,
 * and both replace/merge restore modes.
 *
 * Features:
 * - Encrypted backup creation using AES-256-GCM
 * - SHA-256 checksum validation for data integrity
 * - Selective category import/export
 * - Conflict resolution strategies (skip, overwrite, rename)
 * - Legacy backup format migration (v1.0.0 → v2.0.0)
 * - Private prompt filtering
 *
 * Backup Format:
 * - Version 2.0.0: Metadata + encrypted/plaintext dataset
 * - Version 1.0.0: Legacy format (auto-upgraded on restore)
 *
 * @module backupManager
 */

import { v4 as uuidv4 } from 'uuid';

import type { Category, Prompt, RestoreOptions, RestoreSummary } from '../types';
import { DEFAULT_CATEGORY } from '../types';
import type {
  BackupCreationResult,
  BackupDataset,
  BackupFileV2,
  BackupMetadata,
  BackupOptions,
  BackupPreview,
  BackupPreviewCategory,
  BackupCategory,
  BackupValidationIssue,
  BackupValidationResult,
  ConflictResolutionStrategy,
  EncryptedBackupFileV2
} from '../types/backup';

import { encryptionService } from './encryptionService';
import { StorageManager } from './storage';

/** Current backup file format version */
const BACKUP_VERSION = '2.0.0';

/** Default prefix for generated backup filenames */
const DEFAULT_FILENAME_PREFIX = 'prompt-library-backup';

/** Text encoder for computing checksums and size estimates */
const textEncoder = new TextEncoder();

/**
 * Gets the Web Crypto API instance
 *
 * @returns {Crypto} The Web Crypto API instance
 * @throws {Error} If Web Crypto API is not available
 * @private
 */
const getCrypto = (): Crypto => {
  if (typeof globalThis.crypto !== 'undefined') {
    return globalThis.crypto;
  }
  throw new Error('Web Crypto API is not available.');
};

/**
 * Computes SHA-256 checksum for data integrity verification
 *
 * Generates a SHA-256 hash of the provided text and returns it as a
 * hex-encoded string. Used to detect backup file corruption or tampering.
 *
 * @param {string} text - The text to hash
 * @returns {Promise<string>} Hex-encoded SHA-256 hash
 * @private
 */
const computeChecksum = async (text: string): Promise<string> => {
  const cryptoObj = getCrypto();
  const data = textEncoder.encode(text);
  const digest = await cryptoObj.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(digest));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
};

/**
 * Formats backup filename with timestamp
 *
 * Generates a standardized filename for backup files using the format:
 * `prompt-library-backup-{ISO_timestamp}.json`
 *
 * Example: `prompt-library-backup-2025-01-15T14-30-45-123Z.json`
 *
 * @param {BackupMetadata} metadata - Backup metadata containing creation timestamp
 * @returns {string} Formatted filename
 * @private
 */
const formatFileName = (metadata: BackupMetadata): string => {
  const timestamp = new Date(metadata.createdAt).toISOString().replace(/[:.]/g, '-');
  return `${DEFAULT_FILENAME_PREFIX}-${timestamp}.json`;
};

/**
 * Filters prompts based on privacy settings
 *
 * Optionally excludes private prompts from backup based on user preference.
 * Private prompts are identified by the `isPrivate` property.
 *
 * @param {Prompt[]} prompts - Array of prompts to filter
 * @param {boolean} includePrivatePrompts - Whether to include private prompts
 * @returns {Prompt[]} Filtered prompt array
 * @private
 */
const sanitizePrompts = (prompts: Prompt[], includePrivatePrompts: boolean): Prompt[] => {
  if (includePrivatePrompts) {
    return prompts;
  }

  return prompts.filter((prompt) => {
    const anyPrompt = prompt as Prompt & { isPrivate?: boolean };
    return !anyPrompt.isPrivate;
  });
};

/**
 * Estimates file size in bytes
 *
 * Calculates the byte size of a string when encoded as UTF-8.
 * Used for file size metadata in backups.
 *
 * @param {string} value - The string to measure
 * @returns {number} Size in bytes
 * @private
 */
const estimateSize = (value: string): number => textEncoder.encode(value).length;

/**
 * Backup Manager
 *
 * Manages creation, validation, preview, and restoration of prompt library backups.
 * Supports encrypted backups, conflict resolution, and legacy format migration.
 *
 * Key Capabilities:
 * - Create encrypted or plaintext backups with optional settings
 * - Validate backup integrity using SHA-256 checksums
 * - Preview backup contents before restoration
 * - Restore with conflict resolution (skip, overwrite, rename)
 * - Support replace and merge restore modes
 * - Filter private prompts from backups
 *
 * Security Features:
 * - AES-256-GCM encryption via EncryptionService
 * - SHA-256 checksums for integrity verification
 * - Password validation responsibility delegated to UI layer
 * - Sensitive data cleared from memory after encryption
 *
 * @class BackupManager
 * @public
 */
export class BackupManager {
  private storageManager = StorageManager.getInstance();

  /**
   * Computes SHA-256 checksum for a backup dataset
   *
   * Serializes the dataset and computes its checksum for integrity validation.
   *
   * @param {BackupDataset} dataset - The dataset to checksum
   * @returns {Promise<string>} Hex-encoded SHA-256 hash
   * @private
   */
  private async computeChecksumForDataset(dataset: BackupDataset): Promise<string> {
    const serialized = JSON.stringify(dataset);
    return computeChecksum(serialized);
  }

  /**
   * Creates a backup of the prompt library
   *
   * Process:
   * 1. Fetch prompts, categories, and optionally settings from storage
   * 2. Filter private prompts if requested
   * 3. Compute SHA-256 checksum of dataset
   * 4. Optionally encrypt with AES-256-GCM
   * 5. Generate metadata and filename
   * 6. Return Blob ready for download
   *
   * Backup Options:
   * - includePrivatePrompts: Include prompts marked as private
   * - includeSettings: Include application settings in backup
   * - encryption.enabled: Encrypt backup with password
   * - encryption.password: Password for encryption (if enabled)
   *
   * Security Notes:
   * - Password strength validation is caller's responsibility
   * - Sensitive plaintext is cleared from memory after encryption
   * - Encryption uses AES-256-GCM with PBKDF2 key derivation
   *
   * @param {BackupOptions} options - Backup configuration options
   * @returns {Promise<BackupCreationResult>} Backup file, metadata, and Blob for download
   *
   * @example
   * // Create encrypted backup with all data
   * const backup = await backupManager.createBackup({
   *   includePrivatePrompts: true,
   *   includeSettings: true,
   *   encryption: { enabled: true, password: 'MyStr0ng!Pass' }
   * });
   * // Download: URL.createObjectURL(backup.blob)
   *
   * @example
   * // Create plaintext backup without private prompts
   * const backup = await backupManager.createBackup({
   *   includePrivatePrompts: false,
   *   includeSettings: false,
   *   encryption: { enabled: false }
   * });
   *
   * @public
   */
  async createBackup(options: BackupOptions): Promise<BackupCreationResult> {
    const prompts = await this.storageManager.getPrompts();
    const categories = await this.storageManager.getCategories();
    const filteredPrompts = sanitizePrompts(prompts, options.includePrivatePrompts);

    const dataset: BackupDataset = {
      prompts: filteredPrompts,
      categories,
      settings: options.includeSettings ? await this.storageManager.getSettings() : undefined
    };

    let serializedData = JSON.stringify(dataset);
    const checksum = await computeChecksum(serializedData);
    let metadata: BackupMetadata = {
      version: BACKUP_VERSION,
      createdAt: Date.now(),
      promptCount: dataset.prompts.length,
      categoryCount: dataset.categories.length,
      settingsIncluded: dataset.settings !== undefined,
      encrypted: options.encryption.enabled,
      checksum,
      fileSize: 0
    };

    let backup: BackupFileV2 | EncryptedBackupFileV2;

    if (options.encryption.enabled && options.encryption.password) {
      // Use 'auto' mode: automatically uses Web Worker for large backups (>100KB)
      const { cipherText, iv, salt } = await encryptionService.encrypt(serializedData, options.encryption.password, 'auto');
      backup = {
        metadata,
        payload: cipherText,
        salt,
        iv
      };
      metadata = {
        ...metadata,
        fileSize: estimateSize(cipherText)
      };
    } else {
      backup = {
        metadata,
        data: dataset
      };
      metadata = {
        ...metadata,
        fileSize: estimateSize(serializedData)
      };
    }

    serializedData = ''; // clear sensitive data from memory

    const finalString = JSON.stringify(backup);
    const blob = new Blob([finalString], { type: 'application/json' });

    return {
      fileName: formatFileName(metadata),
      blob,
      metadata,
      raw: backup
    };
  }

  /**
   * Validates a backup file for integrity and format correctness
   *
   * Performs validation checks on backup file content:
   * - JSON syntax validation
   * - Format version detection (v1.0.0 legacy, v2.0.0 modern)
   * - Encryption detection and password requirement check
   * - SHA-256 checksum verification (if available)
   * - Metadata consistency checks
   *
   * Validation is informative and does NOT prevent restoration.
   * Issues are categorized by severity:
   * - error: Critical issues that may prevent restoration
   * - warning: Non-critical issues (e.g., encryption requires password)
   *
   * @param {string} content - Raw backup file content (JSON string)
   * @returns {Promise<BackupValidationResult>} Validation result with issues and metadata
   *
   * @example
   * // Validate plaintext backup
   * const result = await backupManager.validateBackup(fileContent);
   * if (result.valid) {
   *   console.log('Backup is valid');
   * }
   *
   * @example
   * // Validate encrypted backup (password not provided yet)
   * const result = await backupManager.validateBackup(encryptedContent);
   * // result.issues will include warning about password requirement
   * // result.valid may still be true (warning doesn't invalidate)
   *
   * @public
   */
  async validateBackup(content: string): Promise<BackupValidationResult> {
    const issues: BackupValidationIssue[] = [];

    let metadata: BackupMetadata | undefined;

    try {
      const parsed = await this.parseBackupContent(content);
      metadata = parsed.metadata;

      if (parsed.encrypted) {
        issues.push({
          field: 'password',
          message: 'Backup file is encrypted. Provide a password to preview or restore.',
          severity: 'warning'
        });
      }

      if (parsed.metadata.checksum && parsed.dataset) {
        const checksum = await this.computeChecksumForDataset(parsed.dataset);
        if (checksum !== parsed.metadata.checksum) {
          issues.push({
            field: 'checksum',
            message: 'Checksum mismatch detected. The backup may be corrupted.',
            severity: 'error'
          });
        }
      }

      if (!parsed.metadata.promptCount && parsed.dataset) {
        issues.push({
          field: 'promptCount',
          message: 'Prompt count metadata missing. Using dataset length.',
          severity: 'warning'
        });
      }

      return {
        valid: !issues.some((issue) => issue.severity === 'error'),
        issues,
        metadata: parsed.metadata
      };
    } catch (error) {
      issues.push({
        field: 'file',
        message: error instanceof Error ? error.message : 'Unknown error while validating backup file.',
        severity: 'error'
      });

      return {
        valid: false,
        issues,
        metadata
      };
    }
  }

  /**
   * Previews backup contents before restoration
   *
   * Generates a detailed preview of what will be imported if the backup
   * is restored. Shows category-level breakdown with conflict detection.
   *
   * Preview Information:
   * - List of categories with prompt counts
   * - Duplicate detection (existing prompts with same ID)
   * - New prompt counts (unique to backup)
   * - Existing library data for comparison
   * - Metadata (version, timestamps, encryption status)
   *
   * For encrypted backups, password is required to decrypt and preview.
   * Without password, this method will throw an error.
   *
   * @param {string} content - Raw backup file content (JSON string)
   * @param {string} [password] - Decryption password (required for encrypted backups)
   * @returns {Promise<BackupPreview>} Preview with categories and metadata
   * @throws {Error} If backup cannot be decrypted or parsed
   *
   * @example
   * // Preview plaintext backup
   * const preview = await backupManager.previewBackup(fileContent);
   * preview.categories.forEach(cat => {
   *   console.log(`${cat.name}: ${cat.newPromptCount.toString()} new, ${cat.duplicatePromptCount.toString()} duplicates`);
   * });
   *
   * @example
   * // Preview encrypted backup with password
   * const preview = await backupManager.previewBackup(
   *   encryptedContent,
   *   'MyStr0ng!Pass'
   * );
   * // preview.metadata.encrypted === true
   *
   * @public
   */
  async previewBackup(content: string, password?: string): Promise<BackupPreview> {
    const parsed = await this.parseBackupContent(content, password);

    if (!parsed.dataset) {
      throw new Error('Unable to preview encrypted backup without password.');
    }

    const dataset = parsed.dataset;

    const [currentCategories, existingPrompts] = await Promise.all([
      this.storageManager.getCategories(),
      this.storageManager.getPrompts()
    ]);
    const currentCategoryNames = new Set(currentCategories.map((category) => category.name));
    const existingPromptsByCategory = new Map<string, number>();
    const existingPromptIds = new Set(existingPrompts.map((prompt) => prompt.id));

    existingPrompts.forEach((prompt) => {
      const current = existingPromptsByCategory.get(prompt.category) ?? 0;
      existingPromptsByCategory.set(prompt.category, current + 1);
    });

    const categories: BackupPreviewCategory[] = dataset.categories.map((category) => {
      const categoryPrompts = dataset.prompts.filter((prompt) => prompt.category === category.name);
      const duplicatePromptCount = categoryPrompts.filter((prompt) => existingPromptIds.has(prompt.id)).length;
      const newPromptCount = categoryPrompts.length - duplicatePromptCount;

      return {
        id: category.id ?? category.name,
        name: category.name,
        promptCount: categoryPrompts.length,
        selected: true,
        existsInLibrary: currentCategoryNames.has(category.name),
        existingLibraryPromptCount: existingPromptsByCategory.get(category.name) ?? 0,
        duplicatePromptCount,
        newPromptCount
      };
    });

    return {
      metadata: parsed.metadata,
      categories
    };
  }

  /**
   * Restores a backup to the prompt library
   *
   * Imports data from a backup file with configurable conflict resolution
   * and merge behavior. Supports both replace and merge modes.
   *
   * Restore Process:
   * 1. Parse and optionally decrypt backup file
   * 2. Filter categories by user selection (if specified)
   * 3. Merge categories with conflict resolution strategy
   * 4. Merge prompts with conflict resolution strategy
   * 5. Optionally replace or merge settings
   * 6. Validate storage capacity
   * 7. Commit changes to storage
   *
   * Restore Modes:
   * - replace: Delete all existing data and replace with backup
   * - merge: Combine backup data with existing library
   *
   * Conflict Resolution Strategies:
   * - skip: Keep existing item, ignore backup item
   * - overwrite: Replace existing item with backup item
   * - rename: Import backup item with modified name/ID
   *
   * @param {string} content - Raw backup file content (JSON string)
   * @param {RestoreOptions} options - Restoration configuration
   * @param {string} [options.password] - Decryption password (for encrypted backups)
   * @param {'replace' | 'merge'} options.mode - Restore mode
   * @param {ConflictResolutionStrategy} options.conflictResolution - How to handle conflicts
   * @param {string[]} [options.selectedCategoryIds] - Category IDs to import (empty = all)
   * @returns {Promise<RestoreSummary>} Summary of imported, updated, and skipped items
   * @throws {Error} If decryption fails, validation fails, or storage capacity exceeded
   *
   * @example
   * // Replace all data with backup
   * const summary = await backupManager.restoreBackup(content, {
   *   mode: 'replace',
   *   conflictResolution: 'overwrite',
   *   selectedCategoryIds: [],
   *   password: undefined
   * });
   * console.log(`Imported ${summary.importedPrompts.toString()} prompts`);
   *
   * @example
   * // Merge specific categories, rename conflicts
   * const summary = await backupManager.restoreBackup(encryptedContent, {
   *   mode: 'merge',
   *   conflictResolution: 'rename',
   *   selectedCategoryIds: ['cat-123', 'cat-456'],
   *   password: 'MyStr0ng!Pass'
   * });
   * console.log(`Imported: ${summary.importedPrompts.toString()}, Skipped: ${summary.skippedPrompts.toString()}`);
   *
   * @public
   */
  async restoreBackup(content: string, options: RestoreOptions): Promise<RestoreSummary> {
    let metadata: BackupMetadata | undefined;

    try {
      const parsed = await this.parseBackupContent(content, options.password);
      metadata = parsed.metadata;

      if (!parsed.dataset) {
        throw new Error('Unable to restore: dataset is unavailable. Check encryption password.');
      }

      const { dataset } = parsed;
      const [existingPrompts, existingCategories, existingSettings] = await Promise.all([
        this.storageManager.getPrompts(),
        this.storageManager.getCategories(),
        this.storageManager.getSettings()
      ]);

      const selectedCategoryNames = new Set(
        options.selectedCategoryIds.length > 0
          ? dataset.categories
              .filter((category) => {
                const identifier = category.id ?? category.name;
                return options.selectedCategoryIds.includes(identifier);
              })
              .map((category) => category.name)
          : dataset.categories.map((category) => category.name)
      );

      const categoriesToImport = dataset.categories
        .filter((category) => selectedCategoryNames.has(category.name))
        .map((category) => ({
          ...category,
          id: category.id || uuidv4(),
          color: category.color ?? '#6B7280'
        }));

      const { finalCategories, categoryNameMap, summary: categorySummary } = this.mergeCategories(
        existingCategories,
        categoriesToImport,
        options.conflictResolution,
        options.mode
      );

      const promptsToImport = dataset.prompts
        .filter((prompt) => selectedCategoryNames.has(prompt.category))
        .map((prompt) => ({
          ...prompt,
          category: categoryNameMap.get(prompt.category) ?? prompt.category
        }));

      const { finalPrompts, summary: promptSummary } = this.mergePrompts(
        existingPrompts,
        promptsToImport,
        options.conflictResolution,
        options.mode
      );

      const finalSettings = options.mode === 'replace' && dataset.settings ? dataset.settings : existingSettings;

      await this.storageManager.ensureLibraryCapacity({
        prompts: finalPrompts,
        categories: finalCategories,
        settings: finalSettings
      });

      await this.storageManager.replaceLibraryData({
        prompts: finalPrompts,
        categories: finalCategories,
        settings: finalSettings
      });

      return {
        metadata: parsed.metadata,
        importedPrompts: promptSummary.imported,
        importedCategories: categorySummary.imported,
        updatedPrompts: promptSummary.updated,
        updatedCategories: categorySummary.updated,
        skippedPrompts: promptSummary.skipped,
        skippedCategories: categorySummary.skipped
      };
    } catch (error) {
      console.error('[backupManager] Restore failed', {
        error,
        metadata,
        options: {
          ...options,
          password: options.password ? '***' : undefined
        }
      });
      throw error;
    }
  }

  /**
   * Merges backup categories with existing categories
   *
   * Combines categories from backup with existing library categories,
   * applying the specified conflict resolution strategy and restore mode.
   *
   * Conflict Detection:
   * - Categories are matched by name (case-sensitive)
   * - Conflicts occur when backup category name matches existing category name
   *
   * Merge Behavior by Mode:
   * - replace: Ignore existing categories, use only backup categories
   * - merge: Combine backup and existing, resolve conflicts with strategy
   *
   * Conflict Resolution Strategies:
   * - skip: Keep existing category, ignore backup category
   * - overwrite: Update existing category with backup category's properties
   * - rename: Create new category with modified name (e.g., "Work (Imported)")
   *
   * The method always ensures DEFAULT_CATEGORY ("General") exists in final result.
   *
   * @param {Category[]} existing - Current library categories
   * @param {Category[]} incoming - Backup categories to merge
   * @param {ConflictResolutionStrategy} strategy - How to handle conflicts
   * @param {'replace' | 'merge'} mode - Restore mode
   * @returns {object} Merge result with final categories, name mapping, and summary
   * @returns {Category[]} object.finalCategories - Merged category array
   * @returns {Map<string, string>} object.categoryNameMap - Maps old names to new names (for renamed categories)
   * @returns {object} object.summary - Count of imported, skipped, updated categories
   * @private
   */
  private mergeCategories(
    existing: Category[],
    incoming: Category[],
    strategy: ConflictResolutionStrategy,
    mode: RestoreOptions['mode']
  ): {
    finalCategories: Category[];
    categoryNameMap: Map<string, string>;
    summary: { imported: number; skipped: number; updated: number };
  } {
    const summary = { imported: 0, skipped: 0, updated: 0 };
    const categoryNameMap = new Map<string, string>();

    if (mode === 'replace') {
      const categories = this.ensureDefaultCategoryPresence(incoming);
      categories.forEach((category) => {
        categoryNameMap.set(category.name, category.name);
      });
      summary.imported = categories.length;
      return {
        finalCategories: categories,
        categoryNameMap,
        summary
      };
    }

    const finalCategories = [...existing];
    const existingByName = new Map(existing.map((category) => [category.name, category]));
    const existingNames = new Set(existing.map((category) => category.name));

    incoming.forEach((category) => {
      const conflict = existingByName.get(category.name);

      if (!conflict) {
        finalCategories.push(category);
        existingByName.set(category.name, category);
        existingNames.add(category.name);
        categoryNameMap.set(category.name, category.name);
        summary.imported += 1;
        return;
      }

      switch (strategy) {
        case 'skip':
          summary.skipped += 1;
          categoryNameMap.set(category.name, conflict.name);
          break;
        case 'overwrite':
          conflict.color = category.color;
          categoryNameMap.set(category.name, conflict.name);
          summary.updated += 1;
          break;
        case 'rename':
          {
            const newName = this.generateUniqueName(`${category.name} (Imported)`, existingNames);
            const renamedCategory: Category = {
              ...category,
              id: uuidv4(),
              name: newName
            };
            finalCategories.push(renamedCategory);
            existingByName.set(newName, renamedCategory);
            existingNames.add(newName);
            categoryNameMap.set(category.name, newName);
            summary.imported += 1;
          }
          break;
        default:
          categoryNameMap.set(category.name, conflict.name);
          summary.skipped += 1;
      }
    });

    const categoriesWithDefault = this.ensureDefaultCategoryPresence(finalCategories);

    return {
      finalCategories: categoriesWithDefault,
      categoryNameMap,
      summary
    };
  }

  /**
   * Merges backup prompts with existing prompts
   *
   * Combines prompts from backup with existing library prompts,
   * applying the specified conflict resolution strategy and restore mode.
   *
   * Conflict Detection:
   * - Prompts are matched by ID (UUID)
   * - Conflicts occur when backup prompt ID matches existing prompt ID
   *
   * Merge Behavior by Mode:
   * - replace: Ignore existing prompts, use only backup prompts
   * - merge: Combine backup and existing, resolve conflicts with strategy
   *
   * Conflict Resolution Strategies:
   * - skip: Keep existing prompt, ignore backup prompt
   * - overwrite: Replace existing prompt with backup prompt (preserves original createdAt)
   * - rename: Create new prompt with new ID and modified title (e.g., "Title (Imported)")
   *
   * @param {Prompt[]} existing - Current library prompts
   * @param {Prompt[]} incoming - Backup prompts to merge
   * @param {ConflictResolutionStrategy} strategy - How to handle conflicts
   * @param {'replace' | 'merge'} mode - Restore mode
   * @returns {object} Merge result with final prompts and summary
   * @returns {Prompt[]} object.finalPrompts - Merged prompt array
   * @returns {object} object.summary - Count of imported, skipped, updated prompts
   * @private
   */
  private mergePrompts(
    existing: Prompt[],
    incoming: Prompt[],
    strategy: ConflictResolutionStrategy,
    mode: RestoreOptions['mode']
  ): {
    finalPrompts: Prompt[];
    summary: { imported: number; skipped: number; updated: number };
  } {
    const summary = { imported: 0, skipped: 0, updated: 0 };

    if (mode === 'replace') {
      summary.imported = incoming.length;
      return {
        finalPrompts: incoming,
        summary
      };
    }

    const finalPrompts = [...existing];
    const existingById = new Map(existing.map((prompt) => [prompt.id, prompt]));

    incoming.forEach((prompt) => {
      const conflict = existingById.get(prompt.id);

      if (!conflict) {
        finalPrompts.push(prompt);
        existingById.set(prompt.id, prompt);
        summary.imported += 1;
        return;
      }

      switch (strategy) {
        case 'skip':
          summary.skipped += 1;
          break;
        case 'overwrite':
          {
            const index = finalPrompts.findIndex((item) => item.id === prompt.id);
            if (index !== -1) {
              finalPrompts[index] = {
                ...prompt,
                createdAt: conflict.createdAt
              };
            }
            summary.updated += 1;
          }
          break;
        case 'rename':
          {
            const newPrompt: Prompt = {
              ...prompt,
              id: uuidv4(),
              title: `${prompt.title} (Imported)`
            };
            finalPrompts.push(newPrompt);
            existingById.set(newPrompt.id, newPrompt);
            summary.imported += 1;
          }
          break;
        default:
          summary.skipped += 1;
      }
    });

    return {
      finalPrompts,
      summary
    };
  }

  /**
   * Generates a unique name by appending numbers if needed
   *
   * Creates a unique name from a base name by checking against existing names
   * and appending a counter if duplicates exist (e.g., "Name 1", "Name 2").
   *
   * The generated name is automatically added to the existingNames set to
   * prevent future collisions.
   *
   * @param {string} baseName - The base name to make unique
   * @param {Set<string>} existingNames - Set of existing names to check against
   * @returns {string} Unique name (may be modified with counter)
   * @private
   */
  private generateUniqueName(baseName: string, existingNames: Set<string>): string {
    let attempt = baseName;
    let counter = 1;

    while (existingNames.has(attempt)) {
      attempt = `${baseName} ${counter.toString()}`;
      counter += 1;
    }

    existingNames.add(attempt);
    return attempt;
  }

  /**
   * Ensures the default category exists in category list
   *
   * Validates that the DEFAULT_CATEGORY ("General") exists in the provided
   * category array. If missing, adds it at the beginning of the array.
   *
   * The default category is required for the application to function correctly
   * as it serves as a fallback for uncategorized prompts.
   *
   * @param {Category[]} categories - Categories to validate
   * @returns {Category[]} Categories with default category guaranteed to exist
   * @private
   */
  private ensureDefaultCategoryPresence(categories: Category[]): Category[] {
    if (categories.some((category) => category.name === DEFAULT_CATEGORY)) {
      return categories;
    }

    const defaultCategory: Category = {
      id: uuidv4(),
      name: DEFAULT_CATEGORY,
      color: '#6B7280'
    };

    return [defaultCategory, ...categories];
  }

  /**
   * Parses backup file content and optionally decrypts
   *
   * Detects backup format version and structure, then parses and validates:
   * - Modern format (v2.0.0): { metadata, data } or { metadata, payload, salt, iv }
   * - Legacy format (v1.0.0): { prompts, categories, settings, version, exportDate }
   *
   * For encrypted backups:
   * - If password is provided: Decrypts payload and returns dataset
   * - If password is missing: Returns metadata only, dataset is undefined
   *
   * Legacy backups are automatically migrated to v2.0.0 format during parsing.
   *
   * @param {string} content - Raw backup file content (JSON string)
   * @param {string} [password] - Decryption password (optional, required for encrypted backups)
   * @returns {Promise<object>} Parsed backup with metadata, optional dataset, encryption flag
   * @returns {BackupMetadata} object.metadata - Backup metadata (version, timestamps, counts)
   * @returns {BackupDataset} [object.dataset] - Backup dataset (undefined if encrypted without password)
   * @returns {boolean} object.encrypted - Whether backup is encrypted
   * @throws {Error} If JSON is invalid, format is unsupported, or decryption fails
   * @private
   */
  private async parseBackupContent(content: string, password?: string): Promise<{
    metadata: BackupMetadata;
    dataset?: BackupDataset;
    encrypted: boolean;
  }> {
    let backup: unknown;

    try {
      backup = JSON.parse(content) as unknown;
    } catch (error) {
      throw new Error(`Invalid JSON: ${(error as Error).message}`);
    }

    if (!backup || typeof backup !== 'object') {
      throw new Error('Backup file is not a valid object.');
    }

    if (this.isEncryptedBackup(backup)) {
      const metadata = this.ensureMetadata(backup.metadata);

      if (!password) {
        return {
          metadata,
          encrypted: true
        };
      }

      try {
        // Use 'auto' mode: automatically uses Web Worker for large backups (>100KB)
        const plainText = await encryptionService.decrypt(
          {
            cipherText: backup.payload,
            iv: backup.iv,
            salt: backup.salt
          },
          password,
          'auto'
        );

        const dataset = this.ensureDataset(JSON.parse(plainText) as unknown);
        return {
          metadata,
          dataset,
          encrypted: true
        };
      } catch (error) {
        throw new Error(`Failed to decrypt backup. ${(error as Error).message}`);
      }
    }

    if (this.isModernBackup(backup)) {
      const metadata = this.ensureMetadata(backup.metadata);
      const dataset = this.ensureDataset(backup.data);
      return {
        metadata,
        dataset,
        encrypted: false
      };
    }

    if (this.isLegacyBackup(backup)) {
      const dataset = this.ensureDataset(backup);
      const metadata: BackupMetadata = {
        version: typeof backup.version === 'string' ? backup.version : '1.0.0',
        createdAt: typeof backup.exportDate === 'string' ? Date.parse(backup.exportDate) : Date.now(),
        promptCount: dataset.prompts.length,
        categoryCount: dataset.categories.length,
        settingsIncluded: false,
        encrypted: false,
        checksum: await this.computeChecksumForDataset(dataset),
        fileSize: estimateSize(content)
      };

      return {
        metadata,
        dataset,
        encrypted: false
      };
    }

    throw new Error('Unsupported backup format.');
  }

  /**
   * Type guard for modern backup format (v2.0.0 plaintext)
   *
   * Checks if a parsed object matches the modern plaintext backup structure:
   * { metadata: BackupMetadata, data: BackupDataset }
   *
   * @param {unknown} value - Value to check
   * @returns {boolean} True if value matches BackupFileV2 structure
   * @private
   */
  private isModernBackup(value: unknown): value is BackupFileV2 {
    if (!value || typeof value !== 'object') {
      return false;
    }

    const candidate = value as Record<string, unknown>;
    return 'metadata' in candidate && 'data' in candidate;
  }

  /**
   * Type guard for encrypted backup format (v2.0.0 encrypted)
   *
   * Checks if a parsed object matches the encrypted backup structure:
   * { metadata: BackupMetadata, payload: string, salt: string, iv: string }
   *
   * @param {unknown} value - Value to check
   * @returns {boolean} True if value matches EncryptedBackupFileV2 structure
   * @private
   */
  private isEncryptedBackup(value: unknown): value is EncryptedBackupFileV2 {
    if (!value || typeof value !== 'object') {
      return false;
    }

    const candidate = value as Record<string, unknown>;
    return 'metadata' in candidate && 'payload' in candidate && 'salt' in candidate && 'iv' in candidate;
  }

  /**
   * Type guard for legacy backup format (v1.0.0)
   *
   * Checks if a parsed object matches the legacy backup structure:
   * { prompts: Prompt[], categories: Category[], settings?: object, version?: string, exportDate?: string }
   *
   * Legacy backups are automatically migrated to v2.0.0 format during parsing.
   *
   * @param {unknown} value - Value to check
   * @returns {boolean} True if value matches legacy backup structure
   * @private
   */
  private isLegacyBackup(value: unknown): value is { prompts?: unknown; categories?: unknown; settings?: unknown; version?: string; exportDate?: string } {
    if (!value || typeof value !== 'object') {
      return false;
    }
    const candidate = value as Record<string, unknown>;
    return 'prompts' in candidate && 'categories' in candidate;
  }

  /**
   * Validates and normalizes backup metadata
   *
   * Ensures metadata object has all required fields with correct types.
   * Provides defaults for missing or invalid fields.
   *
   * @param {unknown} value - Metadata value to validate
   * @returns {BackupMetadata} Validated and normalized metadata
   * @throws {Error} If metadata is completely missing or not an object
   * @private
   */
  private ensureMetadata(value: unknown): BackupMetadata {
    if (!value || typeof value !== 'object') {
      throw new Error('Backup metadata is missing or invalid.');
    }

    const metadata = value as Record<string, unknown>;

    return {
      version: typeof metadata.version === 'string' ? metadata.version : BACKUP_VERSION,
      createdAt: typeof metadata.createdAt === 'number' ? metadata.createdAt : Date.now(),
      promptCount: typeof metadata.promptCount === 'number' ? metadata.promptCount : 0,
      categoryCount: typeof metadata.categoryCount === 'number' ? metadata.categoryCount : 0,
      settingsIncluded: Boolean(metadata.settingsIncluded),
      encrypted: Boolean(metadata.encrypted),
      checksum: typeof metadata.checksum === 'string' ? metadata.checksum : '',
      fileSize: typeof metadata.fileSize === 'number' ? metadata.fileSize : 0
    };
  }

  /**
   * Validates and normalizes backup dataset
   *
   * Ensures dataset object has valid prompts and categories arrays.
   * Sanitizes and validates all array items, providing safe defaults
   * for missing or invalid properties.
   *
   * Validation Rules:
   * - Prompts array: Filters out non-object items, preserves all prompt properties
   * - Categories array: Filters out non-object items, ensures name/id/color properties
   * - Settings: Optional, validated if present
   *
   * Missing category names default to DEFAULT_CATEGORY ("General").
   *
   * @param {unknown} value - Dataset value to validate
   * @returns {BackupDataset} Validated and normalized dataset
   * @throws {Error} If dataset is completely missing, not an object, or has invalid structure
   * @private
   */
  private ensureDataset(value: unknown): BackupDataset {
    if (!value || typeof value !== 'object') {
      throw new Error('Backup dataset is missing or invalid.');
    }

    const candidate = value as Record<string, unknown>;

    const prompts = Array.isArray(candidate.prompts) ? candidate.prompts : [];
    const categories = Array.isArray(candidate.categories) ? candidate.categories : [];

    if (!Array.isArray(prompts) || !Array.isArray(categories)) {
      throw new Error('Backup dataset has invalid structure.');
    }

    const sanitizedPrompts = prompts
      .filter((prompt): prompt is Record<string, unknown> => Boolean(prompt && typeof prompt === 'object'))
      .map((prompt) => prompt as unknown as Prompt);

    const sanitizedCategories = categories
      .filter((category): category is Record<string, unknown> => Boolean(category && typeof category === 'object'))
      .map((category) => {
        const categoryRecord = category;
        const nameValue = typeof categoryRecord.name === 'string' && categoryRecord.name.length > 0
          ? categoryRecord.name
          : DEFAULT_CATEGORY;
        const idValue = typeof categoryRecord.id === 'string' && categoryRecord.id.length > 0
          ? categoryRecord.id
          : undefined;
        const colorValue = typeof categoryRecord.color === 'string' ? categoryRecord.color : undefined;

        return {
          ...(category as Partial<Category>),
          id: idValue,
          name: nameValue,
          color: colorValue
        } satisfies BackupCategory;
      });

    const dataset: BackupDataset = {
      prompts: sanitizedPrompts,
      categories: sanitizedCategories
    };

    if (candidate.settings && typeof candidate.settings === 'object') {
      dataset.settings = candidate.settings as BackupDataset['settings'];
    }

    return dataset;
  }
}

/**
 * Singleton instance of BackupManager
 *
 * Pre-instantiated BackupManager ready for use throughout the application.
 * Provides access to all backup creation, validation, preview, and restoration
 * functionality.
 *
 * @example
 * import { backupManager } from './backupManager';
 *
 * // Create encrypted backup
 * const backup = await backupManager.createBackup({
 *   includePrivatePrompts: true,
 *   includeSettings: true,
 *   encryption: { enabled: true, password: 'MyStr0ng!Pass' }
 * });
 *
 * @example
 * // Validate and preview backup
 * const validation = await backupManager.validateBackup(content);
 * if (validation.valid) {
 *   const preview = await backupManager.previewBackup(content);
 *   console.log(`Will import ${preview.categories.length.toString()} categories`);
 * }
 *
 * @example
 * // Restore backup with conflict resolution
 * const summary = await backupManager.restoreBackup(content, {
 *   mode: 'merge',
 *   conflictResolution: 'rename',
 *   selectedCategoryIds: [],
 *   password: undefined
 * });
 * console.log(`Imported ${summary.importedPrompts.toString()} prompts`);
 *
 * @public
 */
export const backupManager = new BackupManager();
