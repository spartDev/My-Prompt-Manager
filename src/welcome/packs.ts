import type { PromptPack } from './types';

/**
 * The Packs the Welcome's last step offers: ready-made Prompts a new user can copy and use at once.
 * Each Pack becomes a Category of the same name and color when it is added.
 *
 * How the text is written, so that every Prompt works as it is:
 * - the title says what the Prompt produces, short enough to show whole on a Prompt card;
 * - the content says who the AI should act as, the task, and the shape of the answer;
 * - the details that change each time are Variables ({{snake_case}}), short enough for the
 *   one-line fields of the fill-in form at Insertion;
 * - text the user pastes (code, notes, a draft) goes after the last line, a label such as
 *   "Code:", never into a Variable: a one-line field turns the line breaks of pasted code into
 *   spaces;
 * - plain ASCII, so the text arrives in the chat exactly as written (Verbatim).
 */

/** The lines of a Prompt's content, joined by line breaks */
const text = (...lines: readonly string[]): string => lines.join('\n');

export const PACKS: readonly PromptPack[] = [
  {
    id: 'product',
    name: 'Product',
    color: '#2563EB',
    defaultSelected: true,
    prompts: [
      {
        title: 'PRD from a rough idea',
        content: text(
          'Act as a senior product manager. Turn this rough idea into a one-page product requirements document.',
          '',
          'Idea: {{idea}}',
          'Target users: {{target_users}}',
          '',
          'Cover the problem, goals and non-goals, user stories with acceptance criteria, success metrics and open questions. Use short headings.'
        )
      },
      {
        title: 'User stories for a feature',
        content: text(
          'Act as a product owner. Split this feature into user stories that each fit in one sprint.',
          '',
          'Feature: {{feature}}',
          'Main user: {{user_type}}',
          '',
          'For each story, write "As a ..., I want ..., so that ..." and three to five acceptance criteria in Given/When/Then form. Flag any story that is still too big and say how to split it.'
        )
      },
      {
        title: 'Backlog ranked with RICE',
        content: text(
          'Act as a product manager preparing a planning meeting. Score each backlog item below with RICE (reach, impact, confidence, effort), with this goal in mind: {{goal}}',
          '',
          'Return a table sorted by score, with one line explaining each score, and mark the numbers you had to guess. Then list the items that need more information before they can be ranked, and what is missing.',
          '',
          'Backlog items:'
        )
      },
      {
        title: 'Themes from customer feedback',
        content: text(
          'Act as a user researcher. Group the customer feedback below about {{product_name}} into themes.',
          '',
          'For each theme, give a short name, how many pieces of feedback mention it, two quotes that show it and the need behind it. End with the three themes most worth acting on, and why.',
          '',
          'Feedback:'
        )
      },
      {
        title: 'Competitor teardown',
        content: text(
          'Act as a product strategist. Analyze {{competitor}} as a competitor of {{product_name}}.',
          '',
          'Cover their positioning, target customers, pricing, onboarding and the three features their users praise most. Finish with what we should copy, what we should avoid and one way we can stand out. Mark anything you are not sure about.'
        )
      }
    ]
  },
  {
    id: 'engineering',
    name: 'Engineering',
    color: '#4D7C0F',
    defaultSelected: false,
    prompts: [
      {
        title: 'Code review with fixes',
        content: text(
          'Act as a senior engineer reviewing a pull request. Review the code below for bugs, security issues, readability and performance.',
          '',
          'What the code should do: {{purpose}}',
          '',
          'List the findings from most to least serious, each with where it is, why it matters and a corrected snippet. Say what is done well too, and do not rewrite the whole file.',
          '',
          'Code:'
        )
      },
      {
        title: 'Causes and fixes for an error',
        content: text(
          'Help me debug an error in a {{language}} project that uses {{framework}}.',
          '',
          'What I expected: {{expected_behavior}}',
          '',
          'List the most likely causes, from most to least likely, and for each one a quick way to check it and a fix. If you need to see more code, ask for it instead of guessing.',
          '',
          'Error message and stack trace:'
        )
      },
      {
        title: 'Unit tests for existing code',
        content: text(
          'Write unit tests with {{test_framework}} for the code below.',
          '',
          'Cover the normal cases, the edge cases (empty input, limits, invalid values) and the errors it should raise. Name each test after what it checks. If a behavior looks like a bug, point it out instead of writing a test that accepts it.',
          '',
          'Code:'
        )
      },
      {
        title: 'Explanation of unfamiliar code',
        content: text(
          'Explain the code below to {{audience}}.',
          '',
          'Start with what it does in two sentences. Then walk through it step by step, point out anything surprising or risky, and end with the questions worth asking its author.',
          '',
          'Code:'
        )
      },
      {
        title: 'PR description from a diff',
        content: text(
          'Write a pull request description for the diff below.',
          '',
          'Why we make this change: {{reason}}',
          '',
          'Use these sections: Summary (what changes and why, in two sentences), Changes (bullet points), How to test (numbered steps) and Risks. Describe only what the diff shows.',
          '',
          'Diff:'
        )
      },
      {
        title: 'SQL query from a question',
        content: text(
          'Write a {{database}} query that answers this question: {{question}}',
          '',
          'Explain the query in a few lines, state your assumptions about the data, and point out anything that could make it slow on large tables.',
          '',
          'Tables and columns:'
        )
      }
    ]
  },
  {
    id: 'writing',
    name: 'Writing',
    color: '#9333EA',
    defaultSelected: true,
    prompts: [
      {
        title: 'Follow-up email after a meeting',
        content: text(
          'Write a follow-up email to {{recipient}} after our meeting about {{topic}}.',
          '',
          'What we agreed: {{agreed_points}}',
          '',
          'Thank them in one sentence, recap what we agreed in two or three bullet points, and end with one clear next step and a date. Keep it under 120 words, warm and professional, and suggest a subject line.'
        )
      },
      {
        title: 'Clearer, shorter rewrite',
        content: text(
          'Act as a sharp editor. Rewrite the text below so it is clearer and shorter for {{audience}}, without changing its meaning.',
          '',
          'Keep my voice, cut filler and jargon, and prefer short sentences and active verbs. Give the rewritten text first, then the three most important changes you made.',
          '',
          'Text:'
        )
      },
      {
        title: 'Action items from meeting notes',
        content: text(
          'Turn the raw meeting notes below into a summary for the people who missed the meeting.',
          '',
          'Write a three-line summary, the decisions made, the action items as a table (task, owner, due date) and the open questions. Do not invent owners or dates: write "not decided" when the notes do not say.',
          '',
          'Notes:'
        )
      },
      {
        title: 'Polite reply that says no',
        content: text(
          'Write a short, polite reply to {{person}} that says no to this request: {{request}}',
          '',
          'Give one honest reason, offer an alternative if there is a reasonable one, and keep the relationship warm. Stay under 100 words and do not over-apologize.'
        )
      }
    ]
  },
  {
    id: 'hiring',
    name: 'Hiring',
    color: '#DB2777',
    defaultSelected: false,
    prompts: [
      {
        title: 'Job description for a role',
        content: text(
          'Write a job description for a {{level}} {{role}} joining {{team}}.',
          '',
          'Include a two-line pitch for the role, what they will achieve in the first six months, up to five must-have and five nice-to-have skills, and what we offer. Use plain, inclusive language without buzzwords, and keep it under 400 words.'
        )
      },
      {
        title: 'Interview questions and scorecard',
        content: text(
          'Act as an experienced hiring manager. Prepare a structured interview for a {{level}} {{role}}.',
          '',
          'Write six questions: four about past experience and two built on a realistic problem from the job. For each, say what a strong answer shows and give a scoring guide from 1 to 4. End with a short scorecard the interviewers can fill in.'
        )
      },
      {
        title: 'Kind rejection email to a candidate',
        content: text(
          'Write a kind email telling {{candidate_name}} that we will not move forward with their application for the {{role}} role.',
          '',
          'Feedback to share: {{feedback}}',
          '',
          'Thank them for their time, turn the feedback into one or two specific and respectful sentences, and wish them well. Keep it under 120 words.'
        )
      }
    ]
  }
];
