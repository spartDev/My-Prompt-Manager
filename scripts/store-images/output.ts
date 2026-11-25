/**
 * Writing the images so that a failure leaves the output folder as it was. Written as each was
 * made, a failure on image N left the new images 1 to N-1 beside the old others: a new screenshot 3
 * beside an old marquee that names another list of Platforms. Git does not show that mix in a new
 * Release folder or in an --out folder, where every file is untracked.
 */

import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';

import type { Closable } from './launch';

/** What makes the images: the browser that composes and shoots them */
export interface Maker<I> extends Closable {
  /** The PNG of one image; throws when it cannot be made */
  make(image: I): Promise<Buffer>;
}

export interface Written {
  /** Where it was written: the image's file in `out` */
  file: string;
  png: Buffer;
}

/**
 * Makes every image in memory, closes the maker, then creates `out` and writes them all. When an
 * image fails or the maker fails to close, it writes nothing, creates no folder and rethrows: the
 * image's error when both fail. Other files in `out` are left alone, which a temp folder swapped in
 * for `out` would not do to a custom --out.
 */
export async function makeAllThenWrite<I extends { file: string }>(out: string, images: readonly I[], maker: Maker<I>): Promise<Written[]> {
  const made: { image: I; png: Buffer }[] = [];
  try {
    for (const image of images) {
      made.push({ image, png: await maker.make(image) });
    }
  } catch (error) {
    await maker.close().catch(() => undefined);
    throw error;
  }
  await maker.close();
  mkdirSync(out, { recursive: true });
  return made.map(({ image, png }) => {
    const file = path.join(out, image.file);
    writeFileSync(file, png);
    return { file, png };
  });
}
