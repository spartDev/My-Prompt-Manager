/**
 * Claude Code PreToolUse hook for Bash, registered in .claude/settings.json.
 * `bd update <id> --notes` replaces a ticket's notes, so the hook blocks it and points to `--append-notes`.
 * It reads the tool call as JSON on stdin and exits 2 to block; any other input lets the call through.
 * It catches the ways an agent writes the command, not deliberate evasion: a script file, a command held in a
 * variable, or text decoded at run time still get through.
 */
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

const REASON = "Blocked: 'bd update --notes' replaces the ticket's existing notes. Run the same command with --append-notes to add your note.";

const COMMAND_SEPARATORS = ';&|\n()';
/** Words that come before the program of a simple command: shell control words and command runners. */
const COMMAND_PREFIXES = new Set(['!', '{', 'if', 'then', 'else', 'elif', 'while', 'until', 'do', 'env', 'command', 'exec', 'nohup', 'time']);
const SHELLS = new Set(['sh', 'bash', 'zsh']);
const ENV_ASSIGNMENT = /^[A-Za-z_][A-Za-z0-9_]*=/;
/** A redirection word: `>/dev/null`, `2>&1`, `&>log`, `<input`. */
const REDIRECTION = /^(?:\d+|&)?[<>]/;
/** A redirection whose target is the next word: `>`, `2>`, `&>>`. */
const REDIRECTION_OPERATOR = /^(?:\d+|&)?(?:<|>|>>|<>|>&|<&|>\||<<<)$/;
const SCRIPT_FLAG = /^-[a-z]*c[a-z]*$/;
const PRINTERS = new Set(['echo', 'printf']);

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

/** Reads the bodies of the heredocs opened on the line that ends at `start`; returns them and the index after the last. */
function readHeredocBodies(line, start, heredocs) {
  let position = start;
  const bodies = heredocs.map(({ delimiter, quoted, stripTabs }) => {
    let text = '';
    while (position < line.length) {
      const newline = line.indexOf('\n', position);
      const end = newline === -1 ? line.length : newline;
      const bodyLine = line.slice(position, end);
      position = end + 1;
      if ((stripTabs ? bodyLine.replace(/^\t+/, '') : bodyLine) === delimiter) {
        break;
      }
      text += `${bodyLine}\n`;
    }
    return { text, quoted };
  });
  return { bodies, end: position };
}

const basename = (word) => word.split('/').pop();

/** The words of a simple command without its redirections and their targets. */
function withoutRedirections(words) {
  const kept = [];
  for (let i = 0; i < words.length; i++) {
    if (REDIRECTION_OPERATOR.test(words[i])) {
      i++;
    } else if (!REDIRECTION.test(words[i])) {
      kept.push(words[i]);
    }
  }
  return kept;
}

/** True when a simple command only prints its words (`echo`, `printf`), so a `bd` among them is text, not a program. */
function onlyPrints(words) {
  const program = words.find((w) => !ENV_ASSIGNMENT.test(w) && !COMMAND_PREFIXES.has(w));
  return program !== undefined && PRINTERS.has(basename(program));
}

/**
 * True when a simple command runs a shell without `-c`, so the shell may read a script on stdin: `bash`,
 * `bash -o pipefail`, `sh -s`. A shell given a script file counts too: the file may read stdin.
 */
function readsScriptFromStdin(words) {
  const args = withoutRedirections(words);
  return !onlyPrints(args) && args.some((word, i) => SHELLS.has(basename(word)) && !args.slice(i + 1).some((w) => SCRIPT_FLAG.test(w)));
}

/**
 * Splits a shell command line into simple commands, each a list of words. A quoted string stays inside one word,
 * so a flag named in a message is not a flag; the commands of `$(…)` and backtick substitutions, which run even
 * inside double quotes, are added as commands of their own, and so is text a shell reads on stdin (a heredoc body,
 * `echo '…' | bash`); comments and other quoted heredoc bodies are skipped.
 */
function splitCommands(line) {
  const commands = [];
  let words = [];
  let word = '';
  let inWord = false;
  let quote = null;
  let heredocs = [];
  let pendingBodies = [];
  let lineStart = 0;
  let lineTextStart = 0;

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
  /**
   * Ends the line whose heredoc bodies start at `start`; returns the index after the bodies. A pipeline that
   * continues (`|`, `|&`, `&&`) keeps the bodies until it ends, since its shell may come after them. Text a shell reads on
   * stdin runs as commands, quoted or not; an unquoted body otherwise runs only its substitutions.
   */
  const endLine = (start, continues) => {
    const { bodies, end } = readHeredocBodies(line, start, heredocs);
    heredocs = [];
    pendingBodies.push(...bodies);
    if (continues) {
      return end;
    }
    const lineCommands = commands.slice(lineStart);
    const feedsShell = lineCommands.some(readsScriptFromStdin);
    const texts = feedsShell ? [...lineCommands.flat().filter((w) => /\s/.test(w)), ...pendingBodies.map((b) => b.text)] : [];
    for (const text of texts) {
      commands.push(...splitCommands(text));
    }
    for (const body of feedsShell ? [] : pendingBodies.filter((b) => !b.quoted)) {
      commands.push(...substitutedCommands(body.text));
    }
    pendingBodies = [];
    lineStart = commands.length;
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
    } else if (line.startsWith('<<<', i)) {
      // a here-string: its text is the next word, scanned like any text a shell reads on stdin
      endWord();
      words.push('<<<');
      i += 2;
    } else if (line.startsWith('<<', i)) {
      endWord();
      const { heredoc, end } = readHeredoc(line, i + 2);
      heredocs.push(heredoc);
      i = end - 1;
    } else if (char === '&' && (/[<>]$/.test(word) || (!inWord && line[i + 1] === '>'))) {
      // `2>&1` and `&>log` are redirections, not the `&` that ends a command
      word += char;
      inWord = true;
    } else if (char === ' ' || char === '\t') {
      endWord();
    } else if (COMMAND_SEPARATORS.includes(char)) {
      endCommand();
      if (char === '\n') {
        const continues = /(?:\||\|&|&&)$/.test(line.slice(lineTextStart, i).trimEnd());
        lineTextStart = endLine(i + 1, continues);
        i = lineTextStart - 1;
      }
    } else {
      word += char;
      inWord = true;
    }
  }
  endCommand();
  endLine(line.length, false);
  return commands;
}

/**
 * True when a simple command runs `bd update` with `--notes`, whatever runs it (`env -i`, `time -p`, `xargs`,
 * `find -exec`), or through `eval` or `sh -c`. The `bd` word is looked for anywhere rather than as the program, so
 * a runner's options never hide it; only a command that prints its words is left out.
 */
function updatesNotes(words) {
  const args = withoutRedirections(words);
  if (onlyPrints(args)) {
    return false;
  }
  return args.some((word, i) => {
    const name = basename(word);
    const rest = args.slice(i + 1);
    if (name === 'eval') {
      return replacesNotes(rest.join(' '));
    }
    if (SHELLS.has(name)) {
      const script = rest.findIndex((w) => SCRIPT_FLAG.test(w));
      return script !== -1 && script + 1 < rest.length && replacesNotes(rest[script + 1]);
    }
    const subcommand = rest.find((w) => !w.startsWith('-'));
    return name === 'bd' && subcommand === 'update' && rest.some((w) => w === '--notes' || w.startsWith('--notes='));
  });
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
