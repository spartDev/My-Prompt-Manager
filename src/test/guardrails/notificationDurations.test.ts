// @vitest-environment node
import { readdirSync, readFileSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

import ts from 'typescript';
import { describe, expect, it } from 'vitest';

import { TOAST_DURATION } from '../../hooks/useToast';

/**
 * How long each Notification stays (My-Prompt-Manager-syj: the exit of the Welcome stays 6 s, and no
 * other Notification changes).
 *
 * A Notification shown with no duration of its own takes useToast's, TOAST_DURATION: 2.7 s for a
 * confirmation, 6 s for a failure. A call of `showToast` that passes `duration` sets that Notification's
 * time; only the calls of OWN_DURATIONS may, each with its time. Any other duration, added to a
 * Notification or changed on one of them, fails here, and so does a change to the defaults.
 *
 * Known limits (a convention made executable): only calls of a function named `showToast` are read,
 * and a duration held in a variable is read when it is a `const` of the same module set to a number.
 * Options the call does not write out (a variable, a spread) are reported as such, to be read by hand.
 */

interface OwnDuration {
  /** Repo-relative, forward slashes (for example `src/App.tsx`) */
  file: string;
  /** The first argument as written: a string literal with its quotes, or a name */
  message: string;
  /** The duration passed, in ms, or what stands in for it when it cannot be read */
  duration: number | string;
}

/** The Notifications with a time of their own; every other one takes TOAST_DURATION */
const OWN_DURATIONS: readonly OwnDuration[] = [
  // Its Undo stays within reach 6 s, as long as a failure
  { file: 'src/App.tsx', message: "'Category deleted'", duration: 6000 },
  // A refused add of the Welcome's Packs stays until the user acts (My-Prompt-Manager-ojz.20)
  { file: 'src/hooks/useWelcomeExit.ts', message: 'ADD_FAILED', duration: 0 },
  // The exit of the Welcome, "9 prompts added" or "Your library is ready", read to its "//" (My-Prompt-Manager-syj)
  { file: 'src/hooks/useWelcomeExit.ts', message: 'message', duration: 6000 }
];

const isTestPath = (filePath: string): boolean =>
  filePath.includes('/__tests__/') || filePath.startsWith('src/test/') || /\.test\.tsx?$/.test(filePath);

const isShowToast = (callee: ts.Expression): boolean =>
  (ts.isIdentifier(callee) && callee.text === 'showToast') || (ts.isPropertyAccessExpression(callee) && callee.name.text === 'showToast');

/** The number a `const name = <number>` of the module holds, if it has one */
const constantOf = (sourceFile: ts.SourceFile, name: string): number | undefined => {
  let value: number | undefined;
  const visit = (node: ts.Node): void => {
    if (
      ts.isVariableDeclaration(node) &&
      ts.isIdentifier(node.name) &&
      node.name.text === name &&
      node.initializer !== undefined &&
      ts.isNumericLiteral(node.initializer) &&
      ts.isVariableDeclarationList(node.parent) &&
      (node.parent.flags & ts.NodeFlags.Const) !== 0
    ) {
      value = Number(node.initializer.text.replaceAll('_', ''));
    }
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);
  return value;
};

const durationOf = (sourceFile: ts.SourceFile, expression: ts.Expression): number | string => {
  if (ts.isNumericLiteral(expression)) {
    return Number(expression.text.replaceAll('_', ''));
  }
  if (ts.isIdentifier(expression)) {
    return constantOf(sourceFile, expression.text) ?? expression.text;
  }
  return expression.getText(sourceFile);
};

/** Every call of showToast in a module of src/ that sets the Notification's time, or may */
function findOwnDurations(filePath: string, contents: string): OwnDuration[] {
  if (isTestPath(filePath)) {
    return [];
  }
  const sourceFile = ts.createSourceFile(filePath, contents, ts.ScriptTarget.Latest, true, filePath.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
  const found: OwnDuration[] = [];

  const visit = (node: ts.Node): void => {
    if (ts.isCallExpression(node) && isShowToast(node.expression)) {
      const [message, , options] = node.arguments;
      const record = (duration: number | string): void => {
        found.push({ file: filePath, message: message?.getText(sourceFile) ?? '', duration });
      };
      if (options !== undefined && !ts.isObjectLiteralExpression(options)) {
        record(`options not written out: ${options.getText(sourceFile)}`);
      } else if (options !== undefined) {
        for (const property of options.properties) {
          if (ts.isSpreadAssignment(property)) {
            record(`options spread: ${property.getText(sourceFile)}`);
          } else if (ts.isPropertyAssignment(property) && property.name.getText(sourceFile) === 'duration') {
            record(durationOf(sourceFile, property.initializer));
          } else if (ts.isShorthandPropertyAssignment(property) && property.name.text === 'duration') {
            record(durationOf(sourceFile, property.name));
          }
        }
      }
    }
    ts.forEachChild(node, visit);
  };

  visit(sourceFile);
  return found;
}

/** How many calls of showToast a module makes, a duration of their own or not */
const countCalls = (contents: string): number => contents.match(/\bshowToast\(/g)?.length ?? 0;

// ---------------------------------------------------------------------------
// The source tree
// ---------------------------------------------------------------------------

const REPO_ROOT = fileURLToPath(new URL('../../../', import.meta.url));

function listSourceFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const full = join(directory, entry.name);
    if (entry.isDirectory()) {
      return entry.name === 'node_modules' ? [] : listSourceFiles(full);
    }
    return /\.tsx?$/.test(entry.name) ? [full] : [];
  });
}

const readSourceTree = (): { path: string; contents: string }[] =>
  listSourceFiles(join(REPO_ROOT, 'src'))
    .map((full) => ({ path: relative(REPO_ROOT, full).split(sep).join('/'), contents: readFileSync(full, 'utf-8') }))
    .filter((file) => !isTestPath(file.path));

/** A scan of the whole of src/ takes about 1 s, longer under coverage on a slow runner */
const WHOLE_TREE_TIMEOUT_MS = 20_000;

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('How long each Notification stays', () => {
  describe('reads the duration a call of showToast passes', () => {
    const find = (source: string): OwnDuration[] => findOwnDurations('src/components/Example.tsx', source);

    it.each([
      ['a number', "showToast('Saved', 'success', { duration: 6000 });", 6000],
      ['a number with separators', "showToast('Saved', 'success', { duration: 6_000 });", 6000],
      ['a const of the module', "const LONG = 4000;\nshowToast('Saved', 'success', { sub, duration: LONG });", 4000],
      ['through a property', "latest.current.showToast('Saved', 'success', { duration: 0 });", 0],
      ['an expression, as written', "showToast('Saved', 'success', { duration: base * 2 });", 'base * 2'],
      ['options it cannot see into', "showToast('Saved', 'success', options);", 'options not written out: options'],
      ['options spread', "showToast('Saved', 'success', { ...options });", 'options spread: ...options']
    ])('%s', (_name, source, duration) => {
      expect(find(source)).toEqual([{ file: 'src/components/Example.tsx', message: "'Saved'", duration }]);
    });

    it('and nothing for a Notification that takes the default time', () => {
      expect(find("showToast('Prompt copied', 'success', { sub: title });\nshowToast(\"Couldn't copy\", 'error');")).toEqual([]);
    });
  });

  it('every Notification of src/ takes the default time but the exit of the Welcome (6 s), the Undo of a Category (6 s) and a refused add of the Packs (until the user acts)', () => {
    const tree = readSourceTree();
    // The scan sees the Notifications: more than the three with a time of their own
    expect(tree.reduce((count, file) => count + countCalls(file.contents), 0)).toBeGreaterThan(OWN_DURATIONS.length);

    expect(tree.flatMap((file) => findOwnDurations(file.path, file.contents))).toEqual(OWN_DURATIONS);
  }, WHOLE_TREE_TIMEOUT_MS);

  it('the default time: 2.7 s for a confirmation, 6 s for a failure', () => {
    expect(TOAST_DURATION).toEqual({ confirmation: 2700, failure: 6000 });
  });
});
