/**
 * The onInstalled observer of tests/e2e/fixtures/oninstalled-probe.ts goes on copies of the build
 * only, never in dist/, the build `npm run package` zips (My-Prompt-Manager-ojz.18). No browser: the
 * guard is checked on the folders themselves.
 */
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { expect, test } from '@playwright/test';

import { DEFAULT_EXTENSION_PATH } from '../fixtures/extension';
import { copyBuildAt } from '../fixtures/extension-update';
import { addOnInstalledProbe, resolvesInsideDist } from '../fixtures/oninstalled-probe';

const dist = path.resolve(DEFAULT_EXTENSION_PATH);

/** Every file of dist/, each with its bytes, to show the refusals wrote nothing there */
const filesOf = async (folder: string): Promise<Record<string, string>> => {
  const entries = await fs.readdir(folder, { recursive: true, withFileTypes: true });
  const files = entries.filter((entry) => entry.isFile()).map((entry) => path.join(entry.parentPath, entry.name));
  return Object.fromEntries(await Promise.all(files.sort().map(async (file) => [path.relative(folder, file), (await fs.readFile(file)).toString('base64')] as const)));
};

test.describe('The onInstalled probe', () => {
  let scratch: string;

  test.beforeEach(async () => {
    scratch = await fs.mkdtemp(path.join(os.tmpdir(), 'playwright-probe-guard-'));
  });

  test.afterEach(async () => {
    await fs.rm(scratch, { recursive: true, force: true });
  });

  test('refuses dist/ and every path that resolves inside it, and writes nothing there', async () => {
    const link = path.join(scratch, 'link-to-dist');
    await fs.symlink(dist, link, 'dir');
    const before = await filesOf(dist);

    const refused = [
      dist,
      `${dist}${path.sep}`,
      path.join(dist, 'src'),
      [dist, '..', path.basename(dist)].join(path.sep),
      path.relative(process.cwd(), dist),
      link,
      path.join(link, 'not-yet-there')
    ];
    for (const target of refused) {
      expect(resolvesInsideDist(target), target).toBe(true);
      expect(() => addOnInstalledProbe(target), target).toThrow(/never in dist\//);
    }

    expect(await filesOf(dist)).toEqual(before);
    console.log(`[probe guard] refused ${String(refused.length)} paths: ${JSON.stringify(refused)}; dist/ unchanged (${String(Object.keys(before).length)} files)`);
  });

  test('takes a copy of the build, and a folder whose name only starts like dist', async () => {
    expect(resolvesInsideDist(`${dist}-e2e-whats-new`)).toBe(false);
    expect(resolvesInsideDist(path.dirname(dist))).toBe(false);

    const copy = path.join(scratch, 'build');
    copyBuildAt(copy, '1.9.1', { onInstalledProbe: true });
    const manifest = JSON.parse(await fs.readFile(path.join(copy, 'manifest.json'), 'utf-8')) as { version: string; background: { service_worker: string } };
    expect(manifest.version).toBe('1.9.1');
    expect(manifest.background.service_worker).toBe('e2e-service-worker.js');
  });
});
