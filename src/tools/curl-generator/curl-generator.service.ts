import JSON5 from 'json5';
import { quotePosix, quotePowerShell } from '@/utils/shell-quote';

export type Shell = 'posix' | 'powershell' | 'cmd';

// One piece of the command line: a flag, its value (if any) and what it does.
export interface CurlArg {
  flag: string;
  value?: string;
  explain: string;
}

export interface KeyValue {
  key: string;
  value: string;
}

export type BodyType = 'none' | 'json' | 'urlencoded' | 'multipart' | 'raw' | 'file';
export type AuthType = 'none' | 'basic' | 'digest' | 'bearer';

export interface CurlOptions {
  url: string;
  port: number | null;
  method: string;
  query: KeyValue[];
  headers: KeyValue[];
  bodyType: BodyType;
  json: string;
  formFields: KeyValue[];
  rawBody: string;
  rawContentType: string;
  bodyFile: string;
  authType: AuthType;
  username: string;
  password: string;
  token: string;
  // Output
  silent: boolean;
  showError: boolean;
  verbose: boolean;
  includeHeaders: boolean;
  headOnly: boolean;
  outputFile: string;
  remoteName: boolean;
  writeStatus: boolean;
  fail: boolean;
  // Redirects
  followRedirects: boolean;
  maxRedirects: number | null;
  locationTrusted: boolean;
  // TLS
  insecure: boolean;
  cacert: string;
  clientCert: string;
  clientKey: string;
  tlsMin: '' | '1.2' | '1.3';
  httpVersion: '' | '1.1' | '2' | '3';
  // Connection
  connectTimeout: number | null;
  maxTime: number | null;
  retry: number | null;
  ipVersion: '' | '4' | '6';
  resolve: string;
  proxy: string;
  compressed: boolean;
  userAgent: string;
  cookie: string;
  cookieJar: string;
  limitRate: string;
}

export function defaultCurlOptions(): CurlOptions {
  return {
    url: '',
    port: null,
    method: 'GET',
    query: [{ key: '', value: '' }],
    headers: [{ key: '', value: '' }],
    bodyType: 'none',
    json: '',
    formFields: [{ key: '', value: '' }],
    rawBody: '',
    rawContentType: 'text/plain',
    bodyFile: '',
    authType: 'none',
    username: '',
    password: '',
    token: '',
    silent: false,
    showError: false,
    verbose: false,
    includeHeaders: false,
    headOnly: false,
    outputFile: '',
    remoteName: false,
    writeStatus: false,
    fail: false,
    followRedirects: false,
    maxRedirects: null,
    locationTrusted: false,
    insecure: false,
    cacert: '',
    clientCert: '',
    clientKey: '',
    tlsMin: '',
    httpVersion: '',
    connectTimeout: null,
    maxTime: null,
    retry: null,
    ipVersion: '',
    resolve: '',
    proxy: '',
    compressed: false,
    userAgent: '',
    cookie: '',
    cookieJar: '',
    limitRate: '',
  };
}

// The URL with the port and query parameters folded in. Returns the input unchanged if it
// doesn't parse yet (someone is still typing), so the command still shows something.
export function buildUrl({ url, port, query }: Pick<CurlOptions, 'url' | 'port' | 'query'>): string {
  const trimmed = url.trim();
  if (!trimmed) {
    return 'https://example.com/';
  }
  const withScheme = /^[a-z][a-z0-9+.-]*:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  let parsed: URL;
  try {
    parsed = new URL(withScheme);
  } catch {
    return trimmed;
  }
  if (port) {
    parsed.port = String(port);
  }
  for (const { key, value } of query) {
    if (key) {
      parsed.searchParams.append(key, value);
    }
  }
  return parsed.toString();
}

export function isValidJson(json: string): boolean {
  if (!json.trim()) {
    return true;
  }
  try {
    JSON5.parse(json);
    return true;
  } catch {
    return false;
  }
}

function compactJson(json: string): string {
  try {
    return JSON.stringify(JSON5.parse(json));
  } catch {
    // Still being typed: send it as written rather than failing.
    return json;
  }
}

const filled = (pairs: KeyValue[]) => pairs.filter(({ key }) => key.trim() !== '');

export function buildCurlArgs(options: CurlOptions): CurlArg[] {
  const args: CurlArg[] = [];
  const push = (flag: string, explain: string, value?: string) => args.push({ flag, value, explain });
  const hasBody = options.bodyType !== 'none';
  const method = options.method.toUpperCase();

  // Method
  if (method === 'HEAD' || options.headOnly) {
    push(
      '--head',
      'Send a HEAD request: fetch only the response headers, no body. (Use this, not -X HEAD, which waits for a body that never comes.)',
    );
  } else if (!(method === 'GET' && !hasBody) && !(method === 'POST' && hasBody)) {
    push(
      '-X',
      `Use the ${method} method. curl picks GET on its own, or POST when you send data, so -X is only needed for anything else.`,
      method,
    );
  }

  // Auth
  if (options.authType === 'basic' || options.authType === 'digest') {
    if (options.authType === 'digest') {
      push('--digest', 'Use HTTP Digest authentication instead of Basic (the password is not sent in the clear).');
    }
    const user = options.username || 'user';
    push(
      '-u',
      options.password
        ? 'Username and password. Visible in your shell history and to other users via ps: leave the password out and curl will prompt for it.'
        : 'Username only: curl asks for the password, so it stays out of your shell history.',
      options.password ? `${user}:${options.password}` : user,
    );
  } else if (options.authType === 'bearer') {
    push(
      '-H',
      'Send a bearer token (OAuth2, API keys) in the Authorization header.',
      `Authorization: Bearer ${options.token || 'TOKEN'}`,
    );
  }

  // Headers
  for (const { key, value } of filled(options.headers)) {
    push('-H', `Add the request header ${key.trim()}.`, `${key.trim()}: ${value}`);
  }

  // Body
  if (options.bodyType === 'json') {
    push(
      '--json',
      'Send JSON: sets Content-Type and Accept to application/json and POSTs the data (curl 7.82+; older curl: -H "Content-Type: application/json" --data).',
      compactJson(options.json || '{}'),
    );
  } else if (options.bodyType === 'urlencoded') {
    for (const { key, value } of filled(options.formFields)) {
      push(
        '--data-urlencode',
        `Add the form field ${key.trim()}, URL-encoded for you (like an HTML form; Content-Type application/x-www-form-urlencoded).`,
        `${key.trim()}=${value}`,
      );
    }
  } else if (options.bodyType === 'multipart') {
    for (const { key, value } of filled(options.formFields)) {
      const isFile = value.startsWith('@');
      push(
        '-F',
        isFile
          ? `Upload the file ${value.slice(1) || '(name)'} as the multipart field ${key.trim()}.`
          : `Add the multipart/form-data field ${key.trim()} (start the value with @ to upload a file).`,
        `${key.trim()}=${value}`,
      );
    }
  } else if (options.bodyType === 'raw') {
    if (options.rawContentType) {
      push('-H', 'Tell the server what kind of data the body is.', `Content-Type: ${options.rawContentType}`);
    }
    push(
      '--data-raw',
      'Send this text as the request body exactly as written (an @ at the start is not treated as a file name).',
      options.rawBody,
    );
  } else if (options.bodyType === 'file') {
    push(
      '--data-binary',
      'Send the contents of the file as the body, byte for byte (plain --data would strip newlines).',
      `@${options.bodyFile || 'body.bin'}`,
    );
  }

  // Output
  if (options.silent) {
    push('-s', 'Silent: no progress meter or error messages.');
  }
  if (options.showError) {
    push('-S', 'Show errors even with -s (-sS is the usual pair in scripts).');
  }
  if (options.verbose) {
    push(
      '-v',
      'Verbose: show the connection, TLS handshake, request and response headers (lines starting with > are sent, < are received).',
    );
  }
  if (options.includeHeaders && !options.headOnly && method !== 'HEAD') {
    push('-i', 'Include the response headers in the output, before the body.');
  }
  if (options.fail) {
    push(
      '--fail',
      'Exit with an error (code 22) on HTTP 400 and above instead of printing the error page. Useful in scripts.',
    );
  }
  if (options.outputFile) {
    push('-o', 'Save the response body to this file instead of printing it.', options.outputFile);
  } else if (options.remoteName) {
    push('-O', 'Save the response body to a file named like the last part of the URL.');
  }
  if (options.writeStatus) {
    push(
      '-w',
      'After the transfer, print the HTTP status code and total time (curl -w has many more variables).',
      String.raw`\n%{http_code} %{time_total}s\n`,
    );
  }

  // Redirects
  if (options.followRedirects) {
    push('-L', 'Follow redirects (301, 302, …) to the final page.');
    if (options.maxRedirects !== null) {
      push('--max-redirs', 'Give up after this many redirects.', String(options.maxRedirects));
    }
    if (options.locationTrusted) {
      push(
        '--location-trusted',
        'Also send the credentials to the hosts it is redirected to. Only for hosts you trust.',
      );
    }
  }

  // TLS
  if (options.insecure) {
    push(
      '-k',
      'Skip certificate verification (self-signed or expired certificates). Anyone in the middle could read and change the traffic: for testing only.',
    );
  }
  if (options.cacert) {
    push(
      '--cacert',
      'Trust this CA certificate (PEM) for this request, e.g. your own internal CA. Safer than -k.',
      options.cacert,
    );
  }
  if (options.clientCert) {
    push('--cert', 'Present this client certificate (mutual TLS).', options.clientCert);
  }
  if (options.clientKey) {
    push('--key', 'The private key for the client certificate.', options.clientKey);
  }
  if (options.tlsMin) {
    push(`--tlsv${options.tlsMin}`, `Require TLS ${options.tlsMin} or newer.`);
  }
  if (options.httpVersion === '1.1') {
    push('--http1.1', 'Use HTTP/1.1 only.');
  } else if (options.httpVersion === '2') {
    push('--http2', 'Ask for HTTP/2 (the default for HTTPS in recent curl).');
  } else if (options.httpVersion === '3') {
    push('--http3', 'Use HTTP/3 over QUIC. Only if your curl was built with it (curl -V lists HTTP3).');
  }

  // Connection
  if (options.connectTimeout !== null) {
    push(
      '--connect-timeout',
      'Give up if the connection is not set up within this many seconds.',
      String(options.connectTimeout),
    );
  }
  if (options.maxTime !== null) {
    push('-m', 'Maximum time in seconds for the whole request.', String(options.maxTime));
  }
  if (options.retry !== null) {
    push('--retry', 'Retry this many times on timeouts and temporary errors (408, 429, 5xx).', String(options.retry));
  }
  if (options.ipVersion === '4') {
    push('-4', 'Only use IPv4.');
  } else if (options.ipVersion === '6') {
    push('-6', 'Only use IPv6.');
  }
  if (options.resolve) {
    push(
      '--resolve',
      'Send the request to this IP address instead of looking up the host name: test a server before DNS points at it, keeping the right TLS name. Format host:port:ip.',
      options.resolve,
    );
  }
  if (options.proxy) {
    push('-x', 'Go through this proxy (http://, https://, socks5h://host:port).', options.proxy);
  }
  if (options.compressed) {
    push('--compressed', 'Ask for a compressed response (gzip, brotli, …) and decompress it.');
  }
  if (options.userAgent) {
    push('-A', 'Send this User-Agent instead of curl/<version>.', options.userAgent);
  }
  if (options.cookie) {
    push('-b', 'Send cookies: name=value pairs, or a cookie file to read.', options.cookie);
  }
  if (options.cookieJar) {
    push('-c', 'Save the cookies the server sets to this file (reuse them later with -b).', options.cookieJar);
  }
  if (options.limitRate) {
    push('--limit-rate', 'Cap the transfer speed (e.g. 500K, 2M).', options.limitRate);
  }

  return args;
}

// cmd.exe: wrap in double quotes; curl's own parser turns \" back into ". % still expands
// (%VAR%), which no quoting prevents in an interactive prompt.
function quoteCmd(value: string): string {
  if (value !== '' && /^[\w@+=:,./-]+$/.test(value)) {
    return value;
  }
  return `"${value.replace(/"/g, '\\"')}"`;
}

const quoters: Record<Shell, (value: string) => string> = {
  posix: quotePosix,
  powershell: quotePowerShell,
  cmd: quoteCmd,
};

// Line continuation characters: \ in bash/zsh, a backtick in PowerShell, ^ in cmd.
const continuations: Record<Shell, string> = { posix: ' \\', powershell: ' `', cmd: ' ^' };

export function renderCurlCommand({
  args,
  url,
  shell,
  multiline,
}: {
  args: CurlArg[];
  url: string;
  shell: Shell;
  multiline: boolean;
}): string {
  const quote = quoters[shell];
  // In Windows PowerShell 5.1, "curl" is an alias for Invoke-WebRequest; curl.exe is real curl.
  const program = shell === 'posix' ? 'curl' : 'curl.exe';
  const parts = [
    ...args.map(({ flag, value }) => (value === undefined ? flag : `${flag} ${quote(value)}`)),
    quote(url),
  ];
  if (!multiline) {
    return [program, ...parts].join(' ');
  }
  return [program, ...parts]
    .map((part, index, all) => (index < all.length - 1 ? part + continuations[shell] : part))
    .join('\n  ');
}
