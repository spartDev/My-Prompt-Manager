// @vitest-environment node
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import {
  API_ROOT,
  compareVersions,
  type Fetch,
  planSubmission,
  storeStatus,
  submitRelease,
  zipVersion
} from '../chrome-web-store.mjs';

const SCRIPT = path.resolve(__dirname, '..', 'chrome-web-store.mjs');

const TOKEN = 'ya29.a0-test-access-token-7f3c9e';
const ITEM = 'abcdefghijklmnopabcdefghijklmnop';
const ENV = { CWS_ACCESS_TOKEN: TOKEN, CWS_PUBLISHER_ID: 'publisher-0', CWS_EXTENSION_ID: ITEM };

let workdir: string;
let made = 0;

beforeAll(() => {
  workdir = mkdtempSync(path.join(tmpdir(), 'cws-'));
});

afterAll(() => {
  rmSync(workdir, { recursive: true, force: true });
});

/** A zip made the way release.yml makes it: `zip -r` run inside the folder that holds the files. */
function makeZip(files: Record<string, string>): Buffer {
  const folder = path.join(workdir, `zip-${made++}`);
  for (const [name, content] of Object.entries(files)) {
    mkdirSync(path.dirname(path.join(folder, name)), { recursive: true });
    writeFileSync(path.join(folder, name), content);
  }
  const result = spawnSync('zip', ['-r', '-X', '-q', '../out.zip', '.'], { cwd: folder, encoding: 'utf-8' });
  expect(result.status, result.stderr).toBe(0);
  const zip = readFileSync(path.join(workdir, 'out.zip'));
  rmSync(path.join(workdir, 'out.zip'));
  return zip;
}

const manifest = (version: string) => JSON.stringify({ manifest_version: 3, name: 'My Prompt Manager', version }, null, 2);
const zipOf = (version: string) => makeZip({ 'manifest.json': manifest(version), 'src/popup.html': '<!doctype html>' });

const revision = (state: string, ...versions: string[]) => ({
  state,
  distributionChannels: versions.map((crxVersion) => ({ crxVersion, deployPercentage: 100 }))
});

/** A fetchStatus answer shaped like the reference: 1.9.0 published, no Submission since. */
const storeState = (extra: Record<string, unknown> = {}) => ({
  name: `publishers/publisher-0/items/${ITEM}`,
  itemId: ITEM,
  publishedItemRevisionStatus: revision('PUBLISHED', '1.9.0'),
  ...extra
});

type Endpoint = 'fetchStatus' | 'upload' | 'publish' | 'cancelSubmission';
type Reply = { status?: number; body: unknown };
type Call = { method: string; endpoint: string; url: string; headers: Record<string, string>; body: unknown };

/** A mocked V2 API: each endpoint answers its replies in order, and every request is recorded. */
function fakeStore(replies: Partial<Record<Endpoint, Reply[]>>) {
  const calls: Call[] = [];
  const queues: Partial<Record<string, Reply[]>> = structuredClone(replies);
  const fetch: Fetch = async (url, init) => {
    const endpoint = url.slice(url.lastIndexOf(':') + 1);
    calls.push({ method: init.method, endpoint, url, headers: init.headers, body: init.body });
    const reply = queues[endpoint]?.shift();
    if (!reply) {
      throw new Error(`the test gave no reply for ${init.method} ${endpoint}`);
    }
    const body = typeof reply.body === 'string' ? reply.body : JSON.stringify(reply.body);
    return new Response(body, { status: reply.status ?? 200 });
  };
  return { fetch, calls, requests: () => calls.map((call) => `${call.method} ${call.endpoint}`) };
}

function output() {
  const lines: string[] = [];
  const summary: string[] = [];
  return { lines, summary, out: { log: (line: string) => lines.push(line), summary: (markdown: string) => summary.push(markdown) } };
}

/** Every line and summary block each run printed, for the token check. */
const printed: string[] = [];

async function submit(store: ReturnType<typeof fakeStore>, version = '2.0.0', zip = zipOf(version), env: Record<string, string> = ENV) {
  const { lines, summary, out } = output();
  const sleeps: number[] = [];
  const result = await submitRelease({
    env,
    fetch: store.fetch,
    out,
    zip,
    version,
    sleep: async (ms) => {
      sleeps.push(ms);
    },
    poll: { attempts: 3, intervalMs: 5 }
  });
  printed.push(...lines, ...summary);
  return { result, lines, summary: summary.join('\n'), sleeps };
}

const GOOGLE_ERROR = (code: number, message: string) => ({ error: { code, message, status: 'INVALID_ARGUMENT' } });

describe('submitRelease', () => {
  it('uploads the zip, publishes it with DEFAULT_PUBLISH and prints the status when the upload succeeds at once', async () => {
    const zip = zipOf('2.0.0');
    const store = fakeStore({
      fetchStatus: [{ body: storeState() }, { body: storeState({ submittedItemRevisionStatus: revision('PENDING_REVIEW', '2.0.0') }) }],
      upload: [{ body: { uploadState: 'SUCCEEDED', crxVersion: '2.0.0', itemId: ITEM } }],
      publish: [{ body: { state: 'PENDING_REVIEW', itemId: ITEM } }]
    });

    const { result, summary, sleeps } = await submit(store, '2.0.0', zip);

    expect(result).toEqual({ ok: true, outcome: 'submitted' });
    expect(store.requests()).toEqual(['GET fetchStatus', 'POST upload', 'POST publish', 'GET fetchStatus']);
    const [status, upload, publish] = store.calls;
    expect(status.url).toBe(`${API_ROOT}/v2/publishers/publisher-0/items/${ITEM}:fetchStatus`);
    expect(upload.url).toBe(`${API_ROOT}/upload/v2/publishers/publisher-0/items/${ITEM}:upload`);
    expect(Buffer.compare(upload.body as Buffer, zip)).toBe(0);
    expect(upload.headers['Content-Type']).toBeUndefined(); // as the documented `curl -T` upload
    expect(publish.url).toBe(`${API_ROOT}/v2/publishers/publisher-0/items/${ITEM}:publish`);
    expect(JSON.parse(publish.body as string)).toEqual({ publishType: 'DEFAULT_PUBLISH' });
    expect(store.calls.every((call) => call.headers.Authorization === `Bearer ${TOKEN}`)).toBe(true);
    expect(sleeps).toEqual([]);
    expect(summary).toContain('2.0.0 is submitted and in Store review');
    expect(summary).toContain('Submission: 2.0.0 at 100% (PENDING_REVIEW)');
  });

  it('polls fetchStatus while the upload is IN_PROGRESS, and publishes only once it has SUCCEEDED', async () => {
    const store = fakeStore({
      fetchStatus: [
        { body: storeState() },
        { body: storeState({ lastAsyncUploadState: 'IN_PROGRESS' }) },
        { body: storeState({ lastAsyncUploadState: 'SUCCEEDED' }) },
        { body: storeState({ submittedItemRevisionStatus: revision('PENDING_REVIEW', '2.0.0') }) }
      ],
      upload: [{ body: { uploadState: 'IN_PROGRESS', itemId: ITEM } }],
      publish: [{ body: { state: 'PENDING_REVIEW' } }]
    });

    const { result, sleeps } = await submit(store);

    expect(result).toEqual({ ok: true, outcome: 'submitted' });
    expect(store.requests()).toEqual([
      'GET fetchStatus',
      'POST upload',
      'GET fetchStatus',
      'GET fetchStatus',
      'POST publish',
      'GET fetchStatus'
    ]);
    expect(sleeps).toEqual([5, 5]);
  });

  it('publishes nothing when the upload is still IN_PROGRESS after the last poll', async () => {
    const inProgress = { body: storeState({ lastAsyncUploadState: 'IN_PROGRESS' }) };
    const store = fakeStore({
      fetchStatus: [{ body: storeState() }, inProgress, inProgress, inProgress],
      upload: [{ body: { uploadState: 'IN_PROGRESS' } }]
    });

    const { result, summary } = await submit(store);

    expect(result).toEqual({ ok: false, outcome: 'failed' });
    expect(store.requests()).not.toContain('POST publish');
    expect(summary).toContain('still IN_PROGRESS after 3 polls');
  });

  describe('when the upload fails', () => {
    it('publishes nothing when the upload answers FAILED, and puts the whole answer in the summary', async () => {
      const answer = { uploadState: 'FAILED', itemId: ITEM, name: 'items/x' };
      const store = fakeStore({ fetchStatus: [{ body: storeState() }], upload: [{ body: answer }] });

      const { result, summary } = await submit(store);

      expect(result).toEqual({ ok: false, outcome: 'failed' });
      expect(store.requests()).toEqual(['GET fetchStatus', 'POST upload']);
      expect(summary).toContain('The upload failed; nothing was submitted');
      expect(summary).toContain(JSON.stringify(answer));
    });

    it("publishes nothing when the store refuses the upload, and puts Google's message in the summary verbatim", async () => {
      const message = 'Invalid package: the manifest `version` must be higher than the published one.\nSee "Package" tab.';
      const store = fakeStore({
        fetchStatus: [{ body: storeState() }],
        upload: [{ status: 400, body: GOOGLE_ERROR(400, message) }]
      });

      const { result, summary, lines } = await submit(store);

      expect(result).toEqual({ ok: false, outcome: 'failed' });
      expect(store.requests()).toEqual(['GET fetchStatus', 'POST upload']);
      expect(summary).toContain(`Google's message:\n\n\`\`\`text\n${message}\n\`\`\``);
      // The annotation carries the message too, its line break escaped as GitHub reads workflow commands
      const annotation = lines.find((line) => line.startsWith('::error::'));
      expect(annotation).toContain('`version` must be higher than the published one.%0ASee "Package" tab.');
      expect(annotation).not.toMatch(/\n/);
    });

    it('publishes nothing when a poll answers FAILED', async () => {
      const store = fakeStore({
        fetchStatus: [{ body: storeState() }, { body: storeState({ lastAsyncUploadState: 'FAILED' }) }],
        upload: [{ body: { uploadState: 'IN_PROGRESS' } }]
      });

      const { result, summary } = await submit(store);

      expect(result).toEqual({ ok: false, outcome: 'failed' });
      expect(store.requests()).toEqual(['GET fetchStatus', 'POST upload', 'GET fetchStatus']);
      expect(summary).toContain('lastAsyncUploadState is FAILED');
    });

    it('publishes nothing when the store read another version from the upload', async () => {
      const store = fakeStore({
        fetchStatus: [{ body: storeState() }],
        upload: [{ body: { uploadState: 'SUCCEEDED', crxVersion: '1.9.1' } }]
      });

      const { result } = await submit(store);

      expect(result.ok).toBe(false);
      expect(store.requests()).toEqual(['GET fetchStatus', 'POST upload']);
    });
  });

  describe('when the publish is answered', () => {
    const uploaded = { fetchStatus: [{ body: storeState() }, { body: storeState() }], upload: [{ body: { uploadState: 'SUCCEEDED', crxVersion: '2.0.0' } }] };

    it('ends green when the publish is accepted for Store review, with its warnings in the summary', async () => {
      const store = fakeStore({
        ...uploaded,
        publish: [{ body: { state: 'PENDING_REVIEW', warningInfo: { warnings: [{ reason: 'PERMISSIONS', description: 'New host permission.' }] } } }]
      });

      const { result, summary } = await submit(store);

      expect(result).toEqual({ ok: true, outcome: 'submitted' });
      expect(summary).toContain('in Store review');
      expect(summary).toContain('PERMISSIONS: New host permission.');
    });

    it("fails, with Google's message verbatim, when the store refuses the publish", async () => {
      const message = 'Publish condition not met: the item is in review.';
      const store = fakeStore({ ...uploaded, publish: [{ status: 400, body: GOOGLE_ERROR(400, message) }] });

      const { result, summary } = await submit(store);

      expect(result).toEqual({ ok: false, outcome: 'failed' });
      expect(summary).toContain('The publish call failed');
      expect(summary).toContain(message);
    });

    it('fails when the Submission comes back in a state that is neither Store review nor published', async () => {
      const store = fakeStore({ ...uploaded, publish: [{ body: { state: 'REJECTED' } }] });

      const { result, summary } = await submit(store);

      expect(result).toEqual({ ok: false, outcome: 'failed' });
      expect(summary).toContain("the Submission's state is REJECTED");
    });
  });

  describe("when the zip's version is not higher than the published one", () => {
    it('uploads nothing and fails when the zip is older', async () => {
      const store = fakeStore({ fetchStatus: [{ body: storeState({ publishedItemRevisionStatus: revision('PUBLISHED', '2.0.0') }) }] });

      const { result, summary } = await submit(store, '1.9.1');

      expect(result).toEqual({ ok: false, outcome: 'refused' });
      expect(store.requests()).toEqual(['GET fetchStatus']);
      expect(summary).toContain('not higher than the published 2.0.0');
    });

    it('compares the versions as numbers, part by part', async () => {
      const store = fakeStore({ fetchStatus: [{ body: storeState({ publishedItemRevisionStatus: revision('PUBLISHED', '1.10.0') }) }] });

      const { result } = await submit(store, '1.9.0');

      expect(result).toEqual({ ok: false, outcome: 'refused' });
      expect(store.requests()).toEqual(['GET fetchStatus']);
    });

    it('compares with the highest version of every distribution channel', async () => {
      const store = fakeStore({
        fetchStatus: [{ body: storeState({ publishedItemRevisionStatus: revision('PUBLISHED', '1.9.0', '2.1.0') }) }]
      });

      const { result } = await submit(store, '2.0.0');

      expect(result).toEqual({ ok: false, outcome: 'refused' });
      expect(store.requests()).toEqual(['GET fetchStatus']);
    });
  });

  describe('a rerun for a version already submitted or published', () => {
    it('sends nothing and succeeds when the version is published', async () => {
      const store = fakeStore({ fetchStatus: [{ body: storeState({ publishedItemRevisionStatus: revision('PUBLISHED', '2.0.0') }) }] });

      const { result, summary } = await submit(store, '2.0.0');

      expect(result).toEqual({ ok: true, outcome: 'unchanged' });
      expect(store.requests()).toEqual(['GET fetchStatus']);
      expect(summary).toContain('2.0.0 is already published');
    });

    it.each(['PENDING_REVIEW', 'STAGED'])('sends nothing and succeeds when the version is submitted (%s)', async (state) => {
      const store = fakeStore({ fetchStatus: [{ body: storeState({ submittedItemRevisionStatus: revision(state, '2.0.0') }) }] });

      const { result, summary } = await submit(store, '2.0.0');

      expect(result).toEqual({ ok: true, outcome: 'unchanged' });
      expect(store.requests()).toEqual(['GET fetchStatus']);
      expect(summary).toContain(`2.0.0 is already submitted (${state})`);
    });
  });

  describe('when another version is in Store review', () => {
    it.each(['PENDING_REVIEW', 'STAGED'])('fails, says so, and cancels nothing (%s)', async (state) => {
      const store = fakeStore({ fetchStatus: [{ body: storeState({ submittedItemRevisionStatus: revision(state, '2.0.0') }) }] });

      const { result, summary } = await submit(store, '2.0.1');

      expect(result).toEqual({ ok: false, outcome: 'refused' });
      expect(store.requests()).toEqual(['GET fetchStatus']);
      expect(summary).toContain(`2.0.0 is in Store review (${state})`);
      expect(summary).toContain('never cancels a Submission');
    });
  });

  describe('before any call', () => {
    it('sends nothing when the manifest is under a folder of the zip, not at its root', async () => {
      const store = fakeStore({});
      const zip = makeZip({ 'dist/manifest.json': manifest('2.0.0') });

      const { result, summary } = await submit(store, '2.0.0', zip);

      expect(result).toEqual({ ok: false, outcome: 'invalid' });
      expect(store.calls).toEqual([]);
      expect(summary).toContain('no manifest.json at its root');
    });

    it("sends nothing when the zip's version is not the Release's", async () => {
      const store = fakeStore({});

      const { result, summary } = await submit(store, '2.0.0', zipOf('1.9.9'));

      expect(result).toEqual({ ok: false, outcome: 'invalid' });
      expect(store.calls).toEqual([]);
      expect(summary).toContain("The zip's manifest says 1.9.9, the Release is 2.0.0.");
    });

    it('sends nothing when an identifier is missing', async () => {
      const store = fakeStore({});

      const { result, summary } = await submit(store, '2.0.0', zipOf('2.0.0'), { CWS_ACCESS_TOKEN: TOKEN, CWS_EXTENSION_ID: ITEM });

      expect(result).toEqual({ ok: false, outcome: 'invalid' });
      expect(store.calls).toEqual([]);
      expect(summary).toContain('CWS_PUBLISHER_ID not set');
    });
  });
});

describe('planSubmission', () => {
  it('uploads a version higher than the published one when nothing is submitted', () => {
    expect(planSubmission(storeState(), '1.9.1')).toEqual({ action: 'upload' });
  });

  it('uploads a version higher than a refused or cancelled Submission, and refuses that version again', () => {
    for (const state of ['REJECTED', 'CANCELLED']) {
      const status = storeState({ submittedItemRevisionStatus: revision(state, '2.0.0') });
      expect(planSubmission(status, '2.0.1')).toEqual({ action: 'upload' });
      expect(planSubmission(status, '2.0.0')).toMatchObject({ action: 'refuse', reason: expect.stringContaining(`ended ${state}`) });
    }
  });

  it('counts a submitted revision already published as published', () => {
    const status = storeState({ submittedItemRevisionStatus: revision('PUBLISHED', '2.0.0') });
    expect(planSubmission(status, '2.0.0')).toMatchObject({ action: 'none' });
    expect(planSubmission(status, '1.9.5')).toMatchObject({ action: 'refuse' });
    expect(planSubmission(status, '2.0.1')).toEqual({ action: 'upload' });
  });

  it.each([
    ['no published revision', { publishedItemRevisionStatus: undefined }, 'no published version'],
    ['a published revision without a version', { publishedItemRevisionStatus: { state: 'PUBLISHED' } }, 'no readable version'],
    ['a malformed version', { publishedItemRevisionStatus: revision('PUBLISHED', '1.9.0-beta') }, 'no readable version'],
    ['an unknown Submission state', { submittedItemRevisionStatus: revision('ITEM_STATE_UNSPECIFIED', '2.0.0') }, 'does not know'],
    ['an upload still processed', { lastAsyncUploadState: 'IN_PROGRESS' }, 'still processing']
  ])('refuses when the store reports %s', (_case, extra, reason) => {
    expect(planSubmission(storeState(extra), '2.0.0')).toMatchObject({ action: 'refuse', reason: expect.stringContaining(reason) });
  });
});

describe('compareVersions', () => {
  it('compares part by part as numbers, missing parts as 0', () => {
    expect(compareVersions('1.10.0', '1.9.0')).toBe(1);
    expect(compareVersions('1.9.0', '1.10.0')).toBe(-1);
    expect(compareVersions('2.0', '2.0.0.0')).toBe(0);
    expect(compareVersions('2.0.0.1', '2.0.0')).toBe(1);
  });

  it('refuses what is not a manifest version', () => {
    expect(() => compareVersions('v2.0.0', '1.0.0')).toThrow();
    expect(() => compareVersions('1.0.0', '65536.0')).toThrow();
    expect(() => compareVersions('01.0', '1.0')).toThrow();
  });
});

describe('zipVersion', () => {
  it('reads the version of the manifest at the root, whatever else the zip holds', () => {
    const zip = makeZip({
      'assets/big.js': 'x'.repeat(50_000),
      'manifest.json': manifest('2.3.4'),
      'src/manifest.json': manifest('9.9.9')
    });
    expect(zipVersion(zip)).toBe('2.3.4');
  });

  it('refuses a file that is not a zip', () => {
    expect(() => zipVersion(Buffer.from('not a zip at all, just text'))).toThrow(/not a zip/);
  });
});

describe('storeStatus', () => {
  it('prints the published version with one read-only call', async () => {
    const store = fakeStore({ fetchStatus: [{ body: storeState() }] });
    const { lines, summary, out } = output();

    const result = await storeStatus({ env: ENV, fetch: store.fetch, out });
    printed.push(...lines, ...summary);

    expect(result).toEqual({ ok: true });
    expect(store.requests()).toEqual(['GET fetchStatus']);
    expect(lines).toContain('  Published: 1.9.0 at 100% (PUBLISHED)');
    expect(lines).toContain('  Submission: none since the last Publication');
  });

  it('says what a Submission of the zip would do', async () => {
    const store = fakeStore({ fetchStatus: [{ body: storeState() }] });
    const { lines, summary, out } = output();

    const result = await storeStatus({ env: ENV, fetch: store.fetch, out, zip: zipOf('1.9.0') });
    printed.push(...lines, ...summary);

    expect(result.ok).toBe(true);
    expect(store.requests()).toEqual(['GET fetchStatus']);
    expect(lines).toContain('A Submission of 1.9.0 would send nothing: 1.9.0 is already published. Nothing is sent.');
  });

  it("fails with Google's message verbatim when the call is refused", async () => {
    const message = 'The caller does not have permission';
    const store = fakeStore({ fetchStatus: [{ status: 403, body: GOOGLE_ERROR(403, message) }] });
    const { lines, summary, out } = output();

    const result = await storeStatus({ env: ENV, fetch: store.fetch, out });
    printed.push(...lines, ...summary);

    expect(result).toEqual({ ok: false });
    expect(summary.join('\n')).toContain(`\`\`\`text\n${message}\n\`\`\``);
  });
});

describe('the token', () => {
  it('reaches the store in the Authorization header only', async () => {
    const store = fakeStore({
      fetchStatus: [{ body: storeState() }, { body: storeState() }],
      upload: [{ body: { uploadState: 'SUCCEEDED', crxVersion: '2.0.0' } }],
      publish: [{ body: { state: 'PENDING_REVIEW' } }]
    });

    await submit(store);

    for (const call of store.calls) {
      expect(call.headers.Authorization).toBe(`Bearer ${TOKEN}`);
      expect(call.url).not.toContain(TOKEN);
    }
  });

  it('never appears in a log line or the summary, even when Google echoes it', async () => {
    const echo = `Request had invalid authentication credentials: Bearer ${TOKEN}`;
    const upload = fakeStore({ fetchStatus: [{ body: storeState() }], upload: [{ status: 401, body: GOOGLE_ERROR(401, echo) }] });
    const status = fakeStore({ fetchStatus: [{ status: 401, body: echo }] });
    const { lines, summary, out } = output();

    await submit(upload);
    await storeStatus({ env: ENV, fetch: status.fetch, out });
    printed.push(...lines, ...summary);

    // `printed` holds what every run of this file printed, the runs above included.
    expect(printed.join('\n')).toContain('Bearer [token]');
    expect(printed.filter((text) => text.includes(TOKEN))).toEqual([]);
  });
});

describe('the command line', () => {
  it('prints its usage and exits 2 without a command', () => {
    const result = spawnSync(process.execPath, [SCRIPT], { encoding: 'utf-8', env: { PATH: process.env.PATH } });
    expect(result.status).toBe(2);
    expect(result.stderr).toContain('Usage:');
  });

  it('exits 1, naming what is missing, without the store identifiers', () => {
    const result = spawnSync(process.execPath, [SCRIPT, 'status'], { encoding: 'utf-8', env: { PATH: process.env.PATH } });
    expect(result.status).toBe(1);
    expect(result.stdout).toContain('CWS_ACCESS_TOKEN, CWS_PUBLISHER_ID, CWS_EXTENSION_ID not set');
  });
});
