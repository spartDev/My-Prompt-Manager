import type { FC, ReactElement, ReactNode } from 'react';

import { AddIcon, EditIcon, LogoIcon, SettingsIcon } from './icons/HeaderIcons';

type IconType = 'logo' | 'add' | 'edit' | 'settings';

export interface ViewHeaderProps {
  // Icon configuration
  icon?: IconType | ReactElement;

  // Title section
  title: string;
  subtitle?: string;

  // Action buttons
  onSettings?: () => void;
  onClose?: () => void;
  onBack?: () => void;
  actions?: ReactNode; // Custom actions slot

  // Context
  context?: 'popup' | 'sidepanel';

  // Styling
  className?: string;

  // Children slot for additional content (e.g., search, filters)
  children?: ReactNode;
}

const ViewHeader: FC<ViewHeaderProps> = ({
  icon = 'logo',
  title,
  subtitle,
  onSettings,
  onClose,
  onBack,
  actions,
  context = 'popup',
  className = '',
  children
}) => {
  // Render icon based on type
  const renderIcon = () => {
    let iconElement: ReactElement;

    if (typeof icon === 'string') {
      switch (icon) {
        case 'logo':
          iconElement = <LogoIcon />;
          break;
        case 'add':
          iconElement = <AddIcon />;
          break;
        case 'edit':
          iconElement = <EditIcon />;
          break;
        case 'settings':
          iconElement = <SettingsIcon />;
          break;
        default:
          iconElement = <LogoIcon />;
      }
    } else {
      iconElement = icon;
    }

    return (
      <div
        className="w-10 h-10 bg-gradient-to-br from-purple-600 to-indigo-600 rounded-xl flex items-center justify-center"
        role="img"
        aria-label={`${title} icon`}
      >
        {iconElement}
      </div>
    );
  };

  return (
    <header
      className={`flex-shrink-0 bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm border-b border-purple-100 dark:border-gray-700 ${className}`}
      role="banner"
    >
      <div className="p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            {renderIcon()}
            <div>
              <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">{title}</h1>
              {subtitle && (
                <p className="text-sm text-gray-500 dark:text-gray-400">{subtitle}</p>
              )}
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex items-center space-x-2">
            {/* Back button - positioned first for standard UX */}
            {onBack && (
              <button
                onClick={onBack}
                className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors focus-interactive"
                title="Go back"
                aria-label="Go back"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                </svg>
                <span>Back</span>
              </button>
            )}

            {/* Custom actions slot */}
            {actions}

            {/* Settings button */}
            {onSettings && (
              <button
                onClick={onSettings}
                className="p-2 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors focus-interactive"
                title="Settings"
                aria-label="Open settings"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"/>
                  <path d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/>
                </svg>
              </button>
            )}

            {/* Close button */}
            {onClose && (
              <button
                onClick={onClose}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    onClose();
                  }
                }}
                className="p-2 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors focus-interactive"
                title={context === 'sidepanel' ? 'Close side panel' : 'Close'}
                aria-label={context === 'sidepanel' ? 'Close side panel' : 'Close'}
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Children slot for additional content */}
      {children && (
        <div className="px-6 pb-6">
          {children}
        </div>
      )}
    </header>
  );
};

export default ViewHeader;
