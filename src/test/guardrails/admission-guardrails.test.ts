// @vitest-environment node
import { readdirSync, readFileSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

import ts from 'typescript';
import { describe, expect, it } from 'vitest';

/**
 * Admission guardrails (ADR-001).
 *
 * Types make "no route skips Admission" a compile-time property, but three things slip past
 * the compiler: casts to the branded types, direct chrome.storage writes of the prompts key,
 * and invisible characters written literally in source. Each is a small checker over
 * (path, contents), unit-tested with fixtures, then run over every .ts/.tsx file under src/.
 *
 * Known limits (these are conventions made executable, not a security boundary):
 * - Forgery is found by name, so `type Alias = StoredPrompt` followed by `x as Alias`, or a
 *   cast to `Parameters<typeof f>[0]`, is not seen. Renamed imports and namespace imports are.
 * - A prompts-key write is found as a `<anything>.local.set(...)` call. Aliasing the storage
 *   area first (`const area = chrome.storage.local`), destructuring `set`, or `.call`/`.bind`
 *   on it is not seen; `storage.sync` and `storage.session` are not checked.
 * - A computed key is taken to be the prompts key when its text contains "prompts".
 *
 * This file must stay free of literal invisible characters, so every one is built from a
 * numeric code point.
 */

interface Violation {
  file: string;
  line: number;
  column: number;
  message: string;
}

interface SourceText {
  /** Repo-relative, forward slashes (for example `src/services/storage.ts`). */
  path: string;
  contents: string;
}

const cp = (...codePoints: number[]): string => String.fromCodePoint(...codePoints);

const formatViolation = (violation: Violation): string =>
  `${violation.file}:${violation.line}:${violation.column} ${violation.message}`;

// ---------------------------------------------------------------------------
// Guard 1: invisible characters
// ---------------------------------------------------------------------------

/**
 * Code points that must never appear literally in source: they are invisible (or change how
 * text reads, as in Trojan Source attacks), so they have to be written as escape sequences.
 * This is the set Admission removes from Prompt text, plus the soft hyphen, the joiners and
 * direction marks that Admission keeps in text but that have no business being literal in code.
 */
const INVISIBLE: ReadonlyArray<readonly [first: number, last: number, label: string]> = [
  [0x0000, 0x0008, 'control character'],
  [0x000b, 0x000c, 'control character'],
  [0x000e, 0x001f, 'control character'],
  [0x007f, 0x009f, 'control character'],
  [0x00ad, 0x00ad, 'soft hyphen'],
  [0x061c, 0x061c, 'Arabic letter mark (bidirectional control)'],
  [0x200b, 0x200f, 'zero-width character or direction mark'],
  [0x202a, 0x202e, 'bidirectional embedding or override'],
  [0x2060, 0x206f, 'invisible operator or bidirectional isolate'],
  [0xfeff, 0xfeff, 'byte-order mark'],
  [0xe0000, 0xe007f, 'Unicode tag character']
];

const VARIATION_SELECTORS: ReadonlyArray<readonly [first: number, last: number]> = [
  [0xfe00, 0xfe0f],
  [0xe0100, 0xe01ef]
];

const SYMBOL_OR_EMOJI = /^[\p{S}\p{Extended_Pictographic}]$/u;

/** A variation selector is ordinary writing only right after a non-ASCII symbol or emoji. */
function isAllowedVariationSelector(previous: number | undefined): boolean {
  return previous !== undefined && previous > 0x7f && SYMBOL_OR_EMOJI.test(String.fromCodePoint(previous));
}

function describeInvisible(codePoint: number, previous: number | undefined): string | undefined {
  const forbidden = INVISIBLE.find(([first, last]) => codePoint >= first && codePoint <= last);
  if (forbidden) {
    return forbidden[2];
  }

  const isVariationSelector = VARIATION_SELECTORS.some(([first, last]) => codePoint >= first && codePoint <= last);
  if (isVariationSelector && !isAllowedVariationSelector(previous)) {
    return 'variation selector that does not follow a symbol or emoji';
  }

  return undefined;
}

function findInvisibleCharacters(filePath: string, contents: string): Violation[] {
  const violations: Violation[] = [];

  contents.split('\n').forEach((text, index) => {
    let previous: number | undefined;

    for (let offset = 0; offset < text.length; ) {
      const codePoint = text.codePointAt(offset) ?? 0;
      const problem = describeInvisible(codePoint, previous);

      if (problem) {
        const hex = codePoint.toString(16).toUpperCase().padStart(4, '0');
        violations.push({
          file: filePath,
          line: index + 1,
          column: offset + 1,
          message: `U+${hex} ${problem}: write it as an escape sequence`
        });
      }

      previous = codePoint;
      offset += codePoint > 0xffff ? 2 : 1;
    }
  });

  return violations;
}

// ---------------------------------------------------------------------------
// Guard 2: nominal type forgery
// ---------------------------------------------------------------------------

const ADMISSION_MODULE = 'src/services/promptAdmission.ts';

/** The only functions that may make a branded value, and only inside the Admission module. */
const MINT_FUNCTIONS: readonly string[] = ['mintStored', 'mintAdmitted'];

const BRANDED_TYPES: readonly string[] = ['StoredPrompt', 'AdmittedPrompt'];

function parseSource(filePath: string, contents: string): ts.SourceFile {
  const kind = filePath.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS;
  return ts.createSourceFile(filePath, contents, ts.ScriptTarget.Latest, true, kind);
}

function violationAt(filePath: string, node: ts.Node, message: string): Violation {
  const { line, character } = node.getSourceFile().getLineAndCharacterOfPosition(node.getStart());
  return { file: filePath, line: line + 1, column: character + 1, message };
}

/** The last name of `Foo`, `ns.Foo` or `a.b.Foo`. */
function lastName(name: ts.Node): string | undefined {
  if (ts.isIdentifier(name)) {
    return name.text;
  }
  if (ts.isQualifiedName(name)) {
    return name.right.text;
  }
  if (ts.isPropertyAccessExpression(name)) {
    return name.name.text;
  }
  return undefined;
}

/** Name of the function (or method, or function-valued variable) a node sits in. */
function enclosingFunctionName(node: ts.Node): string | undefined {
  for (let current: ts.Node | undefined = node.parent; current; current = current.parent) {
    if (ts.isFunctionDeclaration(current) || ts.isMethodDeclaration(current)) {
      return current.name?.getText();
    }

    if (ts.isArrowFunction(current) || ts.isFunctionExpression(current)) {
      const holder = current.parent;
      if (ts.isVariableDeclaration(holder) || ts.isPropertyDeclaration(holder) || ts.isPropertyAssignment(holder)) {
        return holder.name.getText();
      }
    }
  }
  return undefined;
}

/** The branded types as this file names them: the originals plus `import { X as Y }` renames. */
function brandNamesIn(sourceFile: ts.SourceFile): ReadonlySet<string> {
  const names = new Set(BRANDED_TYPES);

  for (const statement of sourceFile.statements) {
    const bindings = ts.isImportDeclaration(statement) ? statement.importClause?.namedBindings : undefined;
    if (!bindings || !ts.isNamedImports(bindings)) {
      continue;
    }

    for (const specifier of bindings.elements) {
      if (specifier.propertyName && BRANDED_TYPES.includes(specifier.propertyName.text)) {
        names.add(specifier.name.text);
      }
    }
  }

  return names;
}

/** The first reference to a branded type anywhere inside a type (`X[]`, `Promise<X>`, `X | null`). */
function findBrandedType(node: ts.Node | undefined, brands: ReadonlySet<string>): ts.Node | undefined {
  if (!node) {
    return undefined;
  }

  const name = ts.isTypeReferenceNode(node)
    ? lastName(node.typeName)
    : ts.isImportTypeNode(node) && node.qualifier
      ? lastName(node.qualifier)
      : undefined;

  if (name !== undefined && brands.has(name)) {
    return node;
  }

  return ts.forEachChild(node, (child) => findBrandedType(child, brands));
}

/**
 * Where a node claims a value is a branded type without getting it from the Admission module:
 * a type assertion, a type predicate (`x is StoredPrompt`), `new StoredPrompt()`, or a subclass.
 * All of these compile today and all of them forge the brand.
 */
function findForgery(
  node: ts.Node,
  brands: ReadonlySet<string>
): { at: ts.Node; how: string; isHeritage: boolean } | undefined {
  if (ts.isAsExpression(node) || ts.isTypeAssertionExpression(node)) {
    const at = findBrandedType(node.type, brands);
    return at && { at, how: 'type assertion', isHeritage: false };
  }

  if (ts.isTypePredicateNode(node)) {
    const at = findBrandedType(node.type, brands);
    return at && { at, how: 'type predicate', isHeritage: false };
  }

  if (ts.isNewExpression(node)) {
    const name = lastName(node.expression);
    return name !== undefined && brands.has(name)
      ? { at: node.expression, how: 'construction', isHeritage: false }
      : undefined;
  }

  if (ts.isExpressionWithTypeArguments(node) && ts.isHeritageClause(node.parent) && ts.isClassLike(node.parent.parent)) {
    const name = node.parent.token === ts.SyntaxKind.ExtendsKeyword ? lastName(node.expression) : undefined;
    return name !== undefined && brands.has(name)
      ? { at: node.expression, how: 'subclass', isHeritage: true }
      : undefined;
  }

  return undefined;
}

function findNominalTypeForgery(filePath: string, contents: string): Violation[] {
  const sourceFile = parseSource(filePath, contents);
  const brands = brandNamesIn(sourceFile);
  const isAdmissionModule = filePath === ADMISSION_MODULE;
  const violations: Violation[] = [];

  const visit = (node: ts.Node): void => {
    const forgery = findForgery(node, brands);

    if (forgery) {
      const name = forgery.at.getText();
      const functionName = enclosingFunctionName(node);
      const mints = functionName !== undefined && MINT_FUNCTIONS.includes(functionName);

      if (!isAdmissionModule) {
        violations.push(
          violationAt(
            filePath,
            forgery.at,
            `${forgery.how} of ${name} forges a branded value; get it from ${ADMISSION_MODULE} (readPrompts, admitNew, admitEdit, admitRestored, recordUse)`
          )
        );
      } else if (!forgery.isHeritage && !mints) {
        violations.push(
          violationAt(
            filePath,
            forgery.at,
            `${forgery.how} of ${name} outside ${MINT_FUNCTIONS.join(' and ')}, the only places a branded value is made`
          )
        );
      }
    }

    ts.forEachChild(node, visit);
  };

  visit(sourceFile);
  return violations;
}

// ---------------------------------------------------------------------------
// Guard 3: direct writes of the prompts key
// ---------------------------------------------------------------------------

const STORAGE_MANAGER = 'src/services/storage.ts';

/** StorageManager's private writers: the only code that may write the prompts key. */
const PROMPT_WRITERS: readonly string[] = ['writePrompts', 'writeScrubbed', 'writeCategoriesAndPrompts'];

/**
 * Files allowed to pass `storage.local.set` an argument the guard cannot see into. StorageManager
 * is the one place that writes by design; the storage helper is where a generic writer would go.
 * Nothing outside them does this today, so this stays tiny.
 */
const MAY_WRITE_OPAQUE_ARGUMENTS: readonly string[] = [STORAGE_MANAGER, 'src/utils/chromeStorage.ts'];

function isTestPath(filePath: string): boolean {
  return /(^|\/)__tests__\//.test(filePath) || /\.(test|spec)\.tsx?$/.test(filePath) || filePath.startsWith('src/test/');
}

/** `chrome.storage.local.set` becomes ['chrome', 'storage', 'local', 'set']; anything unreadable is '?'. */
function memberChain(expression: ts.Node): string[] {
  if (ts.isIdentifier(expression)) {
    return [expression.text];
  }
  if (expression.kind === ts.SyntaxKind.ThisKeyword) {
    return ['this'];
  }
  if (ts.isPropertyAccessExpression(expression)) {
    return [...memberChain(expression.expression), expression.name.text];
  }
  if (ts.isElementAccessExpression(expression) && ts.isStringLiteralLike(expression.argumentExpression)) {
    return [...memberChain(expression.expression), expression.argumentExpression.text];
  }
  if (ts.isParenthesizedExpression(expression) || ts.isNonNullExpression(expression)) {
    return memberChain(expression.expression);
  }
  return ['?'];
}

function isPromptsKey(name: ts.PropertyName): boolean {
  if (ts.isIdentifier(name) || ts.isStringLiteralLike(name)) {
    return name.text === 'prompts';
  }
  if (ts.isComputedPropertyName(name)) {
    const key = name.expression;
    return ts.isStringLiteralLike(key) ? key.text === 'prompts' : /prompts/i.test(key.getText());
  }
  return false;
}

interface WrittenKeys {
  /** The object definitely has the prompts key. */
  hasPromptsKey: boolean;
  /** Part of the argument is something the guard cannot read (an identifier, a call, ...). */
  isOpaque: boolean;
}

/** The top-level keys an expression yields, following spreads, `&&`, `||`, `??` and `?:`. */
function writtenKeys(expression: ts.Expression | undefined): WrittenKeys {
  const merge = (...parts: WrittenKeys[]): WrittenKeys => ({
    hasPromptsKey: parts.some((part) => part.hasPromptsKey),
    isOpaque: parts.some((part) => part.isOpaque)
  });

  if (!expression) {
    return { hasPromptsKey: false, isOpaque: true };
  }

  if (
    ts.isParenthesizedExpression(expression) ||
    ts.isAsExpression(expression) ||
    ts.isSatisfiesExpression(expression) ||
    ts.isNonNullExpression(expression)
  ) {
    return writtenKeys(expression.expression);
  }

  if (ts.isConditionalExpression(expression)) {
    return merge(writtenKeys(expression.whenTrue), writtenKeys(expression.whenFalse));
  }

  if (ts.isBinaryExpression(expression)) {
    const operator = expression.operatorToken.kind;
    if (operator === ts.SyntaxKind.AmpersandAmpersandToken) {
      return writtenKeys(expression.right);
    }
    if (operator === ts.SyntaxKind.BarBarToken || operator === ts.SyntaxKind.QuestionQuestionToken) {
      return merge(writtenKeys(expression.left), writtenKeys(expression.right));
    }
  }

  if (ts.isObjectLiteralExpression(expression)) {
    return merge(
      { hasPromptsKey: false, isOpaque: false },
      ...expression.properties.map((property): WrittenKeys => {
        if (ts.isSpreadAssignment(property)) {
          return writtenKeys(property.expression);
        }
        return { hasPromptsKey: isPromptsKey(property.name), isOpaque: false };
      })
    );
  }

  return { hasPromptsKey: false, isOpaque: true };
}

/**
 * Only StorageManager's typed writers may write the prompts key (ADR-001): they accept only
 * values the Admission module made. Anything else that calls `storage.local.set` with a
 * prompts key bypasses Admission, and so does a call whose argument cannot be read.
 */
function findPromptsKeyWrites(filePath: string, contents: string): Violation[] {
  if (isTestPath(filePath)) {
    return [];
  }

  const sourceFile = parseSource(filePath, contents);
  const violations: Violation[] = [];

  // Any receiver counts, so an alias such as `storageApi.local.set(...)` is checked like `chrome.storage.local.set(...)`.
  const isLocalSet = (call: ts.CallExpression): boolean => memberChain(call.expression).slice(-2).join('.') === 'local.set';

  const visit = (node: ts.Node): void => {
    if (ts.isCallExpression(node) && isLocalSet(node)) {
      const keys = writtenKeys(node.arguments[0]);
      const writer = enclosingFunctionName(node);

      if (keys.hasPromptsKey) {
        const inTypedWriter = filePath === STORAGE_MANAGER && writer !== undefined && PROMPT_WRITERS.includes(writer);
        if (!inTypedWriter) {
          const where = filePath === STORAGE_MANAGER ? `${writer ?? 'module level'} in StorageManager` : filePath;
          violations.push(
            violationAt(
              filePath,
              node,
              `${where} writes the prompts key directly; only StorageManager's typed writers (${PROMPT_WRITERS.join(', ')}) may, because they accept only admitted values`
            )
          );
        }
      } else if (keys.isOpaque && !MAY_WRITE_OPAQUE_ARGUMENTS.includes(filePath)) {
        violations.push(
          violationAt(
            filePath,
            node,
            'cannot verify that storage.local.set does not write the prompts key: pass an object literal, or go through StorageManager'
          )
        );
      }
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

function toRepoPath(fullPath: string): string {
  return relative(REPO_ROOT, fullPath).split(sep).join('/');
}

let cachedTree: SourceText[] | undefined;

function readSourceTree(): SourceText[] {
  cachedTree ??= listSourceFiles(join(REPO_ROOT, 'src')).map((full) => ({
    path: toRepoPath(full),
    contents: readFileSync(full, 'utf-8')
  }));
  return cachedTree;
}

type Checker = (filePath: string, contents: string) => Violation[];

/** Runs a checker over a source tree and returns one `file:line:column message` per violation. */
function scan(check: Checker, files: readonly SourceText[] = readSourceTree()): string[] {
  return files.flatMap((file) => check(file.path, file.contents)).map(formatViolation);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Admission guardrails', () => {
  describe('invisible characters', () => {
    it.each([
      ['a null character', 0x0000],
      ['a C1 control character', 0x0085],
      ['a soft hyphen', 0x00ad],
      ['a zero-width space', 0x200b],
      ['a zero-width joiner', 0x200d],
      ['a left-to-right mark', 0x200e],
      ['a right-to-left override', 0x202e],
      ['a word joiner', 0x2060],
      ['a bidirectional isolate', 0x2066],
      ['a byte-order mark', 0xfeff],
      ['a Unicode tag character', 0xe0067]
    ])('reports %s written literally', (_name, codePoint) => {
      const hex = codePoint.toString(16).toUpperCase().padStart(4, '0');

      const violations = findInvisibleCharacters('src/a.ts', `const a = 'x${cp(codePoint)}y';`);

      expect(violations).toHaveLength(1);
      expect(violations[0]).toMatchObject({ file: 'src/a.ts', line: 1, column: 13 });
      expect(violations[0]?.message).toContain(`U+${hex}`);
    });

    it('reports the line and column of every occurrence, counting columns like an editor', () => {
      const contents = `first\nsecond ${cp(0x200b)}\n${cp(0xe0067)}${cp(0x202e)}`;

      const found = findInvisibleCharacters('src/b.ts', contents).map(formatViolation);

      expect(found).toHaveLength(3);
      expect(found[0]).toMatch(/^src\/b\.ts:2:8 U\+200B/);
      expect(found[1]).toMatch(/^src\/b\.ts:3:1 U\+E0067/);
      // The tag character is two UTF-16 code units, so the next character is at column 3.
      expect(found[2]).toMatch(/^src\/b\.ts:3:3 U\+202E/);
    });

    it('reports invisible characters in comments and strings, not only in code', () => {
      const contents = `// note${cp(0x200b)}\n/* ${cp(0x2062)} */\nconst s = \`${cp(0xfeff)}\`;`;

      expect(findInvisibleCharacters('src/c.ts', contents)).toHaveLength(3);
    });

    it('accepts a variation selector right after a symbol or emoji', () => {
      const contents = [
        `const warning = '${cp(0x26a0, 0xfe0f)} Careful';`,
        `const heart = '${cp(0x2764, 0xfe0f)}';`,
        `const text = '${cp(0x2764, 0xfe0e)}';`
      ].join('\n');

      expect(findInvisibleCharacters('src/d.tsx', contents)).toEqual([]);
    });

    it('reports a variation selector that does not follow a symbol or emoji', () => {
      const afterLetter = findInvisibleCharacters('src/e.ts', `a${cp(0xfe0f)}`);
      const afterInvisible = findInvisibleCharacters('src/e.ts', `${cp(0x200b, 0xfe0f)}`);
      const atLineStart = findInvisibleCharacters('src/e.ts', `x\n${cp(0xfe0f)}`);
      const doubled = findInvisibleCharacters('src/e.ts', `${cp(0x26a0, 0xfe0f, 0xfe0f)}`);

      expect(afterLetter).toHaveLength(1);
      expect(afterInvisible).toHaveLength(2);
      expect(atLineStart).toHaveLength(1);
      expect(doubled).toHaveLength(1);
    });

    it('accepts visible non-ASCII text, emoji, and escape sequences', () => {
      const backslash = '\\';
      const contents = [
        `const accented = '${cp(0xe9, 0x4e2d, 0x6587)}';`,
        `const smile = '${cp(0x1f600)}';`,
        `const escaped = '${backslash}u{200B} ${backslash}u{E0067} ${backslash}u{FEFF}';`,
        'const tab = "\\t";'
      ].join('\n');

      expect(findInvisibleCharacters('src/f.ts', contents)).toEqual([]);
    });

    it('finds none in src', () => {
      expect(scan(findInvisibleCharacters)).toEqual([]);
    });
  });

  describe('nominal type forgery', () => {
    const forge = (source: string, path = 'src/services/storage.ts') => findNominalTypeForgery(path, source);

    it.each([
      ['a direct cast', 'const p = raw as StoredPrompt;'],
      ['a cast through unknown', 'const p = raw as unknown as StoredPrompt;'],
      ['a cast to AdmittedPrompt', 'const p = raw as AdmittedPrompt;'],
      ['an angle-bracket assertion', 'const p = <StoredPrompt>raw;'],
      ['a cast to an array', 'const ps = JSON.parse(text) as StoredPrompt[];'],
      ['a cast to a readonly array', 'const ps = raw as unknown as readonly AdmittedPrompt[];'],
      ['a cast inside a generic', 'const ps = raw as Promise<StoredPrompt>;'],
      ['a cast to a union', 'const p = raw as StoredPrompt | null;'],
      ['a cast through a namespace import', "import * as m from './promptAdmission';\nconst p = raw as m.StoredPrompt;"],
      ['a cast through a renamed import', "import type { StoredPrompt as Stored } from './promptAdmission';\nconst p = raw as Stored;"],
      ['a cast to an inline import type', "const p = raw as import('./promptAdmission').AdmittedPrompt;"],
      ['a type predicate', 'function isStored(x: unknown): x is StoredPrompt { return true; }'],
      ['an assertion signature', 'function assertAdmitted(x: unknown): asserts x is AdmittedPrompt {}'],
      ['a construction', 'const p = new StoredPrompt();'],
      ['a subclass', 'class Fake extends AdmittedPrompt {}']
    ])('reports %s', (_name, source) => {
      expect(forge(source)).toHaveLength(1);
    });

    it('reports the position of the branded type', () => {
      const [violation] = forge('const a = 1;\nconst p = raw as unknown as StoredPrompt;');

      expect(violation).toMatchObject({ file: 'src/services/storage.ts', line: 2, column: 29 });
      expect(violation?.message).toContain('StoredPrompt');
    });

    it('reports casts in test files too', () => {
      expect(forge('const p = raw as StoredPrompt;', 'src/services/__tests__/storage.test.ts')).toHaveLength(1);
      expect(forge('const p = raw as AdmittedPrompt;', 'src/components/__tests__/Thing.test.tsx')).toHaveLength(1);
    });

    it('accepts ordinary uses of the types', () => {
      const source = [
        "import type { AdmittedPrompt, StoredPrompt } from './promptAdmission';",
        'export function merge(current: StoredPrompt, next: AdmittedPrompt[]): StoredPrompt | undefined {',
        '  const byId: Record<string, StoredPrompt> = {};',
        '  const wide: Prompt = current;',
        '  return next.length > 0 ? current : byId.x;',
        '}',
        'const view = raw as unknown as Prompt;',
        'const frozen = [1, 2] as const;',
        'const stored = readPrompt(raw) satisfies StoredPrompt | null;',
        'const other = raw as StoredPromptFilter;'
      ].join('\n');

      expect(forge(source)).toEqual([]);
    });

    it('is not fooled by comments, strings, or template literals', () => {
      const source = [
        '// const p = raw as StoredPrompt;',
        '/* const p = <AdmittedPrompt>raw; */',
        "const a = 'raw as unknown as StoredPrompt';",
        'const b = `new AdmittedPrompt() ${1}`;'
      ].join('\n');

      expect(forge(source)).toEqual([]);
    });

    it('allows the Admission module to mint, and only in its mint functions', () => {
      const module = 'src/services/promptAdmission.ts';
      const mint = [
        'function mintStored(fields: StoredFields): StoredPrompt {',
        '  return fields as unknown as StoredPrompt;',
        '}',
        'function mintAdmitted(fields: StoredFields): AdmittedPrompt {',
        '  return fields as unknown as AdmittedPrompt;',
        '}',
        'export declare class AdmittedPrompt extends StoredPrompt {}'
      ].join('\n');
      const stray = 'export function readPrompt(raw: unknown): StoredPrompt {\n  return raw as StoredPrompt;\n}';

      expect(forge(mint, module)).toEqual([]);
      expect(forge(stray, module)).toHaveLength(1);
    });

    it('finds none in src', () => {
      expect(scan(findNominalTypeForgery)).toEqual([]);
    });
  });

  describe('direct prompts-key writes', () => {
    const writes = (source: string, path = 'src/components/Foo.tsx') => findPromptsKeyWrites(path, source);

    it.each([
      ['a shorthand property', 'await chrome.storage.local.set({ prompts });'],
      ['a property assignment', 'await chrome.storage.local.set({ prompts: [] });'],
      ['a single-quoted key', "await chrome.storage.local.set({ 'prompts': [] });"],
      ['a double-quoted key', 'await chrome.storage.local.set({ "prompts": [] });'],
      ['a computed string key', "await chrome.storage.local.set({ ['prompts']: [] });"],
      ['a computed STORAGE_KEYS.PROMPTS key', 'await chrome.storage.local.set({ [STORAGE_KEYS.PROMPTS]: x });'],
      ['a computed key named for prompts', 'await chrome.storage.local.set({ [PROMPTS_KEY]: x });'],
      ['the prompts key among others', 'await chrome.storage.local.set({ categories, prompts: next });'],
      ['the prompts key after a spread', 'await chrome.storage.local.set({ ...rest, prompts: next });'],
      ['the prompts key in a conditional spread', 'await chrome.storage.local.set({ ...(ok && { prompts: next }) });'],
      ['a type-asserted literal', 'await chrome.storage.local.set({ prompts: next } as Record<string, unknown>);'],
      ['a call with a callback', 'chrome.storage.local.set({ prompts: next }, () => done());'],
      ['an optional chain', 'await chrome.storage?.local?.set({ prompts: next });'],
      ['the browser namespace', 'await browser.storage.local.set({ prompts: next });'],
      ['a qualified chrome', 'await window.chrome.storage.local.set({ prompts: next });'],
      ['an alias of chrome.storage', 'await storageApi.local.set({ prompts: next });'],
      ['an element access', "await chrome.storage['local']['set']({ prompts: next });"]
    ])('reports %s outside StorageManager', (_name, source) => {
      const [violation, ...rest] = writes(source);

      expect(rest).toEqual([]);
      expect(violation?.message).toContain('prompts key');
    });

    it('reports where the write is', () => {
      const [violation] = writes('const a = 1;\nawait chrome.storage.local.set({ prompts });', 'src/hooks/usePrompts.ts');

      expect(violation).toMatchObject({ file: 'src/hooks/usePrompts.ts', line: 2, column: 7 });
    });

    it.each([
      ['an identifier', 'await chrome.storage.local.set(payload);'],
      ['a spread of a value', 'await chrome.storage.local.set({ ...payload });'],
      ['a call result', 'await chrome.storage.local.set(buildPayload());']
    ])('reports an argument it cannot verify (%s) outside StorageManager', (_name, source) => {
      const [violation, ...rest] = writes(source);

      expect(rest).toEqual([]);
      expect(violation?.message).toContain('cannot verify');
    });

    it('accepts writes of other keys, in any form', () => {
      const source = [
        'await chrome.storage.local.set({ interfaceMode: mode });',
        "await chrome.storage.local.set({ promptLibrarySettings: next, interfaceMode: 'popup' });",
        'await chrome.storage.local.set({ grantedPermissions });',
        'await chrome.storage.local.set({ [TOAST_SETTINGS_KEY]: updated });',
        'await chrome.storage.local.set({ [USAGE_STORAGE_KEY]: history });',
        'await chrome.storage.local.set({ settings: { prompts: [] } });',
        'await chrome.storage.local.set({ ...(ok && { interfaceMode: mode }) });',
        'await chrome.storage.sync.set({ theme });',
        "cache.set('prompts', value);",
        "const read = await chrome.storage.local.get(['prompts']);",
        'await chrome.storage.local.clear();'
      ].join('\n');

      expect(writes(source)).toEqual([]);
    });

    it('is not fooled by comments, strings, or template literals', () => {
      const source = [
        '// chrome.storage.local.set({ prompts });',
        "const a = 'chrome.storage.local.set({ prompts })';",
        'const b = `chrome.storage.local.set({ prompts: ${x} })`;'
      ].join('\n');

      expect(writes(source)).toEqual([]);
    });

    it('lets StorageManager write the prompts key only in its typed writers', () => {
      const source = [
        'export class StorageManager {',
        '  private async writePrompts(prompts) {',
        '    await chrome.storage.local.set({ [STORAGE_KEYS.PROMPTS]: prompts });',
        '  }',
        '  private async writeScrubbed(scrubbed) {',
        '    await chrome.storage.local.set({',
        '      ...(scrubbed.prompts && { [STORAGE_KEYS.PROMPTS]: scrubbed.prompts }),',
        '      ...(scrubbed.categories && { [STORAGE_KEYS.CATEGORIES]: scrubbed.categories })',
        '    });',
        '  }',
        '  private async writeCategoriesAndPrompts(categories, prompts) {',
        '    await chrome.storage.local.set({ [STORAGE_KEYS.CATEGORIES]: categories, [STORAGE_KEYS.PROMPTS]: prompts });',
        '  }',
        '  private async setStorageData(key, data) {',
        '    await chrome.storage.local.set({ [key]: data });',
        '  }',
        '}'
      ].join('\n');

      expect(writes(source, 'src/services/storage.ts')).toEqual([]);
    });

    it('reports a prompts-key write in StorageManager outside the typed writers', () => {
      const inMethod = 'class StorageManager {\n  async importRaw(raw) {\n    await chrome.storage.local.set({ prompts: raw });\n  }\n}';
      const atTopLevel = 'await chrome.storage.local.set({ prompts: raw });';

      expect(writes(inMethod, 'src/services/storage.ts')).toHaveLength(1);
      expect(writes(inMethod, 'src/services/storage.ts')[0]?.message).toContain('importRaw');
      expect(writes(atTopLevel, 'src/services/storage.ts')).toHaveLength(1);
    });

    it('does not ask StorageManager or the storage availability helper to prove their arguments', () => {
      const source = 'async function write(payload) {\n  await chrome.storage.local.set(payload);\n}';

      expect(writes(source, 'src/services/storage.ts')).toEqual([]);
      expect(writes(source, 'src/utils/chromeStorage.ts')).toEqual([]);
      expect(writes(source, 'src/utils/other.ts')).toHaveLength(1);
    });

    it('ignores test code', () => {
      const source = 'await chrome.storage.local.set({ prompts: [] });';

      expect(writes(source, 'src/services/__tests__/storage.test.ts')).toEqual([]);
      expect(writes(source, 'src/components/__tests__/Thing.test.tsx')).toEqual([]);
      expect(writes(source, 'src/hooks/useThing.spec.ts')).toEqual([]);
      expect(writes(source, 'src/test/utils/InMemoryStorage.ts')).toEqual([]);
    });

    it('finds none in src', () => {
      expect(scan(findPromptsKeyWrites)).toEqual([]);
    });
  });

  // A guard that quietly scans nothing, or that cannot read the structure of the real files, would
  // stay green forever. These edit real files in memory (never on disk) and expect each guard to
  // fire, so the "finds none in src" tests above mean something.
  describe('on the real source tree', () => {
    /** A real file with its contents transformed. Fails loudly if the file is gone. */
    const edited = (path: string, edit: (contents: string) => string): SourceText => {
      const file = readSourceTree().find((candidate) => candidate.path === path);
      expect(file, `${path} is part of the source tree`).toBeDefined();
      return { path, contents: edit(file?.contents ?? '') };
    };

    const append = (extra: string) => (contents: string) => `${contents}\n${extra}\n`;

    it('walks every source file, tests and components included, this file too', () => {
      const paths = readSourceTree().map((file) => file.path);

      // The first two are the paths the guards single out: if one moves, update the constants above.
      expect(paths.length).toBeGreaterThan(100);
      expect(paths).toEqual(
        expect.arrayContaining([
          STORAGE_MANAGER,
          ADMISSION_MODULE,
          'src/services/__tests__/promptAdmission.test.ts',
          'src/components/SettingsView.tsx',
          toRepoPath(fileURLToPath(import.meta.url))
        ])
      );
    });

    it('catches an invisible character added to a real file', () => {
      const file = edited('src/services/promptAdmission.ts', append(`// note${cp(0x202e)}`));

      const found = scan(findInvisibleCharacters, [file]);

      expect(found).toHaveLength(1);
      expect(found[0]).toMatch(/^src\/services\/promptAdmission\.ts:\d+:\d+ U\+202E/);
    });

    it('catches a cast added to a component, to a test, and to the Admission module itself', () => {
      const cast = 'export const forged = raw as unknown as StoredPrompt;';
      const stray = 'export function stray(raw: unknown): AdmittedPrompt {\n  return raw as AdmittedPrompt;\n}';

      const files = [
        edited('src/components/SettingsView.tsx', append(cast)),
        edited('src/services/__tests__/promptAdmission.test.ts', append(cast)),
        edited('src/services/promptAdmission.ts', append(stray))
      ];

      for (const file of files) {
        expect(scan(findNominalTypeForgery, [file]), file.path).toHaveLength(1);
      }
    });

    it('catches a prompts-key write added to a real file', () => {
      const leak = 'export async function leak() {\n  await chrome.storage.local.set({ prompts: [] });\n}';

      const found = scan(findPromptsKeyWrites, [edited('src/hooks/usePrompts.ts', append(leak))]);

      expect(found).toHaveLength(1);
      expect(found[0]).toMatch(/^src\/hooks\/usePrompts\.ts:\d+:\d+ /);
    });

    it("sees StorageManager's three prompts-key writes, which are allowed only under their writer names", () => {
      const renamed = edited('src/services/storage.ts', (contents) =>
        contents
          .replace(/\bwriteCategoriesAndPrompts\b/g, 'persistBoth')
          .replace(/\bwriteScrubbed\b/g, 'persistScrubbed')
          .replace(/\bwritePrompts\b/g, 'persistPrompts')
      );

      const found = scan(findPromptsKeyWrites, [renamed]);

      expect(found).toHaveLength(3);
      expect(found.join('\n')).toContain('persistPrompts in StorageManager');
      expect(found.join('\n')).toContain('persistScrubbed in StorageManager');
      expect(found.join('\n')).toContain('persistBoth in StorageManager');
    });
  });
});
