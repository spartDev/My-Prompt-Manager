// @vitest-environment node
/**
 * Every radio group in src/components takes its keyboard behavior from useRadioGroup (one tab stop,
 * arrows with wrap, Home, End), so a new one cannot forget it (My-Prompt-Manager-ek4, after PR #455).
 */

import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

const COMPONENTS = path.resolve(__dirname, '..');

/** role="radio", role={'radio'}, role={"radio"}; not radiogroup */
const RADIO_ROLE = /\brole=\{?\s*["'`]radio["'`]/;
const USES_HOOK = /\buseRadioGroup\s*\(/;

const sourceFiles = (dir: string): string[] =>
  readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) { return entry.name === '__tests__' ? [] : sourceFiles(full); }
    return /\.tsx?$/.test(entry.name) ? [full] : [];
  });

/** True when a source renders radios with hand-written keyboard handling */
const radiosWithoutHook = (source: string): boolean => RADIO_ROLE.test(source) && !USES_HOOK.test(source);

const RADIO_FILES = sourceFiles(COMPONENTS)
  .filter(file => RADIO_ROLE.test(readFileSync(file, 'utf8')))
  .map(file => path.relative(COMPONENTS, file));

describe('Radio groups in src/components', () => {
  it('finds the known radio groups, so the scan is not silently empty', () => {
    expect(RADIO_FILES).toEqual(expect.arrayContaining([
      'InterfaceModeSelector.tsx',
      'LibraryFilterBar.tsx',
      'settings/AppearanceSection.tsx'
    ]));
  });

  it('flags a radio without the hook and passes one with it', () => {
    const handWritten = `<button role="radio" aria-checked={on} onKeyDown={handleArrows} />`;
    const withHook = `const { getRadioProps } = useRadioGroup({ options, selectedIndex, onSelect });
      <button role={'radio'} aria-checked={on} {...getRadioProps(0)} />`;

    expect(radiosWithoutHook(handWritten)).toBe(true);
    expect(radiosWithoutHook(`<div role={"radio"} />`)).toBe(true);
    expect(radiosWithoutHook(`<div role="radiogroup" />`)).toBe(false);
    expect(radiosWithoutHook(withHook)).toBe(false);
  });

  it.each(RADIO_FILES)('%s takes its keyboard behavior from useRadioGroup', (file) => {
    const source = readFileSync(path.join(COMPONENTS, file), 'utf8');

    expect(radiosWithoutHook(source), `${file} renders role="radio" without useRadioGroup`).toBe(false);
  });
});
