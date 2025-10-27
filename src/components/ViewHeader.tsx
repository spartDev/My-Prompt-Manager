import type { FC, ReactElement, ReactNode } from 'react';
import { Children, isValidElement } from 'react';

import { useExtensionContext } from '../hooks/useExtensionContext';
import * as Logger from '../utils/logger';

import { AddIcon, EditIcon, LogoIcon, SettingsIcon } from './icons/HeaderIcons';

/**
 * Predefined icon types for the ViewHeader component.
 * @typedef {'logo' | 'add' | 'edit' | 'settings'} IconType
 */
type IconType = 'logo' | 'add' | 'edit' | 'settings';

/**
 * Props for the ViewHeader component.
 *
 * Unified header component for all extension views providing consistent styling,
 * navigation patterns, and accessibility features across popup and sidepanel contexts.
 *
 * @example
 * // Main view with logo icon (default)
 * <ViewHeader title="My Prompts" subtitle="Organize your prompts" />
 *
 * @example
 * // Sub-view with back navigation
 * <ViewHeader
 *   icon="settings"
 *   title="Settings"
 *   subtitle="Configure your preferences"
 *   onBack={() => setView('library')}
 * />
 *
 * @example
 * // Custom icon with multiple actions
 * <ViewHeader
 *   icon={<FolderIcon className="w-6 h-6" />}
 *   title="Categories"
 *   onBack={() => goBack()}
 *   onSettings={() => openSettings()}
 * />
 *
 * @example
 * // Using composable API for custom actions
 * <ViewHeader icon="logo" title="My View">
 *   <ViewHeader.Actions>
 *     <ViewHeader.BackButton onClick={handleBack} />
 *     <button onClick={customAction}>Custom</button>
 *     <ViewHeader.SettingsButton onClick={handleSettings} />
 *   </ViewHeader.Actions>
 * </ViewHeader>
 *
 * @example
 * // With additional children content (search bar, filters, etc.)
 * <ViewHeader icon="logo" title="Library">
 *   <SearchBar onSearch={handleSearch} />
 *   <FilterDropdown onFilter={handleFilter} />
 * </ViewHeader>
 */
export interface ViewHeaderProps {
  /**
   * Icon to display in the header.
   * Can be a predefined icon type ('logo' | 'add' | 'edit' | 'settings') or a custom ReactElement.
   * @default 'logo'
   *
   * @example
   * icon="settings"
   *
   * @example
   * icon={<CustomIcon className="w-6 h-6" />}
   */
  icon?: IconType | ReactElement;

  /**
   * Main title text displayed in the header.
   * @example
   * title="My Prompt Manager"
   */
  title: string;

  /**
   * Optional subtitle text displayed below the title.
   * @example
   * subtitle="Organize your creative prompts"
   */
  subtitle?: string;

  /**
   * Callback fired when the settings button is clicked.
   * When provided, a settings button will be displayed in the header.
   *
   * @example
   * onSettings={() => setView('settings')}
   */
  onSettings?: () => void;

  /**
   * Callback fired when the close button is clicked.
   * When provided, a close button will be displayed in the header.
   * The button's aria-label adapts based on context (popup vs sidepanel).
   *
   * @example
   * onClose={() => window.close()}
   */
  onClose?: () => void;

  /**
   * Callback fired when the back button is clicked.
   * When provided, a back button with "Back" text will be displayed.
   *
   * @example
   * onBack={() => setView('library')}
   */
  onBack?: () => void;

  /**
   * Custom action buttons or elements to display in the header actions area.
   * This is a legacy API slot for custom actions.
   * Consider using the composable ViewHeader.Actions API for more control.
   *
   * @example
   * actions={<button onClick={customAction}>Custom</button>}
   */
  actions?: ReactNode;

  /**
   * Extension context (popup or sidepanel).
   * If not provided, will be auto-detected using the useExtensionContext hook.
   *
   * Auto-detection strategy:
   * 1. Checks URL path for 'sidepanel.html' or 'popup.html' identifiers
   * 2. Checks if running in test environment (defaults to 'popup')
   * 3. Uses window dimensions as fallback heuristic (>= 600px suggests sidepanel)
   * 4. Defaults to 'popup' if detection fails
   *
   * @default Auto-detected (usually 'popup')
   *
   * @example
   * context="sidepanel"
   */
  context?: 'popup' | 'sidepanel';

  /**
   * Additional CSS classes to apply to the header element.
   *
   * @example
   * className="custom-header border-red-500"
   */
  className?: string;

  /**
   * Children elements to render below the header title section.
   * Useful for adding search bars, filters, or other interactive elements.
   * If ViewHeader.Actions is used as a child, it will be rendered in the actions area.
   *
   * @example
   * children={<SearchBar onSearch={handleSearch} />}
   *
   * @example
   * children={(
   *   <>
   *     <SearchBar />
   *     <FilterBar />
   *   </>
   * )}
   */
  children?: ReactNode;
}

/**
 * Props for the BackButton subcomponent.
 */
interface BackButtonProps {
  /**
   * Callback fired when the back button is clicked.
   * @example
   * onClick={() => navigate('library')}
   */
  onClick: () => void;

  /**
   * Whether the button is disabled.
   * @default false
   */
  disabled?: boolean;
}

/**
 * Props for the SettingsButton subcomponent.
 */
interface SettingsButtonProps {
  /**
   * Callback fired when the settings button is clicked.
   * @example
   * onClick={() => openSettings()}
   */
  onClick: () => void;

  /**
   * Whether the button is disabled.
   * @default false
   */
  disabled?: boolean;
}

/**
 * Props for the CloseButton subcomponent.
 */
interface CloseButtonProps {
  /**
   * Callback fired when the close button is clicked.
   * @example
   * onClick={() => window.close()}
   */
  onClick: () => void;

  /**
   * Extension context for appropriate aria labels.
   * @default 'popup'
   */
  context?: 'popup' | 'sidepanel';

  /**
   * Whether the button is disabled.
   * @default false
   */
  disabled?: boolean;
}

/**
 * Props for the Actions container subcomponent.
 */
interface ActionsProps {
  /**
   * Action buttons or elements to display in the header.
   * @example
   * children={(
   *   <>
   *     <ViewHeader.BackButton onClick={handleBack} />
   *     <ViewHeader.SettingsButton onClick={handleSettings} />
   *   </>
   * )}
   */
  children: ReactNode;
}

/**
 * Icon component map for predefined icon types.
 * Maps IconType strings to their corresponding React components.
 * @internal
 */
const ICON_COMPONENT_MAP: Record<IconType, FC> = {
  logo: LogoIcon,
  add: AddIcon,
  edit: EditIcon,
  settings: SettingsIcon
};

/**
 * Actions container subcomponent.
 * Use this to wrap multiple action buttons in a composable manner.
 *
 * @example
 * <ViewHeader icon="logo" title="My View">
 *   <ViewHeader.Actions>
 *     <ViewHeader.BackButton onClick={handleBack} />
 *     <button onClick={customAction}>Custom</button>
 *   </ViewHeader.Actions>
 * </ViewHeader>
 */
const Actions: FC<ActionsProps> = ({ children }) => {
  return <>{children}</>;
};

/**
 * Back button subcomponent.
 * Displays a back button with arrow icon and "Back" text.
 * Positioned first in the action area for standard UX patterns.
 *
 * @example
 * <ViewHeader.BackButton onClick={() => navigate('library')} />
 *
 * @example
 * <ViewHeader.BackButton onClick={handleBack} disabled={isLoading} />
 */
const BackButton: FC<BackButtonProps> = ({ onClick, disabled = false }) => {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors focus-interactive disabled:opacity-50 disabled:cursor-not-allowed"
      title="Go back"
      aria-label="Go back"
    >
      <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
      </svg>
      <span>Back</span>
    </button>
  );
};

/**
 * Settings button subcomponent.
 * Displays a gear icon button for opening settings.
 *
 * @example
 * <ViewHeader.SettingsButton onClick={() => setView('settings')} />
 *
 * @example
 * <ViewHeader.SettingsButton onClick={openSettings} disabled={!hasPermission} />
 */
const SettingsButton: FC<SettingsButtonProps> = ({ onClick, disabled = false }) => {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="p-2 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors focus-interactive disabled:opacity-50 disabled:cursor-not-allowed"
      title="Settings"
      aria-label="Open settings"
    >
      <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true">
        <path d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"/>
        <path d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/>
      </svg>
    </button>
  );
};

/**
 * Close button subcomponent.
 * Displays an X icon button for closing the view.
 * The aria-label and title adapt based on context (popup vs sidepanel).
 *
 * @example
 * <ViewHeader.CloseButton onClick={() => window.close()} />
 *
 * @example
 * <ViewHeader.CloseButton
 *   onClick={handleClose}
 *   context="sidepanel"
 *   disabled={isSaving}
 * />
 */
const CloseButton: FC<CloseButtonProps> = ({ onClick, context = 'popup', disabled = false }) => {
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onClick();
    }
  };

  return (
    <button
      onClick={onClick}
      onKeyDown={handleKeyDown}
      disabled={disabled}
      className="p-2 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors focus-interactive disabled:opacity-50 disabled:cursor-not-allowed"
      title={context === 'sidepanel' ? 'Close side panel' : 'Close'}
      aria-label={context === 'sidepanel' ? 'Close side panel' : 'Close'}
    >
      <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
      </svg>
    </button>
  );
};

/**
 * ViewHeader component interface with subcomponents.
 * @internal
 */
interface ViewHeaderComponent extends FC<ViewHeaderProps> {
  /**
   * Actions container for composable action buttons.
   * @see {@link Actions}
   */
  Actions: FC<ActionsProps>;

  /**
   * Back button subcomponent.
   * @see {@link BackButton}
   */
  BackButton: FC<BackButtonProps>;

  /**
   * Settings button subcomponent.
   * @see {@link SettingsButton}
   */
  SettingsButton: FC<SettingsButtonProps>;

  /**
   * Close button subcomponent.
   * @see {@link CloseButton}
   */
  CloseButton: FC<CloseButtonProps>;
}

/**
 * ViewHeader functional component implementation.
 * @internal
 */
const ViewHeaderFC: FC<ViewHeaderProps> = ({
  icon = 'logo',
  title,
  subtitle,
  onSettings,
  onClose,
  onBack,
  actions,
  context: contextProp,
  className = '',
  children
}) => {
  // Auto-detect context if not provided
  const detectedContext = useExtensionContext();
  const context = contextProp ?? detectedContext;
  // Render icon based on type
  const renderIcon = () => {
    let iconElement: ReactElement;

    if (typeof icon === 'string') {
      // Look up icon component in map
      // Since icon has type IconType here (union of valid strings), this lookup is safe
      const IconComponent = ICON_COMPONENT_MAP[icon];

      // Render the icon component
      iconElement = <IconComponent />;
    } else {
      // icon is ReactElement here (can't be undefined due to default value)
      iconElement = icon;
    }

    return (
      <div
        className="w-10 h-10 bg-gradient-to-br from-purple-600 to-indigo-600 rounded-xl flex items-center justify-center text-white"
        role="img"
        aria-label={`${title} icon`}
      >
        {iconElement}
      </div>
    );
  };

  // Check if children contains Actions component (composable API)
  const hasActionsComponent = Children.toArray(children).some(
    child => isValidElement(child) && child.type === Actions
  );

  // Separate Actions from other children
  let actionsComponent: ReactNode = null;
  let otherChildren: ReactNode = null;

  if (hasActionsComponent) {
    const childrenArray = Children.toArray(children);
    actionsComponent = childrenArray.find(
      child => isValidElement(child) && child.type === Actions
    );
    otherChildren = childrenArray.filter(
      child => !(isValidElement(child) && child.type === Actions)
    );
  } else {
    otherChildren = children;
  }

  // Render actions using either composable API or legacy callback API
  const renderActions = () => {
    // If composable API is used, render it
    if (actionsComponent) {
      return <div className="flex items-center space-x-2">{actionsComponent}</div>;
    }

    // Handler wrappers with logging
    const handleBack = () => {
      Logger.debug('Navigation action', {
        component: 'ViewHeader',
        action: 'back',
        title,
        context
      });
      onBack?.();
    };

    const handleSettings = () => {
      Logger.debug('Navigation action', {
        component: 'ViewHeader',
        action: 'settings',
        title,
        context
      });
      onSettings?.();
    };

    const handleClose = () => {
      Logger.debug('Navigation action', {
        component: 'ViewHeader',
        action: 'close',
        title,
        context
      });
      onClose?.();
    };

    // Otherwise, use legacy callback API
    return (
      <div className="flex items-center space-x-2">
        {/* Back button - positioned first for standard UX */}
        {onBack && (
          <button
            onClick={handleBack}
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
            onClick={handleSettings}
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
            onClick={handleClose}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                handleClose();
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
          {renderActions()}
        </div>
      </div>

      {/* Children slot for additional content */}
      {otherChildren && (
        <div className="px-6">
          {otherChildren}
        </div>
      )}
    </header>
  );
};

/**
 * Unified header component for all extension views.
 *
 * Provides consistent header styling, navigation patterns, and accessibility features
 * across popup and sidepanel contexts. Supports both legacy callback API and modern
 * composable subcomponent API.
 *
 * **Features:**
 * - Auto-detects extension context (popup vs sidepanel)
 * - Predefined icon types or custom ReactElements
 * - Flexible action button system (legacy props or composable API)
 * - Full keyboard navigation support
 * - Dark mode compatible
 * - Semantic HTML with proper ARIA labels
 *
 * **Subcomponents:**
 * - `ViewHeader.Actions` - Container for custom action buttons
 * - `ViewHeader.BackButton` - Standardized back navigation button
 * - `ViewHeader.SettingsButton` - Settings gear icon button
 * - `ViewHeader.CloseButton` - Close button with context-aware labels
 *
 * @example
 * // Simple usage with title
 * <ViewHeader title="My Prompts" />
 *
 * @example
 * // With predefined icon and back navigation
 * <ViewHeader
 *   icon="settings"
 *   title="Settings"
 *   subtitle="Configure your preferences"
 *   onBack={() => setView('library')}
 * />
 *
 * @example
 * // Legacy API with multiple actions
 * <ViewHeader
 *   icon="logo"
 *   title="Library"
 *   onBack={() => goBack()}
 *   onSettings={() => openSettings()}
 *   onClose={() => window.close()}
 * />
 *
 * @example
 * // Composable API with custom actions
 * <ViewHeader icon="logo" title="My View">
 *   <ViewHeader.Actions>
 *     <ViewHeader.BackButton onClick={handleBack} />
 *     <button onClick={customAction}>Custom</button>
 *     <ViewHeader.SettingsButton onClick={handleSettings} />
 *     <ViewHeader.CloseButton onClick={handleClose} />
 *   </ViewHeader.Actions>
 * </ViewHeader>
 *
 * @example
 * // With children content (search, filters, etc.)
 * <ViewHeader icon="logo" title="Library">
 *   <SearchBar onSearch={handleSearch} placeholder="Search prompts..." />
 *   <CategoryFilter categories={categories} onSelect={handleFilter} />
 * </ViewHeader>
 *
 * @example
 * // Custom icon with ReactElement
 * <ViewHeader
 *   icon={<FolderIcon className="w-6 h-6 text-white" />}
 *   title="Categories"
 *   onBack={handleBack}
 * />
 *
 * @see {@link ViewHeaderProps} for all available props
 * @see {@link Actions} for composable actions API
 */
const ViewHeader = ViewHeaderFC as ViewHeaderComponent;
ViewHeader.Actions = Actions;
ViewHeader.BackButton = BackButton;
ViewHeader.SettingsButton = SettingsButton;
ViewHeader.CloseButton = CloseButton;

export default ViewHeader;
