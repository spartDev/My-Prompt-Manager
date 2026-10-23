import { type FC, useCallback, useId, useState } from 'react';

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
  const titleId = useId();

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
    <section aria-labelledby={titleId} className="border-t border-default pt-6">
      <button
        onClick={toggleExpanded}
        className="w-full flex items-center justify-between text-left mb-4 group"
        aria-expanded={isExpanded}
      >
        <div className="flex items-center gap-3">
          <div data-testid="section-icon" className="w-10 h-10 bg-accent-subtle text-accent rounded-xl flex items-center justify-center shrink-0">
            <InfoCircleIcon className="w-5 h-5" />
          </div>
          <div>
            <h2 id={titleId} className="text-xl font-semibold text-primary">
              About & Reset
            </h2>
            <p className="text-sm text-tertiary">
              Version info and reset options
            </p>
          </div>
        </div>
        <span className={`transition-transform ${isExpanded ? 'rotate-180' : ''}`}>
          <ChevronDownIcon className="w-5 h-5 text-tertiary" />
        </span>
      </button>

      {isExpanded && (
        <div className="space-y-4 animate-in slide-in-from-top-2 duration-200">
          {/* Version Info */}
          <div className="bg-card rounded-xl p-4 border border-default">
            <h3 className="font-medium text-primary text-sm mb-3">
              Extension Information
            </h3>
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-secondary">Version</span>
                <span className="font-mono text-primary">{version}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-secondary">Author</span>
                <span className="text-primary">Thomas Roux</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-secondary">License</span>
                <span className="text-primary">MIT</span>
              </div>
            </div>
          </div>

          {/* Links */}
          <div className="bg-card rounded-xl p-4 border border-default">
            <h3 className="font-medium text-primary text-sm mb-3">
              Help & Support
            </h3>
            <div className="space-y-2">
              <a
                href="https://github.com/spartDev/My-Prompt-Manager"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 text-sm text-accent hover:text-accent-strong transition-colors focus-interactive rounded-sm"
              >
                <GitHubIcon />
                GitHub Repository
              </a>
              <a
                href="https://github.com/spartDev/My-Prompt-Manager/issues"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 text-sm text-accent hover:text-accent-strong transition-colors focus-interactive rounded-sm"
              >
                <IssueIcon />
                Report an Issue
              </a>
              <a
                href="https://github.com/spartDev/My-Prompt-Manager/wiki"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 text-sm text-accent hover:text-accent-strong transition-colors focus-interactive rounded-sm"
              >
                <DocumentationIcon />
                Documentation
              </a>
            </div>
          </div>

          {/* Reset Settings */}
          <div className="bg-card rounded-xl p-4 border border-default">
            <h3 className="font-medium text-primary text-sm mb-2">
              Reset Settings
            </h3>
            <p className="text-xs text-secondary mb-3">
              Restore all settings to their default values
            </p>
            
            {showResetConfirm ? (
              <div className="space-y-3">
                <div className="p-3 bg-warning-subtle border border-warning rounded-lg">
                  <p className="text-sm text-warning">
                    ⚠️ This will reset all settings to defaults but keep your prompts and categories. Continue?
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => void handleReset()}
                    disabled={resetting}
                    className="flex-1 px-4 py-2 bg-accent hover:bg-accent-hover text-on-accent rounded-lg transition-all duration-200 focus-primary disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {resetting ? 'Resetting...' : 'Yes, Reset Settings'}
                  </button>
                  <button
                    onClick={() => { setShowResetConfirm(false); }}
                    disabled={resetting}
                    className="flex-1 px-4 py-2 bg-card text-secondary border border-strong rounded-lg hover:bg-muted transition-all duration-200 focus-secondary"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <button
                onClick={() => void handleReset()}
                className="px-4 py-2 bg-card text-secondary border border-strong rounded-lg hover:bg-muted transition-all duration-200 focus-secondary"
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