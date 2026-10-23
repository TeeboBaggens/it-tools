import { describe, expect, it } from 'vitest';
import {
  buildLinuxCommands,
  buildMacCommands,
  buildWindowsCommands,
  isValidVariableName,
} from './secret-env-variable.service';

const codes = (commands: { code: string }[]) => commands.map(({ code }) => code);

describe('secret-env-variable', () => {
  it('validates variable names', () => {
    expect(isValidVariableName('API_TOKEN')).to.eql(true);
    expect(isValidVariableName('_x1')).to.eql(true);
    expect(isValidVariableName('1X')).to.eql(false);
    expect(isValidVariableName('A-B')).to.eql(false);
    expect(isValidVariableName('A; rm -rf /')).to.eql(false);
  });

  it('builds hidden prompts for each shell', () => {
    const linux = codes(buildLinuxCommands({ name: 'TOKEN', scope: 'session', command: '' }));
    expect(linux[0]).to.eql(`read -rs -p 'TOKEN: ' TOKEN && echo && export TOKEN`);
    expect(linux[1]).to.eql(`read -rs 'TOKEN?TOKEN: ' && echo && export TOKEN`);
    expect(linux[2]).to.eql(`read -sx -P 'TOKEN: ' TOKEN`);
    expect(linux[3]).to.eql(
      `printf '%s: ' TOKEN; stty -echo; IFS= read -r TOKEN; stty echo; printf '\\n'; export TOKEN`,
    );
    expect(linux[4]).to.eql(`[ -n "$TOKEN" ] && echo "TOKEN is set (\${#TOKEN} characters)"`);

    const windows = codes(buildWindowsCommands({ name: 'TOKEN', scope: 'session', command: '' }));
    expect(windows[0]).to.eql(`$env:TOKEN = Read-Host -Prompt TOKEN -MaskInput`);
    expect(windows[1]).to.eql(
      `$env:TOKEN = [Net.NetworkCredential]::new('', (Read-Host -Prompt TOKEN -AsSecureString)).Password`,
    );
  });

  it('falls back to a safe placeholder for invalid names', () => {
    expect(codes(buildMacCommands({ name: 'bad name', scope: 'session', command: '' }))[0]).to.contain('API_TOKEN');
  });

  it('scopes the secret to one command', () => {
    expect(codes(buildLinuxCommands({ name: 'T', scope: 'command', command: 'gh auth status' }))[0]).to.eql(
      `( read -rs -p 'T: ' T && echo && export T && gh auth status )`,
    );
  });
});
