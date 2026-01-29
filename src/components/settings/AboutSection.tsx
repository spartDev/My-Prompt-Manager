import { FC, useCallback, useState } from 'react';

import { Logger, toError } from '../../utils';
import { ChevronDownIcon, DocumentationIcon, GitHubIcon, InfoCircleIcon, IssueIcon } from '../icons/SettingsIcons';

interface AboutSectionProps {
  version: string;
  onReset: () => Promise<void>;
}

const AboutSection: FC<AboutSectionProps> = ({ version, onReset }) => {
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);

  const toggleExpanded = useCallback(() => { setIsExpanded(prev => !prev); }, []);

  const handleReset = useCallback(async () => {
    if (!showResetConfirm) {
      setShowResetConfirm(true);
      return;
    }

    setResetting(true);
    try {
      await onReset();
      setShowResetConfirm(false);
    } catch (error) {
      Logger.error('Failed to reset settings', toError(error));
    } finally {
      setResetting(false);
    }
  }, [showResetConfirm, onReset]);

  return (
    <section className="border-t border-gray-200 dark:border-gray-700 pt-6">
      <button
        onClick={toggleExpanded}
        className="w-full flex items-center justify-between text-left mb-4 group"
        aria-expanded={isExpanded}
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gradient-to-br from-purple-600 to-indigo-600 rounded-lg flex items-center justify-center shrink-0">
            <InfoCircleIcon className="w-5 h-5 text-white" />
          </div>
          <div>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
              About & Reset
            </h2>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Version info and reset options
            </p>
          </div>
        </div>
        <span className={`transition-transform ${isExpanded ? 'rotate-180' : ''}`}>
          <ChevronDownIcon className="w-5 h-5 text-gray-400" />
        </span>
      </button>

      {isExpanded && (
        <div className="space-y-4 animate-in slide-in-from-top-2 duration-200">
          {/* Version Info */}
          <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
            <h3 className="font-medium text-gray-900 dark:text-gray-100 text-sm mb-3">
              Extension Information
            </h3>
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-600 dark:text-gray-400">Version</span>
                <span className="font-mono text-gray-900 dark:text-gray-100">{version}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-600 dark:text-gray-400">Author</span>
                <span className="text-gray-900 dark:text-gray-100">Thomas Roux</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-600 dark:text-gray-400">License</span>
                <span className="text-gray-900 dark:text-gray-100">MIT</span>
              </div>
            </div>
          </div>

          {/* Links */}
          <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
            <h3 className="font-medium text-gray-900 dark:text-gray-100 text-sm mb-3">
              Help & Support
            </h3>
            <div className="space-y-2">
              <a
                href="https://github.com/spartDev/My-Prompt-Manager"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 text-sm text-purple-600 dark:text-purple-400 hover:text-purple-700 dark:hover:text-purple-300 transition-colors"
              >
                <GitHubIcon />
                GitHub Repository
              </a>
              <a
                href="https://github.com/spartDev/My-Prompt-Manager/issues"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 text-sm text-purple-600 dark:text-purple-400 hover:text-purple-700 dark:hover:text-purple-300 transition-colors"
              >
                <IssueIcon />
                Report an Issue
              </a>
              <a
                href="https://github.com/spartDev/My-Prompt-Manager/wiki"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 text-sm text-purple-600 dark:text-purple-400 hover:text-purple-700 dark:hover:text-purple-300 transition-colors"
              >
                <DocumentationIcon />
                Documentation
              </a>
            </div>
          </div>

          {/* Reset Settings */}
          <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
            <h3 className="font-medium text-gray-900 dark:text-gray-100 text-sm mb-2">
              Reset Settings
            </h3>
            <p className="text-xs text-gray-600 dark:text-gray-400 mb-3">
              Restore all settings to their default values
            </p>
            
            {showResetConfirm ? (
              <div className="space-y-3">
                <div className="p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg">
                  <p className="text-sm text-amber-700 dark:text-amber-300">
                    ⚠️ This will reset all settings to defaults but keep your prompts and categories. Continue?
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => void handleReset()}
                    disabled={resetting}
                    className="flex-1 px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {resetting ? 'Resetting...' : 'Yes, Reset Settings'}
                  </button>
                  <button
                    onClick={() => { setShowResetConfirm(false); }}
                    disabled={resetting}
                    className="flex-1 px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-all duration-200"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <button
                onClick={() => void handleReset()}
                className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-all duration-200"
              >
                Reset to Defaults
              </button>
            )}
          </div>
        </div>
      )}
    </section>
  );
};

export default AboutSection;