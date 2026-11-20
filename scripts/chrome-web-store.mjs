/**
 * Sends a Release's zip to the Chrome Web Store as a Submission, or prints the store's status, through the
 * Chrome Web Store API V2. No dependency: Node's fetch and zlib only, so no third-party code handles the token.
 *
 *   node scripts/chrome-web-store.mjs status [--zip <file>]
 *   node scripts/chrome-web-store.mjs submit --zip <file> --version <X.Y.Z>
 *
 * `status` is read-only: one fetchStatus call. With --zip it also says what `submit` would do with that zip.
 * `submit` checks, uploads, polls, publishes, then prints the status: release.yml runs it on the push of a tag
 * without -alpha, -beta or -rc, in the chrome-webstore environment. The Submission is published as soon as the
 * Store review approves it (publishType DEFAULT_PUBLISH); the job ends at the Submission.
 *
 * Fail safe: when the store's answer leaves any doubt, nothing is uploaded and the job fails red with Google's
 * answer verbatim in the job summary. A rerun for a version already submitted or published sends nothing and
 * ends green. A Submission of another version in Store review fails the job; nothing is ever cancelled.
 *
 * Environment: CWS_ACCESS_TOKEN (from google-github-actions/auth), CWS_PUBLISHER_ID, CWS_EXTENSION_ID,
 * GITHUB_STEP_SUMMARY (optional). The token is never printed: every line and the summary are redacted.
 *
 * API: https://developer.chrome.com/docs/webstore/using-api (publishing workflow, upload URI),
 * https://developer.chrome.com/docs/webstore/api (reference: fetchStatus, media.upload, publish),
 * https://developer.chrome.com/docs/webstore/service-accounts, https://developer.chrome.com/blog/cws-api-v2.
 * Setup: docs/GITHUB_ENVIRONMENTS.md.
 */
import { appendFileSync, readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { parseArgs } from 'node:util';
import { inflateRawSync } from 'node:zlib';

export const API_ROOT = 'https://chromewebstore.googleapis.com';

/** What `submit` waits for an upload the store answered IN_PROGRESS: 30 polls, 10 s apart. */
export const POLL = { attempts: 30, intervalMs: 10_000 };

/**
 * ItemState values (reference, ItemState). A Submission in Store review or approved and staged blocks any other
 * version; a refused or cancelled one does not, but its version is never sent again.
 */
const IN_REVIEW = new Set(['PENDING_REVIEW', 'STAGED']);
const LIVE = new Set(['PUBLISHED', 'PUBLISHED_TO_TESTERS']);
const CLOSED = new Set(['REJECTED', 'CANCELLED']);

/** Chrome's manifest version: one to four dot-separated integers from 0 to 65535, without leading zeros. */
const VERSION = /^(0|[1-9]\d{0,4})(\.(0|[1-9]\d{0,4})){0,3}$/;

/** The four integers of a manifest version, missing ones as 0, or null when it is not one. */
export function parseVersion(version) {
  if (typeof version !== 'string' || !VERSION.test(version)) {
    return null;
  }
  const parts = version.split('.').map(Number);
  if (parts.some((part) => part > 65535)) {
    return null;
  }
  return [...parts, 0, 0, 0].slice(0, 4);
}

/** -1, 0 or 1 as `a` is lower than, equal to or higher than `b`, compared as numbers part by part. */
export function compareVersions(a, b) {
  const left = parseVersion(a);
  const right = parseVersion(b);
  if (!left || !right) {
    throw new Error(`Cannot compare versions "${a}" and "${b}".`);
  }
  for (let i = 0; i < 4; i++) {
    if (left[i] !== right[i]) {
      return left[i] < right[i] ? -1 : 1;
    }
  }
  return 0;
}

const highest = (versions) => versions.reduce((top, version) => (compareVersions(version, top) > 0 ? version : top));

/**
 * The bytes of the entry `name` of a zip, or null when the zip has none. Reads the central directory, so an
 * entry under a folder (`dist/manifest.json`) is not `manifest.json`. Stored and deflated entries only.
 */
export function readZipEntry(zip, name) {
  const END = 0x06054b50;
  const CENTRAL = 0x02014b50;
  const LOCAL = 0x04034b50;
  let end = -1;
  for (let at = zip.length - 22; at >= Math.max(0, zip.length - 22 - 0xffff); at--) {
    if (zip.readUInt32LE(at) === END) {
      end = at;
      break;
    }
  }
  if (end < 0) {
    throw new Error('The file is not a zip: it has no end of central directory.');
  }
  const count = zip.readUInt16LE(end + 10);
  let at = zip.readUInt32LE(end + 16);
  for (let entry = 0; entry < count; entry++) {
    if (zip.readUInt32LE(at) !== CENTRAL) {
      throw new Error('The zip is damaged: its central directory is not where its end record says.');
    }
    const flags = zip.readUInt16LE(at + 8);
    const method = zip.readUInt16LE(at + 10);
    const size = zip.readUInt32LE(at + 20);
    const nameLength = zip.readUInt16LE(at + 28);
    const next = at + 46 + nameLength + zip.readUInt16LE(at + 30) + zip.readUInt16LE(at + 32);
    if (zip.toString('utf8', at + 46, at + 46 + nameLength) === name) {
      if (flags & 1) {
        throw new Error(`The zip's ${name} is encrypted.`);
      }
      const local = zip.readUInt32LE(at + 42);
      if (zip.readUInt32LE(local) !== LOCAL) {
        throw new Error(`The zip is damaged: the local header of ${name} is missing.`);
      }
      const start = local + 30 + zip.readUInt16LE(local + 26) + zip.readUInt16LE(local + 28);
      const data = zip.subarray(start, start + size);
      if (method === 0) {
        return data;
      }
      if (method === 8) {
        return inflateRawSync(data);
      }
      throw new Error(`The zip's ${name} uses compression method ${method}; only stored and deflated are read.`);
    }
    at = next;
  }
  return null;
}

/** The version of the manifest.json at the root of the zip: the store requires the manifest there. */
export function zipVersion(zip) {
  const manifest = readZipEntry(zip, 'manifest.json');
  if (!manifest) {
    throw new Error('The zip has no manifest.json at its root. Zip the contents of dist/, not the folder.');
  }
  const { version } = JSON.parse(manifest.toString('utf8'));
  if (!parseVersion(version)) {
    throw new Error(`The zip's manifest.json has no valid version: ${JSON.stringify(version)}.`);
  }
  return version;
}

/** The versions a revision reports, one per distribution channel; null when one is missing or malformed. */
function versionsOf(revision) {
  const channels = revision?.distributionChannels;
  if (!Array.isArray(channels) || channels.length === 0) {
    return null;
  }
  const versions = channels.map((channel) => channel?.crxVersion);
  return versions.every((version) => parseVersion(version)) ? versions : null;
}

/**
 * What a Submission of `version` does, given the store's fetchStatus answer:
 * { action: 'upload' }, { action: 'none', reason } (already submitted or published: send nothing, end green), or
 * { action: 'refuse', reason } (send nothing, fail). Anything the reference does not describe is refused.
 */
export function planSubmission(status, version) {
  const refuse = (reason) => ({ action: 'refuse', reason });
  if (status?.lastAsyncUploadState === 'IN_PROGRESS') {
    return refuse('The store is still processing an earlier upload (lastAsyncUploadState IN_PROGRESS).');
  }
  const live = [];
  const published = status?.publishedItemRevisionStatus;
  if (published) {
    const versions = versionsOf(published);
    if (!versions) {
      return refuse('The published revision reports no readable version (distributionChannels[].crxVersion).');
    }
    live.push(...versions);
  }
  const submitted = status?.submittedItemRevisionStatus;
  if (submitted) {
    const versions = versionsOf(submitted);
    if (!versions) {
      return refuse('The submitted revision reports no readable version (distributionChannels[].crxVersion).');
    }
    const top = highest(versions);
    const state = submitted.state;
    if (IN_REVIEW.has(state)) {
      if (compareVersions(top, version) === 0) {
        return { action: 'none', reason: `${version} is already submitted (${state}). Nothing is sent.` };
      }
      return refuse(
        `${top} is in Store review (${state}). This job never cancels a Submission: wait for the Store review, or cancel it in the Developer Dashboard, then run the job again.`
      );
    }
    if (LIVE.has(state)) {
      live.push(...versions);
    } else if (CLOSED.has(state)) {
      if (compareVersions(version, top) <= 0) {
        return refuse(
          `The Submission of ${top} ended ${state}. A refused or cancelled Release is fixed and submitted as a higher version, with a new tag.`
        );
      }
    } else {
      return refuse(`The submitted revision is in a state this job does not know: ${JSON.stringify(state)}.`);
    }
  }
  if (live.length === 0) {
    return refuse('The store reports no published version. The API only updates an item already published by hand.');
  }
  const top = highest(live);
  const order = compareVersions(version, top);
  if (order === 0) {
    return { action: 'none', reason: `${version} is already published. Nothing is sent.` };
  }
  if (order < 0) {
    return refuse(`The zip's version ${version} is not higher than the published ${top}. Nothing is uploaded.`);
  }
  return { action: 'upload' };
}

/**
 * A failed call. `message` says what went wrong; `googleMessage` is Google's own error message and `body` its
 * whole answer, both kept verbatim for the job summary.
 */
export class StoreError extends Error {
  constructor(call, { status, description, googleMessage, body }) {
    super(`${call}${status ? ` (HTTP ${status})` : ''}: ${description}`);
    this.call = call;
    this.status = status;
    this.googleMessage = googleMessage;
    this.body = body;
  }
}

/** The calls to the store for one item, each with the bearer token; an answer that is not 2xx throws. */
function storeClient({ token, publisherId, itemId }, fetch) {
  const item = `publishers/${encodeURIComponent(publisherId)}/items/${encodeURIComponent(itemId)}`;
  const call = async (name, method, url, body, contentType) => {
    const headers = { Authorization: `Bearer ${token}` };
    if (contentType) {
      headers['Content-Type'] = contentType;
    }
    let response;
    try {
      response = await fetch(url, { method, headers, body });
    } catch (error) {
      throw new StoreError(name, { description: `the store could not be reached: ${error?.message ?? error}` });
    }
    const text = await response.text();
    let json;
    try {
      json = text ? JSON.parse(text) : {};
    } catch {
      json = undefined;
    }
    if (!response.ok) {
      throw new StoreError(name, {
        status: response.status,
        description: 'the store refused the request',
        googleMessage: json?.error?.message ?? text,
        body: text
      });
    }
    if (json === undefined || typeof json !== 'object' || json === null) {
      throw new StoreError(name, { status: response.status, description: 'the answer is not a JSON object', body: text });
    }
    return { json, text };
  };
  return {
    fetchStatus: () => call('fetchStatus', 'GET', `${API_ROOT}/v2/${item}:fetchStatus`),
    // using-api: "Always use the upload URI and send the ZIP file as the body." With no Content-Type, as its
    // `curl -T` example sends it.
    upload: (zip) => call('upload', 'POST', `${API_ROOT}/upload/v2/${item}:upload`, zip),
    // DEFAULT_PUBLISH: "The submission will be published immediately after being approved."
    publish: () =>
      call('publish', 'POST', `${API_ROOT}/v2/${item}:publish`, JSON.stringify({ publishType: 'DEFAULT_PUBLISH' }), 'application/json')
  };
}

/** The store identifiers and the token from the environment; throws naming what is missing or malformed. */
export function configFrom(env) {
  const missing = ['CWS_ACCESS_TOKEN', 'CWS_PUBLISHER_ID', 'CWS_EXTENSION_ID'].filter((name) => !env[name]);
  if (missing.length > 0) {
    throw new Error(`${missing.join(', ')} not set. The setup is in docs/GITHUB_ENVIRONMENTS.md.`);
  }
  if (!/^[a-p]{32}$/.test(env.CWS_EXTENSION_ID)) {
    throw new Error('CWS_EXTENSION_ID is not an extension ID (32 letters from a to p).');
  }
  return { token: env.CWS_ACCESS_TOKEN, publisherId: env.CWS_PUBLISHER_ID, itemId: env.CWS_EXTENSION_ID };
}

/** Wraps the output so that no line and no summary ever holds the token. */
function redacting(out, token) {
  const redact = (text) => (token ? String(text).split(token).join('[token]') : String(text));
  return { log: (line) => out.log(redact(line)), summary: (markdown) => out.summary(redact(markdown)) };
}

/** `text` in a fenced block whose fence no line of it can close, so Google's message shows verbatim. */
function fenced(text) {
  const longest = Math.max(2, ...(String(text).match(/`+/g) ?? []).map((run) => run.length));
  const fence = '`'.repeat(longest + 1);
  return `${fence}text\n${text}\n${fence}`;
}

function describeRevision(revision) {
  if (!revision) {
    return 'none';
  }
  const channels = (revision.distributionChannels ?? [])
    .map((channel) => `${channel?.crxVersion ?? '?'}${channel?.deployPercentage === undefined ? '' : ` at ${channel.deployPercentage}%`}`)
    .join(', ');
  return `${channels || 'no version'} (${revision.state ?? 'no state'})`;
}

/** The store status, as lines for the log and the summary. */
function statusLines(status) {
  return [
    `Published: ${describeRevision(status.publishedItemRevisionStatus)}`,
    `Submission: ${status.submittedItemRevisionStatus ? describeRevision(status.submittedItemRevisionStatus) : 'none since the last Publication'}`,
    `Last upload (past 24 h): ${status.lastAsyncUploadState ?? 'none'}`,
    `Taken down: ${status.takenDown ? 'yes' : 'no'}, warned: ${status.warned ? 'yes' : 'no'}`
  ];
}

function reportStatus(say, status, title = 'The store') {
  const lines = statusLines(status);
  say.log(`${title}:`);
  for (const line of lines) {
    say.log(`  ${line}`);
  }
  say.summary([`**${title}**`, '', ...lines.map((line) => `- ${line}`)].join('\n'));
}

/** A workflow command's message: GitHub reads %, CR and LF as its own, so they are escaped. */
const annotation = (text) => String(text).replace(/%/g, '%25').replace(/\r/g, '%0D').replace(/\n/g, '%0A');

function reportFailure(say, title, error) {
  const google = error.googleMessage === undefined ? '' : ` (Google's message: ${error.googleMessage})`;
  say.log(`::error::${annotation(`${title}. ${error.message}${google}`)}`);
  const parts = [`#### ❌ ${title}`, fenced(error.message)];
  if (error.googleMessage !== undefined) {
    parts.push("Google's message:", fenced(error.googleMessage));
  }
  if (error.body && error.body !== error.googleMessage) {
    parts.push("Google's whole answer:", fenced(error.body));
  }
  say.summary(parts.join('\n\n'));
}

/**
 * Prints the store status (one read-only fetchStatus call) and, given a zip, what `submit` would do with it.
 * Fails when the call fails, or when `submit` would refuse the zip.
 */
export async function storeStatus({ env, fetch, out, zip }) {
  const say = redacting(out, env.CWS_ACCESS_TOKEN);
  say.summary('### 🌐 Chrome Web Store status');
  let store;
  let version;
  try {
    store = storeClient(configFrom(env), fetch);
    version = zip ? zipVersion(zip) : undefined;
  } catch (error) {
    reportFailure(say, 'The status call cannot start', error);
    return { ok: false };
  }
  let status;
  try {
    ({ json: status } = await store.fetchStatus());
  } catch (error) {
    reportFailure(say, 'The status call failed', error);
    return { ok: false };
  }
  reportStatus(say, status);
  if (!version) {
    return { ok: true };
  }
  const plan = planSubmission(status, version);
  const verdict =
    plan.action === 'upload'
      ? `A Submission of ${version} would upload and submit this zip.`
      : plan.action === 'none'
        ? `A Submission of ${version} would send nothing: ${plan.reason}`
        : `A Submission of ${version} would be refused: ${plan.reason}`;
  say.log(verdict);
  say.summary(verdict);
  return { ok: plan.action !== 'refuse', plan };
}

/**
 * Submits the zip: fetchStatus, then upload, poll while IN_PROGRESS, publish, and fetchStatus again. `version` is
 * the Release's version (the tag): the zip's manifest must carry it. Returns { ok, outcome }.
 */
export async function submitRelease({ env, fetch, out, zip, version, sleep = (ms) => new Promise((r) => setTimeout(r, ms)), poll = POLL }) {
  const say = redacting(out, env.CWS_ACCESS_TOKEN);
  say.summary(`### 🌐 Chrome Web Store Submission of ${version}`);
  let store;
  try {
    store = storeClient(configFrom(env), fetch);
    const zipped = zipVersion(zip);
    if (zipped !== version) {
      throw new Error(`The zip's manifest says ${zipped}, the Release is ${version}.`);
    }
  } catch (error) {
    reportFailure(say, 'Nothing was sent', error);
    return { ok: false, outcome: 'invalid' };
  }

  let step = 'The status check failed; nothing was sent';
  try {
    const { json: before } = await store.fetchStatus();
    reportStatus(say, before, 'The store, before anything is sent');
    const plan = planSubmission(before, version);
    if (plan.action === 'none') {
      say.log(plan.reason);
      say.summary(`✅ ${plan.reason}`);
      return { ok: true, outcome: 'unchanged' };
    }
    if (plan.action === 'refuse') {
      reportFailure(say, 'Nothing was sent', new Error(plan.reason));
      return { ok: false, outcome: 'refused' };
    }

    step = 'The upload failed; nothing was submitted';
    say.log(`Uploading ${version}…`);
    const uploaded = await store.upload(zip);
    let state = uploaded.json.uploadState;
    // The reference says both IN_PROGRESS (UploadState) and UPLOAD_IN_PROGRESS (in uploadState's description).
    for (let attempt = 0; state === 'IN_PROGRESS' || state === 'UPLOAD_IN_PROGRESS'; attempt++) {
      if (attempt === poll.attempts) {
        throw new StoreError('fetchStatus', {
          description: `the upload was still IN_PROGRESS after ${poll.attempts} polls, ${poll.intervalMs / 1000} s apart`
        });
      }
      say.log(`The store is processing the upload (${state}); polling again in ${poll.intervalMs / 1000} s.`);
      await sleep(poll.intervalMs);
      const { json, text } = await store.fetchStatus();
      state = json.lastAsyncUploadState;
      if (state !== 'IN_PROGRESS' && state !== 'SUCCEEDED') {
        throw new StoreError('fetchStatus', { description: `lastAsyncUploadState is ${state ?? 'unset'}`, body: text });
      }
    }
    if (state !== 'SUCCEEDED') {
      throw new StoreError('upload', { description: `uploadState is ${state ?? 'unset'}`, body: uploaded.text });
    }
    if (uploaded.json.crxVersion !== undefined && uploaded.json.crxVersion !== version) {
      throw new StoreError('upload', { description: `the store read version ${uploaded.json.crxVersion}`, body: uploaded.text });
    }
    say.log(`Upload of ${version} succeeded.`);

    step = 'The publish call failed; the upload is a draft in the Developer Dashboard';
    const published = await store.publish();
    const submissionState = published.json.state;
    if (!IN_REVIEW.has(submissionState) && !LIVE.has(submissionState)) {
      throw new StoreError('publish', { description: `the Submission's state is ${submissionState ?? 'unset'}`, body: published.text });
    }
    const done =
      submissionState === 'PENDING_REVIEW'
        ? `${version} is submitted and in Store review. It is published as soon as the Store review approves it; Google's e-mail to the publisher account gives the result.`
        : `${version} is submitted (${submissionState}).`;
    say.log(done);
    const warnings = published.json.warningInfo?.warnings ?? [];
    say.summary(
      [
        `✅ ${done}`,
        ...warnings.map((warning) => `- ⚠️ ${warning.reason ?? 'warning'}: ${warning.description ?? ''}`)
      ].join('\n')
    );

    step = `${version} is submitted, but the status call after it failed`;
    const { json: after } = await store.fetchStatus();
    reportStatus(say, after, 'The store, after the Submission');
    return { ok: true, outcome: 'submitted' };
  } catch (error) {
    reportFailure(say, step, error);
    return { ok: false, outcome: 'failed' };
  }
}

async function main() {
  const { positionals, values } = parseArgs({
    allowPositionals: true,
    options: { zip: { type: 'string' }, version: { type: 'string' } }
  });
  const out = {
    log: (line) => process.stdout.write(`${line}\n`),
    summary: (markdown) => {
      if (process.env.GITHUB_STEP_SUMMARY) {
        appendFileSync(process.env.GITHUB_STEP_SUMMARY, `${markdown}\n\n`);
      }
    }
  };
  const zip = values.zip ? readFileSync(values.zip) : undefined;
  let result;
  if (positionals[0] === 'status') {
    result = await storeStatus({ env: process.env, fetch: globalThis.fetch, out, zip });
  } else if (positionals[0] === 'submit' && zip && values.version) {
    result = await submitRelease({ env: process.env, fetch: globalThis.fetch, out, zip, version: values.version });
  } else {
    process.stderr.write('Usage: chrome-web-store.mjs status [--zip <file>] | submit --zip <file> --version <X.Y.Z>\n');
    process.exit(2);
  }
  process.exitCode = result.ok ? 0 : 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main();
}
