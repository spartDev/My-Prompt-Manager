/**
 * PROTOTYPE, throwaway. The real App in side panel mode, in a plain browser tab: `chrome` is an
 * in-memory stub seeded with a few Prompts, nothing is saved. `?w=` sets the width of the panel
 * (default 360, the narrowest a Chrome side panel gets), `?variant=` the placement shown.
 */
import React from 'react';
import ReactDOM from 'react-dom/client';

import '../popup.css';

import { NewButtonVariantSwitcher } from './newButtonPlacement.prototype';

const now = Date.now();
const day = 86_400_000;
const prompt = (index: number, title: string, content: string, category: string, extra: object = {}) => ({
  id: `proto-${String(index)}`, title, content, category, createdAt: now - index * day, updatedAt: now - index * day, ...extra
});

const local: Record<string, unknown> = {
  prompts: [
    prompt(1, 'Code review checklist', 'Review this diff for correctness, naming, and missing tests. List findings by severity.', 'Code', { pinned: true, usageCount: 14 }),
    prompt(2, 'Summarise a meeting', 'Summarise the transcript below in five bullet points, then list decisions and owners.', 'Writing', { usageCount: 9 }),
    prompt(3, 'Explain like I am new to the team', 'Explain the following concept to a new joiner, with one concrete example.', 'Research', { usageCount: 3 }),
    prompt(4, 'Rewrite in plain English', 'Rewrite the text below in plain English. Keep every fact. Short sentences.', 'Writing'),
    prompt(5, 'Find the edge cases', 'List the edge cases this function does not handle, each with an input that shows it.', 'Code', { usageCount: 6 }),
    prompt(6, 'Compare two papers', 'Compare the two abstracts below: method, data, main claim, and where they disagree.', 'Research'),
    prompt(7, 'Commit message', 'Write a conventional commit message for this diff. Subject under 72 characters.', 'Code', { usageCount: 21 }),
    prompt(8, 'Weekly status update', 'Turn these notes into a status update: done, next, blocked.', 'Uncategorized')
  ],
  categories: [
    { id: 'c0', name: 'Uncategorized' },
    { id: 'c1', name: 'Writing', color: '#2563eb' },
    { id: 'c2', name: 'Code', color: '#16a34a' },
    { id: 'c3', name: 'Research', color: '#d97706' }
  ]
};

const changeListeners = new Set<(changes: Record<string, unknown>, area: string) => void>();
const makeArea = (store: Record<string, unknown>, name: string) => ({
  QUOTA_BYTES: 10_485_760,
  get: (keys?: string | string[] | Record<string, unknown> | null) => {
    if (keys == null) { return Promise.resolve({ ...store }); }
    const defaults: Record<string, unknown> = typeof keys === 'string' ? { [keys]: undefined }
      : Array.isArray(keys) ? Object.fromEntries(keys.map(key => [key, undefined])) : keys;
    return Promise.resolve(Object.fromEntries(
      Object.entries(defaults).map(([key, fallback]) => [key, store[key] ?? fallback]).filter(([, value]) => value !== undefined)
    ));
  },
  set: (items: Record<string, unknown>) => {
    const changes = Object.fromEntries(Object.entries(items).map(([key, newValue]) => [key, { oldValue: store[key], newValue }]));
    Object.assign(store, structuredClone(items));
    changeListeners.forEach(listener => { listener(changes, name); });
    return Promise.resolve();
  },
  remove: (keys: string | string[]) => { [keys].flat().forEach(key => { delete store[key]; }); return Promise.resolve(); },
  clear: () => { Object.keys(store).forEach(key => { delete store[key]; }); return Promise.resolve(); },
  getBytesInUse: () => Promise.resolve(JSON.stringify(store).length)
});

// Anything the stub does not name is a function that resolves to nothing
const anything: unknown = new Proxy(() => undefined, {
  get: (_target, property) => (property === 'then' ? undefined : anything),
  apply: () => Promise.resolve(undefined)
});

const stub = {
  storage: {
    local: makeArea(local, 'local'),
    session: makeArea({}, 'session'),
    onChanged: {
      addListener: (listener: (changes: Record<string, unknown>, area: string) => void) => { changeListeners.add(listener); },
      removeListener: (listener: (changes: Record<string, unknown>, area: string) => void) => { changeListeners.delete(listener); }
    }
  },
  tabs: new Proxy({ query: () => Promise.resolve([]) }, { get: (target, property) => Reflect.get(target, property) ?? anything }),
  permissions: { contains: () => Promise.resolve(false), request: () => Promise.resolve(false) },
  runtime: new Proxy({ id: 'prototype', getURL: (path: string) => `/${path}` }, { get: (target, property) => Reflect.get(target, property) ?? anything })
};
(globalThis as { chrome?: unknown }).chrome = new Proxy(stub, { get: (target, property) => Reflect.get(target, property) ?? anything });

const width = Number(new URLSearchParams(window.location.search).get('w')) || 360;
Object.assign(document.body.style, { width: '100%', height: '100vh', background: '#8a8a8a' });
const root = document.getElementById('root');
const bar = document.getElementById('prototype-bar');
if (root && bar) {
  // The panel stops above the switcher, so the bar never covers the tab bar it is judging
  Object.assign(root.style, { width: `${String(width)}px`, height: 'calc(100vh - 64px)', margin: '0 auto', overflow: 'hidden' });
  ReactDOM.createRoot(bar).render(<NewButtonVariantSwitcher />);
  // After the stub: modules of the app may read `chrome` as they load
  void import('../App').then(({ default: App }) => {
    ReactDOM.createRoot(root).render(
      <React.StrictMode>
        <App context="sidepanel" />
      </React.StrictMode>
    );
  });
}
