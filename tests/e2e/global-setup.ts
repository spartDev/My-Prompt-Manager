import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

import { buildCustomSiteExtension } from './fixtures/custom-site-build';

function globalSetup(): void {
  execSync('npm run build', { stdio: 'inherit' });

  const distPath = path.resolve(process.cwd(), 'dist');
  if (!fs.existsSync(distPath)) {
    throw new Error(`Expected built extension at ${distPath}, but the folder was not found.`);
  }

  buildCustomSiteExtension(distPath);
}

export default globalSetup;
