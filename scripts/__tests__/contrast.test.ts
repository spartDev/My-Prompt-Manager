import { spawnSync } from 'node:child_process';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { getContrastRatio } from '../../src/constants/colors';

const ROOT = path.resolve(__dirname, '..', '..');
const TSX = path.join(ROOT, 'node_modules', '.bin', 'tsx');

const runContrast = (...args: string[]) =>
  spawnSync(TSX, [path.join(ROOT, 'scripts', 'contrast.ts'), ...args], { encoding: 'utf8' });

describe('scripts/contrast.ts', () => {
  it('prints 21:1 for black on white, the pair colors.accessibility.test.ts pins', () => {
    const result = runContrast('#000000', '#FFFFFF');
    expect(result.status).toBe(0);
    expect(result.stdout).toBe('21.00:1  AA pass, AAA pass, AA large text pass\n');
  });

  it('prints the ratio getContrastRatio gives, with the verdicts of meetsWCAGStandard', () => {
    const result = runContrast('5a5a5a', 'ffffff');
    expect(result.status).toBe(0);
    expect(result.stdout).toBe(
      `${getContrastRatio('#5A5A5A', '#FFFFFF').toFixed(2)}:1  AA pass, AAA fail, AA large text pass\n`
    );
  });

  it.each([[[]], [['#000000']], [['black', '#FFFFFF']], [['#000', '#FFF']]])('exits 2 on %j', args => {
    const result = runContrast(...args);
    expect(result.status).toBe(2);
    expect(result.stderr).toContain('Usage');
  });
});
