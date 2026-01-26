import { useCallback } from 'react';

import { Logger, toError } from '../utils';

export interface UseSitePermissionsReturn {
  requestSitePermission: (hostname: string) => Promise<boolean>;
  requestPermissionForOrigin: (origin: string) => Promise<boolean>;
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

  return {
    requestSitePermission,
    requestPermissionForOrigin,
  };
}
