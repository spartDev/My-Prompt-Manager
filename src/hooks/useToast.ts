import { useCallback, useEffect, useRef, useState } from 'react';
import { v4 as uuidv4 } from 'uuid';

import type { ToastType } from '../types/components';
import type { ShowToast, Toast, ToastSettings, UseToastReturn } from '../types/hooks';
import { Logger, toError } from '../utils';

export const TOAST_SETTINGS_KEY = 'toast_settings';

/** How long a Notification stays: a confirmation is glanced at, a failure must be read */
export const TOAST_DURATION = {
  confirmation: 2700,
  failure: 6000
} as const;

const DEFAULT_SETTINGS: ToastSettings = { enabled: true };

const isFailure = (type: ToastType): boolean => type === 'error' || type === 'warning';

/**
 * Reads the stored settings. Before { enabled }, they held one switch per type and a position: only
 * a user who had turned all four types off wanted silence. Returns whether the stored shape is old.
 */
const readSettings = (stored: unknown): { settings: ToastSettings; outdated: boolean } => {
  if (typeof stored !== 'object' || stored === null) {
    return { settings: DEFAULT_SETTINGS, outdated: false };
  }
  const record = stored as Record<string, unknown>;
  if (typeof record.enabled === 'boolean') {
    return { settings: { enabled: record.enabled }, outdated: false };
  }
  const types = record.enabledTypes;
  const allOff = typeof types === 'object' && types !== null
    && (['success', 'error', 'info', 'warning'] as const).every(type => (types as Record<string, unknown>)[type] === false);
  return { settings: { enabled: !allOff }, outdated: true };
};

export const useToast = (): UseToastReturn => {
  const [toast, setToast] = useState<Toast | null>(null);
  const [settings, setSettings] = useState<ToastSettings>(DEFAULT_SETTINGS);
  const [settingsLoaded, setSettingsLoaded] = useState(false);
  // showToast reads the latest switch, so turning Notifications on can show one at once
  const enabledRef = useRef(DEFAULT_SETTINGS.enabled);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const shownIdRef = useRef<string | null>(null);

  const clearTimer = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  useEffect(() => {
    const loadSettings = async () => {
      try {
        const result = await chrome.storage.local.get(TOAST_SETTINGS_KEY);
        const { settings: loaded, outdated } = readSettings(result[TOAST_SETTINGS_KEY]);
        enabledRef.current = loaded.enabled;
        setSettings(loaded);
        if (outdated) {
          await chrome.storage.local.set({ [TOAST_SETTINGS_KEY]: loaded });
        }
      } catch (error) {
        Logger.error('Failed to load toast settings', toError(error));
      } finally {
        setSettingsLoaded(true);
      }
    };
    void loadSettings();
    return clearTimer;
  }, [clearTimer]);

  const hideToast = useCallback((id: string) => {
    if (shownIdRef.current !== id) {return;}
    shownIdRef.current = null;
    clearTimer();
    setToast(null);
  }, [clearTimer]);

  const showToast: ShowToast = useCallback((message, type = 'info', options = {}) => {
    if (!enabledRef.current) {return;}

    const next: Toast = {
      id: uuidv4(),
      message,
      sub: options.sub || undefined,
      type,
      duration: options.duration ?? (isFailure(type) ? TOAST_DURATION.failure : TOAST_DURATION.confirmation),
      action: options.action
    };

    // A new Notification replaces the one on screen, and its own time starts
    clearTimer();
    shownIdRef.current = next.id;
    setToast(next);
    if (next.duration > 0) {
      timerRef.current = setTimeout(() => { hideToast(next.id); }, next.duration);
    }
  }, [clearTimer, hideToast]);

  const updateSettings = useCallback((changes: Partial<ToastSettings>) => {
    const updated: ToastSettings = { enabled: changes.enabled ?? enabledRef.current };
    enabledRef.current = updated.enabled;
    setSettings(updated);
    if (!updated.enabled && shownIdRef.current) {
      hideToast(shownIdRef.current);
    }
    chrome.storage.local.set({ [TOAST_SETTINGS_KEY]: updated }).catch((error: unknown) => {
      Logger.error('Failed to save toast settings', toError(error));
    });
  }, [hideToast]);

  return {
    toast,
    settings,
    settingsLoaded,
    showToast,
    hideToast,
    updateSettings
  };
};
