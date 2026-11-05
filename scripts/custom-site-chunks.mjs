/**
 * Checks, after `npm run build`, that every chunk the content script loads is web-accessible on a custom site.
 *
 * On a custom site (any http or https origin the user adds) the content-script loader imports the content
 * entry chunk, which imports the chunks it shares with the rest of the extension. Chrome serves those to the
 * page's origin only if a `web_accessible_resources` entry for `https://*` and `http://*` lists them, and
 * manifest.json lists them by name pattern. A chunk that is split, renamed or added without a pattern breaks
 * every custom site while the built-in Platforms keep working, since crxjs lists every chunk for theirs.
 *
 * Usage: node scripts/custom-site-chunks.mjs [dist]. It exits 1 and names each unmatched chunk.
 * tests/e2e/content/custom-site-chunks.spec.ts walks the same chunks and asks Chrome for each one.
 */
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const CUSTOM_SITE_MATCHES = ['https://*/*', 'http://*/*'];

/** The chunks a built chunk imports: `from"./x.js"`, `import"./x.js"` and `import("./x.js")`, in any quotes, minified or not. */
export function importsOf(dist, file) {
  const source = fs.readFileSync(path.join(dist, 'assets', file), 'utf-8');
  const found = [...source.matchAll(/(?:from|import)\s*\(?\s*["'`]\.\/([^"'`]+\.js)["'`]/g)].map((match) => match[1]);
  return [...new Set(found)];
}

const readManifest = (dist) => JSON.parse(fs.readFileSync(path.join(dist, 'manifest.json'), 'utf-8'));

/** The chunks the content-script loader imports, as `chrome.runtime.getURL("assets/x.js")`. */
export function loadedByContentScriptLoader(dist) {
  const manifest = readManifest(dist);
  const loader = fs.readFileSync(path.join(dist, manifest.content_scripts[0].js[0]), 'utf-8');
  return [...loader.matchAll(/getURL\(\s*["'`]assets\/([^"'`]+\.js)["'`]\s*\)/g)].map((match) => match[1]);
}

/** Every chunk reachable from `entry` through imports, entry included. */
export function chunksReachableFrom(dist, entry) {
  const seen = new Set([entry]);
  const queue = [entry];
  while (queue.length > 0) {
    const current = queue.shift();
    for (const imported of importsOf(dist, current)) {
      if (!seen.has(imported)) {
        seen.add(imported);
        queue.push(imported);
      }
    }
  }
  return [...seen];
}

/** The resource patterns of the `web_accessible_resources` entries that match every custom-site origin. */
export function customSiteResources(dist) {
  const entries = readManifest(dist).web_accessible_resources ?? [];
  return entries
    .filter((entry) => CUSTOM_SITE_MATCHES.every((match) => entry.matches?.includes(match)))
    .flatMap((entry) => entry.resources ?? []);
}

/** Whether a resource pattern of web_accessible_resources, where `*` matches any run of characters, matches `resource`. */
export function matchesResourcePattern(pattern, resource) {
  const escaped = pattern.split('*').map((part) => part.replace(/[.+?^${}()|[\]\\]/g, '\\$&'));
  return new RegExp(`^${escaped.join('.*')}$`).test(resource);
}

/** The chunks the content script loads on a custom site, and those no custom-site pattern matches. */
export function checkCustomSiteChunks(dist) {
  const entries = loadedByContentScriptLoader(dist);
  if (entries.length !== 1) {
    throw new Error(`The content-script loader should import exactly one entry chunk, found ${entries.length}: ${entries.join(', ')}`);
  }
  const chunks = chunksReachableFrom(dist, entries[0]);
  const patterns = customSiteResources(dist);
  const unmatched = chunks.filter((chunk) => !patterns.some((pattern) => matchesResourcePattern(pattern, `assets/${chunk}`)));
  return { chunks, unmatched };
}

function main() {
  const dist = path.resolve(process.argv[2] ?? 'dist');
  if (!fs.existsSync(path.join(dist, 'manifest.json'))) {
    process.stderr.write(`custom-site-chunks: no ${path.join(dist, 'manifest.json')}; run npm run build first.\n`);
    process.exit(2);
  }
  const { chunks, unmatched } = checkCustomSiteChunks(dist);
  if (unmatched.length > 0) {
    process.stderr.write('custom-site-chunks: the content script loads chunks that no web_accessible_resources pattern for https://*/* and http://*/* matches:\n');
    for (const chunk of unmatched) {
      process.stderr.write(`  assets/${chunk}\n`);
    }
    process.stderr.write('Add a pattern for each to that entry in manifest.json, or the content script fails on every custom site.\n');
    process.exit(1);
  }
  process.stdout.write(`custom-site-chunks: all ${chunks.length} chunks the content script loads are web-accessible on custom sites.\n`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
