import { describe, expect, it } from 'vitest';
import {
  type SedOptions,
  basicToExtendedRegex,
  buildPowerShellCommand,
  buildSedCommand,
  previewSed,
  sedReplacementToDotNet,
} from './sed-command-generator.service';

const base: SedOptions = {
  commandType: 'substitute',
  pattern: 'foo',
  replacement: 'bar',
  delimiter: '/',
  global: true,
  caseInsensitive: false,
  inPlace: false,
  backupSuffix: '',
  extendedRegex: false,
  targetFile: 'file.txt',
};

describe('sed-command-generator', () => {
  it('builds a substitution', () => {
    expect(buildSedCommand(base, 'gnu')).to.eql(`sed 's/foo/bar/g' file.txt`);
  });

  it('allows an empty replacement', () => {
    expect(buildSedCommand({ ...base, replacement: '' }, 'gnu')).to.eql(`sed 's/foo//g' file.txt`);
  });

  it('escapes the delimiter and single quotes', () => {
    expect(buildSedCommand({ ...base, pattern: '/usr/local', replacement: "it's" }, 'gnu')).to.eql(
      `sed 's/\\/usr\\/local/it'\\''s/g' file.txt`,
    );
    expect(buildSedCommand({ ...base, pattern: '/usr/local', replacement: '/opt', delimiter: '|' }, 'gnu')).to.eql(
      `sed 's|/usr/local|/opt|g' file.txt`,
    );
  });

  it('handles in-place editing on GNU and BSD sed', () => {
    expect(buildSedCommand({ ...base, inPlace: true }, 'gnu')).to.eql(`sed -i 's/foo/bar/g' file.txt`);
    expect(buildSedCommand({ ...base, inPlace: true }, 'bsd')).to.eql(`sed -i '' 's/foo/bar/g' file.txt`);
    expect(buildSedCommand({ ...base, inPlace: true, backupSuffix: '.bak' }, 'gnu')).to.eql(
      `sed -i.bak 's/foo/bar/g' file.txt`,
    );
    expect(buildSedCommand({ ...base, inPlace: true, backupSuffix: '.bak' }, 'bsd')).to.eql(
      `sed -i .bak 's/foo/bar/g' file.txt`,
    );
  });

  it('adds -n when extracting', () => {
    expect(buildSedCommand({ ...base, commandType: 'extract' }, 'gnu')).to.eql(`sed -n '/foo/p' file.txt`);
  });

  it('converts basic regex to extended', () => {
    expect(basicToExtendedRegex('\\(a\\+\\)(b)[(]')).to.eql('(a+)\\(b\\)[(]');
  });

  it('converts the replacement for .NET', () => {
    expect(sedReplacementToDotNet('[&] \\1 $5')).to.eql('[$0] $1 $$5');
  });

  it('builds PowerShell equivalents', () => {
    expect(buildPowerShellCommand(base)).to.eql(`Get-Content file.txt | ForEach-Object { $_ -creplace 'foo', 'bar' }`);
    expect(buildPowerShellCommand({ ...base, caseInsensitive: true, inPlace: true })).to.eql(
      `(Get-Content file.txt) | ForEach-Object { $_ -replace 'foo', 'bar' } | Set-Content file.txt`,
    );
    expect(buildPowerShellCommand({ ...base, commandType: 'delete', pattern: '^#' })).to.eql(
      `Get-Content file.txt | Where-Object { $_ -cnotmatch '^#' }`,
    );
  });

  it('previews the result', () => {
    expect(previewSed({ ...base, pattern: '\\(o\\+\\)', replacement: '[\\1]' }, 'foo\nboo').output).to.eql(
      'f[oo]\nb[oo]',
    );
    expect(previewSed({ ...base, pattern: 'o', replacement: '<&>', global: false }, 'foo').output).to.eql('f<o>o');
    expect(previewSed({ ...base, commandType: 'delete', pattern: '^#' }, '#a\nb').output).to.eql('b');
  });
});
