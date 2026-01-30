import { useCallback } from 'react';

import { Logger, toError } from '../utils';

export interface UseSitePermissionsReturn {
  requestSitePermission: (hostname: string) => Promise<boolean>;
  requestPermissionForOrigin: (origin: string) => Promise<boolean>;
  checkPermission: (url: string) => Promise<boolean>;
  checkPermissionForOrigin: (origin: string) => Promise<boolean>;
}

export function useSitePermissions(): UseSitePermissionsReturn {
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

  return {
    requestSitePermission,
    requestPermissionForOrigin,
    checkPermission,
    checkPermissionForOrigin,
  };
}
