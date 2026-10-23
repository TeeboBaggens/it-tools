import { describe, expect, it } from 'vitest';
import { buildRegexCommands, explainRegex, toPosixExtended } from './regex-tester.explain';

const tokens = (pattern: string) => explainRegex(pattern).map(({ token }) => token);

describe('regex-tester explain', () => {
  it('splits a pattern into explained pieces', () => {
    expect(tokens('^ab+c\\d{2,3}$')).to.eql(['^', 'a', 'b', '+', 'c', '\\d', '{2,3}', '$']);
    expect(tokens('(?<year>\\d{4})-[^a-z]|x*?')).to.eql(['(?<year>', '\\d', '{4}', ')', '-', '[^a-z]', '|', 'x', '*?']);
    expect(tokens('hello world')).to.eql(['hello world']);
  });

  it('explains quantifiers and groups', () => {
    const explained = explainRegex('(a)\\1{2,}?');
    expect(explained[0].explain).to.contain('group 1');
    expect(explained[3].explain).to.contain('backreference');
    expect(explained[4].explain).to.contain('2 or more times');
    expect(explained[4].explain).to.contain('lazy');
    expect(explainRegex('[a-z_]')[0].explain).to.eql('one character: a to z, "_"');
  });

  it('converts to POSIX extended where possible', () => {
    expect(toPosixExtended('(?:\\d+)-[\\d]')).to.eql({ pattern: '([0-9]+)-[0-9]', unsupported: [] });
    expect(toPosixExtended('a(?=b).*?').unsupported).to.eql(['lookarounds', 'lazy quantifiers']);
  });

  it('builds commands for each OS', () => {
    const commands = buildRegexCommands({ pattern: "it's \\d+", ignoreCase: true });
    expect(commands.linux[0].code).to.eql(`grep -nPi 'it'\\''s \\d+' file.txt`);
    expect(commands.linux[1].code).to.eql(`grep -nEi 'it'\\''s [0-9]+' file.txt`);
    expect(commands.windows[0].code).to.eql(`Select-String -Path file.txt -Pattern 'it''s \\d+'`);
  });
});
