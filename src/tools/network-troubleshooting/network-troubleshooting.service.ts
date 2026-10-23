import type { OsCommand } from '@/components/OsCommandTabs.vue';
import { quotePosix, quotePowerShell } from '@/utils/shell-quote';

export interface NetworkInput {
  host: string;
  port: number | null;
  protocol: 'tcp' | 'udp';
  recordType: string;
  dnsServer: string;
  sshUser: string;
  sshPort: number | null;
  localPort: number | null;
  jumpHost: string;
}

export interface CommandSection {
  id: string;
  title: string;
  intro: string;
  linux: OsCommand[];
  macos: OsCommand[];
  windows: OsCommand[];
}

export const recordTypes = ['A', 'AAAA', 'CNAME', 'MX', 'TXT', 'NS', 'SOA', 'CAA', 'SRV', 'PTR'];

const isIp = (value: string) => /^\d{1,3}(?:\.\d{1,3}){3}$/.test(value) || /^[0-9a-f:]+:[0-9a-f:]*$/i.test(value);

// Host names, users and jump hosts end up inside shell commands (some inside other quotes),
// so only plain values are used; anything else falls back to the placeholder.
const safe = (value: string, pattern: RegExp, fallback: string) => {
  const trimmed = value.trim();
  return trimmed && pattern.test(trimmed) ? trimmed : fallback;
};
export const isValidHost = (value: string) => /^[\w.:-]+$/.test(value.trim());

export function buildSections(input: NetworkInput): CommandSection[] {
  const host = safe(input.host, /^[\w.:-]+$/, 'example.com');
  const h = quotePosix(host);
  const hp = quotePowerShell(host);
  const port = input.port ?? 443;
  const type = input.recordType || 'A';
  const server = safe(input.dnsServer, /^[\w.:-]+$/, '');
  const at = server ? ` @${server}` : '';
  const udp = input.protocol === 'udp';
  const user = safe(input.sshUser, /^[\w.-]+$/, 'user');
  const target = `${user}@${host}`;
  const sshPort = input.sshPort && input.sshPort !== 22 ? input.sshPort : null;
  const p = sshPort ? ` -p ${sshPort}` : '';
  const localPort = input.localPort ?? 8080;
  const jump = safe(input.jumpHost, /^[\w.@:-]+$/, '');
  const j = jump ? ` -J ${quotePosix(jump)}` : '';
  const ip = isIp(host);

  const digLines = [
    `dig${at} ${h} ${type}`,
    `dig${at} +short ${h} ${type}`,
    ...(ip ? [`dig -x ${h} +short          # reverse: which name has this IP`] : []),
    `dig +trace ${h} ${type}       # follow the delegation from the root servers down`,
  ].join('\n');
  const digNote = `dig asks a DNS server directly. Read the ANSWER SECTION (the records and their TTL in seconds) and status: NOERROR = fine, NXDOMAIN = the name does not exist, SERVFAIL = the server could not get an answer.${server ? ` @${server} asks that server instead of your configured one: compare the two to spot stale caches or split DNS.` : ' Add @1.1.1.1 to ask a public resolver instead of your own.'}`;

  const dns: CommandSection = {
    id: 'dns',
    title: '1. Does the name resolve?',
    intro:
      'Check what DNS says, then what your machine actually uses: the two can differ because of /etc/hosts, a local cache, a VPN or split DNS.',
    linux: [
      { title: `Ask DNS for the ${type} record`, code: digLines, note: digNote },
      {
        title: 'What programs on this machine get (includes /etc/hosts)',
        code: `getent ahosts ${h}\nresolvectl query ${h}`,
        note: 'getent uses the same lookup path as applications. resolvectl only exists with systemd-resolved.',
      },
      {
        title: 'Which DNS servers am I using? Flush the cache',
        code: 'resolvectl status\ncat /etc/resolv.conf\nsudo resolvectl flush-caches',
      },
    ],
    macos: [
      { title: `Ask DNS for the ${type} record`, code: digLines, note: digNote },
      {
        title: 'What programs on this Mac get (includes /etc/hosts)',
        code: `dscacheutil -q host -a name ${h}`,
        note: 'dig bypasses the macOS resolver; dscacheutil goes through it, like apps do.',
      },
      {
        title: 'Which DNS servers am I using? Flush the cache',
        code: 'scutil --dns | grep nameserver\nsudo dscacheutil -flushcache; sudo killall -HUP mDNSResponder',
      },
    ],
    windows: [
      {
        title: `Ask DNS for the ${type} record`,
        code: `Resolve-DnsName ${hp} -Type ${type}${server ? ` -Server ${server}` : ''}\nnslookup -type=${type} ${host}${server ? ` ${server}` : ''}`,
        note: 'Resolve-DnsName is the PowerShell way; nslookup also works in cmd. Add -DnsOnly to skip the hosts file and local cache.',
      },
      {
        title: 'Which DNS servers am I using? Look at / flush the cache',
        code: 'Get-DnsClientServerAddress -AddressFamily IPv4\nGet-DnsClientCache | Select-Object -First 20\nipconfig /flushdns',
      },
    ],
  };

  const reach: CommandSection = {
    id: 'reach',
    title: '2. Can I reach the host?',
    intro:
      'Many servers and firewalls drop ping, so no reply is not proof the host is down: a port check (next section) tells you more.',
    linux: [
      { title: 'Ping 4 times', code: `ping -c 4 ${h}`, note: 'Look at packet loss and time= (round trip in ms).' },
      {
        title: 'Where along the way does it stop?',
        code: `tracepath ${h}\ntraceroute ${h}\nmtr -rwc 10 ${h}         # traceroute + ping per hop`,
        note: '* * * on one hop is often just a router that does not answer; it matters only if every hop after it is * too.',
      },
    ],
    macos: [
      { title: 'Ping 4 times', code: `ping -c 4 ${h}` },
      {
        title: 'Where along the way does it stop?',
        code: `traceroute ${h}\nmtr -rwc 10 ${h}         # brew install mtr`,
      },
    ],
    windows: [
      { title: 'Ping 4 times', code: `Test-Connection ${hp} -Count 4\nping ${host}` },
      {
        title: 'Where along the way does it stop?',
        code: `tracert ${host}\npathping ${host}`,
        note: 'pathping traces the route, then measures loss at each hop for a few minutes.',
      },
    ],
  };

  const portCheck: CommandSection = {
    id: 'port',
    title: `3. Is ${udp ? 'UDP' : 'TCP'} port ${port} open on ${host}?`,
    intro: udp
      ? 'UDP has no handshake, so "open" can only be inferred: no answer may mean open or filtered. Test with the real client (e.g. dig for 53) when you can.'
      : '"succeeded" / "open" = something accepted the connection. "refused" = the host answered but nothing listens there. A timeout = a firewall dropped it, or the host is unreachable.',
    linux: [
      {
        title: 'netcat',
        code: `nc -zv${udp ? 'u' : ''} -w 3 ${h} ${port}`,
        note: '-z only checks the port (sends no data), -v says what happened, -w 3 gives up after 3 seconds, -u for UDP.',
      },
      ...(udp
        ? []
        : [
            {
              title: 'No netcat? bash can do it',
              code: `timeout 3 bash -c '</dev/tcp/${host}/${port}' && echo open || echo closed`,
              note: '/dev/tcp/host/port is a bash feature, not a real file.',
            },
            {
              title: 'Check the TLS certificate on that port',
              code: `openssl s_client -connect ${host}:${port} -servername ${host} </dev/null 2>/dev/null | openssl x509 -noout -subject -issuer -dates`,
              note: '-servername sends the host name (SNI) so you get the right certificate on shared servers.',
            },
          ]),
    ],
    macos: [
      {
        title: 'netcat (built in)',
        code: `nc -zv${udp ? 'u' : ''} -G 3 ${h} ${port}`,
        note: 'macOS nc uses -G for the connect timeout.',
      },
      ...(udp
        ? []
        : [
            {
              title: 'Check the TLS certificate on that port',
              code: `openssl s_client -connect ${host}:${port} -servername ${host} </dev/null 2>/dev/null | openssl x509 -noout -subject -issuer -dates`,
            },
          ]),
    ],
    windows: udp
      ? [
          {
            title: 'UDP',
            code: `# Test-NetConnection only does TCP. Use the real client, e.g. for DNS:\nResolve-DnsName example.com -Server ${host}`,
          },
        ]
      : [
          {
            title: 'PowerShell',
            code: `Test-NetConnection ${hp} -Port ${port}`,
            note: 'TcpTestSucceeded : True means open. It also shows the address it resolved and the interface it used.',
          },
          {
            title: 'Quicker, with a 3 second timeout',
            code: `$c = [Net.Sockets.TcpClient]::new(); $c.ConnectAsync(${hp}, ${port}).Wait(3000); $c.Connected; $c.Dispose()`,
          },
        ],
  };

  const listening: CommandSection = {
    id: 'listening',
    title: `4. What is listening on port ${port} on this machine?`,
    intro:
      'For "it works locally but not from outside": 127.0.0.1 or ::1 = this machine only. 0.0.0.0 or [::] or * = every interface (then a firewall decides). A specific IP = only that interface.',
    linux: [
      {
        title: 'Listening sockets with their program',
        code: `sudo ss -${udp ? 'u' : 't'}lnp 'sport = :${port}'\nsudo ss -tulpn             # everything`,
        note: "-t TCP, -u UDP, -l listening only, -n numbers instead of names, -p show the process (needs sudo for other users' processes).",
      },
      { title: 'Or with lsof', code: `sudo lsof -nP -i${udp ? 'UDP' : 'TCP'}:${port}${udp ? '' : ' -sTCP:LISTEN'}` },
      { title: 'Is the firewall letting it in?', code: 'sudo ufw status verbose\nsudo nft list ruleset | less' },
    ],
    macos: [
      {
        title: 'Listening sockets with their program',
        code: `sudo lsof -nP -i${udp ? 'UDP' : 'TCP'}:${port}${udp ? '' : ' -sTCP:LISTEN'}\nnetstat -anv -p ${udp ? 'udp' : 'tcp'} | grep '\\.${port} '`,
        note: 'macOS has no ss. lsof -n and -P skip name lookups so it is fast.',
      },
    ],
    windows: [
      {
        title: 'Listening sockets with their program',
        code: udp
          ? `Get-NetUDPEndpoint -LocalPort ${port} | Select-Object LocalAddress, LocalPort, @{ n = 'Process'; e = { (Get-Process -Id $_.OwningProcess).ProcessName } }`
          : `Get-NetTCPConnection -LocalPort ${port} -State Listen | Select-Object LocalAddress, LocalPort, @{ n = 'Process'; e = { (Get-Process -Id $_.OwningProcess).ProcessName } }`,
      },
      {
        title: 'cmd',
        code: `netstat -ano | findstr :${port}`,
        note: 'The last column is the process ID: tasklist /fi "PID eq <pid>".',
        language: 'txt',
      },
      {
        title: 'Is the firewall letting it in?',
        code: `Get-NetFirewallPortFilter -Protocol ${udp ? 'UDP' : 'TCP'} | Where-Object LocalPort -eq ${port} | Get-NetFirewallRule`,
      },
    ],
  };

  const sshConnect = `ssh${p}${j} ${quotePosix(target)}`;
  const sshCommon: OsCommand[] = [
    {
      title: 'Connect',
      code: sshConnect,
      note: `${sshPort ? `-p ${sshPort}: the server does not use the default port 22. ` : ''}${jump ? `-J: hop through ${jump} first (a bastion/jump host). ` : ''}Add -v (or -vvv) to see each step when it fails: which keys it offers and why the server says no.`,
    },
    {
      title: `Reach a service on the server's port ${port} as localhost:${localPort} here (local forward)`,
      code: `ssh${p}${j} -N -L ${localPort}:localhost:${port} ${quotePosix(target)}`,
      note: `-L local:destination:port, where destination is seen from the server (localhost = the server itself). -N = no shell, just the tunnel. Then open localhost:${localPort} here.`,
    },
    {
      title: `Let the server reach your port ${localPort} as its localhost:${port} (remote forward)`,
      code: `ssh${p}${j} -N -R ${port}:localhost:${localPort} ${quotePosix(target)}`,
    },
    {
      title: 'Use the server as a SOCKS proxy for your browser',
      code: `ssh${p}${j} -N -D 1080 ${quotePosix(target)}`,
      note: 'Point the browser (or curl -x socks5h://localhost:1080) at localhost:1080.',
    },
    {
      title: 'Save it all in ~/.ssh/config, then just: ssh myserver',
      code: `Host myserver\n    HostName ${host}\n    User ${user}${sshPort ? `\n    Port ${sshPort}` : ''}${jump ? `\n    ProxyJump ${jump}` : ''}\n    IdentityFile ~/.ssh/id_ed25519`,
      language: 'txt',
    },
  ];

  const ssh: CommandSection = {
    id: 'ssh',
    title: '5. SSH',
    intro: 'Connect, set up key login, tunnel ports through the connection, and fix the usual errors.',
    linux: [
      ...sshCommon,
      {
        title: 'Key login: make a key once, copy it to the server',
        code: `ssh-keygen -t ed25519 -C "$USER@$(hostname)"\nssh-copy-id${p} ${quotePosix(target)}`,
        note: 'ssh-keygen asks for a passphrase: use one (ssh-agent remembers it). ssh-copy-id appends the public key to ~/.ssh/authorized_keys on the server.',
      },
      {
        title: '"REMOTE HOST IDENTIFICATION HAS CHANGED"',
        code: `ssh-keygen -R ${h}${sshPort ? `\nssh-keygen -R '[${host}]:${sshPort}'` : ''}`,
        note: 'Only after you have confirmed the server really was reinstalled or re-keyed: this warning is exactly what a man-in-the-middle looks like.',
      },
      {
        title: '"Permission denied (publickey)" / "bad permissions"',
        code:
          'chmod 700 ~/.ssh && chmod 600 ~/.ssh/id_ed25519 ~/.ssh/authorized_keys\nssh -v ' +
          quotePosix(target) +
          ' 2>&1 | grep -iE "offering|authentications|denied"',
        note: 'sshd ignores keys when ~/.ssh or the key files are readable by others. On the server, look at sudo journalctl -u ssh -e.',
      },
    ],
    macos: [
      ...sshCommon,
      {
        title: 'Key login: make a key once, copy it to the server',
        code: `ssh-keygen -t ed25519 -C "$USER@$(hostname -s)"\nssh-copy-id${p} ${quotePosix(target)}\nssh-add --apple-use-keychain ~/.ssh/id_ed25519`,
        note: 'The last line stores the passphrase in the macOS Keychain. Add "UseKeychain yes" and "AddKeysToAgent yes" under Host * in ~/.ssh/config to make it stick.',
      },
      {
        title: '"REMOTE HOST IDENTIFICATION HAS CHANGED"',
        code: `ssh-keygen -R ${h}`,
        note: 'Only once you know why the key changed.',
      },
    ],
    windows: [
      ...sshCommon,
      {
        title: 'Key login: make a key once, copy it to the server (PowerShell)',
        code: `ssh-keygen -t ed25519\nGet-Content $env:USERPROFILE\\.ssh\\id_ed25519.pub | ssh${p} ${target} "mkdir -p ~/.ssh && chmod 700 ~/.ssh && cat >> ~/.ssh/authorized_keys"`,
        note: 'Windows 10/11 include the OpenSSH client (ssh, ssh-keygen, scp) but not ssh-copy-id; the second line does the same. ~/.ssh is C:\\Users\\<you>\\.ssh.',
      },
      {
        title: '"REMOTE HOST IDENTIFICATION HAS CHANGED"',
        code: `ssh-keygen -R ${host}`,
        note: 'Only once you know why the key changed.',
      },
    ],
  };

  return [dns, reach, portCheck, listening, ssh];
}

export const checklist = [
  'Name: does it resolve, and to the address you expect? (section 1; compare your resolver with @1.1.1.1)',
  'Route: can you reach that address at all? (section 2; remember many hosts ignore ping)',
  'Port: does the port answer? Refused = nothing listening, timeout = firewall or routing. (section 3)',
  'Service: on the server, is the program listening, and on which address? 127.0.0.1 is local-only. (section 4)',
  'Firewall: host firewall (ufw, nftables, Windows Defender Firewall), then cloud/security-group rules, then the router.',
  'Application: the port is open but it still fails? Test the protocol itself: curl -v for HTTP (see the Curl Command Generator), openssl s_client for TLS, ssh -v for SSH.',
];
