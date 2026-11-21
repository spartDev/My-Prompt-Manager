// @vitest-environment node
/**
 * npm run store:images (scripts/store-images.ts): the parts that run without a browser. The PNG
 * codec that flattens Chromium's RGBA screenshots, the stale-build check, the options, the demo
 * Library the scenes are taken from, and the seven compositions with the owner's copy.
 */
import { mkdirSync, mkdtempSync, rmSync, utimesSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { deflateSync } from 'node:zlib';

import { afterEach, describe, expect, it } from 'vitest';

import { admit } from '../../src/services/promptAdmission';
import { DEFAULT_CATEGORY } from '../../src/types';
import { extractVariables } from '../../src/utils/promptVariables';
import { parseStoreImagesArgs } from '../store-images/args';
import { IMAGE_PLATFORMS, PLATFORM_LABELS } from '../store-images/composers';
import { LIBRARY_COPY, MARQUEE_COPY, PACKS_COPY, PLATFORMS_COPY, TILE_COPY, TRIGGER_COPY, TRUST_LINE, VARIABLES_COPY } from '../store-images/copy';
import { DEMO_CATEGORIES, demoPrompts, demoStore, packsStore, VARIABLES_PROMPT } from '../store-images/demoLibrary';
import { distProblem } from '../store-images/dist';
import { DARK_GROUND, storeImages, VIOLET_GROUND } from '../store-images/layouts';
import { decodePng, encodeRgbPng, flattenPng, pngInfo } from '../store-images/png';
import type { Scene, Scenes } from '../store-images/scenes';

// --- A PNG writer for the tests, with every filter, independent of png.ts ---

const crcTable = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) {
    c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  }
  return c >>> 0;
});

const pngChunk = (type: string, data: Buffer): Buffer => {
  const typed = Buffer.concat([Buffer.from(type, 'latin1'), data]);
  let c = 0xffffffff;
  for (const byte of typed) {
    c = crcTable[(c ^ byte) & 0xff] ^ (c >>> 8);
  }
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE((c ^ 0xffffffff) >>> 0);
  return Buffer.concat([length, typed, crc]);
};

const paeth = (a: number, b: number, c: number): number => {
  const p = a + b - c;
  const pa = Math.abs(p - a);
  const pb = Math.abs(p - b);
  const pc = Math.abs(p - c);
  return pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
};

/** An 8-bit PNG of `pixels` (rows of channel bytes), row y filtered with filter y % 5 */
const writePng = (width: number, pixels: number[][], channels: 3 | 4, extra: Buffer[] = []): Buffer => {
  const stride = width * channels;
  const rows = pixels.map((row, y) => {
    const filter = y % 5;
    const previous = y > 0 ? pixels[y - 1] : new Array<number>(stride).fill(0);
    const out = [filter];
    for (let x = 0; x < stride; x++) {
      const left = x >= channels ? row[x - channels] : 0;
      const up = previous[x];
      const upLeft = x >= channels ? previous[x - channels] : 0;
      const predicted = [0, left, up, (left + up) >> 1, paeth(left, up, upLeft)][filter];
      out.push((row[x] - predicted) & 0xff);
    }
    return out;
  });
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(pixels.length, 4);
  header.writeUInt8(8, 8);
  header.writeUInt8(channels === 4 ? 6 : 2, 9);
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    pngChunk('IHDR', header),
    ...extra,
    pngChunk('IDAT', deflateSync(Buffer.from(rows.flat()))),
    pngChunk('IEND', Buffer.alloc(0))
  ]);
};

/** Five rows of three RGBA pixels, one row per filter, with values that make each filter wrap */
const RGBA_ROWS = [
  [255, 0, 0, 255, 0, 255, 0, 128, 0, 0, 255, 0],
  [10, 200, 30, 255, 250, 5, 120, 255, 7, 99, 251, 64],
  [255, 255, 255, 0, 1, 2, 3, 255, 200, 100, 50, 255],
  [19, 87, 213, 255, 213, 87, 19, 191, 128, 128, 128, 255],
  [0, 0, 0, 255, 255, 255, 255, 255, 60, 30, 90, 32]
];

describe('png.ts', () => {
  it('decodes an RGBA PNG through all five row filters', () => {
    const image = decodePng(writePng(3, RGBA_ROWS, 4));
    expect(image.width).toBe(3);
    expect(image.height).toBe(5);
    expect([...image.data]).toEqual(RGBA_ROWS.flat());
  });

  it('decodes an RGB PNG as opaque RGBA', () => {
    const rows = RGBA_ROWS.map((row) => row.filter((_, index) => index % 4 !== 3));
    const image = decodePng(writePng(3, rows, 3));
    expect([...image.data]).toEqual(RGBA_ROWS.flatMap((row) => row.map((value, index) => (index % 4 === 3 ? 255 : value))));
  });

  it('tells alpha from the color type and from a tRNS chunk', () => {
    expect(pngInfo(writePng(3, RGBA_ROWS, 4))).toEqual({ width: 3, height: 5, bitDepth: 8, colorType: 6, hasAlpha: true });
    const opaque = RGBA_ROWS.map((row) => row.filter((_, index) => index % 4 !== 3));
    expect(pngInfo(writePng(3, opaque, 3)).hasAlpha).toBe(false);
    expect(pngInfo(writePng(3, opaque, 3, [pngChunk('tRNS', Buffer.from([0, 0, 0, 0, 0, 0]))])).hasAlpha).toBe(true);
  });

  it('flattens to 24-bit RGB, laying each pixel over the ground by its alpha', () => {
    const flat = flattenPng(writePng(3, RGBA_ROWS, 4), '#130e1d');
    expect(pngInfo(flat)).toEqual({ width: 3, height: 5, bitDepth: 8, colorType: 2, hasAlpha: false });
    const pixel = (x: number, y: number): number[] => [...decodePng(flat).data.subarray((y * 3 + x) * 4, (y * 3 + x) * 4 + 4)];
    // Opaque: its own color
    expect(pixel(0, 0)).toEqual([255, 0, 0, 255]);
    // Transparent: the ground
    expect(pixel(0, 2)).toEqual([0x13, 0x0e, 0x1d, 255]);
    // Half: halfway, rounded (0 * 128 + 0x13 * 127) / 255 = 9.46, (255 * 128 + 0x0e * 127) / 255 = 134.97
    expect(pixel(1, 0)).toEqual([9, 135, Math.round((0 * 128 + 0x1d * 127) / 255), 255]);
  });

  it('writes the same bytes for the same pixels', () => {
    const image = decodePng(writePng(3, RGBA_ROWS, 4));
    expect(encodeRgbPng(image, '#6d28d9').equals(encodeRgbPng(image, '#6d28d9'))).toBe(true);
  });

  it('refuses what it cannot read', () => {
    expect(() => pngInfo(Buffer.from('GIF89a'))).toThrow('Not a PNG file');
    expect(() => encodeRgbPng({ width: 1, height: 1, data: Buffer.alloc(4) }, 'violet')).toThrow('Not a #rrggbb color');
  });
});

// --- dist.ts ---

const temporary: string[] = [];
afterEach(() => {
  for (const dir of temporary.splice(0)) {
    rmSync(dir, { recursive: true, force: true });
  }
});

/** A repository at 2.0.0 with one source file, and a dist/ built `builtAgo` seconds after it (or none) */
const repository = (built: { version: string; after: number } | null): { root: string; dist: string } => {
  const root = mkdtempSync(path.join(tmpdir(), 'store-images-'));
  temporary.push(root);
  const dist = path.join(root, 'dist');
  const sourceTime = new Date('2026-11-20T10:00:00Z');
  writeFileSync(path.join(root, 'package.json'), JSON.stringify({ version: '2.0.0' }));
  mkdirSync(path.join(root, 'src', 'popup'), { recursive: true });
  writeFileSync(path.join(root, 'src', 'popup', 'App.tsx'), 'export {};');
  utimesSync(path.join(root, 'package.json'), sourceTime, sourceTime);
  utimesSync(path.join(root, 'src', 'popup', 'App.tsx'), sourceTime, sourceTime);
  if (built) {
    mkdirSync(dist);
    writeFileSync(path.join(dist, 'manifest.json'), JSON.stringify({ version: built.version }));
    const builtTime = new Date(sourceTime.getTime() + built.after * 1000);
    utimesSync(path.join(dist, 'manifest.json'), builtTime, builtTime);
  }
  return { root, dist };
};

describe('dist.ts', () => {
  it('takes a build of the Release made after its sources', () => {
    const { root, dist } = repository({ version: '2.0.0', after: 60 });
    expect(distProblem(root, dist)).toBeNull();
  });

  it('says to build when there is no build', () => {
    const { root, dist } = repository(null);
    expect(distProblem(root, dist)).toBe(`No build in ${dist}: run npm run build first.`);
  });

  it('says to build when the build is of another Release', () => {
    const { root, dist } = repository({ version: '1.9.0', after: 60 });
    expect(distProblem(root, dist)).toBe(`The build in ${dist} is 1.9.0, package.json is 2.0.0: run npm run build first.`);
  });

  it('says to build, and names the file, when a source changed after the build', () => {
    const { root, dist } = repository({ version: '2.0.0', after: -60 });
    expect(distProblem(root, dist)).toBe(`The build in ${dist} is older than ${path.join('src', 'popup', 'App.tsx')}: run npm run build first.`);
  });
});

describe('args.ts', () => {
  it('takes dist/ and store-assets/<version> when given nothing, headless', () => {
    expect(parseStoreImagesArgs([], '/repo/dist')).toEqual({ dist: '/repo/dist', headless: true });
  });

  it('takes --dist, --out and --headed', () => {
    expect(parseStoreImagesArgs(['--dist', '/a', '--out', '/b', '--headed'], '/repo/dist')).toEqual({ dist: '/a', out: '/b', headless: false });
  });

  it('refuses an unknown option and a missing value', () => {
    expect(() => parseStoreImagesArgs(['--outdir', '/b'], '/repo/dist')).toThrow('Unknown option --outdir');
    expect(() => parseStoreImagesArgs(['--out'], '/repo/dist')).toThrow('--out needs a value');
    expect(() => parseStoreImagesArgs(['--out', '--headed'], '/repo/dist')).toThrow('--out needs a value');
  });
});

// --- demoLibrary.ts ---

const NOW = Date.UTC(2026, 10, 21, 12);

describe('the demo Library', () => {
  const prompts = demoPrompts(NOW);

  it('has the four Categories of the ticket, and every Prompt is in one of them', () => {
    expect(DEMO_CATEGORIES.map((category) => category.name)).toEqual(['Product', 'Engineering', 'Writing', 'Hiring', DEFAULT_CATEGORY]);
    const names = new Set(DEMO_CATEGORIES.map((category) => category.name));
    for (const prompt of prompts) {
      expect(names).toContain(prompt.category);
    }
    expect(new Set(prompts.map((prompt) => prompt.category))).toEqual(new Set(['Product', 'Engineering', 'Writing', 'Hiring']));
  });

  it('has Pinned Prompts and usage counts, the newest used a few hours ago', () => {
    expect(prompts.filter((prompt) => prompt.pinned).map((prompt) => prompt.title)).toEqual(['Weekly status update', 'Code review checklist']);
    expect(prompts.filter((prompt) => prompt.usageCount > 0).length).toBeGreaterThan(prompts.length / 2);
    for (const prompt of prompts) {
      expect(prompt.createdAt).toBeLessThan(prompt.updatedAt);
      expect(prompt.updatedAt).toBeLessThan(NOW);
      expect(prompt.lastUsedAt).toBeLessThanOrEqual(NOW);
    }
  });

  it('has two Prompts with Variables, and the Variables image fills in both of the first one', () => {
    const withVariables = prompts.filter((prompt) => extractVariables(prompt.content).length > 0);
    expect(withVariables.map((prompt) => prompt.title)).toEqual(['Weekly status update', 'Interview scorecard']);
    const filled = prompts.find((prompt) => prompt.id === VARIABLES_PROMPT.id);
    expect(filled?.title).toBe(VARIABLES_PROMPT.title);
    expect(extractVariables(filled?.content ?? '')).toEqual(Object.keys(VARIABLES_PROMPT.values));
  });

  it('is admitted as it is: the Library would store these Prompts unchanged', () => {
    for (const { title, content, category } of prompts) {
      expect(admit({ title, content, category })).toEqual({ ok: true, text: { title, content, category } });
    }
  });

  it('names no person, address or account', () => {
    const text = JSON.stringify([prompts, DEMO_CATEGORIES, VARIABLES_PROMPT]);
    expect(text).not.toMatch(/@|https?:|www\.|\.com\b/i);
  });

  it('seeds the Library with the Welcome done and the Release seen, or the Welcome at its Packs', () => {
    expect(demoStore(NOW, 'dark', '2.0.0')).toMatchObject({
      prompts,
      categories: DEMO_CATEGORIES,
      settings: { theme: 'dark', interfaceMode: 'sidepanel' },
      welcome: { status: 'done' },
      whatsNew: { installedVersion: '2.0.0', lastSeenVersion: '2.0.0' }
    });
    const packs = packsStore('dark', '2.0.0');
    expect(packs).toMatchObject({ settings: { theme: 'dark', interfaceMode: 'popup' }, welcome: { status: 'pending', step: 2 }, whatsNew: { installedVersion: '2.0.0' } });
    expect(packs).not.toHaveProperty('prompts');
  });
});

// --- copy.ts and layouts.ts ---

describe('the seven images', () => {
  const scene: Scene = { png: Buffer.from('scene'), width: 400, height: 300, content: { x: 36, y: 36, width: 328, height: 228 } };
  const scenes: Scenes = {
    selectorDark: scene,
    selectorLight: scene,
    variables: scene,
    inserted: scene,
    platforms: Object.fromEntries(IMAGE_PLATFORMS.map((platform) => [platform, scene])) as Scenes['platforms'],
    library: scene,
    packs: scene
  };
  const images = storeImages(scenes, { font: Buffer.from('font'), icon: Buffer.from('icon'), mark: '<svg viewBox="0 0 18 18"><path d="M0 0h18v18H0z"/></svg>' });
  /** What an image says: its markup taken out, the spans inside a line (the accent of //) without a space */
  const textOf = (html: string): string =>
    html
      .replace(/<style>[\s\S]*?<\/style>/g, '')
      .replace(/<\/?span[^>]*>/g, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&quot;/g, '"')
      .replace(/&amp;/g, '&')
      .replace(/\s+/g, ' ');

  it('are the five screenshots, the small promo tile and the marquee, at the Store sizes', () => {
    expect(images.map(({ file, width, height, ground }) => ({ file, width, height, ground }))).toEqual([
      { file: 'screenshot-1-trigger.png', width: 1280, height: 800, ground: DARK_GROUND },
      { file: 'screenshot-2-variables.png', width: 1280, height: 800, ground: DARK_GROUND },
      { file: 'screenshot-3-platforms.png', width: 1280, height: 800, ground: DARK_GROUND },
      { file: 'screenshot-4-library.png', width: 1280, height: 800, ground: DARK_GROUND },
      { file: 'screenshot-5-packs.png', width: 1280, height: 800, ground: DARK_GROUND },
      { file: 'small-promo-tile.png', width: 440, height: 280, ground: VIOLET_GROUND },
      { file: 'marquee.png', width: 1400, height: 560, ground: DARK_GROUND }
    ]);
  });

  it("say the owner's copy, word for word", () => {
    const said = images.map((image) => textOf(image.html));
    expect(said[0]).toContain('Stop retyping your prompts');
    expect(said[0]).toContain('Type // and pick one from your Library.');
    expect(said[1]).toContain('Write it once. Reuse it everywhere.');
    expect(said[1]).toContain('Variables fill in what changes each time.');
    expect(said[2]).toContain('One Library for every AI chat');
    expect(said[2]).toContain('Claude, ChatGPT, Gemini, Mistral, Perplexity and Copilot.');
    expect(said[3]).toContain('A home for every prompt you write');
    expect(said[3]).toContain('Categories, Pinned and Most Used, always one click away.');
    expect(said[3]).toContain('Stays on your device. No account, no cloud.');
    expect(said[4]).toContain('Not sure where to start? Pick a Pack');
    expect(said[4]).toContain('Ready-made prompts, added in one click.');
    expect(said[5]).toContain('Your prompts, one // away');
    expect(said[6]).toContain('Write it once. Reuse it everywhere.');
    expect(said[6]).toContain('Your Library, inside Claude, ChatGPT, Gemini, Mistral, Perplexity and Copilot.');
    for (const text of said) {
      expect(text).toContain('My Prompt Manager');
    }
    // copy.ts holds the same words the images say
    expect([TRIGGER_COPY, VARIABLES_COPY, PLATFORMS_COPY, LIBRARY_COPY, PACKS_COPY, TILE_COPY, MARQUEE_COPY].map((copy) => copy.headline)).toEqual([
      'Stop retyping your prompts',
      'Write it once. Reuse it everywhere.',
      'One Library for every AI chat',
      'A home for every prompt you write',
      'Not sure where to start? Pick a Pack',
      'Your prompts, one // away',
      'Write it once. Reuse it everywhere.'
    ]);
    expect(TRUST_LINE).toBe('Stays on your device. No account, no cloud.');
  });

  it('name each Platform of the Platforms image as text, in the order of its subline', () => {
    expect(IMAGE_PLATFORMS.map((platform) => PLATFORM_LABELS[platform]).join(', ')).toBe('Claude, ChatGPT, Gemini, Mistral, Perplexity, Copilot');
    const said = textOf(images[2].html);
    for (const platform of IMAGE_PLATFORMS) {
      expect(said).toContain(` ${PLATFORM_LABELS[platform]} `);
    }
  });

  it('load nothing from the network: the font, the icon and the scenes are inline', () => {
    for (const { html } of images) {
      expect(html).not.toMatch(/(?:src|href)=["']https?:|url\(["']?https?:/);
      expect(html).toContain('data:font/woff2;base64,');
      expect(html).toContain(`data:image/png;base64,${scene.png.toString('base64')}`);
    }
  });
});
