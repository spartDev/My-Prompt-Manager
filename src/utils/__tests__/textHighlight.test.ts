import { describe, expect, it } from 'vitest';

import { highlightMatch } from '../textHighlight';

describe('highlightMatch', () => {
  it('marks a match at the start', () => {
    expect(highlightMatch('Email follow-up', 'email')).toEqual({ before: '', match: 'Email', after: ' follow-up' });
  });

  it('marks a match in the middle', () => {
    expect(highlightMatch('Weekly status report', 'status')).toEqual({ before: 'Weekly ', match: 'status', after: ' report' });
  });

  it('marks a match at the end', () => {
    expect(highlightMatch('Follow-up email', 'email')).toEqual({ before: 'Follow-up ', match: 'email', after: '' });
  });

  it('ignores case and keeps the text as stored', () => {
    expect(highlightMatch('Code REVIEW checklist', 'review')).toEqual({ before: 'Code ', match: 'REVIEW', after: ' checklist' });
    expect(highlightMatch('code review', 'CODE')).toEqual({ before: '', match: 'code', after: ' review' });
  });

  it('marks only the first occurrence', () => {
    expect(highlightMatch('test the test', 'test')).toEqual({ before: '', match: 'test', after: ' the test' });
  });

  it('marks nothing when the search is not in the text', () => {
    expect(highlightMatch('Follow-up email', 'invoice')).toEqual({ before: 'Follow-up email', match: '', after: '' });
  });

  it.each(['', '   '])('marks nothing for an empty search (%j)', (query) => {
    expect(highlightMatch('Follow-up email', query)).toEqual({ before: 'Follow-up email', match: '', after: '' });
  });

  it('ignores the spaces around the search, as the search itself does', () => {
    expect(highlightMatch('Follow-up email', '  email ')).toEqual({ before: 'Follow-up ', match: 'email', after: '' });
  });

  it.each([
    ['What is C++ (really)?', 'c++ (', { before: 'What is ', match: 'C++ (', after: 'really)?' }],
    ['Price: $5.00 [draft]', '$5.00 [', { before: 'Price: ', match: '$5.00 [', after: 'draft]' }],
    ['a.b', '.', { before: 'a', match: '.', after: 'b' }],
    ['path\\to\\file', '\\to', { before: 'path', match: '\\to', after: '\\file' }],
    ['<b>bold</b>', '<b>', { before: '', match: '<b>', after: 'bold</b>' }],
    ['{{name}} intro', '{{name}}', { before: '', match: '{{name}}', after: ' intro' }]
  ])('reads special characters of %j as plain text', (text, query, segments) => {
    expect(highlightMatch(text, query)).toEqual(segments);
  });

  it('does not read the search as a pattern', () => {
    expect(highlightMatch('abc', '.*')).toEqual({ before: 'abc', match: '', after: '' });
  });

  it('marks nothing when lowercasing changes the length of the text', () => {
    expect(highlightMatch('İstanbul guide', 'guide')).toEqual({ before: 'İstanbul guide', match: '', after: '' });
  });

  it('always gives back the whole text', () => {
    for (const [text, query] of [['Résumé écrit', 'écrit'], ['emoji \u{1F469}\u200D\u{1F469}\u200D\u{1F467} family', 'family'], ['  padded  ', 'pad']] as const) {
      const { before, match, after } = highlightMatch(text, query);
      expect(before + match + after).toBe(text);
    }
  });
});
