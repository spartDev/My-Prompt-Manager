import { useCallback } from 'react';

import { Logger, toError } from '../utils';

export interface PermissionResult {
  granted: boolean;
  error?: string;
}

export interface UseSitePermissionsReturn {
  requestSitePermission: (hostname: string) => Promise<boolean>;
  requestPermissionForOrigin: (origin: string) => Promise<boolean>;
  checkPermission: (url: string) => Promise<boolean>;
  checkPermissionForOrigin: (origin: string) => Promise<boolean>;
  requestPermissionWithResult: (hostname: string) => Promise<PermissionResult>;
}

export function useSitePermissions(): UseSitePermissionsReturn {
  const checkPermissionForOrigin = useCallback(async (origin: string): Promise<boolean> => {
    try {
      return await chrome.permissions.contains({ origins: [origin] });
    } catch (error) {
      Logger.error('Failed to check permission', toError(error));
      return false;
    }
  }, []);

  const checkPermission = useCallback(
    async (url: string): Promise<boolean> => {
      try {
        const parsedUrl = new URL(url);
        const origin = `${parsedUrl.protocol}//${parsedUrl.hostname}/*`;
        return await checkPermissionForOrigin(origin);
      } catch (error) {
        Logger.error('Failed to parse URL for permission check', toError(error));
        return false;
      }
    },
    [checkPermissionForOrigin]
  );

  const requestPermissionForOrigin = useCallback(async (origin: string): Promise<boolean> => {
    try {
      const granted = await chrome.permissions.request({
        origins: [origin],
      });

      if (!granted) {
        return false;
      }

      await chrome.runtime.sendMessage({
        type: 'REQUEST_PERMISSION',
        data: { origins: [origin] },
      });

      return true;
    } catch (error) {
      Logger.error('Failed to request permission', toError(error));
      return false;
    }
  }, []);

  const requestSitePermission = useCallback(
    async (hostname: string): Promise<boolean> => {
      const origin = `https://${hostname}/*`;
      return requestPermissionForOrigin(origin);
    },
    [requestPermissionForOrigin]
  );

  const requestPermissionWithResult = useCallback(
    async (hostname: string): Promise<PermissionResult> => {
      const origin = `https://${hostname}/*`;

      try {
        const granted = await chrome.permissions.request({
          origins: [origin],
        });

        if (!granted) {
          return { granted: false };
        }

        await chrome.runtime.sendMessage({
          type: 'REQUEST_PERMISSION',
          data: { origins: [origin] },
        });

        return { granted: true };
      } catch (error) {
        Logger.error('Failed to request permission', toError(error));
        return { granted: false, error: 'Failed to request permission' };
      }
    },
    []
  );

  return {
    requestSitePermission,
    requestPermissionForOrigin,
    checkPermission,
    checkPermissionForOrigin,
    requestPermissionWithResult,
  };
}
