/**
 * Runs `npm audit` and fails on any advisory of moderate severity or higher, except the waived ones below.
 *
 * `npm audit` has no way to waive one advisory, and an advisory with no patched release fails every CI run
 * until upstream ships a fix. A waiver names the advisory, says why the risk is accepted, and expires: past
 * its date it fails the audit again, so someone looks at the advisory once more.
 *
 * Usage: node scripts/audit.mjs. It exits 1 and names each advisory that blocks, or each expired waiver.
 * CI runs it in place of `npm audit --audit-level=moderate` (pr-checks, main-deploy, release).
 */
import { spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

/** @type {{ id: string; reason: string; until: string }[]} */
export const WAIVERS = [
  {
    id: 'GHSA-fc5q-39xc-vjpf',
    reason:
      'picomatch <=4.0.7 ReDoS, no patched release. Dev dependency only (vite, vitest, lint-staged, @crxjs): it runs on our own globs at build and test time and does not ship in the extension.',
    until: '2027-02-17'
  }
];

const SEVERITY_RANK = { info: 0, low: 1, moderate: 2, high: 3, critical: 4 };
const MIN_RANK = SEVERITY_RANK.moderate;

const ghsaOf = (url) => url?.match(/GHSA-[\w-]+/)?.[0] ?? url;

/**
 * The advisories of an `npm audit --json` report, deduplicated by id. A package listed only because it depends
 * on a vulnerable one has strings in `via`; the advisory itself appears as an object on the vulnerable package.
 */
export function advisoriesOf(report) {
  const advisories = new Map();
  for (const [name, vulnerability] of Object.entries(report.vulnerabilities ?? {})) {
    for (const via of vulnerability.via ?? []) {
      if (typeof via !== 'object') {
        continue;
      }
      const id = ghsaOf(via.url);
      const advisory = advisories.get(id) ?? { id, title: via.title, severity: via.severity, packages: [] };
      advisory.packages.push(name);
      advisories.set(id, advisory);
    }
  }
  return [...advisories.values()];
}

/** The advisories that fail the audit and the waivers past their date, on `today` (YYYY-MM-DD). */
export function auditVerdict(report, waivers, today) {
  const expired = waivers.filter((waiver) => waiver.until < today);
  const active = new Set(waivers.filter((waiver) => waiver.until >= today).map((waiver) => waiver.id));
  const blocking = advisoriesOf(report).filter(
    (advisory) => (SEVERITY_RANK[advisory.severity] ?? SEVERITY_RANK.critical) >= MIN_RANK && !active.has(advisory.id)
  );
  return { blocking, expired };
}

function main() {
  const result = spawnSync('npm', ['audit', '--json'], { encoding: 'utf-8', maxBuffer: 64 * 1024 * 1024 });
  let report;
  try {
    report = JSON.parse(result.stdout);
  } catch {
    process.stderr.write(`audit: npm audit printed no JSON report.\n${result.stderr}`);
    process.exit(2);
  }
  if (report.error) {
    process.stderr.write(`audit: npm audit failed: ${JSON.stringify(report.error)}\n`);
    process.exit(2);
  }
  const today = new Date().toISOString().slice(0, 10);
  const { blocking, expired } = auditVerdict(report, WAIVERS, today);
  for (const waiver of expired) {
    process.stderr.write(
      `audit: the waiver of ${waiver.id} expired on ${waiver.until}. Check the advisory again, then update or remove it in scripts/audit.mjs.\n`
    );
  }
  for (const advisory of blocking) {
    process.stderr.write(`audit: ${advisory.severity} ${advisory.id} ${advisory.title} (${advisory.packages.join(', ')})\n`);
  }
  if (blocking.length > 0 || expired.length > 0) {
    process.exit(1);
  }
  const waived = advisoriesOf(report).filter((advisory) => WAIVERS.some((waiver) => waiver.id === advisory.id));
  for (const advisory of waived) {
    process.stdout.write(`audit: waived ${advisory.severity} ${advisory.id} (${advisory.packages.join(', ')})\n`);
  }
  process.stdout.write('audit: no advisory of moderate severity or higher outside the waivers.\n');
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
