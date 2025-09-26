
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

const BACKUP_VERSION = '2.0.0';
const DEFAULT_FILENAME_PREFIX = 'prompt-library-backup';

const textEncoder = new TextEncoder();

const getCrypto = (): Crypto => {
  if (typeof globalThis.crypto !== 'undefined') {
    return globalThis.crypto;
  }
  throw new Error('Web Crypto API is not available.');
};

const computeChecksum = async (text: string): Promise<string> => {
  const cryptoObj = getCrypto();
  const data = textEncoder.encode(text);
  const digest = await cryptoObj.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(digest));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
};

const formatFileName = (metadata: BackupMetadata): string => {
  const timestamp = new Date(metadata.createdAt).toISOString().replace(/[:.]/g, '-');
  return `${DEFAULT_FILENAME_PREFIX}-${timestamp}.json`;
};

const sanitizePrompts = (prompts: Prompt[], includePrivatePrompts: boolean): Prompt[] => {
  if (includePrivatePrompts) {
    return prompts;
  }

  return prompts.filter((prompt) => {
    const anyPrompt = prompt as Prompt & { isPrivate?: boolean };
    return !anyPrompt.isPrivate;
  });
};

const estimateSize = (value: string): number => textEncoder.encode(value).length;

export class BackupManager {
  private storageManager = StorageManager.getInstance();

  private async computeChecksumForDataset(dataset: BackupDataset): Promise<string> {
    const serialized = JSON.stringify(dataset);
    return computeChecksum(serialized);
  }

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
      const { cipherText, iv, salt } = await encryptionService.encrypt(serializedData, options.encryption.password);
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
        const plainText = await encryptionService.decrypt(
          {
            cipherText: backup.payload,
            iv: backup.iv,
            salt: backup.salt
          },
          password
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

  private isModernBackup(value: unknown): value is BackupFileV2 {
    if (!value || typeof value !== 'object') {
      return false;
    }

    const candidate = value as Record<string, unknown>;
    return 'metadata' in candidate && 'data' in candidate;
  }

  private isEncryptedBackup(value: unknown): value is EncryptedBackupFileV2 {
    if (!value || typeof value !== 'object') {
      return false;
    }

    const candidate = value as Record<string, unknown>;
    return 'metadata' in candidate && 'payload' in candidate && 'salt' in candidate && 'iv' in candidate;
  }

  private isLegacyBackup(value: unknown): value is { prompts?: unknown; categories?: unknown; settings?: unknown; version?: string; exportDate?: string } {
    if (!value || typeof value !== 'object') {
      return false;
    }
    const candidate = value as Record<string, unknown>;
    return 'prompts' in candidate && 'categories' in candidate;
  }

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

export const backupManager = new BackupManager();
