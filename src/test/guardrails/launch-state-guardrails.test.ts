// @vitest-environment node
import { readdirSync, readFileSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

import ts from 'typescript';
import { describe, expect, it } from 'vitest';

/**
 * One writer of the launch state (epic My-Prompt-Manager-ojz, A5, "Contraintes de code": every
 * state write goes through one point, which does nothing in Debug mode).
 *
 * The steps and the end of the Welcome and the Last seen Release are written only by
 * `writeLaunchState` of src/launch/write.ts, the service worker included, so its Debug check is the
 * only one they need. The service worker writes the facts of the install (src/background/), outside
 * it, and nothing else may. Any other module of src/ that names one of their low-level writers is
 * reported: a call, an import, even a renamed one, or a property read through a namespace or a
 * dynamic import. Tests are exempt: they test the low-level writers themselves.
 *
 * Known limits (a convention made executable, not a security boundary): a writer reached through a
 * computed name that is not a string literal (`module[name]`), or a direct `chrome.storage.local.set`
 * of the `welcome` or `whatsNew` key, is not seen.
 */

interface Violation {
  file: string;
  line: number;
  column: number;
  message: string;
}

interface SourceText {
  /** Repo-relative, forward slashes (for example `src/hooks/useLaunchScreen.ts`). */
  path: string;
  contents: string;
}

const WRITER = 'src/launch/write.ts';
const SERVICE_WORKER = 'src/background/';
const WELCOME_STORAGE = 'src/welcome/storage.ts';
const WHATS_NEW_STORAGE = 'src/whatsNew/storage.ts';

/**
 * Each low-level writer of the launch state, and the modules that may name it (a path ending in /
 * stands for every module under it): the module that defines it, and its one caller, the launch
 * writer or the service worker
 */
const MAY_NAME: Readonly<Record<string, readonly string[]>> = {
  // The steps, the end and the Last seen Release: the launch writer's alone, which writes nothing in Debug mode
  writeWelcomeRecord: [WELCOME_STORAGE, WRITER],
  markReleaseSeen: [WHATS_NEW_STORAGE, WRITER],
  // The facts of the install: the service worker's alone
  recordWelcomePending: [WELCOME_STORAGE, SERVICE_WORKER],
  markExistingUserDone: [WELCOME_STORAGE, SERVICE_WORKER],
  recordInstall: [WHATS_NEW_STORAGE, SERVICE_WORKER],
  recordUpdateFrom: [WHATS_NEW_STORAGE, SERVICE_WORKER]
};

const isTestPath = (filePath: string): boolean =>
  filePath.includes('/__tests__/') || filePath.startsWith('src/test/') || /\.test\.tsx?$/.test(filePath);

const mayName = (filePath: string, name: string): boolean =>
  (MAY_NAME[name] ?? []).some((allowed) => (allowed.endsWith('/') ? filePath.startsWith(allowed) : filePath === allowed));

/** The guarded name a node names: an identifier, or a string literal in an element access (`module['markReleaseSeen']`) */
const guardedNameOf = (node: ts.Node): string | undefined => {
  if (ts.isIdentifier(node) && Object.hasOwn(MAY_NAME, node.text)) {
    return node.text;
  }
  if (
    ts.isStringLiteralLike(node) &&
    ts.isElementAccessExpression(node.parent) &&
    node.parent.argumentExpression === node &&
    Object.hasOwn(MAY_NAME, node.text)
  ) {
    return node.text;
  }
  return undefined;
};

/** Every place a module of src/ names a launch-state writer it may not name */
function findLaunchStateWriters(filePath: string, contents: string): Violation[] {
  if (isTestPath(filePath)) {
    return [];
  }

  const sourceFile = ts.createSourceFile(filePath, contents, ts.ScriptTarget.Latest, true, filePath.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
  const violations: Violation[] = [];

  const visit = (node: ts.Node): void => {
    const name = guardedNameOf(node);
    if (name !== undefined && !mayName(filePath, name)) {
      const { line, character } = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile));
      const callers = MAY_NAME[name]?.includes(WRITER) ? WRITER : 'the service worker';
      violations.push({
        file: filePath,
        line: line + 1,
        column: character + 1,
        message: `${name} writes the launch state and only ${callers} may call it: go through writeLaunchState of ${WRITER}, which writes nothing in Debug mode`
      });
    }
    ts.forEachChild(node, visit);
  };

  visit(sourceFile);
  return violations;
}

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

const readSourceTree = (): SourceText[] =>
  listSourceFiles(join(REPO_ROOT, 'src')).map((full) => ({
    path: relative(REPO_ROOT, full).split(sep).join('/'),
    contents: readFileSync(full, 'utf-8')
  }));

const formatViolation = (violation: Violation): string =>
  `${violation.file}:${String(violation.line)}:${String(violation.column)} ${violation.message}`;

/** A scan of the whole of src/ takes about 1 s, longer under coverage on a slow runner */
const WHOLE_TREE_TIMEOUT_MS = 20_000;

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('One writer of the launch state', () => {
  const find = (source: string, path = 'src/components/welcome/WelcomeFrame.tsx'): Violation[] => findLaunchStateWriters(path, source);

  describe('reports a module of the popup or side panel that writes the launch state itself', () => {
    it.each([
      ['a call of markReleaseSeen', "import { markReleaseSeen } from '../../whatsNew/storage';\nvoid markReleaseSeen('2.0.0');"],
      ['a call of writeWelcomeRecord', "import { writeWelcomeRecord } from '../../welcome/storage';\nvoid writeWelcomeRecord({ status: 'done' });"],
      ['a renamed import', "import { writeWelcomeRecord as save } from '../../welcome/storage';"],
      ['a call through a namespace import', "import * as welcome from '../../welcome/storage';\nvoid welcome.writeWelcomeRecord({ status: 'done' });"],
      ['a call through a dynamic import', "const { markReleaseSeen: seen } = await import('../../whatsNew/storage');"],
      ['an element access with a string literal', "import * as whatsNew from '../../whatsNew/storage';\nvoid whatsNew['markReleaseSeen']('2.0.0');"],
      ['a writer passed as a callback', "import * as whatsNew from '../../whatsNew/storage';\nversions.forEach((v) => whatsNew.markReleaseSeen(v));"],
      ['a fact of the install written outside the service worker', "import { recordWelcomePending } from '../../welcome/storage';\nvoid recordWelcomePending();"],
      ['the Release of install written outside the service worker', "import { recordInstall } from '../../whatsNew/storage';"],
      ['an update recorded outside the service worker', "import { recordUpdateFrom } from '../../whatsNew/storage';"],
      ['an existing user marked done outside the service worker', "import { markExistingUserDone } from '../../welcome/storage';"]
    ])('%s', (_name, source) => {
      expect(find(source).length).toBeGreaterThan(0);
    });

    it('in every module of src/ outside the writer and the service worker, hooks included', () => {
      const source = "import { markReleaseSeen } from '../whatsNew/storage';\nmarkReleaseSeen(version);";

      const [importing, calling] = find(source, 'src/hooks/useLaunchScreen.ts');

      expect(importing).toMatchObject({ file: 'src/hooks/useLaunchScreen.ts', line: 1, column: 10 });
      expect(calling).toMatchObject({ line: 2, column: 1 });
      expect(calling?.message).toContain('writeLaunchState');
    });

    it('a module of the What\'s new storage may not write the Welcome record, nor the Welcome storage the Last seen Release', () => {
      expect(find("import { writeWelcomeRecord } from '../welcome/storage';", WHATS_NEW_STORAGE)).toHaveLength(1);
      expect(find("import { markReleaseSeen } from '../whatsNew/storage';", WELCOME_STORAGE)).toHaveLength(1);
    });
  });

  describe('accepts', () => {
    const allWriters = [
      "import { markExistingUserDone, recordWelcomePending, writeWelcomeRecord } from '../welcome/storage';",
      "import { markReleaseSeen, recordInstall, recordUpdateFrom } from '../whatsNew/storage';",
      "void writeWelcomeRecord({ status: 'done' }); void markReleaseSeen('2.0.0');"
    ].join('\n');

    it('the launch writer calling the writers of the popup and side panel', () => {
      const source = [
        "import { writeWelcomeRecord } from '../welcome/storage';",
        "import { markReleaseSeen } from '../whatsNew/storage';",
        "void writeWelcomeRecord({ status: 'done' }); void markReleaseSeen('2.0.0');"
      ].join('\n');

      expect(find(source, WRITER)).toEqual([]);
    });

    it('but not the launch writer writing the facts of the install', () => {
      expect(find("import { recordWelcomePending } from '../welcome/storage';", WRITER)).toHaveLength(1);
    });

    it('the service worker, the writers of the install', () => {
      const installWriters = [
        "import { markExistingUserDone, recordWelcomePending } from '../welcome/storage';",
        "import { recordInstall, recordUpdateFrom } from '../whatsNew/storage';"
      ].join('\n');

      expect(find(installWriters, 'src/background/background.ts')).toEqual([]);
    });

    it('but not the service worker writing the Welcome record or the Last seen Release: the launch writer is their only caller, so its Debug check is their only one', () => {
      const found = find(allWriters, 'src/background/background.ts');

      expect(found.map((violation) => violation.message.split(' ')[0])).toEqual(['writeWelcomeRecord', 'markReleaseSeen', 'writeWelcomeRecord', 'markReleaseSeen']);
      expect(found[0]?.message).toContain(`only ${WRITER} may call it`);
    });

    it('the modules that define them', () => {
      const welcome = "export const writeWelcomeRecord = (r) => r;\nexport const recordWelcomePending = () => writeWelcomeRecord(x);\nexport const markExistingUserDone = () => 1;";
      const whatsNew = "export const markReleaseSeen = () => 1;\nexport const recordInstall = () => 1;\nexport const recordUpdateFrom = () => 1;";

      expect(find(welcome, WELCOME_STORAGE)).toEqual([]);
      expect(find(whatsNew, WHATS_NEW_STORAGE)).toEqual([]);
    });

    it('tests, which test the low-level writers themselves', () => {
      expect(find(allWriters, 'src/welcome/__tests__/storage.test.ts')).toEqual([]);
      expect(find(allWriters, 'src/components/__tests__/App.whatsNew.test.tsx')).toEqual([]);
    });

    it('comments, strings and names that only contain a writer\'s name', () => {
      const source = [
        '// markReleaseSeen is called by the launch writer',
        '/* writeWelcomeRecord({ status: "done" }) */',
        "const label = 'markReleaseSeen';",
        "vi.mock('../whatsNew/storage', () => ({}));",
        'const markReleaseSeenLater = 1;',
        'const { readWelcomeRecord, parseWelcomeRecord } = welcome;'
      ].join('\n');

      expect(find(source)).toEqual([]);
    });
  });

  it('finds none in src', () => {
    const found = readSourceTree().flatMap((file) => findLaunchStateWriters(file.path, file.contents)).map(formatViolation);

    expect(found).toEqual([]);
  }, WHOLE_TREE_TIMEOUT_MS);
});
