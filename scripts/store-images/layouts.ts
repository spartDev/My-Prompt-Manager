/**
 * The seven store images as HTML pages at their exact size, after the compositions the owner chose
 * (ticket My-Prompt-Manager-tuh.9, its design field, in px at the final size): the copy, the brand,
 * the // watermark, and the scenes of scenes.ts placed and scaled. Pure: the images are taken from
 * these pages by store-images.ts.
 */

import { IMAGE_PLATFORMS, type ImagePlatform, PLATFORM_LABELS } from './composers';
import { BRAND_NAME, type ImageCopy, LIBRARY_COPY, MARQUEE_COPY, PACKS_COPY, PLATFORMS_COPY, TILE_COPY, TRIGGER_COPY, TRUST_LINE, VARIABLES_COPY } from './copy';
import type { Scene, Scenes } from './scenes';

/** What every image draws besides the scenes */
export interface Assets {
  /** Schibsted Grotesk, the build's own (dist/fonts) */
  font: Buffer;
  /** The extension's icon, 128 px (dist/public/icons) */
  icon: Buffer;
  /** The extension's mark, the bubble of LogoIcon (src/components/icons/HeaderIcons.tsx), as SVG markup */
  mark: string;
}

export interface StoreImage {
  file: string;
  width: number;
  height: number;
  /** The image's ground: what the flattened PNG lays every pixel over */
  ground: string;
  html: string;
}

/** The dark ground of the screenshots and the marquee, the violet one of the tile */
export const DARK_GROUND = '#130e1d';
export const VIOLET_GROUND = '#6d28d9';

const SCREENSHOT = { width: 1280, height: 800 } as const;
const TILE = { width: 440, height: 280 } as const;
const MARQUEE = { width: 1400, height: 560 } as const;

const escapeHtml = (text: string): string => text.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c] ?? c);

/** Names of two words a line break must not split: the domain terms the copy names */
const KEPT_WHOLE = ['Most Used'];

/** The text, with each // in the accent color, and the names of KEPT_WHOLE on one line */
const withTrigger = (text: string): string =>
  KEPT_WHOLE.reduce(
    (html, name) => html.replaceAll(escapeHtml(name), `<span class="whole">${escapeHtml(name)}</span>`),
    escapeHtml(text).replace(/\/\//g, '<span class="tok">//</span>')
  );

const dataUri = (type: string, bytes: Buffer): string => `data:${type};base64,${bytes.toString('base64')}`;

const LOCK = '<svg viewBox="0 0 16 16" width="1em" height="1em" aria-hidden="true"><rect x="3" y="7" width="10" height="7.5" rx="1.8" fill="currentColor"/><path d="M5.2 7V5.3a2.8 2.8 0 0 1 5.6 0V7" fill="none" stroke="currentColor" stroke-width="1.6"/></svg>';

const page = (size: { width: number; height: number }, ground: string, assets: Assets, css: string, body: string): string => /* html */ `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <style>
      @font-face { font-family: 'Schibsted Grotesk'; font-weight: 400 900; src: url('${dataUri('font/woff2', assets.font)}') format('woff2'); }
      * { box-sizing: border-box; margin: 0; padding: 0; }
      html, body { width: ${String(size.width)}px; height: ${String(size.height)}px; overflow: hidden; background: ${ground}; }
      body { position: relative; font-family: 'Schibsted Grotesk', sans-serif; color: #f1ecfb; -webkit-font-smoothing: antialiased; }
      .glyph { position: absolute; font-weight: 900; letter-spacing: -.08em; line-height: .8; white-space: nowrap; }
      .hl { font-weight: 800; letter-spacing: -.028em; line-height: 1.02; text-wrap: balance; }
      .tok { color: #a78bfa; }
      .whole { white-space: nowrap; }
      .sl { line-height: 1.35; text-wrap: balance; color: #b9aed6; }
      .brand { position: absolute; display: flex; align-items: center; gap: .6em; font-weight: 700; white-space: nowrap; }
      .brand img, .brand svg { display: block; flex: none; }
      .scene { position: absolute; }
      .scene img { position: absolute; display: block; }
      ${css}
    </style>
  </head>
  <body>${body}</body>
</html>`;

interface Placement {
  /** Where the scene's content (the UI, without the room kept for its shadows) starts */
  x: number;
  y: number;
  scale: number;
  /** A CSS transform of the content box, about `origin` */
  transform?: string;
  origin?: string;
}

/** The scene's image, its content box at `x`, `y`, enlarged `scale` times */
const placed = (scene: Scene, { x, y, scale, transform, origin }: Placement, extra = ''): string => {
  const style = [
    `left: ${String(x)}px`,
    `top: ${String(y)}px`,
    `width: ${String(scene.content.width * scale)}px`,
    `height: ${String(scene.content.height * scale)}px`,
    ...(transform ? [`transform: ${transform}`, `transform-origin: ${origin ?? 'top left'}`] : [])
  ].join('; ');
  const image = [
    `left: ${String(-scene.content.x * scale)}px`,
    `top: ${String(-scene.content.y * scale)}px`,
    `width: ${String(scene.width * scale)}px`,
    `height: ${String(scene.height * scale)}px`
  ].join('; ');
  return `<div class="scene${extra ? ` ${extra}` : ''}" style="${style}"><img alt="" src="${dataUri('image/png', scene.png)}" style="${image}"></div>`;
};

/** The scale that fits the scene's content in `area`, at most `largest` */
const fitting = (scene: Scene, area: { width: number; height: number }, largest: number): number =>
  Math.min(largest, area.width / scene.content.width, area.height / scene.content.height);

/** The scene centred in `area`, as large as fits, at most `largest` times */
const centred = (scene: Scene, area: { x: number; y: number; width: number; height: number }, largest: number, extra = ''): string => {
  const scale = fitting(scene, area, largest);
  return placed(scene, { x: area.x + (area.width - scene.content.width * scale) / 2, y: area.y + (area.height - scene.content.height * scale) / 2, scale }, extra);
};

const brandIcon = (assets: Assets, size: number): string => `<img alt="" src="${dataUri('image/png', assets.icon)}" style="width: ${String(size)}px; height: ${String(size)}px">`;

/** The icon drawn the other way round, for a violet ground: a white square, the bubble in violet */
const invertedIcon = (assets: Assets, size: number): string =>
  `<svg viewBox="0 0 48 48" width="${String(size)}" height="${String(size)}" aria-hidden="true"><rect width="48" height="48" rx="11" fill="#ffffff"/><g color="${VIOLET_GROUND}">${assets.mark.replace('<svg ', '<svg x="11" y="11" width="26" height="26" ')}</g></svg>`;

/** The scene area of a screenshot with its text on the left */
const SIDE_SCENE = { x: 576, y: 40, width: 664, height: 720 };
/** How much a screenshot enlarges its UI, at most */
const SIDE_SCALE = 1.2;

const SIDE_CSS = /* css */ `
  .glyph { font-size: 704px; right: -35px; bottom: -127px; color: rgba(167, 139, 250, .08); }
  .copy { position: absolute; left: 72px; top: 0; bottom: 0; width: 480px; display: flex; flex-direction: column; justify-content: center; gap: 18px; }
  .copy .hl { font-size: 57px; }
  .copy .sl { font-size: 22px; }
  .trust { align-self: flex-start; display: inline-flex; align-items: center; gap: .55em; font-size: 16px; font-weight: 600; padding: .55em .9em; border-radius: 999px; background: #0f2a22; color: #a7f3d0; }
  .brand { left: 72px; bottom: 48px; font-size: 18px; }
  .window { border-radius: 18px; overflow: hidden; box-shadow: 0 0 0 1px rgba(255, 255, 255, .08), 0 40px 80px -30px rgba(0, 0, 0, .8); }
`;

/** A screenshot with its text on the left, its scene on the right */
const sideScreenshot = (file: string, copy: ImageCopy, scene: string, assets: Assets, trust = false): StoreImage => ({
  file,
  ...SCREENSHOT,
  ground: DARK_GROUND,
  html: page(SCREENSHOT, DARK_GROUND, assets, SIDE_CSS, /* html */ `
    <div class="glyph">//</div>
    <div class="copy">
      <h1 class="hl">${withTrigger(copy.headline)}</h1>
      ${copy.subline ? `<p class="sl">${withTrigger(copy.subline)}</p>` : ''}
      ${trust ? `<p class="trust">${LOCK} ${escapeHtml(TRUST_LINE)}</p>` : ''}
    </div>
    ${scene}
    <div class="brand">${brandIcon(assets, 27)}${escapeHtml(BRAND_NAME)}</div>`)
});

/** 1. The // trigger: the selector opened over the composer */
export const triggerImage = (scenes: Scenes, assets: Assets): StoreImage =>
  sideScreenshot('screenshot-1-trigger.png', TRIGGER_COPY, centred(scenes.selectorDark, SIDE_SCENE, SIDE_SCALE), assets);

/** 2. Variables: the Variables step above, the composer after the Insertion with its Undo below */
export const variablesImage = (scenes: Scenes, assets: Assets): StoreImage => {
  const { variables, inserted } = scenes;
  const scale = Math.min(SIDE_SCALE, SIDE_SCENE.width / inserted.content.width, SIDE_SCENE.width / variables.content.width);
  const gap = 56;
  const height = (variables.content.height + inserted.content.height) * scale + gap;
  const top = SIDE_SCENE.y + (SIDE_SCENE.height - height) / 2;
  const insertedX = SIDE_SCENE.x + SIDE_SCENE.width - inserted.content.width * scale;
  const scene = [
    placed(variables, { x: SIDE_SCENE.x, y: top, scale }),
    placed(inserted, { x: insertedX, y: top + variables.content.height * scale + gap, scale })
  ].join('');
  return sideScreenshot('screenshot-2-variables.png', VARIABLES_COPY, scene, assets);
};

/** 3. The Platforms: text on top, the composer of each Platform with its Prompts button below */
export const platformsImage = (scenes: Scenes, assets: Assets): StoreImage => {
  const scale = 1.1;
  const columns = 2;
  const columnGap = 40;
  const rowGap = 18;
  const label = 32;
  const first = scenes.platforms[IMAGE_PLATFORMS[0]];
  const cell = { width: first.content.width * scale, height: Math.max(...IMAGE_PLATFORMS.map((platform) => scenes.platforms[platform].content.height)) * scale };
  const left = (SCREENSHOT.width - (columns * cell.width + (columns - 1) * columnGap)) / 2;
  const cells = IMAGE_PLATFORMS.map((platform: ImagePlatform, index) => {
    const x = left + (index % columns) * (cell.width + columnGap);
    const y = 240 + Math.floor(index / columns) * (label + cell.height + rowGap);
    return `<p class="name" style="left: ${String(x + 6)}px; top: ${String(y)}px">${escapeHtml(PLATFORM_LABELS[platform])}</p>${placed(scenes.platforms[platform], { x, y: y + label, scale })}`;
  });
  const css = /* css */ `
    .glyph { font-size: 704px; right: -35px; bottom: -127px; color: rgba(167, 139, 250, .08); }
    .copy { position: absolute; left: 128px; right: 128px; top: 54px; display: flex; flex-direction: column; align-items: center; gap: 11px; text-align: center; }
    .copy .hl { font-size: 53px; }
    .copy .sl { font-size: 21px; }
    .brand { left: 36px; top: 32px; font-size: 15px; }
    .name { position: absolute; font-size: 19px; font-weight: 700; color: #f1ecfb; }
  `;
  return {
    file: 'screenshot-3-platforms.png',
    ...SCREENSHOT,
    ground: DARK_GROUND,
    html: page(SCREENSHOT, DARK_GROUND, assets, css, /* html */ `
      <div class="glyph">//</div>
      <div class="brand">${brandIcon(assets, 24)}${escapeHtml(BRAND_NAME)}</div>
      <div class="copy">
        <h1 class="hl">${withTrigger(PLATFORMS_COPY.headline)}</h1>
        <p class="sl">${withTrigger(PLATFORMS_COPY.subline ?? '')}</p>
      </div>
      ${cells.join('\n      ')}`)
  };
};

/** 4. The Library in the side panel, with the trust line */
export const libraryImage = (scenes: Scenes, assets: Assets): StoreImage =>
  sideScreenshot('screenshot-4-library.png', LIBRARY_COPY, centred(scenes.library, SIDE_SCENE, SIDE_SCALE, 'window'), assets, true);

/** 5. The Welcome's Packs step */
export const packsImage = (scenes: Scenes, assets: Assets): StoreImage =>
  sideScreenshot('screenshot-5-packs.png', PACKS_COPY, centred(scenes.packs, SIDE_SCENE, SIDE_SCALE, 'window'), assets);

/** The small promo tile: violet, the light selector over a composer showing //, tilted at the bottom right */
export const tileImage = (scenes: Scenes, assets: Assets): StoreImage => {
  const scene = scenes.selectorLight;
  const scale = 0.46;
  const css = /* css */ `
    body { color: #ffffff; }
    .glyph { font-size: 352px; left: -21px; bottom: -70px; color: rgba(255, 255, 255, .09); }
    .brand { left: 22px; top: 20px; font-size: 15px; font-weight: 750; }
    .hl { position: absolute; left: 22px; top: 69px; width: 224px; font-size: 30px; }
    .tok { color: #e9d5ff; }
  `;
  // The content's bottom right corner 35 px past the right edge and 19 px past the bottom edge, turned about it
  const x = TILE.width + 35 - scene.content.width * scale;
  const y = TILE.height + 19 - scene.content.height * scale;
  return {
    file: 'small-promo-tile.png',
    ...TILE,
    ground: VIOLET_GROUND,
    html: page(TILE, VIOLET_GROUND, assets, css, /* html */ `
      <div class="glyph">//</div>
      <div class="brand">${invertedIcon(assets, 24)}${escapeHtml(BRAND_NAME)}</div>
      <h1 class="hl">${withTrigger(TILE_COPY.headline)}</h1>
      ${placed(scene, { x, y, scale, transform: 'rotate(-4deg)', origin: 'bottom right' })}`)
  };
};

/** The marquee: dark, a violet glow at the top right, the dark selector over a composer with //, tilted */
export const marqueeImage = (scenes: Scenes, assets: Assets): StoreImage => {
  const css = /* css */ `
    .glow { position: absolute; width: 640px; height: 640px; right: -96px; top: -128px; border-radius: 50%; background: radial-gradient(closest-side, rgba(139, 92, 246, .35), rgba(139, 92, 246, 0)); }
    .glyph { font-size: 640px; right: 38px; bottom: -141px; color: rgba(167, 139, 250, .08); }
    .copy { position: absolute; left: 80px; top: 0; bottom: 0; width: 608px; display: flex; flex-direction: column; justify-content: center; gap: 19px; }
    .copy .brand { position: static; font-size: 22px; }
    .copy .hl { font-size: 66px; }
    .copy .sl { font-size: 22px; }
  `;
  return {
    file: 'marquee.png',
    ...MARQUEE,
    ground: DARK_GROUND,
    html: page(MARQUEE, DARK_GROUND, assets, css, /* html */ `
      <div class="glow"></div>
      <div class="glyph">//</div>
      <div class="copy">
        <div class="brand">${brandIcon(assets, 32)}${escapeHtml(BRAND_NAME)}</div>
        <h1 class="hl">${withTrigger(MARQUEE_COPY.headline)}</h1>
        <p class="sl">${withTrigger(MARQUEE_COPY.subline ?? '')}</p>
      </div>
      ${placed(scenes.selectorDark, { x: 752, y: 56, scale: 1.1, transform: 'rotate(-3deg)', origin: 'top left' })}`)
  };
};

/** The seven images, in the order the listing shows them */
export const storeImages = (scenes: Scenes, assets: Assets): StoreImage[] => [
  triggerImage(scenes, assets),
  variablesImage(scenes, assets),
  platformsImage(scenes, assets),
  libraryImage(scenes, assets),
  packsImage(scenes, assets),
  tileImage(scenes, assets),
  marqueeImage(scenes, assets)
];
