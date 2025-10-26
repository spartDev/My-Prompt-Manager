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

  describe('Legacy Backup Migration (v1.0 → v2.0)', () => {
    it('should import legacy v1.0 backup format without metadata', async () => {
      // Legacy v1.0 backup format (before encryption feature)
      const legacyBackup = {
        version: '1.0.0',
        exportDate: '2024-01-15T10:30:00.000Z',
        prompts: [
          {
            id: 'legacy-p1',
            title: 'Legacy Prompt 1',
            content: 'This is a legacy prompt',
            category: DEFAULT_CATEGORY,
            createdAt: Date.now() - 5000,
            updatedAt: Date.now() - 5000
          },
          {
            id: 'legacy-p2',
            title: 'Legacy Prompt 2',
            content: 'Another legacy prompt',
            category: 'Old Category',
            createdAt: Date.now() - 10000,
            updatedAt: Date.now() - 3000
          }
        ],
        categories: [
          { id: 'legacy-c1', name: DEFAULT_CATEGORY },
          { id: 'legacy-c2', name: 'Old Category' } // No color field
        ],
        settings: {
          defaultCategory: DEFAULT_CATEGORY,
          sortOrder: 'createdAt',
          theme: 'light'
        }
      };

      const legacyBackupContent = JSON.stringify(legacyBackup);

      // Validate legacy backup
      const validation = await backupManager.validateBackup(legacyBackupContent);
      expect(validation.valid).toBe(true);
      expect(validation.metadata?.version).toBe('1.0.0');
      expect(validation.metadata?.promptCount).toBe(2);
      expect(validation.metadata?.categoryCount).toBe(2);
      expect(validation.metadata?.settingsIncluded).toBe(false); // Legacy format doesn't track this

      // Preview legacy backup
      const preview = await backupManager.previewBackup(legacyBackupContent);
      expect(preview.categories).toHaveLength(2);
      expect(preview.categories[0].name).toBe(DEFAULT_CATEGORY);
      expect(preview.categories[1].name).toBe('Old Category');

      // Restore legacy backup
      const summary = await backupManager.restoreBackup(legacyBackupContent, {
        mode: 'merge',
        conflictResolution: 'rename',
        selectedCategoryIds: []
      });

      expect(summary.importedPrompts).toBeGreaterThan(0);
      expect(summary.importedCategories).toBeGreaterThan(0);
      expect(summary.metadata.version).toBe('1.0.0');
    });

    it('should handle legacy backup without version field', async () => {
      // Very old backup format without version field
      const veryOldBackup = {
        prompts: [
          {
            id: 'old-p1',
            title: 'Very Old Prompt',
            content: 'From the early days',
            category: DEFAULT_CATEGORY,
            createdAt: Date.now(),
            updatedAt: Date.now()
          }
        ],
        categories: [
          { id: 'old-c1', name: DEFAULT_CATEGORY }
        ]
      };

      const oldBackupContent = JSON.stringify(veryOldBackup);
      const validation = await backupManager.validateBackup(oldBackupContent);

      expect(validation.valid).toBe(true);
      expect(validation.metadata?.version).toBe('1.0.0'); // Defaults to 1.0.0
      expect(validation.metadata?.promptCount).toBe(1);
    });

    it('should migrate categories without color field to undefined color', async () => {
      const legacyBackup = {
        version: '1.0.0',
        exportDate: '2024-01-15T10:30:00.000Z',
        prompts: [
          {
            id: 'p-color-test',
            title: 'Color Test Prompt',
            content: 'Testing color migration',
            category: 'No Color Category',
            createdAt: Date.now(),
            updatedAt: Date.now()
          }
        ],
        categories: [
          { id: 'c-no-color', name: 'No Color Category' }, // Missing color field
          { id: 'c-with-color', name: 'With Color', color: '#FF0000' } // Has color
        ],
        settings: {}
      };

      const backupContent = JSON.stringify(legacyBackup);
      const preview = await backupManager.previewBackup(backupContent);

      expect(preview.categories).toHaveLength(2);

      // Find categories by name
      const noColorCat = preview.categories.find(c => c.name === 'No Color Category');
      const withColorCat = preview.categories.find(c => c.name === 'With Color');

      // Category without color should have undefined color
      expect(noColorCat?.color).toBeUndefined();

      // Category with color should preserve color
      expect(withColorCat?.color).toBe('#FF0000');
    });

    it('should preserve exportDate as createdAt in metadata', async () => {
      const exportDate = '2024-01-15T10:30:00.000Z';
      const legacyBackup = {
        version: '1.0.0',
        exportDate: exportDate,
        prompts: [],
        categories: [{ id: 'c1', name: DEFAULT_CATEGORY }]
      };

      const backupContent = JSON.stringify(legacyBackup);
      const validation = await backupManager.validateBackup(backupContent);

      expect(validation.valid).toBe(true);
      expect(validation.metadata?.createdAt).toBe(Date.parse(exportDate));
    });

    it('should handle legacy backup with malformed categories gracefully', async () => {
      const legacyBackup = {
        version: '1.0.0',
        prompts: [
          {
            id: 'p1',
            title: 'Test Prompt',
            content: 'Test',
            category: DEFAULT_CATEGORY,
            createdAt: Date.now(),
            updatedAt: Date.now()
          }
        ],
        categories: [
          { id: '', name: '' }, // Invalid: empty id and name
          { name: 'Valid Category' }, // Missing id
          { id: 'c3' }, // Missing name
          { id: 'c4', name: 'Normal Category' } // Valid
        ]
      };

      const backupContent = JSON.stringify(legacyBackup);
      const validation = await backupManager.validateBackup(backupContent);

      // Should still be valid - sanitization handles malformed data
      expect(validation.valid).toBe(true);

      const preview = await backupManager.previewBackup(backupContent);
      // Should have at least the default category and valid categories
      expect(preview.categories.length).toBeGreaterThan(0);
    });

    it('should restore legacy backup in replace mode', async () => {
      const legacyBackup = {
        version: '1.0.0',
        exportDate: '2024-01-15T10:30:00.000Z',
        prompts: [
          {
            id: 'legacy-replace-p1',
            title: 'Legacy Replace Prompt',
            content: 'Testing replace mode with legacy backup',
            category: DEFAULT_CATEGORY,
            createdAt: Date.now(),
            updatedAt: Date.now()
          }
        ],
        categories: [
          { id: 'legacy-replace-c1', name: DEFAULT_CATEGORY }
        ]
      };

      const backupContent = JSON.stringify(legacyBackup);
      const summary = await backupManager.restoreBackup(backupContent, {
        mode: 'replace',
        conflictResolution: 'overwrite',
        selectedCategoryIds: []
      });

      expect(summary.importedPrompts).toBe(1);
      expect(summary.metadata.version).toBe('1.0.0');
      expect(chrome.storage.local.set).toHaveBeenCalled();
    });

    it('should handle legacy backup with special characters and Unicode', async () => {
      const legacyBackup = {
        version: '1.0.0',
        prompts: [
          {
            id: 'unicode-p1',
            title: '世界 🌍 émojis',
            content: 'Unicode content: 世界, émojis 😀, symbols !@#$%',
            category: 'Unicode Category 世界',
            createdAt: Date.now(),
            updatedAt: Date.now()
          }
        ],
        categories: [
          { id: 'unicode-c1', name: DEFAULT_CATEGORY },
          { id: 'unicode-c2', name: 'Unicode Category 世界' }
        ]
      };

      const backupContent = JSON.stringify(legacyBackup);
      const preview = await backupManager.previewBackup(backupContent);

      expect(preview.categories).toHaveLength(2);
      const unicodeCat = preview.categories.find(c => c.name.includes('世界'));
      expect(unicodeCat).toBeDefined();
      expect(unicodeCat?.promptCount).toBe(1);
    });

    it('should compute checksum for legacy backup during migration', async () => {
      const legacyBackup = {
        version: '1.0.0',
        exportDate: '2024-01-15T10:30:00.000Z',
        prompts: [
          {
            id: 'checksum-p1',
            title: 'Checksum Test',
            content: 'Testing checksum generation',
            category: DEFAULT_CATEGORY,
            createdAt: Date.now(),
            updatedAt: Date.now()
          }
        ],
        categories: [
          { id: 'checksum-c1', name: DEFAULT_CATEGORY }
        ]
      };

      const backupContent = JSON.stringify(legacyBackup);
      const validation = await backupManager.validateBackup(backupContent);

      expect(validation.valid).toBe(true);
      expect(validation.metadata?.checksum).toBeTruthy();
      expect(typeof validation.metadata?.checksum).toBe('string');
      expect(validation.metadata?.checksum.length).toBeGreaterThan(0);
    });
  });
});
