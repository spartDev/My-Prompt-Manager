/**
 * A real update of the extension in a running browser: Chromium fires `onInstalled` with reason
 * 'update' and the previous version, as when the Chrome Web Store updates a user's install.
 *
 * A relaunch does not do it. Chromium installs an extension loaded with --load-extension afresh at
 * every launch, so a build copied at a higher version over the loaded folder, then a relaunch,
 * fires 'install' (store kept), never 'update' (probe of 2026-11-18, Chrome for Testing of
 * Playwright, ticket My-Prompt-Manager-ojz.1). What fires 'update' is the Reload of
 * chrome://extensions (`chrome.developerPrivate.reload`) once developer mode is on; with developer
 * mode off, that Reload disables the extension instead (disable reason `unsupportedDeveloperExtension`).
 */
import path from 'node:path';

import type { BrowserContext, Worker } from '@playwright/test';

import { copyDistWithManifest } from './dist-copy';
import { DEFAULT_EXTENSION_PATH } from './extension';
import { addOnInstalledProbe } from './oninstalled-probe';

/** The part of chrome.developerPrivate the update uses: chrome://extensions has it, @types/chrome does not */
interface DeveloperPrivate {
  updateProfileConfiguration: (update: { inDeveloperMode: boolean }) => Promise<void>;
  reload: (extensionId: string, options: { failQuietly: boolean }) => Promise<void>;
}

/** What a copy of the build carries besides itself */
export interface BuildCopyOptions {
  /** The observer of onInstalled of fixtures/oninstalled-probe.ts, which records each event the copy fires */
  readonly onInstalledProbe?: boolean;
}

/** Copies the build in dist/ to `target`, replacing what was there, at manifest version `version` */
export function copyBuildAt(target: string, version: string, { onInstalledProbe = false }: BuildCopyOptions = {}): void {
  copyDistWithManifest(path.resolve(DEFAULT_EXTENSION_PATH), target, (manifest) => ({ ...manifest, version }));
  if (onInstalledProbe) {
    addOnInstalledProbe(target);
  }
}

/** The running service worker of the extension, once it runs at `version` */
export const serviceWorkerAt = async (context: BrowserContext, extensionId: string, version: string): Promise<Worker> => {
  const deadline = Date.now() + (process.env.CI ? 60_000 : 20_000);
  while (Date.now() < deadline) {
    for (const worker of context.serviceWorkers()) {
      if (!worker.url().startsWith(`chrome-extension://${extensionId}/`)) {
        continue;
      }
      // A worker of the version before can still be listed while it goes away
      const running = await worker.evaluate(() => chrome.runtime.getManifest().version).catch(() => undefined);
      if (running === version) {
        return worker;
      }
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`The service worker of ${extensionId} did not start at ${version}`);
};

/**
 * Updates the extension loaded from `extensionPath` to the build of dist/ at `version`: copies it
 * over the folder, turns developer mode on and reloads the extension from chrome://extensions, so
 * `onInstalled` fires 'update' with the version it had. Resolves with the new service worker.
 */
export const updateExtensionInPlace = async (
  context: BrowserContext,
  extensionId: string,
  extensionPath: string,
  version: string,
  options: BuildCopyOptions = {}
): Promise<Worker> => {
  copyBuildAt(extensionPath, version, options);

  const extensions = await context.newPage();
  try {
    await extensions.goto('chrome://extensions');
    await extensions.evaluate(async (id) => {
      const developerPrivate = (chrome as unknown as { developerPrivate: DeveloperPrivate }).developerPrivate;
      await developerPrivate.updateProfileConfiguration({ inDeveloperMode: true });
      await developerPrivate.reload(id, { failQuietly: false });
    }, extensionId);
  } finally {
    await extensions.close();
  }

  return serviceWorkerAt(context, extensionId, version);
};
