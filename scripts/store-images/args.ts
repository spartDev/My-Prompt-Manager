/** The options of npm run store:images */

import path from 'node:path';

export interface StoreImagesOptions {
  /** The build to load */
  dist: string;
  /** Where the images go: store-assets/<version> when not given */
  out?: string;
  /** Where to write the text of each image and of the UI in its scenes, when given */
  texts?: string;
  headless: boolean;
}

export function parseStoreImagesArgs(argv: readonly string[], defaultDist: string): StoreImagesOptions {
  const options: StoreImagesOptions = { dist: defaultDist, headless: true };
  for (let index = 0; index < argv.length; index++) {
    const flag = argv[index];
    const value = (): string => {
      const next = argv[index + 1];
      if (next === undefined || next.startsWith('--')) {
        throw new Error(`${flag} needs a value`);
      }
      index++;
      return next;
    };
    switch (flag) {
      case '--dist':
        options.dist = path.resolve(value());
        break;
      case '--out':
        options.out = path.resolve(value());
        break;
      case '--texts':
        options.texts = path.resolve(value());
        break;
      case '--headed':
        options.headless = false;
        break;
      default:
        throw new Error(`Unknown option ${flag}: use --dist <dir>, --out <dir>, --texts <file> or --headed`);
    }
  }
  return options;
}
