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
 * confirmation, 6 s for a failure. A call that passes `duration` sets that Notification's time; only
 * the calls of OWN_DURATIONS may, each with its time. Any other duration, added to a Notification or
 * changed on one of them, fails here, and so does a change to the defaults.
 *
 * Every Notification of src/ is shown through a ShowToast, under one of the names of SHOW_TOAST_NAMES:
 * the calls of those names are read, bare (`showToast(...)`) or read from a property
 * (`latest.current.showToast(...)`, `latest.current?.showToast(...)`). A ShowToast given another name
 * is reported in these forms, and only these:
 * - a declaration whose type is written `ShowToast`: a property of an interface or a type, a class
 *   field, a parameter or a variable (`notify: ShowToast`);
 * - a variable under a plain name (`const`, `let` or `var`), an object literal's property or a JSX
 *   prop, set to a ShowToast named bare or read from a property (`const notify =
 *   latest.current.showToast`, `{ notify: showToast }`, `<Section notify={showToast} />`);
 * - `showToast` or `onShowToast` destructured under another name (`const { showToast: notify } = props`).
 * The options are looked into, through spreads of object literals (in parentheses, a conditional,
 * `&&`, `||` or `??`): only a `duration` they hold is recorded.
 *
 * Known limits (a convention made executable, read from the syntax alone):
 * - A duration held in a name is read when the name is a module-level `const` set to a number and the
 *   module binds it nowhere else. Any other name (a shadow, a parameter, a const of a function, an
 *   import) is recorded by its name, and what it cannot see into (options or a spread held in a
 *   variable, a computed property name) is recorded as such: to be read by hand, never let through.
 * - Not seen, among others:
 *   - a ShowToast passed by position (`run(showToast)`) to a parameter not typed `ShowToast`;
 *   - one given another name by an assignment (`notify = showToast`, `ref.current.notify =
 *     showToast`), a default (`const { notify = showToast } = props`, a component's props included,
 *     or a parameter's), a class field not typed `ShowToast`, an array destructuring
 *     (`const [notify] = [showToast]`), or an import or export under another name
 *     (`import { showToast as notify }`, `export { showToast as notify }`);
 *   - one wrapped in an expression: parentheses, a cast, `!`, a conditional, `??` or `||`;
 *   - one typed otherwise than `ShowToast` as written (`ShowToast | undefined`);
 *   - one reached otherwise than by its name (`api['showToast']`, `showToast.bind(api)`);
 *   - a call through `.call` or `.apply`, which is not read.
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
  // The exit of the Welcome, "9 prompts added" or "Your library is ready", read to its "//"
  // (My-Prompt-Manager-syj). Named by its local variable, `message`: renaming it fails here
  { file: 'src/hooks/useWelcomeExit.ts', message: 'message', duration: 6000 }
];

/** The names a ShowToast goes by in src/: useToast's own, and the prop the Settings sections take it as */
const SHOW_TOAST_NAMES: ReadonlySet<string> = new Set(['showToast', 'onShowToast']);

const isTestPath = (filePath: string): boolean =>
  filePath.includes('/__tests__/') || filePath.startsWith('src/test/') || /\.test\.tsx?$/.test(filePath);

const parse = (filePath: string, contents: string): ts.SourceFile =>
  ts.createSourceFile(filePath, contents, ts.ScriptTarget.Latest, true, filePath.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS);

const isShowToast = (callee: ts.Expression): boolean =>
  (ts.isIdentifier(callee) && SHOW_TOAST_NAMES.has(callee.text)) ||
  (ts.isPropertyAccessExpression(callee) && SHOW_TOAST_NAMES.has(callee.name.text));

/**
 * The number a module-level `const name = <number>` holds, when the module binds that name once. A
 * second binding at any depth (a variable, a parameter, a destructured name) may be the one a call
 * reads, a shadow: the name is then not resolved, and neither is a const of a function
 */
const constantOf = (sourceFile: ts.SourceFile, name: string): number | undefined => {
  const values: (number | undefined)[] = [];
  const visit = (node: ts.Node): void => {
    if ((ts.isVariableDeclaration(node) || ts.isParameter(node) || ts.isBindingElement(node)) && ts.isIdentifier(node.name) && node.name.text === name) {
      const ofTheModule =
        ts.isVariableDeclaration(node) &&
        node.initializer !== undefined &&
        ts.isNumericLiteral(node.initializer) &&
        ts.isVariableDeclarationList(node.parent) &&
        (node.parent.flags & ts.NodeFlags.Const) !== 0 &&
        ts.isVariableStatement(node.parent.parent) &&
        node.parent.parent.parent === sourceFile;
      values.push(ofTheModule ? Number(node.initializer.text.replaceAll('_', '')) : undefined);
    }
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);
  return values.length === 1 ? values[0] : undefined;
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

/** A property's name as a string, or undefined for a computed name that is no string literal */
const nameOf = (name: ts.PropertyName): string | undefined => {
  if (ts.isIdentifier(name) || ts.isStringLiteralLike(name) || ts.isNumericLiteral(name) || ts.isPrivateIdentifier(name)) {
    return name.text;
  }
  if (ts.isComputedPropertyName(name) && ts.isStringLiteralLike(name.expression)) {
    return name.expression.text;
  }
  return undefined;
};

/** The durations an object literal of options sets, its spreads looked into */
const durationsOfObject = (sourceFile: ts.SourceFile, object: ts.ObjectLiteralExpression): (number | string)[] =>
  object.properties.flatMap((property): (number | string)[] => {
    if (ts.isSpreadAssignment(property)) {
      return durationsOf(sourceFile, property.expression, (text) => `options spread: ...${text}`);
    }
    if (ts.isShorthandPropertyAssignment(property)) {
      return property.name.text === 'duration' ? [durationOf(sourceFile, property.name)] : [];
    }
    const name = nameOf(property.name);
    if (name === undefined) {
      return [`computed property: ${property.getText(sourceFile)}`];
    }
    if (name !== 'duration') {
      return [];
    }
    return ts.isPropertyAssignment(property) ? [durationOf(sourceFile, property.initializer)] : [property.getText(sourceFile)];
  });

/**
 * The durations an expression of options may set: an object literal, looked into, through
 * parentheses, both branches of a conditional, the right of `&&` (its left spreads nothing when it is
 * falsy) and both sides of `||` and `??`. Anything else cannot be seen into: `opaque` says so
 */
function durationsOf(sourceFile: ts.SourceFile, expression: ts.Expression, opaque: (text: string) => string): (number | string)[] {
  if (ts.isObjectLiteralExpression(expression)) {
    return durationsOfObject(sourceFile, expression);
  }
  if (ts.isParenthesizedExpression(expression)) {
    return durationsOf(sourceFile, expression.expression, opaque);
  }
  if (ts.isConditionalExpression(expression)) {
    return [...durationsOf(sourceFile, expression.whenTrue, opaque), ...durationsOf(sourceFile, expression.whenFalse, opaque)];
  }
  if (ts.isBinaryExpression(expression)) {
    const operator = expression.operatorToken.kind;
    if (operator === ts.SyntaxKind.AmpersandAmpersandToken) {
      return durationsOf(sourceFile, expression.right, opaque);
    }
    if (operator === ts.SyntaxKind.BarBarToken || operator === ts.SyntaxKind.QuestionQuestionToken) {
      return [...durationsOf(sourceFile, expression.left, opaque), ...durationsOf(sourceFile, expression.right, opaque)];
    }
  }
  return [opaque(expression.getText(sourceFile))];
}

/** The Notifications a module of src/ shows: how many calls, and those that set their own time, or may */
function readNotifications(filePath: string, contents: string): { calls: number; own: OwnDuration[] } {
  if (isTestPath(filePath)) {
    return { calls: 0, own: [] };
  }
  const sourceFile = parse(filePath, contents);
  let calls = 0;
  const own: OwnDuration[] = [];

  const visit = (node: ts.Node): void => {
    if (ts.isCallExpression(node) && isShowToast(node.expression)) {
      calls++;
      const [message, , options] = node.arguments;
      const durations = options === undefined ? [] : durationsOf(sourceFile, options, (text) => `options not written out: ${text}`);
      for (const duration of durations) {
        own.push({ file: filePath, message: message?.getText(sourceFile) ?? '', duration });
      }
    }
    ts.forEachChild(node, visit);
  };

  visit(sourceFile);
  return { calls, own };
}

const isShowToastType = (type: ts.TypeNode | undefined): boolean =>
  type !== undefined && ts.isTypeReferenceNode(type) && ts.isIdentifier(type.typeName) && type.typeName.text === 'ShowToast';

/** A ShowToast by one of its names, bare or read from a property (`latest.current.showToast`) */
const holdsShowToast = (expression: ts.Expression | undefined): boolean => expression !== undefined && isShowToast(expression);

/**
 * The names other than SHOW_TOAST_NAMES that a module gives a ShowToast, whose calls the scan would not
 * read, in the forms the header lists as reported: a declaration typed `ShowToast`; a variable, an
 * object literal's property or a JSX prop set to a ShowToast named bare or read from a property;
 * `showToast` or `onShowToast` destructured under another name
 */
function findOtherNames(filePath: string, contents: string): string[] {
  if (isTestPath(filePath)) {
    return [];
  }
  const sourceFile = parse(filePath, contents);
  const found: string[] = [];
  const report = (node: ts.Node, name: string): void => {
    if (!SHOW_TOAST_NAMES.has(name)) {
      const { line } = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile));
      found.push(`${filePath}:${String(line + 1)} ${name}`);
    }
  };

  const visit = (node: ts.Node): void => {
    if ((ts.isPropertySignature(node) || ts.isPropertyDeclaration(node) || ts.isParameter(node) || ts.isVariableDeclaration(node)) && isShowToastType(node.type)) {
      report(node, node.name.getText(sourceFile));
    } else if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && holdsShowToast(node.initializer)) {
      report(node, node.name.text);
    } else if (ts.isPropertyAssignment(node) && holdsShowToast(node.initializer)) {
      report(node, node.name.getText(sourceFile));
    } else if (ts.isJsxAttribute(node) && node.initializer !== undefined && ts.isJsxExpression(node.initializer) && holdsShowToast(node.initializer.expression)) {
      report(node, node.name.getText(sourceFile));
    } else if (ts.isBindingElement(node) && node.propertyName !== undefined && SHOW_TOAST_NAMES.has(node.propertyName.getText(sourceFile))) {
      report(node, node.name.getText(sourceFile));
    }
    ts.forEachChild(node, visit);
  };

  visit(sourceFile);
  return found;
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
    const find = (source: string): OwnDuration[] => readNotifications('src/components/Example.tsx', source).own;

    it.each([
      ['a number', "showToast('Saved', 'success', { duration: 6000 });", [6000]],
      ['a number with separators', "showToast('Saved', 'success', { duration: 6_000 });", [6000]],
      ['a const of the module', "const LONG = 4000;\nshowToast('Saved', 'success', { sub, duration: LONG });", [4000]],
      ['a const of the module whose name a function binds again further down: by its name', "const LONG = 100;\nshowToast('Saved', 'success', { duration: LONG });\nfunction other() { const LONG = 6000; return LONG; }", ['LONG']],
      ['a const of the module shadowed where the call is: by its name', "function show() { const LONG = 100; showToast('Saved', 'success', { duration: LONG }); }\nconst LONG = 6000;", ['LONG']],
      ['a parameter under the name of a const of the module: by its name', "const LONG = 6000;\nconst show = (LONG: number) => { showToast('Saved', 'success', { duration: LONG }); };", ['LONG']],
      ['a const of a function, not of the module: by its name', "function show() { const LONG = 4000; showToast('Saved', 'success', { duration: LONG }); }", ['LONG']],
      ['through a property', "latest.current.showToast('Saved', 'success', { duration: 0 });", [0]],
      ['a call of onShowToast, the prop of the Settings sections', "onShowToast('Saved', 'error', { duration: 6000 });", [6000]],
      ['an expression, as written', "showToast('Saved', 'success', { duration: base * 2 });", ['base * 2']],
      ['a quoted name', "showToast('Saved', 'success', { 'duration': 1 });", [1]],
      ['a literal spread with no duration: only the duration beside it', "showToast('Saved', 'error', { duration: 0, ...(flag ? { focusAction: true } : {}) });", [0]],
      ['a duration in a literal spread', "showToast('Saved', 'success', { ...(flag ? { duration: 1 } : {}) });", [1]],
      ['a duration after && in a spread', "showToast('Saved', 'success', { sub, ...(flag && { duration: 2 }) });", [2]],
      ['options in a conditional', "showToast('Saved', 'success', flag ? { duration: 3 } : { sub });", [3]],
      ['options it cannot see into', "showToast('Saved', 'success', options);", ['options not written out: options']],
      ['an opaque spread', "showToast('Saved', 'success', { ...options });", ['options spread: ...options']],
      ['an opaque spread inside a literal one', "showToast('Saved', 'success', { ...(flag ? options : {}) });", ['options spread: ...options']],
      ['a computed name', "showToast('Saved', 'success', { [key]: 1 });", ['computed property: [key]: 1']]
    ] as const)('%s', (_name, source, durations) => {
      expect(find(source)).toEqual(durations.map((duration) => ({ file: 'src/components/Example.tsx', message: "'Saved'", duration })));
    });

    it('and nothing for a Notification that takes the default time', () => {
      expect(find("showToast('Prompt copied', 'success', { sub: title });\nonShowToast(\"Couldn't copy\", 'error', { sub, ...(flag ? { focusAction: true } : {}) });")).toEqual([]);
    });
  });

  describe('reports a ShowToast given a name whose calls are not read', () => {
    const find = (source: string): string[] => findOtherNames('src/components/Example.tsx', source);

    it.each([
      ['a prop typed ShowToast', 'interface Props { notify: ShowToast }', 'notify'],
      ['a parameter typed ShowToast', 'const run = (notify: ShowToast) => notify("Saved");', 'notify'],
      ['a prop set to it', '<Section notify={showToast} />', 'notify'],
      ['a property set to it', 'const options = { notify: onShowToast };', 'notify'],
      ['a renamed binding', 'const { showToast: notify } = props;', 'notify'],
      ['an alias', 'const notify = showToast;', 'notify'],
      ['an alias of one read from a property', 'const notify = latest.current.showToast;', 'notify'],
      ['an alias of one read from an object that holds it', 'const notify = toastApi.showToast;', 'notify'],
      ['a prop set to one read from a property', '<Section notify={toastApi.showToast} />', 'notify'],
      ['a property set to one read from a property', 'const options = { notify: props.onShowToast };', 'notify']
    ])('%s', (_name, source, name) => {
      expect(find(source)).toEqual([`src/components/Example.tsx:1 ${name}`]);
    });

    it('but not the names whose calls are read', () => {
      expect(find('interface Props { showToast: ShowToast; onShowToast?: ShowToast }\n<SettingsSection onShowToast={showToast} />\nconst { showToast } = useToast();')).toEqual([]);
      expect(find('<SettingsSection onShowToast={latest.current.showToast} />\nconst showToast = latest.current.showToast;')).toEqual([]);
    });
  });

  it('every ShowToast of src/ goes by a name whose calls are read', () => {
    expect(readSourceTree().flatMap((file) => findOtherNames(file.path, file.contents))).toEqual([]);
  }, WHOLE_TREE_TIMEOUT_MS);

  it('every Notification of src/ takes the default time but the exit of the Welcome (6 s), the Undo of a Category (6 s) and a refused add of the Packs (until the user acts)', () => {
    const read = readSourceTree().map((file) => readNotifications(file.path, file.contents));
    // The scan sees the Notifications: more than the three with a time of their own
    expect(read.reduce((count, file) => count + file.calls, 0)).toBeGreaterThan(OWN_DURATIONS.length);

    expect(read.flatMap((file) => file.own)).toEqual(OWN_DURATIONS);
  }, WHOLE_TREE_TIMEOUT_MS);

  it('the default time: 2.7 s for a confirmation, 6 s for a failure', () => {
    expect(TOAST_DURATION).toEqual({ confirmation: 2700, failure: 6000 });
  });
});
