/**
 * Integration tests for backup and restore functionality
 * Tests the complete flow from backup creation to restore with encryption
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';

import { DEFAULT_CATEGORY, type Prompt, type Category, type Settings } from '../../types';
import { BackupManager } from '../backupManager';

describe('Backup/Restore Integration Tests', () => {
  let backupManager: BackupManager;

  const samplePrompts: Prompt[] = [
    {
      id: 'p1',
      title: 'Test Prompt 1',
      content: 'This is a test prompt for backup',
      category: DEFAULT_CATEGORY,
      createdAt: Date.now() - 1000,
      updatedAt: Date.now() - 1000
    },
    {
      id: 'p2',
      title: 'Test Prompt 2',
      content: 'Another test prompt with special chars: 世界 🌍',
      category: 'Work',
      createdAt: Date.now() - 2000,
      updatedAt: Date.now() - 500
    }
  ];

  const sampleCategories: Category[] = [
    { id: 'c1', name: DEFAULT_CATEGORY },
    { id: 'c2', name: 'Work', color: '#FF0000' },
    { id: 'c3', name: 'Personal', color: '#00FF00' }
  ];

  const sampleSettings: Settings = {
    defaultCategory: DEFAULT_CATEGORY,
    sortOrder: 'updatedAt',
    theme: 'dark'
  };

  beforeEach(() => {
    backupManager = new BackupManager();

    // Mock storage with sample data
    vi.mocked(chrome.storage.local.get).mockImplementation((keys) => {
      const mockData: Record<string, unknown> = {
        prompts: samplePrompts,
        categories: sampleCategories,
        settings: sampleSettings
      };

      if (Array.isArray(keys)) {
        const result: Record<string, unknown> = {};
        keys.forEach(key => {
          result[key] = mockData[key];
        });
        return Promise.resolve(result);
      }
      if (typeof keys === 'string') {
        return Promise.resolve({ [keys]: mockData[keys] });
      }
      return Promise.resolve(mockData);
    });

    vi.mocked(chrome.storage.local.set).mockResolvedValue(undefined);
    vi.mocked(chrome.storage.local.getBytesInUse).mockImplementation(() => Promise.resolve(1024));
    chrome.storage.local.QUOTA_BYTES = 1024 * 1024;
  });

  describe('Unencrypted Backup Flow', () => {
    it('should create unencrypted backup successfully', async () => {
      const result = await backupManager.createBackup({
        includeSettings: true,
        includePrivatePrompts: true,
        encryption: { enabled: false }
      });

      expect(result.fileName).toMatch(/prompt-library-backup-.*\.json/);
      expect(result.blob.type).toBe('application/json');
      expect(result.metadata.encrypted).toBe(false);
      expect(result.metadata.promptCount).toBe(2);
      expect(result.metadata.categoryCount).toBe(3);
      expect(result.metadata.settingsIncluded).toBe(true);
    });

    it('should validate unencrypted backup file', async () => {
      const backup = await backupManager.createBackup({
        includeSettings: true,
        includePrivatePrompts: true,
        encryption: { enabled: false }
      });

      const backupContent = JSON.stringify(backup.raw);
      const validation = await backupManager.validateBackup(backupContent);

      expect(validation.valid).toBe(true);
      expect(validation.issues).toHaveLength(0);
      expect(validation.metadata).toBeDefined();
      expect(validation.metadata?.promptCount).toBe(2);
    });

    it('should preview unencrypted backup', async () => {
      const backup = await backupManager.createBackup({
        includeSettings: true,
        includePrivatePrompts: true,
        encryption: { enabled: false }
      });

      const backupContent = JSON.stringify(backup.raw);
      const preview = await backupManager.previewBackup(backupContent);

      expect(preview.categories).toHaveLength(3);
      expect(preview.categories[0].name).toBe(DEFAULT_CATEGORY);
      expect(preview.categories[1].promptCount).toBe(1); // Prompt 2 is in 'Work'
    });

    it('should restore unencrypted backup with merge mode', async () => {
      const backup = await backupManager.createBackup({
        includeSettings: true,
        includePrivatePrompts: true,
        encryption: { enabled: false }
      });

      const backupContent = JSON.stringify(backup.raw);
      const summary = await backupManager.restoreBackup(backupContent, {
        mode: 'merge',
        conflictResolution: 'rename', // Use rename to import duplicates with new IDs
        selectedCategoryIds: ['c1', 'c2', 'c3']
      });

      expect(summary.importedPrompts).toBeGreaterThan(0);
      expect(summary.importedCategories).toBeGreaterThan(0);
    });

    it('should restore unencrypted backup with replace mode', async () => {
      const backup = await backupManager.createBackup({
        includeSettings: true,
        includePrivatePrompts: true,
        encryption: { enabled: false }
      });

      const backupContent = JSON.stringify(backup.raw);
      const summary = await backupManager.restoreBackup(backupContent, {
        mode: 'replace',
        conflictResolution: 'overwrite',
        selectedCategoryIds: []
      });

      expect(summary.metadata.promptCount).toBe(2);
      expect(chrome.storage.local.set).toHaveBeenCalled();
    });
  });

  describe('Encrypted Backup Flow', () => {
    const strongPassword = 'MyStr0ng!P@ssw0rd123';

    it('should create encrypted backup successfully', async () => {
      const result = await backupManager.createBackup({
        includeSettings: true,
        includePrivatePrompts: true,
        encryption: {
          enabled: true,
          password: strongPassword
        }
      });

      expect(result.fileName).toMatch(/prompt-library-backup-.*\.json/);
      expect(result.blob.type).toBe('application/json');
      expect(result.metadata.encrypted).toBe(true);
      expect(result.metadata.promptCount).toBe(2);
      expect(result.metadata.categoryCount).toBe(3);

      // Verify encrypted payload exists
      if ('payload' in result.raw) {
        expect(result.raw.payload).toBeDefined();
        expect(result.raw.salt).toBeDefined();
        expect(result.raw.iv).toBeDefined();
      } else {
        throw new Error('Expected encrypted backup format');
      }
    });

    it('should validate encrypted backup file', async () => {
      const backup = await backupManager.createBackup({
        includeSettings: true,
        includePrivatePrompts: true,
        encryption: {
          enabled: true,
          password: strongPassword
        }
      });

      const backupContent = JSON.stringify(backup.raw);
      const validation = await backupManager.validateBackup(backupContent);

      expect(validation.valid).toBe(true);
      // Encrypted backups have a warning about password requirement
      expect(validation.issues).toHaveLength(1);
      expect(validation.issues[0].severity).toBe('warning');
      expect(validation.issues[0].field).toBe('password');
      expect(validation.metadata?.encrypted).toBe(true);
    });

    it('should preview encrypted backup with correct password', async () => {
      const backup = await backupManager.createBackup({
        includeSettings: true,
        includePrivatePrompts: true,
        encryption: {
          enabled: true,
          password: strongPassword
        }
      });

      const backupContent = JSON.stringify(backup.raw);
      const preview = await backupManager.previewBackup(backupContent, strongPassword);

      expect(preview.categories).toHaveLength(3);
      expect(preview.metadata.encrypted).toBe(true);
    });

    it('should fail to preview encrypted backup with wrong password', async () => {
      const backup = await backupManager.createBackup({
        includeSettings: true,
        includePrivatePrompts: true,
        encryption: {
          enabled: true,
          password: strongPassword
        }
      });

      const backupContent = JSON.stringify(backup.raw);

      await expect(
        backupManager.previewBackup(backupContent, 'WrongP@ssw0rd!')
      ).rejects.toThrow();
    });

    it('should restore encrypted backup with correct password', async () => {
      const backup = await backupManager.createBackup({
        includeSettings: true,
        includePrivatePrompts: true,
        encryption: {
          enabled: true,
          password: strongPassword
        }
      });

      const backupContent = JSON.stringify(backup.raw);
      const summary = await backupManager.restoreBackup(backupContent, {
        mode: 'merge',
        conflictResolution: 'rename', // Use rename to import duplicates with new IDs
        selectedCategoryIds: ['c1', 'c2', 'c3'],
        password: strongPassword
      });

      expect(summary.importedPrompts).toBeGreaterThan(0);
      expect(summary.importedCategories).toBeGreaterThan(0);
    });

    it('should fail to restore encrypted backup without password', async () => {
      const backup = await backupManager.createBackup({
        includeSettings: true,
        includePrivatePrompts: true,
        encryption: {
          enabled: true,
          password: strongPassword
        }
      });

      const backupContent = JSON.stringify(backup.raw);

      await expect(
        backupManager.restoreBackup(backupContent, {
          mode: 'merge',
          conflictResolution: 'skip',
          selectedCategoryIds: []
        })
      ).rejects.toThrow();
    });
  });

  describe('Encryption/Decryption Roundtrip', () => {
    it('should maintain data integrity through encryption/decryption', async () => {
      const password = 'TestP@ssw0rd123!';

      // Create encrypted backup
      const backup = await backupManager.createBackup({
        includeSettings: true,
        includePrivatePrompts: true,
        encryption: {
          enabled: true,
          password
        }
      });

      // Restore and verify data matches
      const backupContent = JSON.stringify(backup.raw);
      const summary = await backupManager.restoreBackup(backupContent, {
        mode: 'replace',
        conflictResolution: 'overwrite',
        selectedCategoryIds: [],
        password
      });

      expect(summary.importedPrompts).toBe(samplePrompts.length);
      expect(summary.importedCategories).toBe(sampleCategories.length);
    });

    it('should handle special characters in encrypted content', async () => {
      const specialPrompt: Prompt = {
        id: 'special',
        title: 'Special 世界 🌍',
        content: 'Content with émojis 😀, unicode 世界, and symbols !@#$%^&*()',
        category: DEFAULT_CATEGORY,
        createdAt: Date.now(),
        updatedAt: Date.now()
      };

      vi.mocked(chrome.storage.local.get).mockImplementation(() => Promise.resolve({
        prompts: [specialPrompt],
        categories: [{ id: 'c1', name: DEFAULT_CATEGORY }],
        settings: sampleSettings
      }));

      const password = 'TestP@ssw0rd123!';
      const backup = await backupManager.createBackup({
        includeSettings: false,
        includePrivatePrompts: true,
        encryption: {
          enabled: true,
          password
        }
      });

      const backupContent = JSON.stringify(backup.raw);
      const preview = await backupManager.previewBackup(backupContent, password);

      expect(preview.categories).toHaveLength(1);
      expect(preview.categories[0].promptCount).toBe(1);
    });
  });

  describe('Conflict Resolution', () => {
    it('should skip duplicate prompts in merge mode', async () => {
      // Create backup with current data
      const backup = await backupManager.createBackup({
        includeSettings: false,
        includePrivatePrompts: true,
        encryption: { enabled: false }
      });

      const backupContent = JSON.stringify(backup.raw);

      // Mock storage to have same prompts already
      vi.mocked(chrome.storage.local.get).mockImplementation(() => Promise.resolve({
        prompts: samplePrompts,
        categories: sampleCategories,
        settings: sampleSettings
      }));

      const summary = await backupManager.restoreBackup(backupContent, {
        mode: 'merge',
        conflictResolution: 'skip',
        selectedCategoryIds: []
      });

      // Should skip all duplicates
      expect(summary.skippedPrompts).toBeGreaterThan(0);
    });

    it('should rename duplicate prompts in merge mode', async () => {
      const backup = await backupManager.createBackup({
        includeSettings: false,
        includePrivatePrompts: true,
        encryption: { enabled: false }
      });

      const backupContent = JSON.stringify(backup.raw);

      const summary = await backupManager.restoreBackup(backupContent, {
        mode: 'merge',
        conflictResolution: 'rename',
        selectedCategoryIds: []
      });

      expect(summary.importedPrompts + summary.updatedPrompts).toBeGreaterThan(0);
    });
  });

  describe('Selective Restore', () => {
    it('should restore only selected categories', async () => {
      const backup = await backupManager.createBackup({
        includeSettings: false,
        includePrivatePrompts: true,
        encryption: { enabled: false }
      });

      const backupContent = JSON.stringify(backup.raw);

      // Only restore 'Work' category
      const summary = await backupManager.restoreBackup(backupContent, {
        mode: 'merge',
        conflictResolution: 'skip',
        selectedCategoryIds: ['c2'] // Work category
      });

      // Should only import prompts from selected category
      expect(summary.importedPrompts).toBeLessThanOrEqual(1);
    });

    it('should restore all categories when no selection specified', async () => {
      const backup = await backupManager.createBackup({
        includeSettings: false,
        includePrivatePrompts: true,
        encryption: { enabled: false }
      });

      const backupContent = JSON.stringify(backup.raw);

      const summary = await backupManager.restoreBackup(backupContent, {
        mode: 'merge',
        conflictResolution: 'skip',
        selectedCategoryIds: [] // Empty means all
      });

      expect(summary.importedPrompts + summary.skippedPrompts).toBe(samplePrompts.length);
    });
  });

  describe('Error Scenarios', () => {
    it('should reject corrupted backup file', async () => {
      const corruptedBackup = JSON.stringify({ invalid: 'data' });

      const validation = await backupManager.validateBackup(corruptedBackup);

      expect(validation.valid).toBe(false);
      expect(validation.issues.length).toBeGreaterThan(0);
    });

    it('should reject backup with invalid JSON', async () => {
      const invalidJSON = 'not valid json {{{';

      // validateBackup catches JSON errors and returns validation result
      const validation = await backupManager.validateBackup(invalidJSON);

      expect(validation.valid).toBe(false);
      expect(validation.issues.length).toBeGreaterThan(0);
      expect(validation.issues[0].severity).toBe('error');
      expect(validation.issues[0].message).toContain('Invalid JSON');
    });

    it('should handle empty backup file', async () => {
      const emptyBackup = JSON.stringify({
        metadata: {
          version: '2.0.0',
          createdAt: Date.now(),
          promptCount: 0,
          categoryCount: 0,
          settingsIncluded: false,
          encrypted: false,
          checksum: '',
          fileSize: 0
        },
        data: {
          prompts: [],
          categories: [],
          settings: undefined
        }
      });

      const validation = await backupManager.validateBackup(emptyBackup);
      expect(validation.valid).toBe(true);
    });

    it('should handle quota exceeded during restore', async () => {
      const backup = await backupManager.createBackup({
        includeSettings: true,
        includePrivatePrompts: true,
        encryption: { enabled: false }
      });

      // Mock quota exceeded error
      vi.mocked(chrome.storage.local.set).mockRejectedValue(
        new Error('QUOTA_EXCEEDED')
      );

      const backupContent = JSON.stringify(backup.raw);

      await expect(
        backupManager.restoreBackup(backupContent, {
          mode: 'replace',
          conflictResolution: 'overwrite',
          selectedCategoryIds: []
        })
      ).rejects.toThrow();
    });
  });

  describe('Metadata Verification', () => {
    it('should generate accurate metadata', async () => {
      const backup = await backupManager.createBackup({
        includeSettings: true,
        includePrivatePrompts: true,
        encryption: { enabled: false }
      });

      expect(backup.metadata.version).toBe('2.0.0');
      expect(backup.metadata.createdAt).toBeLessThanOrEqual(Date.now());
      expect(backup.metadata.promptCount).toBe(samplePrompts.length);
      expect(backup.metadata.categoryCount).toBe(sampleCategories.length);
      expect(backup.metadata.settingsIncluded).toBe(true);
      expect(backup.metadata.checksum).toBeTruthy();
      expect(backup.metadata.fileSize).toBeGreaterThan(0);
    });

    it('should verify checksum integrity', async () => {
      const backup = await backupManager.createBackup({
        includeSettings: true,
        includePrivatePrompts: true,
        encryption: { enabled: false }
      });

      const backupContent = JSON.stringify(backup.raw);
      const validation = await backupManager.validateBackup(backupContent);

      expect(validation.valid).toBe(true);
      expect(validation.metadata?.checksum).toBe(backup.metadata.checksum);
    });

    it('should detect checksum mismatch', async () => {
      const backup = await backupManager.createBackup({
        includeSettings: true,
        includePrivatePrompts: true,
        encryption: { enabled: false }
      });

      // Tamper with the backup
      const backupObj = backup.raw as { data: { prompts: Prompt[] } };
      backupObj.data.prompts[0].title = 'Tampered Title';
      const tamperedContent = JSON.stringify(backupObj);

      const validation = await backupManager.validateBackup(tamperedContent);

      // Should detect checksum mismatch
      expect(validation.issues.some(issue => issue.field === 'checksum')).toBe(true);
    });
  });
});
