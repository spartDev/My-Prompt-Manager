import { spawnSync } from 'node:child_process';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

const SCRIPT = path.resolve(__dirname, '..', '..', '.claude', 'skills', 'parallel-claude', 'scripts', 'test-launch-claims.sh');

describe('ticket claims of the parallel launchers', () => {
  // The cases live in the bash script, against a stub bd and a stub tmux in a scratch repository
  it('claim, roll back and release as test-launch-claims.sh checks', () => {
    const run = spawnSync('bash', [SCRIPT], { encoding: 'utf8' });

    expect(run.stdout + run.stderr).toMatch(/\d+ passed, 0 failed/);
    expect(run.status).toBe(0);
  }, 60_000);
});
