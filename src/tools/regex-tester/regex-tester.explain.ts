import type { OsCommand } from '@/components/OsCommandTabs.vue';
import { quotePosix, quotePowerShell } from '@/utils/shell-quote';

export interface RegexToken {
  token: string;
  explain: string;
}

const escapes: Record<string, string> = {
  d: 'a digit (0-9)',
  D: 'any character except a digit',
  w: 'a word character (letter, digit or _)',
  W: 'any character except a word character',
  s: 'whitespace (space, tab, newline…)',
  S: 'any character except whitespace',
  b: 'a word boundary (between a word character and something else)',
  B: 'not a word boundary',
  n: 'a newline',
  r: 'a carriage return',
  t: 'a tab',
  f: 'a form feed',
  v: 'a vertical tab',
  0: 'a NUL character',
};

function describeQuantifier(quantifier: string): string {
  const lazy = quantifier.length > 1 && quantifier.endsWith('?');
  const base = lazy ? quantifier.slice(0, -1) : quantifier;
  let text: string;
  if (base === '*') {
    text = 'zero or more times';
  } else if (base === '+') {
    text = 'one or more times';
  } else if (base === '?') {
    text = 'optional (zero or one time)';
  } else {
    const [, min, comma, max] = /^\{(\d*)(,?)(\d*)\}$/.exec(base) ?? [];
    if (!comma) {
      text = `exactly ${min} times`;
    } else if (max === '') {
      text = `${min} or more times`;
    } else {
      text = `between ${min || 0} and ${max} times`;
    }
  }
  return `…the previous item, ${text}${lazy ? ', as few as possible (lazy)' : ', as many as possible'}`;
}

function describeClass(body: string): string {
  const negated = body.startsWith('^');
  const inner = negated ? body.slice(1) : body;
  const parts: string[] = [];
  for (let i = 0; i < inner.length; i++) {
    if (inner[i] === '\\' && i + 1 < inner.length) {
      parts.push(escapes[inner[i + 1]] ?? `"${inner[i + 1]}"`);
      i++;
    } else if (inner[i + 1] === '-' && i + 2 < inner.length) {
      parts.push(`${inner[i]} to ${inner[i + 2]}`);
      i += 2;
    } else {
      parts.push(`"${inner[i]}"`);
    }
  }
  return `${negated ? 'one character that is NOT' : 'one character:'} ${parts.join(', ')}`;
}

// Walk the pattern once and describe each piece. Covers JavaScript syntax; anything it
// does not recognise is shown as a literal.
export function explainRegex(pattern: string): RegexToken[] {
  const tokens: RegexToken[] = [];
  let groupNumber = 0;
  let literal = '';
  const flushLiteral = () => {
    if (literal) {
      tokens.push({ token: literal, explain: `the text "${literal}"` });
      literal = '';
    }
  };
  const push = (token: string, explain: string) => {
    flushLiteral();
    tokens.push({ token, explain });
  };

  for (let i = 0; i < pattern.length; i++) {
    const char = pattern[i];
    const rest = pattern.slice(i);

    const quantifier = /^(?:[*+?]|\{\d+(?:,\d*)?\})\??/.exec(rest);
    if (quantifier && (tokens.length > 0 || literal)) {
      // A quantifier applies to the last character of a run of literal text only.
      if (literal.length > 1) {
        const last = literal.slice(-1);
        literal = literal.slice(0, -1);
        flushLiteral();
        literal = last;
      }
      flushLiteral();
      tokens.push({ token: quantifier[0], explain: describeQuantifier(quantifier[0]) });
      i += quantifier[0].length - 1;
      continue;
    }

    if (char === '\\' && i + 1 < pattern.length) {
      const next = pattern[i + 1];
      const unicode = /^\\[pP]\{[^}]+\}/.exec(rest);
      const hex = /^\\(?:x[0-9a-fA-F]{2}|u[0-9a-fA-F]{4}|u\{[0-9a-fA-F]+\})/.exec(rest);
      const namedRef = /^\\k<([^>]+)>/.exec(rest);
      if (unicode) {
        push(
          unicode[0],
          `${next === 'P' ? 'a character NOT in' : 'a character in'} the Unicode category ${unicode[0].slice(3, -1)}`,
        );
        i += unicode[0].length - 1;
      } else if (hex) {
        push(hex[0], `the character with code ${hex[0].slice(2).replace(/[{}]/g, '')} (hex)`);
        i += hex[0].length - 1;
      } else if (namedRef) {
        push(namedRef[0], `the same text the group "${namedRef[1]}" matched`);
        i += namedRef[0].length - 1;
      } else if (/[1-9]/.test(next)) {
        push(`\\${next}`, `the same text group ${next} matched (backreference)`);
        i++;
      } else if (escapes[next]) {
        push(`\\${next}`, escapes[next]);
        i++;
      } else {
        literal += next;
        i++;
      }
      continue;
    }

    if (char === '[') {
      let end = i + 1;
      if (pattern[end] === '^') {
        end++;
      }
      if (pattern[end] === ']') {
        end++;
      }
      while (end < pattern.length && pattern[end] !== ']') {
        end += pattern[end] === '\\' ? 2 : 1;
      }
      const token = pattern.slice(i, end + 1);
      push(token, describeClass(pattern.slice(i + 1, end)));
      i = end;
      continue;
    }

    if (char === '(') {
      const special = /^\(\?(?::|=|!|<=|<!|<([A-Za-z_]\w*)>)/.exec(rest);
      if (!special) {
        groupNumber++;
        push(
          '(',
          `start of group ${groupNumber} (captured: its text is available as $${groupNumber} / \\${groupNumber})`,
        );
      } else if (special[1]) {
        groupNumber++;
        push(special[0], `start of group ${groupNumber}, named "${special[1]}"`);
      } else {
        const kinds: Record<string, string> = {
          '(?:': 'start of a group that is not captured (just for | or a quantifier)',
          '(?=': 'start of a lookahead: what follows must match this, without consuming it',
          '(?!': 'start of a negative lookahead: what follows must NOT match this',
          '(?<=': 'start of a lookbehind: what comes before must match this',
          '(?<!': 'start of a negative lookbehind: what comes before must NOT match this',
        };
        push(special[0], kinds[special[0]]);
      }
      i += (special?.[0].length ?? 1) - 1;
      continue;
    }

    if (char === ')') {
      push(')', 'end of the group');
    } else if (char === '|') {
      push('|', 'OR: either what is before or what is after');
    } else if (char === '^') {
      push('^', 'start of the text (of each line with the m flag)');
    } else if (char === '$') {
      push('$', 'end of the text (of each line with the m flag)');
    } else if (char === '.') {
      push('.', 'any character except a newline (newlines too with the s flag)');
    } else {
      literal += char;
    }
  }
  flushLiteral();
  return tokens;
}

export interface PaletteItem {
  label: string;
  insert: string;
  explain: string;
}

export const builderPalette: { title: string; items: PaletteItem[] }[] = [
  {
    title: 'Position',
    items: [
      { label: '^', insert: '^', explain: 'Start of the text (or line, with m)' },
      { label: '$', insert: '$', explain: 'End of the text (or line, with m)' },
      { label: '\\b', insert: '\\b', explain: 'Word boundary: match whole words' },
    ],
  },
  {
    title: 'Characters',
    items: [
      { label: '.', insert: '.', explain: 'Any character' },
      { label: '\\d', insert: '\\d', explain: 'A digit' },
      { label: '\\w', insert: '\\w', explain: 'A letter, digit or _' },
      { label: '\\s', insert: '\\s', explain: 'Whitespace' },
      { label: '[abc]', insert: '[abc]', explain: 'One of a, b or c' },
      { label: '[^abc]', insert: '[^abc]', explain: 'Anything except a, b or c' },
      { label: '[a-z]', insert: '[a-z]', explain: 'A lowercase letter' },
      { label: '\\.', insert: '\\.', explain: 'A real dot (escaped)' },
    ],
  },
  {
    title: 'How many',
    items: [
      { label: '*', insert: '*', explain: 'Zero or more of the previous item' },
      { label: '+', insert: '+', explain: 'One or more' },
      { label: '?', insert: '?', explain: 'Optional' },
      { label: '{3}', insert: '{3}', explain: 'Exactly 3' },
      { label: '{2,5}', insert: '{2,5}', explain: 'Between 2 and 5' },
      { label: '*?', insert: '*?', explain: 'Zero or more, as few as possible' },
    ],
  },
  {
    title: 'Groups',
    items: [
      { label: '( )', insert: '(abc)', explain: 'Capture group' },
      { label: '(?: )', insert: '(?:abc)', explain: 'Group without capturing' },
      { label: '(?<name> )', insert: '(?<name>abc)', explain: 'Named group' },
      { label: 'a|b', insert: 'cat|dog', explain: 'Either one' },
      { label: '(?= )', insert: '(?=abc)', explain: 'Followed by' },
      { label: '(?! )', insert: '(?!abc)', explain: 'Not followed by' },
    ],
  },
  {
    title: 'Common patterns',
    items: [
      { label: 'IPv4', insert: '\\b(?:\\d{1,3}\\.){3}\\d{1,3}\\b', explain: 'An IPv4 address (does not check 0-255)' },
      { label: 'Email', insert: '[\\w.+-]+@[\\w-]+(?:\\.[\\w-]+)+', explain: 'A typical email address' },
      { label: 'URL', insert: 'https?://[^\\s/$.?#][^\\s]*', explain: 'An http(s) URL' },
      { label: 'Date', insert: '\\d{4}-\\d{2}-\\d{2}', explain: 'YYYY-MM-DD' },
      { label: 'Time', insert: '\\d{2}:\\d{2}(?::\\d{2})?', explain: 'HH:MM or HH:MM:SS' },
      { label: 'MAC', insert: '(?:[0-9A-Fa-f]{2}[:-]){5}[0-9A-Fa-f]{2}', explain: 'A MAC address' },
      { label: 'UUID', insert: '[0-9a-fA-F]{8}-(?:[0-9a-fA-F]{4}-){3}[0-9a-fA-F]{12}', explain: 'A UUID' },
      { label: 'Log level', insert: '\\b(?:ERROR|WARN|INFO|DEBUG)\\b', explain: 'A log level word' },
      { label: 'Quoted', insert: '"[^"]*"', explain: 'Text in double quotes' },
      { label: 'Blank line', insert: '^\\s*$', explain: 'An empty or whitespace-only line (use the m flag)' },
    ],
  },
];

// grep -E (POSIX extended) has no \d, lookarounds, lazy quantifiers, named groups or \p{}.
export function toPosixExtended(pattern: string): { pattern: string; unsupported: string[] } {
  const unsupported: string[] = [];
  if (/\(\?<?[=!]/.test(pattern)) {
    unsupported.push('lookarounds');
  }
  if (/(?:[*+?}])\?/.test(pattern.replace(/\\./g, ''))) {
    unsupported.push('lazy quantifiers');
  }
  if (/\\[pP]\{|\\k</.test(pattern)) {
    unsupported.push('\\p{…} / \\k<…>');
  }
  const converted = pattern
    .replace(/\(\?<[A-Za-z_]\w*>/g, '(')
    .replace(/\(\?:/g, '(')
    .replace(/\\\\|\\d|\\D/g, (match) => (match === '\\d' ? '[0-9]' : match === '\\D' ? '[^0-9]' : match))
    .replace(/\[([^\]]*)\[0-9\]([^\]]*)\]/g, '[$10-9$2]');
  return { pattern: converted, unsupported };
}

export function buildRegexCommands({ pattern, ignoreCase }: { pattern: string; ignoreCase: boolean }): {
  linux: OsCommand[];
  macos: OsCommand[];
  windows: OsCommand[];
} {
  const regex = pattern || 'error';
  const ere = toPosixExtended(regex);
  const i = ignoreCase ? 'i' : '';
  const ereNote = ere.unsupported.length
    ? `grep -E can't do ${ere.unsupported.join(', ')}: use the -P (Perl) form or perl instead.`
    : ere.pattern !== regex
      ? 'Rewritten for POSIX: \\d becomes [0-9], (?: and named groups become plain groups.'
      : undefined;
  const perl = `perl -ne 'print if /${regex.replace(/'/g, `'\\''`).replace(/\//g, '\\/')}/${i}' file.txt`;

  return {
    linux: [
      {
        title: 'grep with Perl-compatible regex (closest to this tester)',
        code: `grep -nP${i} ${quotePosix(regex, { always: true })} file.txt`,
        note: '-n line numbers, -P Perl syntax, -i ignore case. Add -o to print only the matched part, -r to search a directory, -v to show lines that do NOT match, -c to count.',
      },
      {
        title: 'grep with extended regex (works everywhere)',
        code: `grep -nE${i} ${quotePosix(ere.pattern, { always: true })} file.txt`,
        note: ereNote,
      },
      {
        title: 'Search every file below a directory',
        code: `grep -rnP${i} ${quotePosix(regex, { always: true })} .`,
      },
    ],
    macos: [
      {
        title: 'grep with extended regex (built in)',
        code: `grep -nE${i} ${quotePosix(ere.pattern, { always: true })} file.txt`,
        note: `macOS grep has no -P. ${ereNote ?? ''}`.trim(),
      },
      {
        title: 'perl (built in, full Perl/JavaScript-like syntax)',
        code: perl,
      },
      {
        title: 'GNU grep with -P',
        code: `brew install grep\nggrep -nP${i} ${quotePosix(regex, { always: true })} file.txt`,
      },
    ],
    windows: [
      {
        title: 'Search a file (PowerShell)',
        code: `Select-String -Path file.txt -Pattern ${quotePowerShell(regex, { always: true })}${ignoreCase ? '' : ' -CaseSensitive'}`,
        note: 'Select-String ignores case unless you add -CaseSensitive. Use -AllMatches for every match on a line, and Get-ChildItem -Recurse | Select-String … for a directory. .NET regex supports lookarounds, lazy quantifiers and named groups ((?<name>…)) like this tester.',
      },
      {
        title: 'Test one string and see the groups',
        code: `'your text here' -${ignoreCase ? '' : 'c'}match ${quotePowerShell(regex, { always: true })}\n$Matches`,
        note: '-match ignores case; -cmatch is case-sensitive. $Matches holds the whole match (0) and each group.',
      },
      {
        title: 'Command Prompt (findstr, very limited)',
        code: `findstr /n${ignoreCase ? ' /i' : ''} /r ${`"${ere.pattern.replace(/"/g, '\\"')}"`} file.txt`,
        note: 'findstr knows only . * ^ $ [ ] and \\< \\>: no +, ?, {n}, | or groups. Prefer PowerShell.',
        language: 'txt',
      },
    ],
  };
}
