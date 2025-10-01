import { FC } from 'react';

import type { BackupHistoryEntry } from '../../../types/backup';

import { formatBytes, formatDate } from './types';

interface BackupHistoryListProps {
  history: BackupHistoryEntry[];
}

/**
 * Recent backup history list component
 */
const BackupHistoryList: FC<BackupHistoryListProps> = ({ history }) => {
  if (history.length === 0) {
    return null;
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
      <h3 className="font-medium text-gray-900 dark:text-gray-100 text-sm mb-3">Recent Backups</h3>
      <ul className="space-y-2 text-sm">
        {history.map((entry) => (
          <li key={entry.id} className="rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/40 px-3 py-2">
            <div className="font-medium text-gray-900 dark:text-gray-100">{entry.filename}</div>
            <div className="text-xs text-gray-500 dark:text-gray-400">
              Created {formatDate(entry.createdAt)} · {entry.metadata.promptCount} prompts · {formatBytes(entry.metadata.fileSize)}
            </div>
          </li>
        ))}
      </ul>
      <p className="text-xs text-gray-500 dark:text-gray-400 mt-3">
        Backups listed above are available for this session. For safekeeping, store your backups in a secure location.
      </p>
    </div>
  );
};

export default BackupHistoryList;
