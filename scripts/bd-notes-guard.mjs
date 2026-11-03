/**
 * Claude Code PreToolUse hook for Bash, registered in .claude/settings.json.
 * `bd update <id> --notes` replaces a ticket's notes, so the hook blocks it and points to `--append-notes`.
 * It reads the tool call as JSON on stdin and exits 2 to block; any other input lets the call through.
 */
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

const REASON = "Blocked: 'bd update --notes' replaces the ticket's existing notes. Run the same command with --append-notes to add your note.";

const COMMAND_SEPARATORS = ';&|\n()';
const COMMAND_PREFIXES = new Set(['env', 'command', 'exec', 'nohup', 'time']);
const ENV_ASSIGNMENT = /^[A-Za-z_][A-Za-z0-9_]*=/;

/**
 * Splits a shell command line into simple commands, each a list of words.
 * A quoted string stays inside one word, so a flag named in a message or a description is not a flag.
 */
function splitCommands(line) {
  const commands = [];
  let words = [];
  let word = '';
  let inWord = false;
  let quote = null;

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

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (quote) {
      if (char === quote) {
        quote = null;
      } else if (char === '\\' && quote === '"' && i + 1 < line.length) {
        word += line[++i];
      } else {
        word += char;
      }
    } else if (char === "'" || char === '"') {
      quote = char;
      inWord = true;
    } else if (char === '\\' && i + 1 < line.length) {
      word += line[++i];
      inWord = true;
    } else if (char === ' ' || char === '\t') {
      endWord();
    } else if (COMMAND_SEPARATORS.includes(char)) {
      endCommand();
    } else {
      word += char;
      inWord = true;
    }
  }
  endCommand();
  return commands;
}

/** True when a word of the command line runs `bd update` with `--notes`. */
export function replacesNotes(line) {
  return splitCommands(line).some((words) => {
    const program = words.findIndex((w) => !ENV_ASSIGNMENT.test(w) && !COMMAND_PREFIXES.has(w));
    if (program === -1 || !(words[program] === 'bd' || words[program].endsWith('/bd'))) {
      return false;
    }

    const args = words.slice(program + 1);
    const subcommand = args.find((w) => !w.startsWith('-'));
    return subcommand === 'update' && args.some((w) => w === '--notes' || w.startsWith('--notes='));
  });
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
