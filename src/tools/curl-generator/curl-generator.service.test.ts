import { describe, expect, it } from 'vitest';
import { buildCurlArgs, buildUrl, defaultCurlOptions, isValidJson, renderCurlCommand } from './curl-generator.service';

function render(
  overrides: Partial<ReturnType<typeof defaultCurlOptions>>,
  shell: 'posix' | 'powershell' | 'cmd' = 'posix',
) {
  const options = { ...defaultCurlOptions(), ...overrides };
  return renderCurlCommand({ args: buildCurlArgs(options), url: buildUrl(options), shell, multiline: false });
}

describe('curl-generator', () => {
  describe('buildUrl', () => {
    it('adds a scheme, a port and query parameters', () => {
      expect(buildUrl({ url: 'example.com/api', port: 8443, query: [{ key: 'q', value: 'a b&c' }] })).to.eql(
        'https://example.com:8443/api?q=a+b%26c',
      );
    });
    it('keeps an unparsable URL as typed', () => {
      expect(buildUrl({ url: 'http://', port: null, query: [] })).to.eql('http://');
    });
  });

  it('builds a plain GET without -X', () => {
    expect(render({ url: 'https://example.com' })).to.eql('curl https://example.com/');
  });

  it('uses --head instead of -X HEAD', () => {
    expect(render({ url: 'https://example.com', method: 'HEAD' })).to.eql('curl --head https://example.com/');
  });

  it('sends JSON with --json and only adds -X when needed', () => {
    expect(render({ url: 'https://example.com', method: 'POST', bodyType: 'json', json: "{a: 1, b: 'x y'}" })).to.eql(
      `curl --json '{"a":1,"b":"x y"}' https://example.com/`,
    );
    expect(render({ url: 'https://example.com', method: 'PUT', bodyType: 'json', json: '{}' })).to.eql(
      `curl -X PUT --json '{}' https://example.com/`,
    );
  });

  it('does not throw on half-typed JSON', () => {
    expect(isValidJson('{"a":')).to.eql(false);
    expect(render({ url: 'https://example.com', method: 'POST', bodyType: 'json', json: '{"a":' })).to.eql(
      `curl --json '{"a":' https://example.com/`,
    );
  });

  it('quotes for each shell', () => {
    const options = { url: 'https://example.com', authType: 'bearer' as const, token: "it's" };
    expect(render(options, 'posix')).to.eql(`curl -H 'Authorization: Bearer it'\\''s' https://example.com/`);
    expect(render(options, 'powershell')).to.eql(`curl.exe -H 'Authorization: Bearer it''s' https://example.com/`);
    expect(render({ url: 'https://example.com', bodyType: 'json', method: 'POST', json: '{"a":1}' }, 'cmd')).to.eql(
      `curl.exe --json "{\\"a\\":1}" https://example.com/`,
    );
  });

  it('adds connection, TLS and output options', () => {
    expect(
      render({
        url: 'https://example.com',
        silent: true,
        showError: true,
        followRedirects: true,
        insecure: true,
        connectTimeout: 5,
        resolve: 'example.com:443:127.0.0.1',
      }),
    ).to.eql('curl -s -S -L -k --connect-timeout 5 --resolve example.com:443:127.0.0.1 https://example.com/');
  });

  it('renders one option per line with the right continuation', () => {
    const args = buildCurlArgs({ ...defaultCurlOptions(), silent: true });
    expect(renderCurlCommand({ args, url: 'https://example.com/', shell: 'posix', multiline: true })).to.eql(
      'curl \\\n  -s \\\n  https://example.com/',
    );
    expect(renderCurlCommand({ args, url: 'https://example.com/', shell: 'powershell', multiline: true })).to.eql(
      'curl.exe `\n  -s `\n  https://example.com/',
    );
  });
});
