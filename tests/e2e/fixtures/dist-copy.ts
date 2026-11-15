/**
 * The copy of dist/ every test-only build starts from: the custom-site build (custom-site-build.ts)
 * and the What's new 2.0.0 build (whats-new-build.ts). Each changes its manifest only.
 */
import fs from 'node:fs';
import path from 'node:path';

/** A manifest as the test builds edit it: only the fields they touch are typed */
export interface TestBuildManifest {
  version: string;
  host_permissions?: string[];
}

/**
 * Copies the build in `dist` to `target`, replacing what was there, and rewrites the copy's
 * manifest with `edit`. Everything else runs as built. Shared by every test-only build.
 */
export function copyDistWithManifest(dist: string, target: string, edit: (manifest: TestBuildManifest) => TestBuildManifest): void {
  fs.rmSync(target, { recursive: true, force: true });
  fs.cpSync(dist, target, { recursive: true });

  const manifestPath = path.join(target, 'manifest.json');
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8')) as TestBuildManifest;
  fs.writeFileSync(manifestPath, JSON.stringify(edit(manifest), null, 2));
}
