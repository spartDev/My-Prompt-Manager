/**
 * The test-only build the custom-site specs load (My-Prompt-Manager-aqe).
 *
 * A custom site is any https origin the user adds in Settings > AI sites. The extension
 * asks for it as an optional host permission (`optional_host_permissions` in manifest.json), and
 * Chrome grants that only through its permission prompt, which Playwright can neither show nor
 * accept. The background then refuses to inject the content script, as it should without the
 * permission.
 *
 * So the global setup copies dist/ to dist-e2e-custom-site/ and adds the test origin to the copy's
 * `host_permissions`. Chrome grants a required host permission when it loads the extension, so
 * there `chrome.permissions.request` for the origin resolves true with no prompt, and everything
 * after it (the Settings form, the background injector, the content script and the chunks it
 * imports) runs as built. Only that one manifest field differs from dist/.
 */
import path from 'node:path';

import { copyDistWithManifest } from './dist-copy';

/** A page that is none of the built-in Platforms; the specs serve it with page.route, nothing goes to the network */
export const CUSTOM_SITE_HOSTNAME = 'custom-site.example';
export const CUSTOM_SITE_URL = `https://${CUSTOM_SITE_HOSTNAME}/`;

export const CUSTOM_SITE_EXTENSION_PATH = path.resolve(process.cwd(), 'dist-e2e-custom-site');

/** Copies the build in `dist` to CUSTOM_SITE_EXTENSION_PATH and grants the test origin there */
export function buildCustomSiteExtension(dist: string): void {
  copyDistWithManifest(dist, CUSTOM_SITE_EXTENSION_PATH, (manifest) => ({
    ...manifest,
    host_permissions: [...(manifest.host_permissions ?? []), `https://${CUSTOM_SITE_HOSTNAME}/*`]
  }));
}
