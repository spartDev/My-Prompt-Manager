// @vitest-environment node
/**
 * Every modal dialog in src/components (aria-modal) takes its keyboard behavior from useModalFocus:
 * focus moves in, Tab wraps inside, Escape closes, focus returns to the opener. Three review rounds
 * found a dialog that hand-wrote part of it (Codex on PRs #465, #501 and #521), so a new one cannot.
 * HAND_WRITTEN names the dialogs that still carry their own handlers; it only shrinks.
 */

import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

const COMPONENTS = path.resolve(__dirname, '..');

/** aria-modal="true", aria-modal={true}, aria-modal */
const ARIA_MODAL = /\baria-modal\b/;
const USES_HOOK = /\buseModalFocus\s*\(/;

/** Dialogs with hand-written focus handling, kept until each is migrated to useModalFocus: none since My-Prompt-Manager-xaz */
const HAND_WRITTEN: string[] = [];

const sourceFiles = (dir: string): string[] =>
  readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) { return entry.name === '__tests__' ? [] : sourceFiles(full); }
    return /\.tsx?$/.test(entry.name) ? [full] : [];
  });

/** True when a source renders an aria-modal dialog without calling useModalFocus */
const dialogWithoutHook = (source: string): boolean => ARIA_MODAL.test(source) && !USES_HOOK.test(source);

const read = (file: string): string => readFileSync(path.join(COMPONENTS, file), 'utf8');

const DIALOG_FILES = sourceFiles(COMPONENTS)
  .filter((file) => ARIA_MODAL.test(readFileSync(file, 'utf8')))
  .map((file) => path.relative(COMPONENTS, file));

describe('Modal dialogs in src/components', () => {
  it('finds the known dialogs, so the scan is not silently empty', () => {
    expect(DIALOG_FILES).toEqual(expect.arrayContaining(['ConfirmDialog.tsx', 'analytics/AnalyticsTab.tsx']));
  });

  it('flags a dialog without the hook and passes one with it', () => {
    const handWritten = `<div role="dialog" aria-modal="true" onKeyDown={trapFocus} />`;
    const withHook = `useModalFocus({ isOpen, onClose, containerRef, initialFocusRef });
      <div role="dialog" aria-modal="true" ref={containerRef} tabIndex={-1} />`;

    expect(dialogWithoutHook(handWritten)).toBe(true);
    expect(dialogWithoutHook(`<div role="dialog" aria-modal={true} />`)).toBe(true);
    expect(dialogWithoutHook(withHook)).toBe(false);
    expect(dialogWithoutHook(`<div role="alertdialog" />`)).toBe(false);
  });

  it.each(DIALOG_FILES.filter((file) => !HAND_WRITTEN.includes(file)))(
    '%s takes its keyboard behavior from useModalFocus',
    (file) => {
      expect(dialogWithoutHook(read(file))).toBe(false);
    }
  );

  it('HAND_WRITTEN names only dialogs that still lack the hook (remove a migrated one)', () => {
    const stale = HAND_WRITTEN.filter((file) => !DIALOG_FILES.includes(file) || !dialogWithoutHook(read(file)));

    expect(stale).toEqual([]);
  });
});
