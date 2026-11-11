/**
 * The anchor chain of each built-in Platform, run on a sanitized copy of its live composer
 * (tests/fixtures/composers/<platform>.html). A Platform that changes its composer fails here once
 * the fixture is captured again.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { SUPPORTED_PLATFORMS } from '../../../config/platforms';
import { resolveIconPlacement } from '../icon-placement';

const FIXTURES = resolve(__dirname, '../../../../tests/fixtures/composers');

/** Loads a Platform's composer fixture into the page and returns its editor */
function loadComposer(platformId: string): HTMLElement {
  document.body.innerHTML = readFileSync(resolve(FIXTURES, `${platformId}.html`), 'utf8');
  // The strategies, not this config, find the editor on the page: any editable element will do here
  const editor = document.querySelector<HTMLElement>('[contenteditable="true"], textarea');
  if (!editor) {
    throw new Error(`No editor of ${platformId} in its composer fixture`);
  }
  return editor;
}

describe('icon placement chains on the live composers', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  it.each(['claude', 'chatgpt', 'mistral', 'perplexity', 'gemini', 'copilot', 'm365copilot'])('%s resolves its first anchor', (platformId) => {
    const editor = loadComposer(platformId);

    const resolution = resolveIconPlacement(editor, SUPPORTED_PLATFORMS[platformId].iconPlacement);

    expect(resolution?.index).toBe(0);
  });

  it('never takes an anchor outside the composer, such as a message action bar above it', () => {
    const editor = loadComposer('claude');
    const messageBar = document.createElement('div');
    messageBar.innerHTML = '<div data-testid="composer-dictate"></div>';
    document.body.prepend(messageBar);

    const resolution = resolveIconPlacement(editor, SUPPORTED_PLATFORMS.claude.iconPlacement);

    expect(resolution?.anchor.closest('div:has([data-testid="chat-input"])')).not.toBeNull();
    expect(messageBar.contains(resolution?.anchor ?? null)).toBe(false);
  });

  it.each(Object.keys(SUPPORTED_PLATFORMS))('%s gives no anchor for an editor alone on the page', (platformId) => {
    document.body.innerHTML = '<div contenteditable="true" role="textbox"></div>';
    const editor = document.body.firstElementChild as HTMLElement;

    expect(resolveIconPlacement(editor, SUPPORTED_PLATFORMS[platformId].iconPlacement)).toBeNull();
  });
});
