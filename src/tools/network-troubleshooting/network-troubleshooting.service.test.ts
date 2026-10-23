import { describe, expect, it } from 'vitest';
import { type NetworkInput, buildSections } from './network-troubleshooting.service';

const input: NetworkInput = {
  host: 'example.com',
  port: 443,
  protocol: 'tcp',
  recordType: 'MX',
  dnsServer: '1.1.1.1',
  sshUser: 'alice',
  sshPort: 2222,
  localPort: 8080,
  jumpHost: '',
};

const section = (id: string, value = input) => buildSections(value).find((s) => s.id === id)!;

describe('network-troubleshooting', () => {
  it('builds dig with the record type and server', () => {
    expect(section('dns').linux[0].code.split('\n')[0]).to.eql('dig @1.1.1.1 example.com MX');
    expect(section('dns').windows[0].code.split('\n')[0]).to.eql(
      'Resolve-DnsName example.com -Type MX -Server 1.1.1.1',
    );
  });

  it('checks the port per OS', () => {
    expect(section('port').linux[0].code).to.eql('nc -zv -w 3 example.com 443');
    expect(section('port').macos[0].code).to.eql('nc -zv -G 3 example.com 443');
    expect(section('port').windows[0].code).to.eql('Test-NetConnection example.com -Port 443');
  });

  it('builds ssh commands with a custom port and tunnels', () => {
    expect(section('ssh').linux[0].code).to.eql('ssh -p 2222 alice@example.com');
    expect(section('ssh').linux[1].code).to.eql('ssh -p 2222 -N -L 8080:localhost:443 alice@example.com');
  });

  it('never puts unsafe input into a command', () => {
    const evil = { ...input, host: "x'; rm -rf ~; '", sshUser: '$(id)', jumpHost: 'a b' };
    const all = buildSections(evil)
      .flatMap((s) => [...s.linux, ...s.macos, ...s.windows])
      .map((c) => c.code)
      .join('\n');
    expect(all).not.to.contain('rm -rf');
    expect(all).not.to.contain('$(id)');
    expect(all).to.contain('example.com');
  });
});
