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
const RADIO_ROLES = new RegExp(RADIO_ROLE.source, 'g');
const USES_HOOK = /\buseRadioGroup\s*\(/;
/** {...getRadioProps(index)} on a radio element */
const RADIO_PROPS_SPREADS = /\{\s*\.\.\.\s*(?:\w+\.)?getRadioProps\s*\(/g;

const sourceFiles = (dir: string): string[] =>
  readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) { return entry.name === '__tests__' ? [] : sourceFiles(full); }
    return /\.tsx?$/.test(entry.name) ? [full] : [];
  });

/**
 * True when a source renders a radio with hand-written keyboard handling: it has no useRadioGroup call,
 * or fewer {...getRadioProps()} spreads than role="radio" elements (a second group beside a hooked one)
 */
const radiosWithoutHook = (source: string): boolean => {
  const radios = source.match(RADIO_ROLES)?.length ?? 0;
  if (radios === 0) { return false; }
  const spreads = source.match(RADIO_PROPS_SPREADS)?.length ?? 0;
  return !USES_HOOK.test(source) || spreads < radios;
};

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

  it('flags a hand-written radio group beside one that uses the hook', () => {
    const secondGroup = `const { getRadioProps } = useRadioGroup({ options, selectedIndex, onSelect });
      <button role="radio" aria-checked={on} {...getRadioProps(0)} />
      <button role="radio" aria-checked={size === 'small'} onKeyDown={handleArrows} />`;

    expect(radiosWithoutHook(secondGroup)).toBe(true);
  });

  it.each(RADIO_FILES)('%s takes its keyboard behavior from useRadioGroup', (file) => {
    const source = readFileSync(path.join(COMPONENTS, file), 'utf8');

    expect(radiosWithoutHook(source), `${file} renders a role="radio" without {...getRadioProps()} from useRadioGroup`).toBe(false);
  });
});
