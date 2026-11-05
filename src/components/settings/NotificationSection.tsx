import { type FC, useCallback, useId, useMemo, useState } from 'react';

import type { ToastType } from '../../types/components';
import type { ToastSettings } from '../../types/hooks';
import { BellIcon, CheckCircleIcon, ChevronDownIcon, TestBellIcon } from '../icons/SettingsIcons';

import ToggleSwitch from './ToggleSwitch';

interface NotificationSectionProps {
  settings?: ToastSettings;
  onSettingsChange: (settings: Partial<ToastSettings>) => void;
  onTestToast: (type: ToastType) => void;
}

interface NotificationTypeRowProps {
  type: ToastType;
  label: string;
  description: string;
  color: string;
  enabled: boolean;
  onToggle: (type: ToastType, checked: boolean) => void;
}

const NotificationTypeRow: FC<NotificationTypeRowProps> = ({
  type,
  label,
  description,
  color,
  enabled,
  onToggle
}) => {
  return (
    <div className={`
      flex items-center justify-between p-3 rounded-lg border transition-all duration-200
      ${enabled
        ? 'border-default hover:bg-muted'
        : 'border-default bg-raised opacity-60'
      }
    `}>
      <div className="flex items-center space-x-3">
        <div data-testid="notification-type-mark" className={`w-1 h-8 rounded-sm transition-colors duration-200 ${enabled ? color : 'bg-(--border-color-input)'}`}></div>
        <div>
          <div className={`text-sm font-medium transition-colors duration-200 ${enabled ? 'text-primary' : 'text-tertiary'}`}>
            {label}
          </div>
          <div className={`text-xs transition-colors duration-200 ${enabled ? 'text-tertiary' : 'text-faint'}`}>
            {description}
          </div>
        </div>
      </div>
      <ToggleSwitch
        checked={enabled}
        onChange={(checked) => { onToggle(type, checked); }}
        ariaLabel={`Enable ${type} notifications`}
        size="small"
      />
    </div>
  );
};

// Configuration for notification types
const NOTIFICATION_TYPES = [
  {
    type: 'success' as const,
    label: 'Success',
    description: 'Confirmation messages (2.75s)',
    color: 'bg-success'
  },
  {
    type: 'error' as const,
    label: 'Error',
    description: 'Error messages (7s)',
    color: 'bg-danger'
  },
  {
    type: 'warning' as const,
    label: 'Warning',
    description: 'Important alerts (5s)',
    color: 'bg-warning'
  },
  {
    type: 'info' as const,
    label: 'Info',
    description: 'Informational messages (2.75s)',
    color: 'bg-accent'
  }
] as const;

const NotificationSection: FC<NotificationSectionProps> = ({
  settings,
  onSettingsChange,
  onTestToast
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [currentTestTypeIndex, setCurrentTestTypeIndex] = useState(0);

  const toggleExpanded = useCallback(() => { setIsExpanded(prev => !prev); }, []);
  const titleId = useId();

  // Memoize enabledTypes with defaults
  const currentEnabledTypes = useMemo(() => {
    const types = settings?.enabledTypes;
    return {
      success: types?.success ?? true,
      error: types?.error ?? true,
      info: types?.info ?? true,
      warning: types?.warning ?? true
    };
  }, [settings?.enabledTypes]);

  // Get list of enabled notification types
  const enabledTypes = (['success', 'error', 'warning', 'info'] as const).filter(
    type => currentEnabledTypes[type]
  );

  // Memoized handler for notification type toggles
  const handleTypeToggle = useCallback((type: ToastType, checked: boolean) => {
    onSettingsChange({
      enabledTypes: {
        ...currentEnabledTypes,
        [type]: checked
      }
    });
  }, [onSettingsChange, currentEnabledTypes]);

  // Handle test button click - cycles through enabled types
  const handleTestClick = () => {
    if (enabledTypes.length === 0) {return;}

    const currentType = enabledTypes[currentTestTypeIndex];
    onTestToast(currentType);

    // Move to next enabled type
    setCurrentTestTypeIndex((currentTestTypeIndex + 1) % enabledTypes.length);
  };

  return (
    <section aria-labelledby={titleId} className="border-t border-default pt-6">
      <button
        onClick={toggleExpanded}
        className="w-full flex items-center justify-between text-left mb-4 group"
        aria-expanded={isExpanded}
      >
        <div className="flex items-center gap-3">
          <div data-testid="section-icon" className="w-10 h-10 bg-accent-subtle text-accent rounded-xl flex items-center justify-center shrink-0">
            <BellIcon className="w-5 h-5" />
          </div>
          <div>
            <h2 id={titleId} className="text-xl font-semibold text-primary">
              Notifications
            </h2>
            <p className="text-sm text-tertiary">
              Customize toast notification behavior and appearance
            </p>
          </div>
        </div>
        <span className={`transition-transform ${isExpanded ? 'rotate-180' : ''}`}>
          <ChevronDownIcon className="w-5 h-5 text-tertiary" />
        </span>
      </button>

      {isExpanded && (
        <div className="space-y-4 animate-in slide-in-from-top-2 duration-200">
        {/* Position Setting */}
        <div className="bg-card rounded-xl p-4 border border-default">
          <h3 className="font-medium text-primary text-sm mb-3">
            Position
          </h3>
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => { onSettingsChange({ position: 'top-right' }); }}
              className={`
                relative p-4 rounded-lg border-2 transition-all
                ${(settings?.position ?? 'top-right') === 'top-right'
                  ? 'border-accent bg-accent-selected text-accent-strong font-semibold'
                  : 'border-default bg-card text-primary font-medium hover:border-strong'
                }
              `}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm">
                  Top Right
                </span>
                {(settings?.position ?? 'top-right') === 'top-right' && <CheckCircleIcon className="w-5 h-5 text-accent" />}
              </div>
              <div className="relative h-12 bg-subtle rounded-sm border border-default">
                <div className="absolute top-1 right-1 w-16 h-3 bg-accent rounded-sm"></div>
              </div>
            </button>

            <button
              onClick={() => { onSettingsChange({ position: 'bottom-right' }); }}
              className={`
                relative p-4 rounded-lg border-2 transition-all
                ${settings?.position === 'bottom-right'
                  ? 'border-accent bg-accent-selected text-accent-strong font-semibold'
                  : 'border-default bg-card text-primary font-medium hover:border-strong'
                }
              `}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm">
                  Bottom Right
                </span>
                {settings?.position === 'bottom-right' && <CheckCircleIcon className="w-5 h-5 text-accent" />}
              </div>
              <div className="relative h-12 bg-subtle rounded-sm border border-default">
                <div className="absolute bottom-1 right-1 w-16 h-3 bg-accent rounded-sm"></div>
              </div>
            </button>
          </div>
        </div>

        {/* Notification Types */}
        <div className="bg-card rounded-xl p-4 border border-default">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h3 className="font-medium text-primary text-sm">
                Notification Types
              </h3>
              <p className="text-xs text-tertiary mt-1">
                Choose which types of notifications you want to see
              </p>
            </div>
            <button
              type="button"
              onClick={handleTestClick}
              disabled={enabledTypes.length === 0}
              className={`
                flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium transition-colors
                ${enabledTypes.length === 0
                  ? 'bg-card border border-default text-faint cursor-not-allowed'
                  : 'bg-card border border-strong text-secondary hover:bg-muted focus-secondary'
                }
              `}
            >
              <TestBellIcon />
              <span>Test</span>
            </button>
          </div>
          <div className="space-y-3">
            {NOTIFICATION_TYPES.map(({ type, label, description, color }) => (
              <NotificationTypeRow
                key={type}
                type={type}
                label={label}
                description={description}
                color={color}
                enabled={currentEnabledTypes[type]}
                onToggle={handleTypeToggle}
              />
            ))}
          </div>
        </div>
        </div>
      )}
    </section>
  );
};

export default NotificationSection;