import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

function globalSetup(): void {
  execSync('npm run build', { stdio: 'inherit' });

  const outputDir = path.resolve(
    process.cwd(),
    process.env.EXTENSION_OUTPUT_DIR ?? path.join('.output', 'chrome-mv3')
  );

  if (!fs.existsSync(outputDir)) {
    throw new Error(`Expected built extension at ${outputDir}, but the folder was not found.`);
  }
}

export default globalSetup;
