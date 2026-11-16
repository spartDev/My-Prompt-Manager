#!/usr/bin/env node
// Asks Jev (TypeSafe System One) the judgments a triage needs about the tickets of a
// `bd list --json` snapshot, and turns the answers into decisions in code.
//
// Jev judges; this file decides. Every question, criterion, area, weight and threshold
// is in the blocks at the top, so a reviewer edits one place.
//
//   node jev-rank.mjs <scratch>/backlog.json [--no-dups]
//       Step 2 (rank, flag, acceptance check, duplicates) and step 4 (code areas).
//       Writes <scratch>/jev.json.
//   node jev-rank.mjs deferred <scratch>/backlog.json <scratch>/evidence.json
//       Step 3: does the evidence show a deferred ticket's condition now holds?
//       evidence.json is {"<id>": "<the command run and its output>"}.
//       Writes <scratch>/jev-deferred.json.
//
// Needs TYPESAFE_API_KEY. TYPESAFE_API_URL and TYPESAFE_MODEL override the endpoint
// and the model (default jev-latest). Exit 3: no key. Exit 1: a request failed.

import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

const API_URL = process.env.TYPESAFE_API_URL ?? 'https://api.typesafe.ai/v1/systemone';
const MODEL = process.env.TYPESAFE_MODEL ?? 'jev-latest';
const KEY = process.env.TYPESAFE_API_KEY;

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
const DUPLICATE_BATCH = 60; // pairs per request: ~60 x 300 tokens, inside the 64k context

// ---------------------------------------------------------------------------

class ApiError extends Error {}

async function ask(state, questions) {
  const payload = { model: MODEL, state, questions };
  for (let attempt = 0; ; attempt++) {
    const res = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${KEY}` },
      body: JSON.stringify(payload),
    });
    if (res.status === 429 && attempt < 3) {
      const wait = Number(res.headers.get('retry-after')) || 2 ** attempt;
      await new Promise((r) => setTimeout(r, wait * 1000));
      continue;
    }
    if (!res.ok) {
      // A failed call is an error, never an answer.
      throw new ApiError(`HTTP ${res.status}: ${(await res.text()).slice(0, 300)}`);
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

async function rank(snapshotPath, opts) {
  const all = JSON.parse(readFileSync(snapshotPath, 'utf8'));
  // An epic is ranked and placed by its children, not judged on its own.
  const tickets = all.filter((t) => t.issue_type !== 'epic');

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

  // Every pair is asked, whatever its issue_type, in requests of at most
  // DUPLICATE_BATCH pairs so each stays well inside the model's context. A failed
  // batch is reported with the pairs it held, never read as "no duplicate".
  let duplicates = [];
  if (!opts.includes('--no-dups')) {
    const pairs = [];
    for (let i = 0; i < tickets.length; i++) {
      for (let j = i + 1; j < tickets.length; j++) pairs.push([tickets[i], tickets[j]]);
    }
    const brief = (t) => ({ title: t.title, description: (t.description ?? '').slice(0, 600) });
    const batches = [];
    for (let s = 0; s < pairs.length; s += DUPLICATE_BATCH) batches.push(pairs.slice(s, s + DUPLICATE_BATCH));
    const answered = await pool(batches, async (batch) => {
      const questions = Object.fromEntries(
        batch.map(([a, b], k) => [
          `pair_${k}`,
          {
            type: 'noul',
            instructions: { task: 'Do `first` and `second` ask for the same change?', first: brief(a), second: brief(b) },
            criteria: DUPLICATE_CRITERIA,
          },
        ])
      );
      try {
        const { response } = await ask({ project: PROJECT }, questions);
        return batch.map(([a, b], k) => ({ a: a.id, b: b.id, p: response.answers[`pair_${k}`].noul }));
      } catch (e) {
        if (!(e instanceof ApiError) && !(e instanceof TypeError)) throw e;
        return [{ error: `${String(e.message ?? e)} (${batch.length} pairs not checked, from ${batch[0][0].id} ~ ${batch[0][1].id})` }];
      }
    });
    duplicates = answered
      .flat()
      .filter((d) => d.error || d.p > THRESHOLDS.no)
      .sort((x, y) => (y.error ? 2 : y.p) - (x.error ? 2 : x.p));
  }


  // Policy before weights: a ticket users would notice (user_visible not read as 'no')
  // ranks above every ticket they would not, whatever the weighted values say.
  const tier = (r) => (r.error ? -1 : noulReading(r.vis) === 'no' ? 0 : 1);
  const ranked = [...results].sort((x, y) => tier(y) - tier(x) || (y.value ?? -1) - (x.value ?? -1));

  // An epic is not judged on its own: it takes the best suggestion and the areas of its
  // live children (ids "<epic>.<n>" in the snapshot), so the report and step 4 keep it.
  const epics = all
    .filter((t) => t.issue_type === 'epic')
    .map((e) => {
      const children = results.filter((r) => r.id.startsWith(`${e.id}.`));
      const judged = children.filter((c) => !c.error);
      const areas = [...new Set(judged.flatMap((c) => (noulReading(c.changes_files) === 'no' ? [] : c.areas.yes)))];
      return {
        id: e.id,
        priority: e.priority,
        status: e.status,
        title: e.title,
        children: children.map((c) => c.id),
        suggested: judged.length ? Math.min(...judged.map((c) => c.suggested)) : null,
        areas,
      };
    });
  const out = join(dirname(snapshotPath), 'jev.json');
  const areaPaths = Object.fromEntries(Object.entries(AREAS).map(([n, a]) => [n, a.paths]));
  writeFileSync(out, JSON.stringify({ model: MODEL, weights: WEIGHTS, thresholds: THRESHOLDS, areas: areaPaths, ranked, epics, duplicates }, null, 2));

  for (const r of ranked) {
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
        : `EPIC ${e.id} P${e.priority}->P${e.suggested} (best child) children ${e.children.join(', ')} | areas ${e.areas.join(', ') || 'no files'}`
    );
  }
  for (const d of duplicates) {
    console.log(d.error ? `DUPLICATES ERROR ${d.error}` : `DUPLICATE? ${d.a} ~ ${d.b} p=${pct(d.p)} (${noulReading(d.p)})`);
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
  if (ranked.some((r) => r.error) || duplicates.some((d) => d.error)) process.exitCode = 1;
}

async function deferred(snapshotPath, evidencePath) {
  const all = JSON.parse(readFileSync(snapshotPath, 'utf8'));
  const evidence = JSON.parse(readFileSync(evidencePath, 'utf8'));
  const tickets = all.filter((t) => t.status === 'deferred');
  const results = await pool(tickets, async (t) => {
    const base = { id: t.id, title: t.title };
    if (!evidence[t.id]) return { ...base, decision: 'no evidence fetched: open it by hand' };
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
  'usage: jev-rank.mjs <scratch>/backlog.json [--no-dups]\n       jev-rank.mjs deferred <scratch>/backlog.json <scratch>/evidence.json';
if (!args.length || (args[0] === 'deferred' && args.length < 3)) {
  console.error(usage);
  process.exit(2);
}
// The key goes over HTTPS only; plain HTTP is allowed to a local mock and nowhere else.
{
  const u = new URL(API_URL);
  const local = ['localhost', '127.0.0.1', '[::1]'].includes(u.hostname);
  if (u.protocol !== 'https:' && !(u.protocol === 'http:' && local)) {
    console.error(`TYPESAFE_API_URL must be https (or http to localhost for a mock): ${API_URL}`);
    process.exit(2);
  }
}
if (!KEY) {
  console.error('TYPESAFE_API_KEY is not set: do this step by hand, as SKILL.md says.');
  process.exit(3);
}
if (args[0] === 'deferred') await deferred(args[1], args[2]);
else await rank(args[0], args.slice(1));
