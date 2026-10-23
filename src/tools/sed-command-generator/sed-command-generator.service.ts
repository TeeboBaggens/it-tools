import { quotePosix, quotePowerShell } from '@/utils/shell-quote';

export type SedCommandType = 'substitute' | 'delete' | 'extract' | 'number';

export interface SedOptions {
  commandType: SedCommandType;
  pattern: string;
  replacement: string;
  delimiter: string;
  global: boolean;
  caseInsensitive: boolean;
  inPlace: boolean;
  backupSuffix: string;
  extendedRegex: boolean;
  targetFile: string;
}

export interface SedPart {
  part: string;
  explain: string;
}

// Basic regular expressions (sed without -E) use \( \) \{ \} \+ \? \| for the special
// meaning and plain ( ) { } + ? | as literals: the reverse of extended syntax.
export function basicToExtendedRegex(pattern: string): string {
  let out = '';
  let inBracket = false;
  for (let i = 0; i < pattern.length; i++) {
    const char = pattern[i];
    if (inBracket) {
      out += char;
      if (char === ']' && pattern[i - 1] !== '[' && !(pattern[i - 1] === '^' && pattern[i - 2] === '[')) {
        inBracket = false;
      }
      continue;
    }
    if (char === '[') {
      inBracket = true;
      out += char;
      continue;
    }
    if (char === '\\' && i + 1 < pattern.length) {
      const next = pattern[i + 1];
      out += '(){}+?|'.includes(next) ? next : `\\${next}`;
      i++;
      continue;
    }
    out += '(){}+?|'.includes(char) ? `\\${char}` : char;
  }
  return out;
}

// POSIX classes like [[:digit:]] -> what .NET and JavaScript understand.
const posixClasses: Record<string, string> = {
  alpha: 'a-zA-Z',
  digit: '0-9',
  alnum: 'a-zA-Z0-9',
  upper: 'A-Z',
  lower: 'a-z',
  space: '\\s',
  blank: ' \\t',
  punct: '!-\\/:-@\\[-`{-~',
  xdigit: '0-9A-Fa-f',
};
function replacePosixClasses(pattern: string): string {
  return pattern.replace(/\[:(\w+):\]/g, (whole, name: string) => posixClasses[name] ?? whole);
}

// sed's \1 and & in the replacement -> $1 and $0 (.NET) or $& (JavaScript); a literal $ doubles.
export function sedReplacementToDotNet(replacement: string, wholeMatch: '$0' | '$&' = '$0'): string {
  let out = '';
  for (let i = 0; i < replacement.length; i++) {
    const char = replacement[i];
    if (char === '\\' && i + 1 < replacement.length) {
      const next = replacement[i + 1];
      out += /\d/.test(next) ? `$${next}` : next === '&' ? '&' : next === 'n' ? '\n' : next === 't' ? '\t' : next;
      i++;
    } else if (char === '&') {
      out += wholeMatch;
    } else if (char === '$') {
      out += '$$';
    } else {
      out += char;
    }
  }
  return out;
}

function escapeDelimiter(value: string, delimiter: string): string {
  if (!delimiter || delimiter === '\\') {
    return value;
  }
  let out = '';
  for (let i = 0; i < value.length; i++) {
    const char = value[i];
    if (char === '\\' && i + 1 < value.length) {
      out += char + value[i + 1];
      i++;
    } else if (char === delimiter) {
      out += `\\${char}`;
    } else {
      out += char;
    }
  }
  return out;
}

export function buildSedExpression(rawOptions: SedOptions): string {
  // An empty regex in sed means "the last regex used", so show a placeholder instead.
  const options = { ...rawOptions, pattern: rawOptions.pattern || 'foo' };
  const delimiter = options.delimiter || '/';
  const pattern = escapeDelimiter(options.pattern, '/');
  const caseFlag = options.caseInsensitive ? 'I' : '';
  switch (options.commandType) {
    case 'substitute': {
      const flags = `${options.global ? 'g' : ''}${caseFlag}`;
      return `s${delimiter}${escapeDelimiter(options.pattern, delimiter)}${delimiter}${escapeDelimiter(options.replacement, delimiter)}${delimiter}${flags}`;
    }
    case 'delete':
      return `/${pattern}/${caseFlag}d`;
    case 'extract':
      return `/${pattern}/${caseFlag}p`;
    default:
      return '=';
  }
}

function fileOrPlaceholder(options: SedOptions) {
  return options.targetFile.trim() || 'file.txt';
}

export function buildSedCommand(options: SedOptions, flavor: 'gnu' | 'bsd'): string {
  const args = ['sed'];
  if (options.extendedRegex) {
    args.push('-E');
  }
  if (options.commandType === 'extract') {
    args.push('-n');
  }
  if (options.inPlace) {
    if (flavor === 'gnu') {
      args.push(options.backupSuffix ? `-i${quotePosix(options.backupSuffix)}` : '-i');
    } else {
      args.push('-i', options.backupSuffix ? quotePosix(options.backupSuffix) : "''");
    }
  }
  args.push(quotePosix(buildSedExpression(options), { always: true }), quotePosix(fileOrPlaceholder(options)));
  return args.join(' ');
}

export function toDotNetPattern(options: Pick<SedOptions, 'pattern' | 'extendedRegex'>): string {
  const pattern = options.extendedRegex ? options.pattern : basicToExtendedRegex(options.pattern);
  return replacePosixClasses(pattern);
}

export function buildPowerShellCommand(rawOptions: SedOptions): string {
  const options = { ...rawOptions, pattern: rawOptions.pattern || 'foo' };
  const file = quotePowerShell(fileOrPlaceholder(options));
  const pattern = quotePowerShell(toDotNetPattern(options), { always: true });
  // -match/-replace ignore case unless you use the c-prefixed form.
  const c = options.caseInsensitive ? '' : 'c';
  const write = options.inPlace ? ` | Set-Content ${file}` : '';
  const read = options.inPlace ? `(Get-Content ${file})` : `Get-Content ${file}`;
  switch (options.commandType) {
    case 'substitute': {
      const replacement = quotePowerShell(sedReplacementToDotNet(options.replacement), { always: true });
      if (options.global) {
        return `${read} | ForEach-Object { $_ -${c}replace ${pattern}, ${replacement} }${write}`;
      }
      const regexOptions = options.caseInsensitive ? `, 'IgnoreCase'` : '';
      return `$re = [regex]::new(${pattern}${regexOptions})\n${read} | ForEach-Object { $re.Replace($_, ${replacement}, 1) }${write}`;
    }
    case 'delete':
      return `${read} | Where-Object { $_ -${c}notmatch ${pattern} }${write}`;
    case 'extract':
      return `Select-String -Path ${file} -Pattern ${pattern}${options.caseInsensitive ? '' : ' -CaseSensitive'} | ForEach-Object Line`;
    default:
      return `Get-Content ${file} | ForEach-Object { $_.ReadCount; $_ }`;
  }
}

// Run the expression on sample text with JavaScript's regex engine, which agrees with sed
// on everything this generator produces except a few POSIX corner cases.
export function previewSed(options: SedOptions, input: string): { output: string; error: string } {
  if (options.commandType !== 'number' && !options.pattern) {
    return { output: input, error: '' };
  }
  let regex: RegExp;
  try {
    regex = new RegExp(toDotNetPattern(options), `${options.global ? 'g' : ''}${options.caseInsensitive ? 'i' : ''}`);
  } catch (error) {
    return { output: '', error: (error as Error).message };
  }
  const lines = input.split('\n');
  switch (options.commandType) {
    case 'substitute': {
      const replacement = sedReplacementToDotNet(options.replacement, '$&');
      return { output: lines.map((line) => line.replace(regex, replacement)).join('\n'), error: '' };
    }
    case 'delete':
      return {
        output: lines.filter((line) => !new RegExp(regex.source, regex.flags.replace('g', '')).test(line)).join('\n'),
        error: '',
      };
    case 'extract':
      return {
        output: lines.filter((line) => new RegExp(regex.source, regex.flags.replace('g', '')).test(line)).join('\n'),
        error: '',
      };
    default:
      return { output: lines.map((line, index) => `${index + 1}\n${line}`).join('\n'), error: '' };
  }
}

export function explainSed(options: SedOptions): SedPart[] {
  const parts: SedPart[] = [];
  if (options.extendedRegex) {
    parts.push({
      part: '-E',
      explain: 'Extended regular expressions: ( ) + ? | { } work without backslashes, like in most languages.',
    });
  } else {
    parts.push({
      part: '(no -E)',
      explain:
        'Basic regular expressions: write \\( \\) \\+ \\? \\| \\{ \\} for groups and repetition; plain ( ) + are literal characters.',
    });
  }
  if (options.commandType === 'extract') {
    parts.push({
      part: '-n',
      explain:
        'Do not print every line automatically; only lines a p command prints. Without it, matches would appear twice.',
    });
  }
  if (options.inPlace) {
    parts.push({
      part: options.backupSuffix ? `-i${options.backupSuffix}` : '-i',
      explain: `Edit the file in place instead of printing the result${options.backupSuffix ? `, keeping the original as ${fileOrPlaceholder(options)}${options.backupSuffix}` : ''}. macOS needs a separate argument: -i '' (no backup) or -i .bak.`,
    });
  }
  const delimiter = options.delimiter || '/';
  if (options.commandType === 'substitute') {
    parts.push({ part: 's', explain: 'Substitute: s<d>pattern<d>replacement<d>flags.' });
    parts.push({
      part: delimiter,
      explain: `The delimiter. Any character works; pick one that is not in your text (| or # for paths) to avoid escaping. A ${delimiter} inside the pattern or replacement is escaped as \\${delimiter}.`,
    });
    parts.push({ part: options.pattern || '(pattern)', explain: 'What to find (a regular expression).' });
    parts.push({
      part: options.replacement || '(empty)',
      explain: 'What to put instead. & means the whole match, \\1 to \\9 the groups. Empty deletes the match.',
    });
    if (options.global) {
      parts.push({ part: 'g', explain: 'Global: replace every match on the line, not just the first.' });
    }
  } else if (options.commandType === 'delete') {
    parts.push({ part: `/${options.pattern || '(pattern)'}/d`, explain: 'Delete every line that matches.' });
  } else if (options.commandType === 'extract') {
    parts.push({
      part: `/${options.pattern || '(pattern)'}/p`,
      explain: 'Print the lines that match (with -n: only those).',
    });
  } else {
    parts.push({ part: '=', explain: 'Print each line number on its own line, before the line.' });
  }
  if (options.caseInsensitive) {
    parts.push({ part: 'I', explain: 'Ignore case (GNU sed; on older macOS sed install gsed: brew install gnu-sed).' });
  }
  parts.push({
    part: "'…'",
    explain: 'Single quotes stop the shell from touching $, *, \\ and spaces in the expression.',
  });
  return parts;
}
