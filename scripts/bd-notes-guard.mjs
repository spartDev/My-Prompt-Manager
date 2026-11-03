/**
 * Claude Code PreToolUse hook for Bash, registered in .claude/settings.json.
 * `bd update <id> --notes` replaces a ticket's notes, so the hook blocks it and points to `--append-notes`.
 * It reads the tool call as JSON on stdin and exits 2 to block; any other input lets the call through.
 */
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

const REASON = "Blocked: 'bd update --notes' replaces the ticket's existing notes. Run the same command with --append-notes to add your note.";

const COMMAND_SEPARATORS = ';&|\n()';
/** Words that come before the program of a simple command: shell control words and command runners. */
const COMMAND_PREFIXES = new Set(['!', '{', 'if', 'then', 'else', 'elif', 'while', 'until', 'do', 'env', 'command', 'exec', 'nohup', 'time']);
const SHELLS = new Set(['sh', 'bash', 'zsh']);
const ENV_ASSIGNMENT = /^[A-Za-z_][A-Za-z0-9_]*=/;

/** Index of the `)` closing a `$(` whose contents start at `start`, honouring nested parentheses and quotes. */
function closingParen(line, start) {
  let depth = 1;
  let quote = null;
  for (let i = start; i < line.length; i++) {
    const char = line[i];
    if (quote) {
      if (char === quote) {
        quote = null;
      } else if (char === '\\' && quote === '"') {
        i++;
      }
    } else if (char === '\\') {
      i++;
    } else if (char === "'" || char === '"') {
      quote = char;
    } else if (char === '(') {
      depth++;
    } else if (char === ')' && --depth === 0) {
      return i;
    }
  }
  return line.length;
}

/** Index of the backtick closing a substitution whose contents start at `start`. */
function closingBacktick(line, start) {
  for (let i = start; i < line.length; i++) {
    if (line[i] === '\\') {
      i++;
    } else if (line[i] === '`') {
      return i;
    }
  }
  return line.length;
}

/** The commands that `$(…)` and backtick substitutions run inside text Bash expands, such as an unquoted heredoc body. */
function substitutedCommands(text) {
  const commands = [];
  for (let i = 0; i < text.length; i++) {
    if (text[i] === '\\') {
      i++;
    } else if (text[i] === '$' && text[i + 1] === '(') {
      const end = closingParen(text, i + 2);
      commands.push(...splitCommands(text.slice(i + 2, end)));
      i = end;
    } else if (text[i] === '`') {
      const end = closingBacktick(text, i + 1);
      commands.push(...splitCommands(text.slice(i + 1, end)));
      i = end;
    }
  }
  return commands;
}

/**
 * Reads the heredoc operator that starts after `<<` at `start`: its delimiter, whether the body is expanded
 * (unquoted delimiter) and whether leading tabs are stripped (`<<-`). Returns the index after the delimiter.
 */
function readHeredoc(line, start) {
  let i = start;
  const stripTabs = line[i] === '-';
  if (stripTabs) {
    i++;
  }
  while (line[i] === ' ' || line[i] === '\t') {
    i++;
  }
  let delimiter = '';
  let quoted = false;
  while (i < line.length && !/[\s;&|()<>]/.test(line[i])) {
    if (line[i] === "'" || line[i] === '"' || line[i] === '\\') {
      quoted = true;
    } else {
      delimiter += line[i];
    }
    i++;
  }
  return { heredoc: { delimiter, quoted, stripTabs }, end: i };
}

/** Skips the bodies of the heredocs opened on the line that ends at `start`; returns the index after the last body. */
function skipHeredocBodies(line, start, heredocs, commands) {
  let position = start;
  for (const { delimiter, quoted, stripTabs } of heredocs) {
    let body = '';
    while (position < line.length) {
      const newline = line.indexOf('\n', position);
      const end = newline === -1 ? line.length : newline;
      const text = line.slice(position, end);
      position = end + 1;
      if ((stripTabs ? text.replace(/^\t+/, '') : text) === delimiter) {
        break;
      }
      body += `${text}\n`;
    }
    if (!quoted) {
      commands.push(...substitutedCommands(body));
    }
  }
  return position;
}

/**
 * Splits a shell command line into simple commands, each a list of words. A quoted string stays inside one word,
 * so a flag named in a message is not a flag; the commands of `$(…)` and backtick substitutions, which run even
 * inside double quotes, are added as commands of their own; comments and quoted heredoc bodies are skipped.
 */
function splitCommands(line) {
  const commands = [];
  let words = [];
  let word = '';
  let inWord = false;
  let quote = null;
  let heredocs = [];

  const endWord = () => {
    if (inWord) {
      words.push(word);
    }
    word = '';
    inWord = false;
  };
  const endCommand = () => {
    endWord();
    if (words.length > 0) {
      commands.push(words);
    }
    words = [];
  };
  /** Adds the commands of the substitution opening at `i` and returns the index of its closing character. */
  const substitution = (i) => {
    const backtick = line[i] === '`';
    const start = backtick ? i + 1 : i + 2;
    const end = backtick ? closingBacktick(line, start) : closingParen(line, start);
    commands.push(...splitCommands(line.slice(start, end)));
    word += line.slice(i, end + 1);
    inWord = true;
    return end;
  };

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    const opensSubstitution = char === '`' || (char === '$' && line[i + 1] === '(');
    if (quote === "'") {
      if (char === quote) {
        quote = null;
      } else {
        word += char;
      }
    } else if (quote === '"') {
      if (char === quote) {
        quote = null;
      } else if (opensSubstitution) {
        i = substitution(i);
      } else if (char === '\\' && i + 1 < line.length) {
        word += line[++i];
      } else {
        word += char;
      }
    } else if (opensSubstitution) {
      i = substitution(i);
    } else if (char === "'" || char === '"') {
      quote = char;
      inWord = true;
    } else if (char === '\\' && i + 1 < line.length) {
      word += line[++i];
      inWord = true;
    } else if (char === '#' && !inWord) {
      while (i + 1 < line.length && line[i + 1] !== '\n') {
        i++;
      }
    } else if (char === '<' && line[i + 1] === '<' && line[i + 2] !== '<') {
      endWord();
      const { heredoc, end } = readHeredoc(line, i + 2);
      heredocs.push(heredoc);
      i = end - 1;
    } else if (char === ' ' || char === '\t') {
      endWord();
    } else if (COMMAND_SEPARATORS.includes(char)) {
      endCommand();
      if (char === '\n' && heredocs.length > 0) {
        i = skipHeredocBodies(line, i + 1, heredocs, commands) - 1;
        heredocs = [];
      }
    } else {
      word += char;
      inWord = true;
    }
  }
  endCommand();
  return commands;
}

/** True when a simple command runs `bd update` with `--notes`, directly or through `eval` or `sh -c`. */
function updatesNotes(words) {
  let program = 0;
  while (program < words.length && (ENV_ASSIGNMENT.test(words[program]) || COMMAND_PREFIXES.has(words[program]))) {
    program++;
  }
  if (program === words.length) {
    return false;
  }
  const name = words[program].split('/').pop();
  const args = words.slice(program + 1);

  if (name === 'eval') {
    return replacesNotes(args.join(' '));
  }
  if (SHELLS.has(name)) {
    const script = args.findIndex((w) => /^-[a-z]*c[a-z]*$/.test(w));
    return script !== -1 && script + 1 < args.length && replacesNotes(args[script + 1]);
  }
  if (name !== 'bd') {
    return false;
  }
  const subcommand = args.find((w) => !w.startsWith('-'));
  return subcommand === 'update' && args.some((w) => w === '--notes' || w.startsWith('--notes='));
}

/** True when any command the line runs is `bd update` with `--notes`. */
export function replacesNotes(line) {
  return splitCommands(line).some(updatesNotes);
}

function main() {
  let call;
  try {
    call = JSON.parse(readFileSync(0, 'utf8'));
  } catch {
    return 0;
  }
  const command = call?.tool_input?.command;
  if (typeof command !== 'string' || !replacesNotes(command)) {
    return 0;
  }

  process.stderr.write(`${REASON}\n`);
  return 2;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exitCode = main();
}
