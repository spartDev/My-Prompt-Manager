import { spawnSync } from 'node:child_process';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { replacesNotes } from '../bd-notes-guard.mjs';

const SCRIPT = path.resolve(__dirname, '..', 'bd-notes-guard.mjs');

const runHook = (stdin: string) => spawnSync(process.execPath, [SCRIPT], { input: stdin, encoding: 'utf8' });

const bashCall = (command: string) => JSON.stringify({ tool_name: 'Bash', tool_input: { command } });

describe('replacesNotes', () => {
  it.each([
    'bd update My-Prompt-Manager-abc --notes "found it"',
    'bd update My-Prompt-Manager-abc --notes="found it"',
    'cd /repo && bd update My-Prompt-Manager-abc --notes x',
    'bd show My-Prompt-Manager-abc; bd update My-Prompt-Manager-abc --status=open --notes x',
    'BEADS_DIR=/repo/.beads bd update My-Prompt-Manager-abc --notes x',
    '/usr/local/bin/bd update My-Prompt-Manager-abc --notes x',
    'bd update My-Prompt-Manager-abc --notes "$(cat <<\'EOF\'\nline one\nEOF\n)"',
    'result="$(bd update My-Prompt-Manager-abc --notes x)"',
    'echo "`bd update My-Prompt-Manager-abc --notes x`"',
    'echo $(bd update My-Prompt-Manager-abc --notes x)',
    'if bd update My-Prompt-Manager-abc --notes x; then echo updated; fi',
    'for id in abc def; do bd update "My-Prompt-Manager-$id" --notes x; done',
    'bash -c \'bd update My-Prompt-Manager-abc --notes x\'',
    'eval "bd update My-Prompt-Manager-abc --notes x"',
    'cat <<EOF\n$(bd update My-Prompt-Manager-abc --notes x)\nEOF',
    'cat > example.txt <<\'EOF\'\nbd update My-Prompt-Manager-abc --notes x\nEOF\nbd update My-Prompt-Manager-abc --notes x',
    'bash <<\'EOF\'\nbd update My-Prompt-Manager-abc --notes x\nEOF',
    'cat <<\'EOF\' | sh\nbd update My-Prompt-Manager-abc --notes x\nEOF',
    'echo \'bd update My-Prompt-Manager-abc --notes x\' | bash',
    '>/dev/null bd update My-Prompt-Manager-abc --notes x',
    '2>&1 bd update My-Prompt-Manager-abc --notes x',
    '&>/dev/null bd update My-Prompt-Manager-abc --notes x',
    '2> /dev/null bd update My-Prompt-Manager-abc --notes x',
  ])('blocks %s', (command) => {
    expect(replacesNotes(command)).toBe(true);
  });

  it.each([
    'bd update My-Prompt-Manager-abc --append-notes "found it"',
    'bd create --title "New ticket" --notes "context"',
    'bd update My-Prompt-Manager-abc --description "run it with --notes and it replaces"',
    'git commit -m "bd update --notes replaces the notes"',
    'echo bd update My-Prompt-Manager-abc --notes x',
    'bd show My-Prompt-Manager-abc',
    'cat > example.txt <<\'EOF\'\nbd update My-Prompt-Manager-abc --notes x\nEOF',
    'cat > example.txt <<-EOF\n\tbd update My-Prompt-Manager-abc --notes x\n\tEOF',
    'echo done # then bd update My-Prompt-Manager-abc --notes x',
    'echo "$(bd show My-Prompt-Manager-abc)"',
    'echo \'bd update My-Prompt-Manager-abc --notes x\' > notes.txt',
    'bd show My-Prompt-Manager-abc 2>&1 | tail -5',
    'npm test > out.log 2>&1; bd update My-Prompt-Manager-abc --append-notes "tests pass"',
  ])('lets %s through', (command) => {
    expect(replacesNotes(command)).toBe(false);
  });
});

describe('bd-notes-guard hook', () => {
  it('exits 2 and names --append-notes when a Bash call replaces the notes', () => {
    const result = runHook(bashCall('bd update My-Prompt-Manager-abc --notes x'));

    expect(result.status).toBe(2);
    expect(result.stderr).toContain('--append-notes');
  });

  it('exits 0 silently for any other Bash call', () => {
    const result = runHook(bashCall('bd update My-Prompt-Manager-abc --append-notes x'));

    expect(result.status).toBe(0);
    expect(result.stderr).toBe('');
  });

  it('exits 0 when its input is not a tool call, so a broken payload never blocks Bash', () => {
    expect(runHook('not json').status).toBe(0);
    expect(runHook(JSON.stringify({ tool_name: 'Bash' })).status).toBe(0);
  });
});
