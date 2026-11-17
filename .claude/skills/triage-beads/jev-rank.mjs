#!/usr/bin/env node
// Asks Jev (TypeSafe System One) the judgments a triage needs about the tickets of a
// `bd list --json` snapshot, and turns the answers into decisions in code.
//
// Jev judges; this file decides. Every question, criterion, area, weight and threshold
// is in the blocks at the top, so a reviewer edits one place.
//
//   node jev-rank.mjs <scratch>/backlog.json [--no-dups] [--exclude <id>,<id>]
//       Step 2 (rank, flag, acceptance check, duplicates) and step 4 (code areas).
//       Writes <scratch>/jev.json.
//   node jev-rank.mjs deferred <scratch>/backlog.json <scratch>/evidence.json [--exclude <id>,<id>]
//       Step 3: does the evidence show a deferred ticket's condition now holds?
//       evidence.json is {"<id>": "<the command run and its output>"}.
//       Writes <scratch>/jev-deferred.json.
//
// Needs TYPESAFE_API_KEY. TYPESAFE_API_URL and TYPESAFE_MODEL override the endpoint
// and the model (default jev-latest). Exit 3: no key. Exit 1: a request failed.

import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

const API_URL = process.env.TYPESAFE_API_URL ?? 'https://api.typesafe.ai/v1/systemone';
const MODEL = process.env.TYPESAFE_MODEL ?? 'jev-latest';
// A local mock (http://localhost) gets a dummy credential, never the real key.
const LOCAL_MOCK = (() => {
  const u = new URL(API_URL);
  return u.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(u.hostname);
})();
const KEY = LOCAL_MOCK ? 'local-mock-dummy-key' : process.env.TYPESAFE_API_KEY;

// ---------------------------------------------------------------------------
// What Jev is told about the project. Shared by every request.
// ---------------------------------------------------------------------------
const PROJECT =
  'My Prompt Manager is a Chrome extension. Users keep a Library of Prompts in its popup ' +
  'and side panel, and insert a Prompt into AI chat Platforms (ChatGPT, Claude, Gemini, ' +
  'Mistral, Perplexity, Copilot, M365 Copilot) through a badge and a Prompt selector the ' +
  'extension adds to each Platform page. A Prompt must be inserted Verbatim, its text unchanged.';

// ---------------------------------------------------------------------------
// Step 2: the judgments asked about each ticket. One judgment per question.
// ---------------------------------------------------------------------------
const QUESTIONS = {
  user_visible: {
    type: 'noul',
    instructions: 'Would a user of the extension notice the problem or the change described in `ticket`?',
    criteria: {
      true: 'The user sees it in the popup, the side panel, the Analytics page, or on a Platform page (the badge, the Prompt selector, the inserted text). A release that ships changes to users counts.',
      false: 'Only code, tests, CI scripts or docs change; the user sees nothing different.',
    },
  },
  severity: {
    type: 'score',
    instructions: 'How badly does the problem described in `ticket` hurt users today?',
    criteria: [
      'Nothing is broken: the ticket is a cleanup, a test, tooling, a manual check or a new capability.',
      'Something looks off, but every feature still works.',
      'A feature works badly or forgets a setting on some pages, and the user can work around it.',
      'A feature fails on a Platform: the user cannot insert a Prompt there or loses their setup.',
      'Prompts are lost or inserted with changed text, or the extension stops working everywhere.',
    ],
  },
  time_bound: {
    type: 'noul',
    instructions: 'Does `ticket` have to land before a date, a release, or an outside change such as a Platform redesign or a Chrome Web Store review?',
    criteria: {
      true: 'Something outside the ticket waits on it or will make it worse if it waits.',
      false: 'It can land at any time; nothing waits on it.',
    },
  },
  effort: {
    type: 'score',
    instructions: 'How large is the change `ticket` asks for?',
    criteria: [
      'A small edit in one file.',
      'A few files in one area, with their tests.',
      'Several areas, such as both the popup and the content scripts, or a manual pass over several Platforms.',
      'A new subsystem, a data migration, or a rework that touches every Platform.',
    ],
  },
  ready: {
    type: 'noul',
    instructions: 'Could a developer start on `ticket` today, knowing what done looks like?',
    criteria: {
      true: 'It says what to change, and its acceptance criteria name a check that proves it.',
      false: 'It first needs a decision, an investigation, or an outside event such as an upstream release.',
    },
  },
  // Null case for the areas below: a ticket that changes no file has no area.
  changes_files: {
    type: 'noul',
    instructions: 'Does `ticket` ask for a change to files in the repository?',
    criteria: {
      true: 'Code, tests, config, scripts or docs in the repository change.',
      false: 'It is a manual check, a Chrome Web Store release, or a decision; no file in the repository changes.',
    },
  },
};

// Every acceptance criterion item gets this question, the item in its own instructions.
const acceptanceQuestion = (item) => ({
  type: 'noul',
  instructions: `Could someone check this acceptance criterion and see whether it holds, from a test, a command's output, a screenshot, or a file or page to read? "${item}"`,
  criteria: {
    true: 'It names something to run, look at or read, and what it must show, such as a doc that must describe something.',
    false: "It is vague, such as 'works well', 'is cleaner' or 'is fixed', with nothing to run or look at.",
  },
});

// ---------------------------------------------------------------------------
// Step 4: the code areas a ticket may touch. Several can be true, so one Noul each.
// The paths let step 4 match an area against the paths other tickets cite.
// ---------------------------------------------------------------------------
const AREAS = {
  platform_adapters: {
    describes: 'How the extension finds the composer and inserts text on one Platform (its strategy).',
    paths: ['src/content/platforms/', 'src/config/platforms.ts'],
  },
  icon_placement: {
    describes: 'Where the Prompts badge sits on a Platform page: the user\'s placement pick, its repairs, and the Settings list of repairs.',
    paths: ['src/content/core/icon-placement.ts', 'src/content/core/placement-repair.ts', 'src/content/core/anchored-overlay.ts', 'src/content/core/injector.ts', 'src/services/iconPlacementRepairs.ts', 'src/hooks/useIconPlacementRepairs.ts'],
  },
  prompt_selector: {
    describes: 'The Prompt selector opened from the badge or by typing //, and inserting the chosen Prompt.',
    paths: ['src/content/selector/', 'src/content/core/insertion-manager.ts'],
  },
  custom_sites: {
    describes: 'Custom sites the user adds: the element picker and the custom site forms in Settings.',
    paths: ['src/content/modules/element-picker.ts', 'src/content/utils/element-fingerprint.ts', 'src/components/settings/AddCustomSiteForm.tsx', 'src/components/settings/CustomSitesList.tsx', 'src/components/settings/SiteImportDrawer.tsx'],
  },
  site_settings: {
    describes: 'Per-site settings and how the background service worker and the content scripts follow them.',
    paths: ['src/services/siteSettings.ts', 'src/background/', 'src/content/utils/storage.ts', 'src/components/settings/SiteIntegrationSection.tsx', 'src/components/settings/SiteRow.tsx'],
  },
  library: {
    describes: 'The Library in the popup and side panel: Prompts, Categories, search, the Prompt editor, import and storage.',
    paths: ['src/components/LibraryView.tsx', 'src/components/PromptCard.tsx', 'src/components/PromptEditor.tsx', 'src/components/editor/', 'src/components/CategoryManager.tsx', 'src/components/CategorySheet.tsx', 'src/services/promptManager.ts', 'src/services/storage.ts', 'src/hooks/usePrompts.ts', 'src/hooks/useCategories.ts', 'src/popup.tsx', 'src/sidepanel.tsx'],
  },
  analytics: {
    describes: 'The Analytics page and usage tracking.',
    paths: ['src/analytics.tsx', 'src/components/analytics/', 'src/services/usageInsights.ts', 'src/services/UsageTracker.ts'],
  },
  whats_new: {
    describes: "The What's New panel shown after an update.",
    paths: ['src/whatsNew/', 'src/components/whatsNew/'],
  },
  build_and_ci: {
    describes: 'Build, manifest, dependencies, Renovate, CI workflows and repository scripts.',
    paths: ['manifest.json', 'vite.config.ts', 'package.json', 'renovate.json', '.github/workflows/', 'scripts/'],
  },
  e2e_tests: {
    describes: 'End-to-end tests and the stand-in pages that imitate the Platforms.',
    paths: ['tests/e2e/', 'tests/fixtures/'],
  },
  docs: {
    describes: 'Documentation: docs/, AGENTS.md, CONTEXT.md, the README.',
    paths: ['docs/', 'AGENTS.md', 'CONTEXT.md', 'README.md'],
  },
};
const areaQuestion = (area) => ({
  type: 'noul',
  instructions: `Would the change \`ticket\` asks for edit files in this part of the extension: ${area.describes}`,
  criteria: {
    true: 'Doing the ticket means editing files of this part.',
    false: 'The ticket may mention it, but its change lands elsewhere.',
  },
});

// ---------------------------------------------------------------------------
// Duplicates: one Noul per pair, both tickets in the question.
// ---------------------------------------------------------------------------
const DUPLICATE_CRITERIA = {
  true: 'Closing one ticket would leave nothing to do in the other.',
  false: 'They touch the same area or the same Platform, but each asks for a change the other does not.',
};

// ---------------------------------------------------------------------------
// Step 3: a deferred ticket against the evidence fetched for it.
// ---------------------------------------------------------------------------
const DEFERRED_QUESTIONS = {
  evidence_on_topic: {
    type: 'noul',
    instructions: 'Is `evidence` about the very condition `ticket` waits for?',
    criteria: {
      true: 'It reports the state of the upstream issue, release, pull request or event the ticket names.',
      false: 'It is about something else, or too partial to tell the state of that condition.',
    },
  },
  condition_met: {
    type: 'noul',
    instructions: 'Does `evidence` show that the condition `ticket` waits for has now happened?',
    criteria: {
      true: 'The release, fix, merge or event the ticket waits for has happened.',
      false: 'It is still pending: the issue is open, the fix is unreleased, or the event has not come.',
    },
  },
};

// ---------------------------------------------------------------------------
// How the answers become decisions. Code, not Jev, decides.
// ---------------------------------------------------------------------------
const WEIGHTS = {
  // Policy (maintainer, 2026-11-17): test and tooling tickets rank below user-facing
  // bugs. The weights do not guarantee it on their own: the sort in rank() puts every
  // ticket users would notice first, then orders each tier by these weights.
  severity: 0.45, // severity / 4
  user_visible: 0.2, // Noul probability
  time_bound: 0.2, // Noul probability
  unblocks: 0.15, // min(dependent_count, 3) / 3, from the snapshot
  effort_penalty: 0.15, // subtracted: effort / 3
};
const THRESHOLDS = {
  yes: 0.7, // a Noul above reads as yes
  no: 0.3, // below reads as no; between is unsettled
  // value -> suggested beads priority. P0 is never suggested: a human calls an outage.
  bands: [
    [0.6, 1],
    [0.4, 2],
    [0.2, 3],
    [Number.NEGATIVE_INFINITY, 4],
  ],
  mismatch: 2, // flag when |suggested - current| reaches this
};
const CONCURRENCY = 4;
const DUPLICATE_BATCH = 60; // at most this many pairs per request
const DUPLICATE_BATCH_CHARS = 45000; // and this many characters of questions (see rank())

// ---------------------------------------------------------------------------
// Privacy guard: text that looks like a secret or personal data is never sent.
// The ticket (or the evidence) is reported instead, to be cleaned or decided by hand.
// A pattern can miss what it does not know: the skill still asks for a read first.
// ---------------------------------------------------------------------------
const SENSITIVE_PATTERNS = {
  email: /[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}/,
  phone: /(?<![\w+])\+\d{1,3}[\s.-]\(?\d{1,4}\)?(?:[\s.-]\d{2,4}){2,4}\b/,
  private_key: /-----BEGIN [A-Z ]*PRIVATE KEY-----/,
  aws_key: /\bAKIA[0-9A-Z]{16}\b/,
  github_token: /\b(?:gh[pousr]_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{30,})\b/,
  slack_token: /\bxox[abprs]-[A-Za-z0-9-]{10,}/,
  api_key: /\b(?:sk|pk|rk)[-_](?:live|test|proj|ant)?[-_]?[A-Za-z0-9]{20,}/,
  jwt: /\beyJ[A-Za-z0-9_-]{10,}\.eyJ[A-Za-z0-9_-]{10,}\./,
  credential_assignment: /\b(?:password|passwd|secret|token|api[_-]?key)\s*[:=]\s*['"]?[^\s'"]{8,}/i,
};
const sensitiveKinds = (text) =>
  Object.entries(SENSITIVE_PATTERNS)
    .filter(([, re]) => re.test(text))
    .map(([k]) => k);

// ---------------------------------------------------------------------------

class ApiError extends Error {
  constructor(message, options = {}) {
    super(message, options);
    this.status = options.status;
  }
}
// What the API answers to a request it will not take as sent, such as one over the
// model's context: the duplicate batches split and retry on these.
const REJECTED_REQUEST = new Set([400, 413, 422]);

async function ask(state, questions) {
  const payload = { model: MODEL, state, questions };
  for (let attempt = 0; ; attempt++) {
    const res = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${KEY}` },
      // A redirect, even https -> http, could resend the ticket text in clear: refuse it.
      redirect: 'error',
      body: JSON.stringify(payload),
    });
    if (res.status === 429 && attempt < 3) {
      const wait = Number(res.headers.get('retry-after')) || 2 ** attempt;
      await new Promise((r) => setTimeout(r, wait * 1000));
      continue;
    }
    if (!res.ok) {
      // A failed call is an error, never an answer.
      throw new ApiError(`HTTP ${res.status}: ${(await res.text()).slice(0, 300)}`, { status: res.status });
    }
    try {
      return { payload, response: await res.json() };
    } catch (e) {
      // A 200 whose body is not JSON is a failed call too.
      throw new ApiError(`HTTP ${res.status}: response is not JSON (${e.message})`, { cause: e });
    }
  }
}

async function pool(items, fn) {
  const out = new Array(items.length);
  let next = 0;
  const workers = Array.from({ length: Math.min(CONCURRENCY, items.length) }, async () => {
    while (next < items.length) {
      const i = next++;
      out[i] = await fn(items[i]);
    }
  });
  await Promise.all(workers);
  return out;
}

const ticketBrief = (t) => ({
  title: t.title,
  type: t.issue_type,
  status: t.status,
  description: t.description ?? '',
  acceptance_criteria: acceptanceText(t),
});

const noulReading = (p) => (p >= THRESHOLDS.yes ? 'yes' : p <= THRESHOLDS.no ? 'no' : 'unsettled');
const pct = (p) => Math.round(p * 100);

// Splits acceptance criteria into items: "1. … 2. …", one per line, or "- …" bullets.
// The acceptance field, or, when it is empty, an "Acceptance criteria" section written
// inside the description (a heading or a line "Acceptance criteria:"), up to the next heading.
function acceptanceText(t) {
  if ((t.acceptance_criteria ?? '').trim()) return t.acceptance_criteria;
  const m = (t.description ?? '').match(/^\s*(?:#+\s*)?acceptance(?: criteria)?\s*:?\s*$([\s\S]*?)(?=^\s*#+\s|(?![\s\S]))/im);
  return m ? m[1].trim() : '';
}

function acceptanceItems(text) {
  const t = (text ?? '').trim();
  if (!t) return [];
  const numbered = t.split(/(?:^|\s)\d+[.)]\s+/).map((s) => s.trim()).filter(Boolean);
  if (numbered.length > 1) return withLeadIns(numbered);
  const lines = t.split(/\n+/).map((s) => s.replace(/^\s*(?:[-*•]\s*)?(?:\[[ xX]\]\s*)?/, '').trim()).filter(Boolean);
  return withLeadIns(lines.length ? lines : [t]);
}

// A line ending in ":" introduces the items after it ("On each Platform, with main:"):
// it is no criterion of its own, so it is put in front of each item it introduces.
function withLeadIns(items) {
  const out = [];
  let lead = '';
  for (const item of items) {
    if (item.endsWith(':')) lead = `${item} `;
    else out.push(lead + item);
  }
  return out.length ? out : items;
}

function decide(t, answers, acItems) {
  const sev = answers.severity.score;
  const eff = answers.effort.score;
  const vis = answers.user_visible.noul;
  const time = answers.time_bound.noul;
  const ready = answers.ready.noul;
  const unblocks = Math.min(t.dependent_count ?? 0, 3) / 3;
  const value =
    WEIGHTS.severity * (sev / 4) +
    WEIGHTS.user_visible * vis +
    WEIGHTS.time_bound * time +
    WEIGHTS.unblocks * unblocks -
    WEIGHTS.effort_penalty * (eff / 3);
  const suggested = THRESHOLDS.bands.find(([min]) => value >= min)[1];

  const flags = [];
  if (Math.abs(suggested - t.priority) >= THRESHOLDS.mismatch) {
    flags.push(`priority: P${t.priority} but judged P${suggested}`);
  }
  const unsettled = ['user_visible', 'time_bound', 'ready'].filter(
    (k) => noulReading(answers[k].noul) === 'unsettled'
  );
  if (unsettled.length) flags.push(`unsettled: ${unsettled.join(', ')}`);
  if (t.status === 'open' && noulReading(ready) === 'no') flags.push('not ready');
  // A Score whose top two levels are far apart has two peaks: its position hides that.
  for (const k of ['severity', 'effort']) {
    const probs = Object.entries(answers[k].probabilities ?? {}).sort((a, b) => b[1] - a[1]);
    if (probs.length > 1 && probs[1][1] >= 0.25 && Math.abs(Number(probs[0][0]) - Number(probs[1][0])) >= 2) {
      flags.push(`${k} split between levels ${probs[0][0]} and ${probs[1][0]}`);
    }
  }

  // Acceptance criteria: the user's rule is that every ticket has checkable ones.
  const acceptance = acItems.map((item, i) => ({ item, p: answers[`ac_${i}`].noul }));
  if (!acItems.length && t.issue_type !== 'epic') flags.push('acceptance: none');
  const vague = acceptance.map((a, i) => (noulReading(a.p) === 'yes' ? null : `${i + 1}`)).filter(Boolean);
  if (vague.length) {
    flags.push(`acceptance: ${vague.length > 1 ? 'items' : 'item'} ${vague.join(', ')} ${vague.length > 1 ? 'name' : 'names'} no check`);
  }

  // Areas: read only when the ticket changes files. Unsettled areas are listed apart.
  const changes = answers.changes_files.noul;
  const areas = { yes: [], unsettled: [] };
  if (noulReading(changes) !== 'no') {
    for (const name of Object.keys(AREAS)) {
      const r = noulReading(answers[`area_${name}`].noul);
      if (r !== 'no') areas[r].push(name);
    }
  }

  return {
    value: Number(value.toFixed(3)),
    suggested,
    sev,
    eff,
    vis,
    time,
    ready,
    flags,
    acceptance,
    changes_files: changes,
    areas,
  };
}

// --exclude id,id: tickets never sent, applied to the snapshot as read, so a later
// re-pull of the listing cannot bring them back.
function excludedIds(opts) {
  const i = opts.indexOf('--exclude');
  return new Set(i >= 0 && opts[i + 1] ? opts[i + 1].split(',').map((s) => s.trim()).filter(Boolean) : []);
}

async function rank(snapshotPath, opts) {
  const excluded = excludedIds(opts);
  const all = JSON.parse(readFileSync(snapshotPath, 'utf8')).filter((t) => !excluded.has(t.id));
  // An epic is ranked and placed by its children, not judged on its own.
  const live = all.filter((t) => t.issue_type !== 'epic');
  // A ticket that looks like it holds a secret or personal data is not sent at all.
  const held = live
    .map((t) => ({ t, kinds: sensitiveKinds(`${t.title}\n${t.description ?? ''}\n${t.acceptance_criteria ?? ''}`) }))
    .filter((h) => h.kinds.length);
  const heldIds = new Set(held.map((h) => h.t.id));
  const tickets = live.filter((t) => !heldIds.has(t.id));

  const results = await pool(tickets, async (t) => {
    const acItems = acceptanceItems(acceptanceText(t));
    // Speculative fan-out: every question shares the ticket as state, so one request.
    const questions = {
      ...QUESTIONS,
      ...Object.fromEntries(acItems.map((item, i) => [`ac_${i}`, acceptanceQuestion(item)])),
      ...Object.fromEntries(Object.entries(AREAS).map(([name, a]) => [`area_${name}`, areaQuestion(a)])),
    };
    const base = { id: t.id, priority: t.priority, status: t.status, title: t.title };
    try {
      const { payload, response } = await ask({ project: PROJECT, ticket: ticketBrief(t) }, questions);
      return { ...base, payload, answers: response.answers, ...decide(t, response.answers, acItems) };
    } catch (e) {
      if (!(e instanceof ApiError) && !(e instanceof TypeError)) throw e;
      return { ...base, error: String(e.message ?? e) };
    }
  });

  // Every pair of sent tickets is asked, whatever its issue_type. Each pair question is
  // bounded (title 200 + description 600 characters per ticket), and pairs are packed
  // into requests of at most DUPLICATE_BATCH pairs and DUPLICATE_BATCH_CHARS characters
  // of questions: even at one token per character a request stays under the 64k-token
  // request context, and one question far under the 32k per-question context. A failed
  // batch lists every pair it held, never read as "no duplicate".
  let duplicates = [];
  if (!opts.includes('--no-dups')) {
    const brief = (t) => ({ title: t.title.slice(0, 200), description: (t.description ?? '').slice(0, 600) });
    const pairQuestion = (a, b) => ({
      type: 'noul',
      instructions: { task: 'Do `first` and `second` ask for the same change?', first: brief(a), second: brief(b) },
      criteria: DUPLICATE_CRITERIA,
    });
    const batches = [];
    let batch = [];
    let chars = 0;
    for (let i = 0; i < tickets.length; i++) {
      for (let j = i + 1; j < tickets.length; j++) {
        const q = pairQuestion(tickets[i], tickets[j]);
        const size = JSON.stringify(q).length;
        if (batch.length && (batch.length >= DUPLICATE_BATCH || chars + size > DUPLICATE_BATCH_CHARS)) {
          batches.push(batch);
          batch = [];
          chars = 0;
        }
        batch.push({ a: tickets[i].id, b: tickets[j].id, q });
        chars += size;
      }
    }
    if (batch.length) batches.push(batch);
    // The size caps are an estimate, not a token count: a batch the API rejects (400,
    // 413, 422, as for a request over the context) is split in two and each half
    // retried, down to a single pair; a pair still rejected is reported as unchecked.
    const askBatch = async (b) => {
      const questions = Object.fromEntries(b.map((p, k) => [`pair_${k}`, p.q]));
      try {
        const { response } = await ask({ project: PROJECT }, questions);
        return b.map((p, k) => ({ a: p.a, b: p.b, p: response.answers[`pair_${k}`].noul }));
      } catch (e) {
        if (!(e instanceof ApiError) && !(e instanceof TypeError)) throw e;
        if (e instanceof ApiError && REJECTED_REQUEST.has(e.status) && b.length > 1) {
          const half = Math.ceil(b.length / 2);
          return [...(await askBatch(b.slice(0, half))), ...(await askBatch(b.slice(half)))];
        }
        return [{ error: String(e.message ?? e), unchecked: b.map((p) => [p.a, p.b]) }];
      }
    };
    const answered = await pool(batches, askBatch);
    duplicates = answered
      .flat()
      .filter((d) => d.error || d.p > THRESHOLDS.no)
      .sort((x, y) => (y.error ? 2 : y.p) - (x.error ? 2 : x.p));
  }


  // Held tickets were never sent: they stay in the output, unjudged, to be ranked by hand.
  for (const { t, kinds } of held) {
    results.push({ id: t.id, priority: t.priority, status: t.status, title: t.title, held: kinds, error: `not sent: may hold ${kinds.join(', ')}` });
  }

  // Policy before weights: a ticket users would notice (user_visible not read as 'no')
  // ranks above every ticket they would not, whatever the weighted values say.
  const tier = (r) => (r.error ? -1 : noulReading(r.vis) === 'no' ? 0 : 1);
  const ranked = [...results].sort((x, y) => tier(y) - tier(x) || (y.value ?? -1) - (x.value ?? -1));

  // An epic is not judged on its own: it takes the best suggestion and the areas of its
  // live children, so the report and step 4 keep it. Children are the tickets linked to
  // it by a parent-child edge (bd list --parent); the "<epic>.<n>" id is used only when
  // bd cannot be asked.
  const childIds = (epicId) => {
    try {
      const out = execFileSync('bd', ['list', '--parent', epicId, '--status=open,in_progress,blocked,deferred', '--json', '--limit', '0'], {
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'ignore'],
      });
      return new Set(JSON.parse(out).map((c) => c.id));
    } catch {
      return null;
    }
  };
  const epics = all
    .filter((t) => t.issue_type === 'epic')
    .map((e) => {
      const linked = childIds(e.id);
      const children = results.filter((r) => (linked ? linked.has(r.id) : r.id.startsWith(`${e.id}.`)));
      const judged = children.filter((c) => !c.error);
      const changing = judged.filter((c) => noulReading(c.changes_files) !== 'no');
      const areas = [...new Set(changing.flatMap((c) => c.areas.yes))];
      const maybe = [...new Set(changing.flatMap((c) => c.areas.unsettled))].filter((a) => !areas.includes(a));
      return {
        id: e.id,
        priority: e.priority,
        status: e.status,
        title: e.title,
        children: children.map((c) => c.id),
        children_from: linked ? 'parent-child edges' : 'id prefix (bd list --parent failed)',
        suggested: judged.length ? Math.min(...judged.map((c) => c.suggested)) : null,
        // "no files" only when every judged child says so; otherwise what is known.
        // Every child, failed ones included, must read "no": an unknown child is not a "no".
        no_files: children.length > 0 && judged.length === children.length && changing.length === 0,
        areas,
        maybe_areas: maybe,
      };
    });
  const out = join(dirname(snapshotPath), 'jev.json');
  const areaPaths = Object.fromEntries(Object.entries(AREAS).map(([n, a]) => [n, a.paths]));
  writeFileSync(out, JSON.stringify({ model: MODEL, weights: WEIGHTS, thresholds: THRESHOLDS, areas: areaPaths, ranked, epics, duplicates }, null, 2));

  for (const r of ranked) {
    if (r.held) {
      console.log(`${r.id} P${r.priority} HELD ${r.error}: clean the ticket, or --exclude it and rank it by hand`);
      continue;
    }
    if (r.error) {
      console.log(`${r.id} P${r.priority} ERROR ${r.error}`);
      continue;
    }
    console.log(
      `${r.id} P${r.priority}->P${r.suggested} v=${r.value} sev=${r.sev.toFixed(1)} eff=${r.eff.toFixed(1)} ` +
        `vis=${pct(r.vis)} time=${pct(r.time)} ready=${pct(r.ready)}${r.flags.length ? ` | ${r.flags.join('; ')}` : ''}`
    );
  }
  for (const e of epics) {
    console.log(
      e.suggested === null
        ? `EPIC ${e.id} P${e.priority}: no judged live child, rank it by hand`
        : `EPIC ${e.id} P${e.priority}->P${e.suggested} (best child) children ${e.children.join(', ')} | areas ${e.no_files ? 'no files' : e.areas.join(', ') || 'no confirmed areas'}${e.maybe_areas.length ? ` (maybe ${e.maybe_areas.join(', ')})` : ''}`
    );
  }
  for (const d of duplicates) {
    if (!d.error) {
      console.log(`DUPLICATE? ${d.a} ~ ${d.b} p=${pct(d.p)} (${noulReading(d.p)})`);
      continue;
    }
    console.log(`DUPLICATES ERROR ${d.error} (${d.unchecked.length} pairs not checked)`);
    for (const [a, b] of d.unchecked) console.log(`UNCHECKED ${a} ~ ${b}`);
  }
  for (const r of ranked) {
    if (r.error) continue;
    const reading = noulReading(r.changes_files);
    const where =
      reading === 'no'
        ? 'no files'
        : `${r.areas.yes.join(', ') || '?'}${r.areas.unsettled.length ? ` (maybe ${r.areas.unsettled.join(', ')})` : ''}${reading === 'unsettled' ? ' [changes files: unsettled]' : ''}`;
    console.log(`AREAS ${r.id}: ${where}`);
  }
  console.log(`-> ${out}`);
  if (ranked.some((r) => r.error && !r.held) || duplicates.some((d) => d.error)) process.exitCode = 1;
}

async function deferred(snapshotPath, evidencePath, opts) {
  const excluded = excludedIds(opts);
  const all = JSON.parse(readFileSync(snapshotPath, 'utf8'));
  const evidence = JSON.parse(readFileSync(evidencePath, 'utf8'));
  const tickets = all.filter((t) => t.status === 'deferred');
  const results = await pool(tickets, async (t) => {
    const base = { id: t.id, title: t.title };
    // The same exclusions as the ranking: an excluded ticket is never sent.
    if (excluded.has(t.id)) return { ...base, decision: 'excluded: decide it by hand' };
    if (!evidence[t.id]) return { ...base, decision: 'no evidence fetched: open it by hand' };
    const kinds = sensitiveKinds(
      `${t.title}\n${t.description ?? ''}\n${t.acceptance_criteria ?? ''}\n${evidence[t.id]}`
    );
    if (kinds.length) {
      return { ...base, decision: `not sent: the ticket or its evidence may hold ${kinds.join(', ')}; clean it or decide by hand` };
    }
    try {
      const { payload, response } = await ask({ ticket: ticketBrief(t), evidence: evidence[t.id] }, DEFERRED_QUESTIONS);
      const onTopic = response.answers.evidence_on_topic.noul;
      const met = response.answers.condition_met.noul;
      let decision;
      if (noulReading(onTopic) !== 'yes') decision = 'evidence does not settle it: fetch better evidence or open it';
      else if (noulReading(met) === 'yes') decision = 'condition met: propose reopening (bd update <id> --status open)';
      else if (noulReading(met) === 'no') decision = 'still waiting: stays deferred';
      else decision = 'unsettled: open it and read the evidence';
      return { ...base, payload, answers: response.answers, on_topic: onTopic, met, decision };
    } catch (e) {
      if (!(e instanceof ApiError) && !(e instanceof TypeError)) throw e;
      return { ...base, error: String(e.message ?? e) };
    }
  });
  const out = join(dirname(snapshotPath), 'jev-deferred.json');
  writeFileSync(out, JSON.stringify({ model: MODEL, thresholds: THRESHOLDS, results }, null, 2));
  for (const r of results) {
    if (r.error) console.log(`${r.id} ERROR ${r.error}`);
    else if (r.met === undefined) console.log(`${r.id} ${r.decision}`);
    else console.log(`${r.id} on_topic=${pct(r.on_topic)} met=${pct(r.met)} -> ${r.decision}`);
  }
  console.log(`-> ${out}`);
  if (results.some((r) => r.error)) process.exitCode = 1;
}

const args = process.argv.slice(2);
const usage =
  'usage: jev-rank.mjs <scratch>/backlog.json [--no-dups] [--exclude <id>,<id>]\n       jev-rank.mjs deferred <scratch>/backlog.json <scratch>/evidence.json [--exclude <id>,<id>]';
if (!args.length || (args[0] === 'deferred' && args.length < 3)) {
  console.error(usage);
  process.exit(2);
}
// The key goes over HTTPS only; plain HTTP is allowed to a local mock, which gets a
// dummy key (LOCAL_MOCK above), and nowhere else.
{
  if (new URL(API_URL).protocol !== 'https:' && !LOCAL_MOCK) {
    console.error(`TYPESAFE_API_URL must be https (or http to localhost for a mock): ${API_URL}`);
    process.exit(2);
  }
}
if (!KEY) {
  console.error('TYPESAFE_API_KEY is not set: do this step by hand, as SKILL.md says.');
  process.exit(3);
}
if (args[0] === 'deferred') await deferred(args[1], args[2], args.slice(3));
else await rank(args[0], args.slice(1));
