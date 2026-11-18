/**
 * An observer of `chrome.runtime.onInstalled`, added to a test build so a spec can read which event
 * an install, a relaunch or an update fired, and from which version (My-Prompt-Manager-ojz.12).
 *
 * The extension logs its install and update writes with Logger.info, which a production build does
 * not print, and the What's new record shows an 'update' only when it had no Release of install. So
 * the copy gets one more listener: a module imported before the service worker of the build, which
 * appends each event to `chrome.storage.session`. Nothing of the build is changed: the manifest
 * names a new entry that imports the probe, then the build's own service worker loader, so both
 * listeners are registered in the same first run of the worker. The probe writes nothing to
 * `chrome.storage.local`, so every record a spec reads there is the extension's own.
 */
import fs from 'node:fs';
import path from 'node:path';

import type { Worker } from '@playwright/test';

/** The `chrome.storage.session` key the probe appends the events to */
export const ON_INSTALLED_PROBE_KEY = 'e2eOnInstalledProbe';

/** One `onInstalled` event as the probe saw it, with the version the extension then ran at */
export interface OnInstalledEvent {
  readonly reason: string;
  readonly previousVersion: string | null;
  readonly version: string;
}

const PROBE_FILE = 'e2e-oninstalled-probe.js';
const ENTRY_FILE = 'e2e-service-worker.js';

const PROBE_SOURCE = `// Test-only observer (tests/e2e/fixtures/oninstalled-probe.ts): records each onInstalled event
chrome.runtime.onInstalled.addListener((details) => {
  const event = { reason: details.reason, previousVersion: details.previousVersion ?? null, version: chrome.runtime.getManifest().version };
  void chrome.storage.session.get(${JSON.stringify(ON_INSTALLED_PROBE_KEY)}).then((stored) => {
    const seen = Array.isArray(stored[${JSON.stringify(ON_INSTALLED_PROBE_KEY)}]) ? stored[${JSON.stringify(ON_INSTALLED_PROBE_KEY)}] : [];
    return chrome.storage.session.set({ ${JSON.stringify(ON_INSTALLED_PROBE_KEY)}: [...seen, event] });
  });
});
`;

interface ManifestWithWorker {
  background: { service_worker: string; type?: string };
}

/**
 * Adds the probe to the build copied at `extensionPath`: the probe module, and an entry that
 * imports it before the build's own service worker, named by the manifest. Run on a fresh copy.
 */
export function addOnInstalledProbe(extensionPath: string): void {
  const manifestPath = path.join(extensionPath, 'manifest.json');
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8')) as ManifestWithWorker;
  const worker = manifest.background.service_worker;
  if (manifest.background.type !== 'module' || worker === ENTRY_FILE) {
    throw new Error(`The probe needs a fresh module service worker; the manifest names ${worker} (${String(manifest.background.type)})`);
  }

  fs.writeFileSync(path.join(extensionPath, PROBE_FILE), PROBE_SOURCE);
  fs.writeFileSync(path.join(extensionPath, ENTRY_FILE), `import './${PROBE_FILE}';\nimport './${worker}';\n`);
  fs.writeFileSync(manifestPath, JSON.stringify({ ...manifest, background: { ...manifest.background, service_worker: ENTRY_FILE } }, null, 2));
}

/**
 * The `onInstalled` events the probe recorded since the browser started, once one of them is `awaited`
 * (by default, any event)
 */
export const onInstalledEvents = async (
  worker: Worker,
  awaited: (event: OnInstalledEvent) => boolean = () => true
): Promise<readonly OnInstalledEvent[]> => {
  const deadline = Date.now() + (process.env.CI ? 30_000 : 15_000);
  let events: readonly OnInstalledEvent[] = [];
  while (Date.now() < deadline) {
    events = await worker.evaluate(async (key) => {
      const stored = await chrome.storage.session.get(key);
      return (Array.isArray(stored[key]) ? stored[key] : []) as OnInstalledEvent[];
    }, ON_INSTALLED_PROBE_KEY);
    if (events.some(awaited)) {
      return events;
    }
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  throw new Error(`The onInstalled probe did not record the event awaited; it recorded ${JSON.stringify(events)}`);
};
