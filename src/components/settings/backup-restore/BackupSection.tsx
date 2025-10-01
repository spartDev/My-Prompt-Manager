import { FC, useState } from 'react';

import { useSecurePassword } from '../../../hooks/useSecurePassword';
import { backupManager } from '../../../services/backupManager';
import type { BackupCreationResult } from '../../../types/backup';
import { PasswordStrengthIndicator } from '../../PasswordStrengthIndicator';
import ToggleSwitch from '../ToggleSwitch';

interface BackupSectionProps {
  onBackupCreated?: (result: BackupCreationResult) => void;
  onShowToast?: (message: string, type?: 'success' | 'error' | 'info') => void;
}

interface BackupOptionsState {
  includeSettings: boolean;
  encryptionEnabled: boolean;
}

const initialBackupOptions: BackupOptionsState = {
  includeSettings: true,
  encryptionEnabled: false
};

const downloadBackup = (result: BackupCreationResult) => {
  const url = URL.createObjectURL(result.blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = result.fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

/**
 * Backup creation section with encryption options
 */
const BackupSection: FC<BackupSectionProps> = ({ onBackupCreated, onShowToast }) => {
  const [backupOptions, setBackupOptions] = useState<BackupOptionsState>(initialBackupOptions);
  const [isBackingUp, setIsBackingUp] = useState(false);
  const encryptionPassword = useSecurePassword();

  const handleBackupOptionChange = (key: keyof BackupOptionsState, value: boolean) => {
    setBackupOptions((prev) => ({
      ...prev,
      [key]: value
    }));
  };

  const handleCreateBackup = async () => {
    try {
      setIsBackingUp(true);
      const result = await backupManager.createBackup({
        includeSettings: backupOptions.includeSettings,
        includePrivatePrompts: true,
        encryption: {
          enabled: backupOptions.encryptionEnabled,
          password: encryptionPassword.value
        }
      });

      downloadBackup(result);

      if (onBackupCreated) {
        onBackupCreated(result);
      }

      if (onShowToast) {
        onShowToast('Backup created successfully.', 'success');
      }

      // Securely clear password after successful backup
      encryptionPassword.clear();
    } catch (error) {
      if (onShowToast) {
        onShowToast(error instanceof Error ? error.message : 'Failed to create backup.', 'error');
      }
    } finally {
      setIsBackingUp(false);
    }
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
      <div>
        <h3 className="font-medium text-gray-900 dark:text-gray-100 text-sm mb-3">Create Backup</h3>
        <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">Download an encrypted archive of your prompts, categories, and settings.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="grid gap-2 grid-flow-col-dense items-center rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-4 py-3">
          <div>
            <p className="text-sm font-medium text-gray-900 dark:text-gray-100">Include settings</p>
            <p className="text-xs text-gray-500 dark:text-gray-400">Export appearance preferences and other app-level configuration.</p>
          </div>
          <ToggleSwitch
            checked={backupOptions.includeSettings}
            onChange={(checked) => { handleBackupOptionChange('includeSettings', checked); }}
            ariaLabel="Include settings"
          />
        </div>

        <div className="flex flex-col gap-3">
          <div className="grid gap-2 grid-flow-col-dense items-center rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-4 py-3">
            <div>
              <p className="text-sm font-medium text-gray-900 dark:text-gray-100">Password protect backup (AES-256)</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">Encrypt the exported archive with a password before download.</p>
            </div>
            <ToggleSwitch
              checked={backupOptions.encryptionEnabled}
              onChange={(checked) => { handleBackupOptionChange('encryptionEnabled', checked); }}
              ariaLabel="Password protect backup (AES-256)"
            />
          </div>

          {backupOptions.encryptionEnabled && (
            <div className="space-y-1">
              <input
                type="password"
                placeholder="Encryption password"
                value={encryptionPassword.value}
                onChange={(event) => { encryptionPassword.setValue(event.target.value); }}
                className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm text-gray-900 dark:text-white"
              />
              <PasswordStrengthIndicator password={encryptionPassword.value} />
            </div>
          )}
        </div>
        <button
          type="button"
          onClick={() => { void handleCreateBackup(); }}
          disabled={isBackingUp || (backupOptions.encryptionEnabled && encryptionPassword.isEmpty())}
          className="inline-flex w-full items-center justify-center gap-2 px-4 py-2 rounded-lg bg-gradient-to-r from-purple-600 to-indigo-600 text-white text-sm font-medium hover:from-purple-700 hover:to-indigo-700 transition-colors disabled:opacity-50"
        >
          {isBackingUp ? 'Creating backup…' : 'Create Backup'}
        </button>
      </div>
    </div>
  );
};

export default BackupSection;
