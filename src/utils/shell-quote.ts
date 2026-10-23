// Quote a value so it reaches a command as exactly one argument, unchanged.

const POSIX_SAFE = /^[\w@%+=:,./-]+$/;

// bash/zsh/sh: single quotes keep everything literal; a ' inside becomes '\''
// `always` quotes even plain words: clearer for scripts and regexes in examples.
export function quotePosix(value: string, { always = false } = {}): string {
  if (!always && value !== '' && POSIX_SAFE.test(value)) {
    return value;
  }
  return `'${value.replace(/'/g, `'\\''`)}'`;
}

// PowerShell: single quotes are literal too; a ' inside is doubled.
export function quotePowerShell(value: string, { always = false } = {}): string {
  if (!always && value !== '' && POSIX_SAFE.test(value)) {
    return value;
  }
  return `'${value.replace(/['‘’‚‛]/g, (quote) => quote + quote)}'`;
}
