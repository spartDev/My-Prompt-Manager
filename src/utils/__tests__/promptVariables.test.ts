import { describe, expect, it } from 'vitest';

import { extractVariables, fillVariables } from '../promptVariables';

describe('extractVariables', () => {
  it('returns no variables for text without placeholders', () => {
    expect(extractVariables('Summarize this article.')).toEqual([]);
  });

  it('finds a named variable', () => {
    expect(extractVariables('Translate to {{language}}.')).toEqual(['language']);
  });

  it('returns distinct names in order of first appearance', () => {
    expect(extractVariables('{{b}} then {{a}} then {{b}} and {{c}} then {{a}}')).toEqual(['b', 'a', 'c']);
  });

  it('trims whitespace inside the braces so {{ lang }} is the same variable as {{lang}}', () => {
    expect(extractVariables('{{ lang }} and {{lang}} and {{  lang\t}}')).toEqual(['lang']);
  });

  it('ignores malformed placeholders', () => {
    expect(extractVariables('{{}} {{   }} {name} {{ open and close }')).toEqual([]);
  });

  it('does not span lines', () => {
    expect(extractVariables('{{first\nsecond}}')).toEqual([]);
  });
});

describe('fillVariables', () => {
  it('fills every occurrence of a variable, whatever the whitespace inside the braces', () => {
    expect(fillVariables('{{lang}} to {{ lang }}: {{text}}', { lang: 'French', text: 'Hello' })).toBe('French to French: Hello');
  });

  it('leaves unfilled variables raw, exactly as written', () => {
    expect(fillVariables('Hi {{ name }}, see {{topic}}', { name: '', topic: 'tests' })).toBe('Hi {{ name }}, see tests');
    expect(fillVariables('Hi {{name}}', {})).toBe('Hi {{name}}');
  });

  it('inserts values literally (no $ replacement patterns, no re-expansion of braces)', () => {
    expect(fillVariables('{{a}} {{b}}', { a: '$& $1 {{b}}', b: 'B' })).toBe('$& $1 {{b}} B');
  });

  it('leaves malformed placeholders untouched', () => {
    expect(fillVariables('{{}} {name}', { name: 'x' })).toBe('{{}} {name}');
  });
});
