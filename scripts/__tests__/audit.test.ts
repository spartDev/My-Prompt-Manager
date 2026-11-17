import { describe, expect, it } from 'vitest';

import { advisoriesOf, auditVerdict, WAIVERS } from '../audit.mjs';

/** Shaped like `npm audit --json`: the vulnerable package carries the advisory, its dependents name it by string. */
const advisory = (id: string, severity: string) => ({
  source: 1,
  name: 'pkg',
  title: `advisory ${id}`,
  url: `https://github.com/advisories/${id}`,
  severity
});

type Vulnerability = { via: unknown[]; nodes?: string[] };
const report = (vulnerabilities: Record<string, Vulnerability>) => ({ vulnerabilities });

const PICOMATCH = report({
  picomatch: { via: [advisory('GHSA-fc5q-39xc-vjpf', 'high')], nodes: ['node_modules/picomatch'] },
  vite: { via: ['picomatch', 'tinyglobby'], nodes: ['node_modules/vite'] },
  tinyglobby: { via: ['picomatch'], nodes: ['node_modules/tinyglobby'] }
});

const waiver = (id: string, until: string, devOnly?: boolean) => ({ id, reason: 'test', until, devOnly });

/** A package-lock.json where `dev` maps each installation path to whether it is a dev dependency only. */
const lockfile = (dev: Record<string, boolean>) => ({
  packages: Object.fromEntries(Object.entries(dev).map(([node, isDev]) => [node, isDev ? { dev: true } : {}]))
});

describe('advisoriesOf', () => {
  it('lists each advisory once, on the packages that carry it, not on their dependents', () => {
    const both = report({
      picomatch: { via: [advisory('GHSA-aaaa', 'high')], nodes: ['node_modules/picomatch'] },
      'other-picomatch': { via: [advisory('GHSA-aaaa', 'high'), 'picomatch'], nodes: ['node_modules/x/node_modules/picomatch'] },
      vite: { via: ['picomatch'], nodes: ['node_modules/vite'] }
    });

    expect(advisoriesOf(both)).toEqual([
      {
        id: 'GHSA-aaaa',
        title: 'advisory GHSA-aaaa',
        severity: 'high',
        packages: ['picomatch', 'other-picomatch'],
        nodes: ['node_modules/picomatch', 'node_modules/x/node_modules/picomatch']
      }
    ]);
  });

  it('reads a report with no vulnerabilities', () => {
    expect(advisoriesOf({ vulnerabilities: {} })).toEqual([]);
  });
});

describe('auditVerdict', () => {
  it('fails on an advisory of moderate or higher that no waiver names', () => {
    const { blocking, expired } = auditVerdict(PICOMATCH, [], '2026-11-17');

    expect(blocking.map((a) => a.id)).toEqual(['GHSA-fc5q-39xc-vjpf']);
    expect(expired).toEqual([]);
  });

  it('passes when a waiver in date names every advisory', () => {
    const { blocking, expired } = auditVerdict(PICOMATCH, [waiver('GHSA-fc5q-39xc-vjpf', '2027-02-17')], '2026-11-17');

    expect(blocking).toEqual([]);
    expect(expired).toEqual([]);
  });

  it('still fails on another advisory while one is waived', () => {
    const two = report({
      picomatch: { via: [advisory('GHSA-fc5q-39xc-vjpf', 'high')] },
      lodash: { via: [advisory('GHSA-bbbb', 'moderate')] }
    });

    const { blocking } = auditVerdict(two, [waiver('GHSA-fc5q-39xc-vjpf', '2027-02-17')], '2026-11-17');

    expect(blocking.map((a) => a.id)).toEqual(['GHSA-bbbb']);
  });

  it('fails on a waiver past its date, and no longer waives its advisory', () => {
    const { blocking, expired } = auditVerdict(PICOMATCH, [waiver('GHSA-fc5q-39xc-vjpf', '2027-02-17')], '2027-02-18');

    expect(expired.map((w) => w.id)).toEqual(['GHSA-fc5q-39xc-vjpf']);
    expect(blocking.map((a) => a.id)).toEqual(['GHSA-fc5q-39xc-vjpf']);
  });

  it('waives on the last day of the waiver', () => {
    expect(auditVerdict(PICOMATCH, [waiver('GHSA-fc5q-39xc-vjpf', '2027-02-17')], '2027-02-17').blocking).toEqual([]);
  });

  it('lets low and info advisories through, as --audit-level=moderate did', () => {
    const low = report({ a: { via: [advisory('GHSA-low', 'low')] }, b: { via: [advisory('GHSA-info', 'info')] } });

    expect(auditVerdict(low, [], '2026-11-17').blocking).toEqual([]);
  });

  it('applies a devOnly waiver while the lockfile marks every installation dev', () => {
    const dev = lockfile({ 'node_modules/picomatch': true });

    expect(auditVerdict(PICOMATCH, [waiver('GHSA-fc5q-39xc-vjpf', '2027-02-17', true)], '2026-11-17', dev).blocking).toEqual([]);
  });

  it('blocks a devOnly-waived advisory once a runtime dependency installs the package', () => {
    const runtime = lockfile({ 'node_modules/picomatch': false });

    const { blocking } = auditVerdict(PICOMATCH, [waiver('GHSA-fc5q-39xc-vjpf', '2027-02-17', true)], '2026-11-17', runtime);

    expect(blocking.map((a) => a.id)).toEqual(['GHSA-fc5q-39xc-vjpf']);
  });

  it('blocks a devOnly-waived advisory when one of its installations is not dev', () => {
    const nested = report({
      picomatch: {
        via: [advisory('GHSA-fc5q-39xc-vjpf', 'high')],
        nodes: ['node_modules/picomatch', 'node_modules/runtime-dep/node_modules/picomatch']
      }
    });
    const mixed = lockfile({ 'node_modules/picomatch': true, 'node_modules/runtime-dep/node_modules/picomatch': false });

    const { blocking } = auditVerdict(nested, [waiver('GHSA-fc5q-39xc-vjpf', '2027-02-17', true)], '2026-11-17', mixed);

    expect(blocking.map((a) => a.id)).toEqual(['GHSA-fc5q-39xc-vjpf']);
  });

  it('blocks a devOnly-waived advisory when the lockfile does not list its installation', () => {
    const { blocking } = auditVerdict(PICOMATCH, [waiver('GHSA-fc5q-39xc-vjpf', '2027-02-17', true)], '2026-11-17', lockfile({}));

    expect(blocking.map((a) => a.id)).toEqual(['GHSA-fc5q-39xc-vjpf']);
  });

  it('waives the picomatch ReDoS advisory with a reason, an expiry, and only as a dev dependency', () => {
    const picomatch = WAIVERS.find((w) => w.id === 'GHSA-fc5q-39xc-vjpf');

    expect(picomatch?.reason).toMatch(/Dev dependency only/);
    expect(picomatch?.until).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(picomatch?.devOnly).toBe(true);
  });
});
