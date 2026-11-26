/**
 * What a pick sends, and what its Custom site's configuration code holds (My-Prompt-Manager-je37).
 *
 * Each case builds a page whose address has a path, a query and a fragment, puts a draft or a value
 * of the page's own in the element, then picks it through the real click path of the Element picker
 * and reads the ELEMENT_SELECTED message it sends. The Custom site is then built from that message as
 * AddCustomSiteForm builds it, exported with ConfigurationEncoder.encode and decoded again.
 *
 * Each case also checks what the pick keeps: the element is still found as the content script finds
 * it, by the fingerprint, then by the selector, so a pick that keeps nothing at all fails too. Where the
 * page gives the element no identifier a pick keeps, the fingerprint no longer finds it and the
 * selector does (`fingerprintFinds: false`).
 *
 * Token-shaped values and the e-mail address are built from parts, so no such string is written whole.
 */
import userEvent from '@testing-library/user-event';
import { decompressFromEncodedURIComponent } from 'lz-string';
import { act, createElement, useState } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ConfigurationEncoder } from '../../../services/configurationEncoder';
import type { CustomSite, ElementFingerprint } from '../../../types';
import { getElementFingerprintGenerator } from '../../utils/element-fingerprint';
import { ElementPicker } from '../element-picker';

vi.mock('../../utils/logger', () => ({
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  debug: vi.fn(),
  isDebugMode: vi.fn(() => false)
}));

const DRAFT = 'Draft: merger closes Friday';
const TOKEN = ['tk', '9f8e7d6c5b4a3f2e'].join('');
const EMAIL = ['jane.doe', 'example.org'].join('@');
const PATH = '/workspace/notes/42';
const QUERY = `invite=${TOKEN}&email=${encodeURIComponent(EMAIL)}`;
const FRAGMENT = 'reply-to-7c1d';
const OPAQUE_HEX = ['a8f3c2e1', 'b7d94e06'].join('');
const UUID = ['e5f6a7b8', '1c2d', '4e5f', '8a9b', '0c1d2e3f4a5b'].join('-');
const JWT = [['eyJhbGciOiJIUzI1', 'NiJ9'].join(''), ['eyJzdWIiOiIx', 'MjM0NTY3ODkwIn0'].join(''), ['SflKxwRJSMeKKF2QT4fwpM', 'eJf36POk6yJV_adQssw5c'].join('')].join('.');

/** What no part of a pick, nor of its configuration code, may hold */
const PAGE_ADDRESS = [PATH, QUERY, TOKEN, EMAIL, encodeURIComponent(EMAIL), FRAGMENT];

interface PickCase {
  name: string;
  /** Builds the page and returns the element the user picks */
  build: () => Promise<HTMLElement> | HTMLElement;
  /** What the page holds that the pick must not keep */
  private: string[];
  /** What the pick keeps, at least, so that the fingerprint still names the element */
  kept: Partial<{ id: string; dataTestId: string; name: string; ariaLabel: string; placeholder: string }>;
  /** Whether the fingerprint alone still finds the element; else the selector does */
  fingerprintFinds?: false;
}

let root: Root | null = null;

/** A React composer whose textarea is controlled: React keeps its text content equal to what is typed */
const Composer = () => {
  const [draft, setDraft] = useState('');
  return createElement('textarea', {
    id: 'prompt-textarea',
    placeholder: 'Ask anything',
    value: draft,
    onChange: (event: { target: { value: string } }) => { setDraft(event.target.value); }
  });
};

const renderReactComposer = async (): Promise<HTMLTextAreaElement> => {
  const host = document.createElement('div');
  host.id = 'react-host';
  document.body.appendChild(host);
  await act(async () => {
    root = createRoot(host);
    root.render(createElement(Composer));
  });
  const textarea = host.querySelector('textarea');
  if (!textarea) {
    throw new Error('The React composer did not render');
  }
  await userEvent.type(textarea, DRAFT);
  return textarea;
};

const CASES: PickCase[] = [
  {
    name: 'a contenteditable composer holding a draft',
    build: () => {
      document.body.innerHTML = `
        <main id="chat">
          <div id="composer" contenteditable="true" role="textbox" aria-label="Write a message" data-testid="chat-input"><p>${DRAFT}</p></div>
        </main>`;
      return document.getElementById('composer') as HTMLElement;
    },
    private: [DRAFT, 'merger'],
    kept: { id: 'composer', dataTestId: 'chat-input', ariaLabel: 'Write a message' }
  },
  {
    name: "the composer's wrapper, around a field holding a draft",
    build: () => {
      document.body.innerHTML = `
        <main id="chat">
          <div class="composer-shell" data-testid="composer-shell">
            <div contenteditable="true" role="textbox"><p>${DRAFT}</p></div>
          </div>
        </main>`;
      return document.querySelector('.composer-shell') as HTMLElement;
    },
    private: [DRAFT, 'merger'],
    kept: { dataTestId: 'composer-shell' }
  },
  {
    name: 'a React controlled textarea after typing',
    build: renderReactComposer,
    private: [DRAFT, 'merger'],
    kept: { id: 'prompt-textarea', placeholder: 'Ask anything' }
  },
  {
    name: 'a field whose page copies the draft into a data- attribute',
    build: () => {
      document.body.innerHTML = `
        <form><input type="text" name="message" data-draft="hello" value="hello" class="msg"></form>
        <form><input type="text" class="msg"></form>`;
      return document.querySelector('[data-draft]') as HTMLElement;
    },
    private: ['hello'],
    kept: { name: 'message' }
  },
  {
    name: 'a draft copied into a data- attribute, holding a word the fingerprint filters',
    build: () => {
      document.body.innerHTML = `
        <form><input type="text" name="message" data-draft="session notes" class="msg"></form>
        <form><input type="text" class="msg"></form>`;
      return document.querySelector('[data-draft]') as HTMLElement;
    },
    private: ['session notes'],
    kept: { name: 'message' }
  },
  {
    name: 'an opaque token in data-id and a JWT in data-state',
    build: () => {
      document.body.innerHTML = `
        <div><textarea data-id="${OPAQUE_HEX}" data-state="${JWT}" placeholder="Message" class="box"></textarea></div>
        <div><textarea class="box"></textarea></div>`;
      return document.querySelector('[data-id]') as HTMLElement;
    },
    private: [OPAQUE_HEX, JWT],
    kept: { placeholder: 'Message' },
    fingerprintFinds: false
  },
  {
    name: "a session id on an ancestor, which the selector's path reaches",
    build: () => {
      document.body.innerHTML = `
        <section id="${UUID}"><div><div><textarea class="box"></textarea></div></div></section>
        <section><div><div><textarea class="box"></textarea></div></div></section>`;
      return document.querySelector(`[id="${UUID}"] textarea`) as HTMLElement;
    },
    private: [UUID],
    kept: {},
    fingerprintFinds: false
  },
  {
    name: 'an e-mail address in a test id, and a user id in the element id',
    build: () => {
      document.body.innerHTML = `
        <div id="thread-${'4815162342'}"><button type="button" id="user-${'90210731'}" data-testid="${EMAIL}" aria-label="Send">Send</button></div>`;
      return document.querySelector('button') as HTMLElement;
    },
    private: [EMAIL, '90210731', '4815162342'],
    kept: { ariaLabel: 'Send' }
  }
];

/** The data of the ELEMENT_SELECTED message the picker sends when the user clicks this element */
const pick = (element: HTMLElement): { fingerprint: ElementFingerprint; selector: string; [key: string]: unknown } => {
  const picker = new ElementPicker();
  const elementFromPoint = vi.spyOn(document, 'elementFromPoint').mockReturnValue(element);
  try {
    picker.activate();
    document.dispatchEvent(new MouseEvent('mousemove', { clientX: 10, clientY: 10, bubbles: true }));
    document.dispatchEvent(new MouseEvent('click', { clientX: 10, clientY: 10, bubbles: true }));
  } finally {
    picker.deactivate();
    elementFromPoint.mockRestore();
  }
  const sent = vi.mocked(chrome.runtime.sendMessage).mock.calls
    .map(([message]) => message as { type?: string; data?: unknown })
    .find((message) => message.type === 'ELEMENT_SELECTED');
  if (!sent) {
    throw new Error('The picker sent no ELEMENT_SELECTED: the element was refused');
  }
  return sent.data as { fingerprint: ElementFingerprint; selector: string };
};

/** The Custom site the form stores for this pick (AddCustomSiteForm.handleAddSite) */
const customSiteOf = (data: { fingerprint: ElementFingerprint; selector: string }): CustomSite => ({
  hostname: 'notes.example.com',
  displayName: 'Team notes',
  enabled: true,
  dateAdded: 1_760_000_000_000,
  positioning: {
    mode: 'custom',
    fingerprint: data.fingerprint,
    selector: data.selector,
    placement: 'before',
    offset: { x: 0, y: 0 },
    zIndex: 1000
  }
});

/** The element the content script places the button by: the fingerprint's, else the selector's (PlacementRepair.findPicked) */
const placedBy = (fingerprint: ElementFingerprint | undefined, selector: string | undefined): Element | null =>
  (fingerprint ? getElementFingerprintGenerator().findElement(fingerprint) : null)
  ?? (selector ? document.querySelector(selector) : null);

const expectNoneOf = (where: string, serialized: string, values: readonly string[]) => {
  for (const value of values) {
    expect(serialized, `${where} holds "${value}"`).not.toContain(value);
  }
};

describe('Element picker: a pick keeps nothing of the page address nor of what the user typed (je37)', () => {
  beforeEach(() => {
    window.history.pushState(null, '', `${PATH}?${QUERY}#${FRAGMENT}`);
  });

  afterEach(() => {
    act(() => { root?.unmount(); });
    root = null;
    document.body.innerHTML = '';
    window.history.pushState(null, '', '/');
  });

  it.each(CASES)('AC1: $name: the pick sends neither the address, its query, its fragment nor the draft', async (pickCase) => {
    const element = await pickCase.build();
    expect(window.location.search).toBe(`?${QUERY}`);
    expect(window.location.hash).toBe(`#${FRAGMENT}`);

    const data = pick(element);

    expectNoneOf('the ELEMENT_SELECTED message', JSON.stringify(data), [...PAGE_ADDRESS, ...pickCase.private]);
    expect(data.fingerprint.meta).not.toHaveProperty('url');
    expect(data.fingerprint.content).toEqual({});

    // What it keeps still names the element
    expect(data.fingerprint.primary).toMatchObject(Object.fromEntries(
      Object.entries(pickCase.kept).filter(([key]) => key !== 'placeholder')
    ));
    if (pickCase.kept.placeholder) {
      expect(data.fingerprint.secondary.placeholder).toBe(pickCase.kept.placeholder);
    }
    expect(getElementFingerprintGenerator().findElement(data.fingerprint)).toBe(pickCase.fingerprintFinds === false ? null : element);
    expect(document.querySelector(data.selector)).toBe(element);
    expect(placedBy(data.fingerprint, data.selector)).toBe(element);
  });

  it.each(CASES)("AC2: $name: the site's configuration code, and the site decoded from it, hold none of them", async (pickCase) => {
    const element = await pickCase.build();
    const site = customSiteOf(pick(element));

    const code = await ConfigurationEncoder.encode(site);
    const payload = decompressFromEncodedURIComponent(code);
    expect(payload).toBeTruthy();
    expectNoneOf('the configuration code', payload ?? '', [...PAGE_ADDRESS, ...pickCase.private]);

    const decoded = await ConfigurationEncoder.decode(code);
    expectNoneOf('the decoded site', JSON.stringify(decoded), [...PAGE_ADDRESS, ...pickCase.private]);

    // The decoded site still places its button by the element picked
    expect(decoded.positioning?.fingerprint).toBeDefined();
    expect(document.querySelector(decoded.positioning?.selector ?? '')).toBe(element);
    expect(placedBy(decoded.positioning?.fingerprint, decoded.positioning?.selector)).toBe(element);
  });
});
