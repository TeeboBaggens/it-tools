import { describe, expect, it } from 'vitest';
import { quotePosix, quotePowerShell } from './shell-quote';

describe('shell-quote', () => {
  it('leaves plain words alone', () => {
    expect(quotePosix('https://example.com/a-b_c.txt')).to.eql('https://example.com/a-b_c.txt');
    expect(quotePowerShell('file.txt')).to.eql('file.txt');
  });
  it('quotes plain words when asked to', () => {
    expect(quotePosix('s/a/b/g', { always: true })).to.eql(`'s/a/b/g'`);
    expect(quotePowerShell('foo', { always: true })).to.eql(`'foo'`);
  });
  it('quotes empty strings', () => {
    expect(quotePosix('')).to.eql(`''`);
    expect(quotePowerShell('')).to.eql(`''`);
  });
  it('quotes spaces, $ and other shell syntax', () => {
    expect(quotePosix('a b')).to.eql(`'a b'`);
    expect(quotePosix('$HOME;rm')).to.eql(`'$HOME;rm'`);
    expect(quotePowerShell('$env:X a')).to.eql(`'$env:X a'`);
  });
  it('escapes single quotes', () => {
    expect(quotePosix(`it's`)).to.eql(`'it'\\''s'`);
    expect(quotePowerShell(`it's`)).to.eql(`'it''s'`);
  });
});
