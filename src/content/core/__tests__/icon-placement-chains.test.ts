/**
 * The anchor chain of each built-in Platform, run on a sanitized copy of its live composer
 * (tests/fixtures/composers/<platform>.html). A Platform that changes its composer fails here once
 * the fixture is captured again with `npm run composers:capture`, which runs this file on what it
 * captured this run (scripts/composers/fixtures.ts); every other Platform is read from the
 * committed fixtures.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { composerFixturePath } from '../../../../scripts/composers/fixtures';
import { SUPPORTED_PLATFORMS } from '../../../config/platforms';
import { resolveIconPlacement } from '../icon-placement';

const FIXTURES = resolve(__dirname, '../../../../tests/fixtures/composers');

/** The fixture of a Platform: the one the capture wrote this run, if any, else the committed one */
const fixtureOf = (platformId: string): string => composerFixturePath(platformId, FIXTURES, process.env);

/** Where a chain led on a composer: the anchor it reached, or the Anchored overlay */
function describeResolution(index: number | undefined, chainLength: number): string {
  return index === undefined
    ? `no anchor of the ${String(chainLength)} found: the icon falls to the Anchored overlay`
    : `anchor ${String(index)} of ${String(chainLength)} found, the earlier ones no longer match`;
}

/** Loads a Platform's composer fixture into the page and returns its editor */
function loadComposer(platformId: string): HTMLElement {
  document.body.innerHTML = readFileSync(fixtureOf(platformId), 'utf8');
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

    const placement = SUPPORTED_PLATFORMS[platformId].iconPlacement;

    const resolution = resolveIconPlacement(editor, placement);

    expect(resolution?.index, `${platformId}: ${describeResolution(resolution?.index, placement?.anchors.length ?? 0)}`).toBe(0);
  });

  it('m365copilot still finds the Fluent actions of the composer m365.cloud.microsoft served before its redirect', () => {
    // Reconstructed on 2026-11-11 from the attributes the injector relied on before Phase 2
    document.body.innerHTML = `
      <div class="fai-ChatInput">
        <span id="m365-chat-editor-target-element" data-lexical-editor="true" contenteditable="true" role="combobox"><p><br></p></span>
        <div class="fai-ChatInput__actions"><span><button type="button"></button><button type="submit"></button></span></div>
      </div>`;
    const editor = document.getElementById('m365-chat-editor-target-element') as HTMLElement;

    const resolution = resolveIconPlacement(editor, SUPPORTED_PLATFORMS.m365copilot.iconPlacement);

    expect(resolution?.anchor).toBe(document.querySelector('.fai-ChatInput__actions'));
  });

  it('m365copilot still finds the send button of a Fluent composer that has no actions element', () => {
    document.body.innerHTML = `
      <div class="fai-ChatInput">
        <span id="m365-chat-editor-target-element" data-lexical-editor="true" contenteditable="true" role="combobox"><p><br></p></span>
        <span><button type="submit"></button></span>
      </div>`;
    const editor = document.getElementById('m365-chat-editor-target-element') as HTMLElement;

    const resolution = resolveIconPlacement(editor, SUPPORTED_PLATFORMS.m365copilot.iconPlacement);

    expect(resolution?.index).toBe(2);
    expect(resolution?.anchor).toBe(document.querySelector('button[type="submit"]'));
  });

  it('m365copilot takes the Fluent composer that holds the actions, not an inner .fai-ChatInput around the editor', () => {
    document.body.innerHTML = `
      <div class="fai-ChatInput">
        <div class="fai-ChatInput"><span id="m365-chat-editor-target-element" data-lexical-editor="true" contenteditable="true" role="combobox"><p><br></p></span></div>
        <div class="fai-ChatInput__actions"><button type="submit"></button></div>
      </div>`;
    const editor = document.getElementById('m365-chat-editor-target-element') as HTMLElement;

    expect(resolveIconPlacement(editor, SUPPORTED_PLATFORMS.m365copilot.iconPlacement)?.index).toBe(1);
  });

  it('m365copilot places the icon right after the plus menu of copilot.cloud.microsoft', () => {
    const editor = loadComposer('m365copilot');

    const resolution = resolveIconPlacement(editor, SUPPORTED_PLATFORMS.m365copilot.iconPlacement);

    expect(resolution?.anchor).toBe(document.querySelector('[data-testid="PlusMenuButton"]'));
    expect(SUPPORTED_PLATFORMS.m365copilot.iconPlacement?.anchors[0].relation).toBe('after');
  });

  it('m365copilot finds its composer still when a capture folds the span around the editor', () => {
    document.body.innerHTML = readFileSync(fixtureOf('m365copilot'), 'utf8').replace('<span></span>', '');
    const wrapper = document.querySelector('[data-lexical-editor]')?.parentElement as HTMLElement;
    wrapper.replaceWith(...Array.from(wrapper.children));
    const editor = document.querySelector<HTMLElement>('[contenteditable="true"]') as HTMLElement;
    expect(editor.parentElement?.tagName).toBe('DIV');

    expect(resolveIconPlacement(editor, SUPPORTED_PLATFORMS.m365copilot.iconPlacement)?.index).toBe(0);
  });

  it('m365copilot gives no anchor once the plus menu loses its test id: the icon goes on the editor', () => {
    document.body.innerHTML = readFileSync(fixtureOf('m365copilot'), 'utf8').replace(' data-testid="PlusMenuButton"', '');
    const editor = document.querySelector<HTMLElement>('[contenteditable="true"]') as HTMLElement;

    expect(resolveIconPlacement(editor, SUPPORTED_PLATFORMS.m365copilot.iconPlacement)).toBeNull();
  });

  it('m365copilot gives another editor on the page, such as a message being edited, no anchor of the composer', () => {
    document.body.innerHTML = `
      <div>
        <div><div contenteditable="true" data-lexical-editor="true" role="textbox" id="edited-message"></div></div>
        ${readFileSync(fixtureOf('m365copilot'), 'utf8')}
      </div>`;
    const edited = document.getElementById('edited-message') as HTMLElement;
    const composerEditor = document.querySelector<HTMLElement>('[contenteditable="true"]:not(#edited-message)') as HTMLElement;

    expect(resolveIconPlacement(edited, SUPPORTED_PLATFORMS.m365copilot.iconPlacement)).toBeNull();
    // The composer's own editor still finds its toolbar
    expect(resolveIconPlacement(composerEditor, SUPPORTED_PLATFORMS.m365copilot.iconPlacement)?.index).toBe(0);
  });

  it('m365copilot takes no button of the page outside the composer, such as a dictation button in a header', () => {
    document.body.innerHTML = `
      <div>
        <header><button type="button" aria-label="Start dictation"></button></header>
        <div><div contenteditable="true" data-lexical-editor="true" role="textbox"></div></div>
      </div>`;
    const editor = document.querySelector<HTMLElement>('[contenteditable="true"]') as HTMLElement;

    expect(resolveIconPlacement(editor, SUPPORTED_PLATFORMS.m365copilot.iconPlacement)).toBeNull();
  });

  it('never takes an anchor outside the composer, such as a message action bar above it', () => {
    const editor = loadComposer('claude');
    const messageBar = document.createElement('div');
    messageBar.innerHTML = '<div data-testid="composer-dictate"></div>';
    document.body.prepend(messageBar);

    const resolution = resolveIconPlacement(editor, SUPPORTED_PLATFORMS.claude.iconPlacement);

    const composer = editor.closest(SUPPORTED_PLATFORMS.claude.iconPlacement?.composer ?? ':not(*)');
    expect(composer).not.toBeNull();
    expect(composer?.contains(resolution?.anchor ?? null)).toBe(true);
    expect(messageBar.contains(resolution?.anchor ?? null)).toBe(false);
  });

  it.each(Object.keys(SUPPORTED_PLATFORMS))('%s gives no anchor for an editor alone on the page', (platformId) => {
    document.body.innerHTML = '<div contenteditable="true" role="textbox"></div>';
    const editor = document.body.firstElementChild as HTMLElement;

    expect(resolveIconPlacement(editor, SUPPORTED_PLATFORMS[platformId].iconPlacement)).toBeNull();
  });
});
