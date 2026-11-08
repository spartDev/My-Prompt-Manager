/**
 * E2E: Pick Element on a custom site, against a fresh and a stale build (My-Prompt-Manager-y6a)
 *
 * Chrome reads the manifest once, when it loads the extension. A `npm run build` afterwards writes
 * the content script loader under a new hashed name, while chrome.runtime.getManifest() still names
 * the old one, which is gone. The background then cannot inject the content script, and Pick Element
 * must say how to recover (reload the extension) instead of "Unable to locate content script file".
 *
 * Each test copies the custom-site build, so renaming the loader leaves the shared build alone.
 */
import fs from 'node:fs';
import path from 'node:path';

import type { BrowserContext } from '@playwright/test';

import { CUSTOM_SITE_EXTENSION_PATH, CUSTOM_SITE_URL } from '../fixtures/custom-site-build';
import { expect, test } from '../fixtures/extension';

const STALE_BUILD_PATH = path.resolve(process.cwd(), 'dist-e2e-stale-build');

const startPicker = async (context: BrowserContext, extensionId: string) => {
  await context.route(`${CUSTOM_SITE_URL}**`, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'text/html',
      body: '<!DOCTYPE html><html><body><textarea id="notes"></textarea></body></html>',
    });
  });
  const target = await context.newPage();
  await target.goto(CUSTOM_SITE_URL);

  const popup = await context.newPage();
  await popup.goto(`chrome-extension://${extensionId}/src/popup.html`);
  return popup.evaluate(async (url) => {
    const [tab] = await chrome.tabs.query({ url: `${url}*` });
    return chrome.runtime.sendMessage({ type: 'START_ELEMENT_PICKER', data: { tabId: tab?.id } });
  }, CUSTOM_SITE_URL);
};

test.describe('Element picker on a custom site', () => {
  test.use({ extensionPath: CUSTOM_SITE_EXTENSION_PATH });

  test('with the build Chrome loaded, Pick Element injects the content script and starts the picker', async ({
    context,
    extensionId,
  }) => {
    expect(await startPicker(context, extensionId)).toEqual(expect.objectContaining({ success: true }));
  });
});

test.describe('Element picker after a rebuild Chrome has not reloaded', () => {
  test.beforeAll(() => {
    fs.rmSync(STALE_BUILD_PATH, { recursive: true, force: true });
    fs.cpSync(CUSTOM_SITE_EXTENSION_PATH, STALE_BUILD_PATH, { recursive: true });
  });
  test.afterAll(() => {
    fs.rmSync(STALE_BUILD_PATH, { recursive: true, force: true });
  });
  test.use({ extensionPath: STALE_BUILD_PATH });

  test('Pick Element asks to reload the extension', async ({ context, extensionId }) => {
    // What a rebuild does once Chrome has read the manifest: the loader it names is no longer on disk
    const assets = path.join(STALE_BUILD_PATH, 'assets');
    const loader = fs.readdirSync(assets).find((file) => file.startsWith('index.ts-loader-'));
    expect(loader).toBeDefined();
    fs.renameSync(path.join(assets, loader as string), path.join(assets, 'index.ts-loader-rebuilt.js'));

    expect(await startPicker(context, extensionId)).toEqual({
      success: false,
      error: expect.stringMatching(/reload .*chrome:\/\/extensions/i),
    });
  });
});
