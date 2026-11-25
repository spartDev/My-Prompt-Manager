/**
 * The PNG reading and writing the store images need, with node:zlib alone: Chromium's screenshots
 * are RGBA, and the Chrome Web Store wants 24-bit PNGs with no alpha channel. Reads the 8-bit,
 * non-interlaced PNGs Chromium writes (RGB or RGBA); writes 8-bit RGB.
 */

import { deflateSync, inflateSync } from 'node:zlib';

const SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

/** PNG color types: truecolor, and truecolor with alpha */
const RGB = 2;
const RGBA = 6;

export interface PngInfo {
  width: number;
  height: number;
  bitDepth: number;
  colorType: number;
  /** Whether the pixels carry an alpha channel (color type 4 or 6) or a tRNS chunk gives one */
  hasAlpha: boolean;
}

export interface RgbaImage {
  width: number;
  height: number;
  /** Four bytes per pixel, row after row */
  data: Buffer;
}

interface Chunk {
  type: string;
  data: Buffer;
}

const chunksOf = (png: Buffer): Chunk[] => {
  if (png.length < SIGNATURE.length || !png.subarray(0, SIGNATURE.length).equals(SIGNATURE)) {
    throw new Error('Not a PNG file');
  }
  const chunks: Chunk[] = [];
  let offset = SIGNATURE.length;
  while (offset + 8 <= png.length) {
    const length = png.readUInt32BE(offset);
    const type = png.toString('latin1', offset + 4, offset + 8);
    chunks.push({ type, data: png.subarray(offset + 8, offset + 8 + length) });
    offset += 12 + length;
    if (type === 'IEND') {
      break;
    }
  }
  return chunks;
};

/** Width, height, bit depth and color type, read from the header, and whether there is alpha. */
export function pngInfo(png: Buffer): PngInfo {
  const chunks = chunksOf(png);
  const header = chunks[0];
  if (header?.type !== 'IHDR') {
    throw new Error('PNG without a header');
  }
  const colorType = header.data.readUInt8(9);
  return {
    width: header.data.readUInt32BE(0),
    height: header.data.readUInt32BE(4),
    bitDepth: header.data.readUInt8(8),
    colorType,
    hasAlpha: colorType === 4 || colorType === RGBA || chunks.some((chunk) => chunk.type === 'tRNS')
  };
}

const paeth = (left: number, up: number, upLeft: number): number => {
  const estimate = left + up - upLeft;
  const toLeft = Math.abs(estimate - left);
  const toUp = Math.abs(estimate - up);
  const toUpLeft = Math.abs(estimate - upLeft);
  if (toLeft <= toUp && toLeft <= toUpLeft) {
    return left;
  }
  return toUp <= toUpLeft ? up : upLeft;
};

/** Undoes the filter of each scanline, in place in a buffer of the raw rows. */
const unfilter = (raw: Buffer, width: number, height: number, channels: number): Buffer => {
  const stride = width * channels;
  const pixels = Buffer.alloc(stride * height);
  for (let y = 0; y < height; y++) {
    const filter = raw[y * (stride + 1)];
    const source = y * (stride + 1) + 1;
    const row = y * stride;
    const previous = row - stride;
    for (let x = 0; x < stride; x++) {
      const value = raw[source + x];
      const left = x >= channels ? pixels[row + x - channels] : 0;
      const up = y > 0 ? pixels[previous + x] : 0;
      const upLeft = y > 0 && x >= channels ? pixels[previous + x - channels] : 0;
      let predicted: number;
      switch (filter) {
        case 0:
          predicted = 0;
          break;
        case 1:
          predicted = left;
          break;
        case 2:
          predicted = up;
          break;
        case 3:
          predicted = (left + up) >> 1;
          break;
        case 4:
          predicted = paeth(left, up, upLeft);
          break;
        default:
          throw new Error(`Unknown PNG filter ${String(filter)} on row ${String(y)}`);
      }
      pixels[row + x] = (value + predicted) & 0xff;
    }
  }
  return pixels;
};

/** Decodes an 8-bit, non-interlaced RGB or RGBA PNG into RGBA pixels. */
export function decodePng(png: Buffer): RgbaImage {
  const info = pngInfo(png);
  const chunks = chunksOf(png);
  const interlace = chunks[0].data.readUInt8(12);
  if (info.bitDepth !== 8 || (info.colorType !== RGB && info.colorType !== RGBA) || interlace !== 0) {
    throw new Error(`Unsupported PNG: bit depth ${String(info.bitDepth)}, color type ${String(info.colorType)}, interlace ${String(interlace)}`);
  }
  const channels = info.colorType === RGBA ? 4 : 3;
  const raw = inflateSync(Buffer.concat(chunks.filter((chunk) => chunk.type === 'IDAT').map((chunk) => chunk.data)));
  const pixels = unfilter(raw, info.width, info.height, channels);
  if (channels === 4) {
    return { width: info.width, height: info.height, data: pixels };
  }
  const data = Buffer.alloc(info.width * info.height * 4);
  for (let i = 0, j = 0; i < pixels.length; i += 3, j += 4) {
    data[j] = pixels[i];
    data[j + 1] = pixels[i + 1];
    data[j + 2] = pixels[i + 2];
    data[j + 3] = 255;
  }
  return { width: info.width, height: info.height, data };
}

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) {
    c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  }
  return c >>> 0;
});

const crc32 = (bytes: Buffer): number => {
  let c = 0xffffffff;
  for (const byte of bytes) {
    c = CRC_TABLE[(c ^ byte) & 0xff] ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
};

const chunk = (type: string, data: Buffer): Buffer => {
  const head = Buffer.alloc(8);
  head.writeUInt32BE(data.length, 0);
  head.write(type, 4, 'latin1');
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([head.subarray(4), data])), 0);
  return Buffer.concat([head, data, crc]);
};

/** Hex color (#rrggbb) to its three bytes. */
const rgbOf = (hex: string): [number, number, number] => {
  const match = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex);
  if (!match) {
    throw new Error(`Not a #rrggbb color: ${hex}`);
  }
  return [Number.parseInt(match[1], 16), Number.parseInt(match[2], 16), Number.parseInt(match[3], 16)];
};

/**
 * Encodes the image as an 8-bit RGB PNG (color type 2, no alpha), every pixel laid over
 * `background`: an opaque pixel keeps its color. The rows are unfiltered, so the same pixels
 * always give the same bytes.
 */
export function encodeRgbPng(image: RgbaImage, background: string): Buffer {
  const [backR, backG, backB] = rgbOf(background);
  const stride = image.width * 3;
  const raw = Buffer.alloc((stride + 1) * image.height);
  for (let y = 0; y < image.height; y++) {
    raw[y * (stride + 1)] = 0;
    for (let x = 0; x < image.width; x++) {
      const from = (y * image.width + x) * 4;
      const to = y * (stride + 1) + 1 + x * 3;
      const alpha = image.data[from + 3];
      const over = (value: number, back: number): number => Math.round((value * alpha + back * (255 - alpha)) / 255);
      raw[to] = over(image.data[from], backR);
      raw[to + 1] = over(image.data[from + 1], backG);
      raw[to + 2] = over(image.data[from + 2], backB);
    }
  }
  const header = Buffer.alloc(13);
  header.writeUInt32BE(image.width, 0);
  header.writeUInt32BE(image.height, 4);
  header.writeUInt8(8, 8);
  header.writeUInt8(RGB, 9);
  header.writeUInt8(0, 10);
  header.writeUInt8(0, 11);
  header.writeUInt8(0, 12);
  return Buffer.concat([SIGNATURE, chunk('IHDR', header), chunk('IDAT', deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0))]);
}

/** A screenshot as the store wants it: 24-bit RGB, with no alpha channel, over `background`. */
export const flattenPng = (png: Buffer, background: string): Buffer => encodeRgbPng(decodePng(png), background);
