// @vitest-environment node
/**
 * The scroll lines of src/popup.css (.section-scroll-scope [data-scroll-container]) follow the
 * scrolling element of the view under the header. Every view that renders <ViewHeader or <SectionHeader puts
 * data-scroll-container on that element, its flex-1 overflow box (My-Prompt-Manager-90c).
 * The views are found from the source, so a new one is covered without editing this test.
 */

import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

const SRC = path.resolve(__dirname, '../..');

/** An opening JSX tag: `<div className="…" …>`, attributes on one line or several */
const OPENING_TAG = /<[a-z][\w.]*\b[^<>]*>/g;
const VIEW_SCROLLER = /\bflex-1\b[^"'`]*\boverflow-(?:y-)?(?:auto|scroll)\b|\boverflow-(?:y-)?(?:auto|scroll)\b[^"'`]*\bflex-1\b/;

function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      return entry.name === '__tests__' || entry.name === 'test' ? [] : sourceFiles(full);
    }
    return /\.tsx$/.test(entry.name) && !/\.test\.tsx$/.test(entry.name) ? [full] : [];
  });
}

/** The opening tags of the view's scrolling elements, each with or without data-scroll-container */
function viewScrollers(source: string): string[] {
  return (source.match(OPENING_TAG) ?? []).filter((tag) => VIEW_SCROLLER.test(tag));
}

const VIEWS = sourceFiles(SRC)
  .filter((file) => /<(?:ViewHeader|SectionHeader)\b/.test(readFileSync(file, 'utf8')))
  .filter((file) => !['ViewHeader.tsx', 'SectionHeader.tsx'].includes(path.basename(file)))
  .map((file) => path.relative(SRC, file));

describe('Views under a ViewHeader', () => {
  it('are found from the source', () => {
    expect(VIEWS).toEqual(expect.arrayContaining(['components/LibraryView.tsx', 'components/SettingsView.tsx', 'components/analytics/AnalyticsDashboard.tsx']));
  });

  it.each(VIEWS)('%s puts data-scroll-container on its scrolling element', (file) => {
    const scrollers = viewScrollers(readFileSync(path.join(SRC, file), 'utf8'));

    expect(scrollers, 'flex-1 overflow elements').toHaveLength(1);
    expect(scrollers[0]).toMatch(/\sdata-scroll-container\b/);
  });

  it('tells the scrolling element from a nested scroller', () => {
    const view = [
      '<ViewHeader title="Add" />',
      '<div className="flex-1 overflow-auto p-4">',
      '  <div className="max-h-40 overflow-y-auto">',
      '</div>'
    ].join('\n');

    expect(viewScrollers(view)).toEqual(['<div className="flex-1 overflow-auto p-4">']);
  });
});
