import { useState, useCallback, useRef, useEffect } from 'react';
import { v4 as uuidv4 } from 'uuid';

import { Toast, UseToastReturn, ToastSettings, ToastAction } from '../types/hooks';
import { Logger, toError } from '../utils';

const TOAST_SETTINGS_KEY = 'toast_settings';

const DEFAULT_SETTINGS: ToastSettings = {
  position: 'top-right',
  enabledTypes: {
    success: true,
    error: true,
    info: true,
    warning: true
  },
  enableGrouping: true,
  groupingWindow: 500 // 500ms window for grouping
};

export const useToast = (): UseToastReturn => {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [queue, setQueue] = useState<Toast[]>([]);
  const [settings, setSettings] = useState<ToastSettings>(DEFAULT_SETTINGS);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const toastsCountRef = useRef(0);

  // Keep ref in sync with toasts length for use in callbacks
  useEffect(() => {
    toastsCountRef.current = toasts.length;
  }, [toasts.length]);

  // Load settings from Chrome storage on mount
  useEffect(() => {
    const loadSettings = async () => {
      try {
        const result = await chrome.storage.local.get(TOAST_SETTINGS_KEY);
        if (result[TOAST_SETTINGS_KEY]) {
          const savedSettings = result[TOAST_SETTINGS_KEY] as ToastSettings;
          setSettings({ ...DEFAULT_SETTINGS, ...savedSettings });
        }
      } catch (error) {
        Logger.error('Failed to load toast settings', toError(error));
      }
    };
    void loadSettings();
  }, []);

  // Process queue when current toast is dismissed
  useEffect(() => {
    if (toasts.length === 0 && queue.length > 0) {
      // Use microtask to avoid synchronous setState in effect
      queueMicrotask(() => {
        setQueue(prevQueue => {
          if (prevQueue.length === 0) {
            return prevQueue; // No items to process
          }

          const nextToast = prevQueue[0];
          toastsCountRef.current = 1; // Update ref synchronously
          setToasts([nextToast]);
          return prevQueue.slice(1);
        });
      });
    }

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [toasts.length, queue.length]);

  const showToast = useCallback((
    message: string,
    type: Toast['type'] = 'info',
    duration?: number,
    action?: ToastAction
  ) => {
    // Check if this toast type is enabled
    if (!settings.enabledTypes[type]) {
      return;
    }

    // Truncate message if it exceeds 80 characters (Material Design recommendation)
    const MAX_LENGTH = 80;
    const truncatedMessage = message.length > MAX_LENGTH
      ? `${message.substring(0, MAX_LENGTH - 3)}...`
      : message;

    // Set duration based on type if not explicitly provided
    const toastDuration = duration !== undefined ? duration : (() => {
      switch (type) {
        case 'error':
          return 7000; // 7 seconds for errors
        case 'warning':
          return 5000; // 5 seconds for warnings
        case 'success':
        case 'info':
        default:
          return 2750; // 2.75 seconds for success/info
      }
    })();

    const toast: Toast = {
      id: uuidv4(),
      message: truncatedMessage,
      type,
      duration: toastDuration,
      action
    };

    // Check state via ref and call appropriate setter (avoids nested setState anti-pattern)
    if (toastsCountRef.current === 0) {
      // No toast showing, show immediately
      toastsCountRef.current = 1; // Update ref synchronously for rapid successive calls
      setToasts([toast]);
    } else {
      // Toast already showing, queue this one
      setQueue(prev => [...prev, toast]);
    }
  }, [settings.enabledTypes]);

  const hideToast = useCallback((id: string) => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    setToasts(prev => {
      const filtered = prev.filter(toast => toast.id !== id);
      toastsCountRef.current = filtered.length; // Update ref synchronously
      return filtered;
    });
  }, []);

  const clearAllToasts = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    toastsCountRef.current = 0; // Update ref synchronously
    setToasts([]);
    setQueue([]);
  }, []);

  const updateSettings = useCallback((newSettings: Partial<ToastSettings>) => {
    setSettings(prevSettings => {
      const updatedSettings = { ...prevSettings, ...newSettings };

      // Save to storage asynchronously
      chrome.storage.local.set({ [TOAST_SETTINGS_KEY]: updatedSettings }).catch((error: unknown) => {
        Logger.error('Failed to save toast settings', toError(error));
      });

      return updatedSettings;
    });
  }, []);

  return {
    toasts,
    queueLength: queue.length,
    settings,
    showToast,
    hideToast,
    clearAllToasts,
    updateSettings
  };
};