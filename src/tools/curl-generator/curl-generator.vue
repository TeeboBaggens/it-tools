<script setup lang="ts">
import { useI18n } from 'vue-i18n';
import {
  type CurlOptions,
  buildCurlArgs,
  buildUrl,
  defaultCurlOptions,
  isValidJson,
  renderCurlCommand,
} from './curl-generator.service';
import type { OsCommand } from '@/components/OsCommandTabs.vue';
import { useValidation } from '@/composable/validation';

const { t } = useI18n();

// Not persisted on purpose: the form can hold passwords and tokens.
const form = ref<CurlOptions>(defaultCurlOptions());
const multiline = ref(true);

const methods = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'].map((m) => ({ label: m, value: m }));

const bodyTypes = [
  { value: 'none', label: 'No body' },
  { value: 'json', label: 'JSON' },
  { value: 'urlencoded', label: 'Form (URL-encoded)' },
  { value: 'multipart', label: 'Multipart form / file upload' },
  { value: 'raw', label: 'Raw text' },
  { value: 'file', label: 'Body from a file' },
];

const authTypes = [
  { value: 'none', label: 'None' },
  { value: 'basic', label: 'Basic' },
  { value: 'digest', label: 'Digest' },
  { value: 'bearer', label: 'Bearer token' },
];

const jsonBodyValidation = useValidation({
  source: computed(() => form.value.json),
  rules: [
    {
      message: t('tools.curl-generator.texts.message-invalid-json-string'),
      validator: (value: string) => isValidJson(value),
    },
  ],
});

// A body with GET is almost never what's meant: switch to POST when one is picked.
watch(
  () => form.value.bodyType,
  (bodyType, previous) => {
    if (bodyType !== 'none' && previous === 'none' && ['GET', 'HEAD'].includes(form.value.method)) {
      form.value.method = 'POST';
    }
  },
);

const url = computed(() => buildUrl(form.value));
const args = computed(() => buildCurlArgs(form.value));

const posixCommand = computed(() =>
  renderCurlCommand({ args: args.value, url: url.value, shell: 'posix', multiline: multiline.value }),
);

const linuxCommands = computed<OsCommand[]>(() => [{ title: 'bash / zsh', code: posixCommand.value }]);
const macCommands = computed<OsCommand[]>(() => [
  {
    title: 'zsh / bash (Terminal)',
    code: posixCommand.value,
    note: 'macOS ships curl. Its build has no HTTP/3; brew install curl gets a newer one.',
  },
]);
const windowsCommands = computed<OsCommand[]>(() => [
  {
    title: 'PowerShell',
    code: renderCurlCommand({ args: args.value, url: url.value, shell: 'powershell', multiline: multiline.value }),
    note: 'Type curl.exe, not curl: in Windows PowerShell 5.1, curl is an alias for Invoke-WebRequest. Windows 10 and 11 include curl.exe. PowerShell 5.1 drops double quotes inside arguments (fixed in PowerShell 7.3), so for a JSON body there, save it to a file and use --json "@body.json".',
  },
  {
    title: 'Command Prompt (cmd)',
    code: renderCurlCommand({ args: args.value, url: url.value, shell: 'cmd', multiline: multiline.value }),
    note: 'cmd only understands double quotes; ^ continues a line. A % in a value can be expanded as a variable.',
    language: 'txt',
  },
]);
</script>

<template>
  <div>
    <c-card :title="t('tools.curl-generator.texts.title-request')" mb-2>
      <c-input-text
        v-model:value="form.url"
        :label="t('tools.curl-generator.texts.label-url')"
        label-position="left"
        label-width="90px"
        :placeholder="t('tools.curl-generator.texts.placeholder-enter-url')"
        raw-text
        mb-2
      />
      <n-space mb-2>
        <n-form-item
          :label="t('tools.curl-generator.texts.label-method')"
          label-placement="left"
          :show-feedback="false"
        >
          <n-select v-model:value="form.method" :options="methods" style="width: 130px" />
        </n-form-item>
        <n-form-item :label="t('tools.curl-generator.texts.label-port')" label-placement="left" :show-feedback="false">
          <n-input-number
            v-model:value="form.port"
            :min="1"
            :max="65535"
            clearable
            placeholder="from URL"
            style="width: 150px"
          />
        </n-form-item>
      </n-space>
      <n-p op-70 mb-2>
        No port: 443 for https, 80 for http. Setting one here writes it into the URL (https://host:8443/), which is how
        curl takes it.
      </n-p>
      <n-form-item :label="t('tools.curl-generator.texts.label-query')" :show-feedback="false">
        <n-dynamic-input
          v-model:value="form.query"
          preset="pair"
          :key-placeholder="t('tools.curl-generator.texts.placeholder-key')"
          :value-placeholder="t('tools.curl-generator.texts.placeholder-value')"
        />
      </n-form-item>
    </c-card>

    <c-card :title="t('tools.curl-generator.texts.title-generated-curl-command')" mb-2>
      <n-checkbox v-model:checked="multiline" mb-2>
        {{ t('tools.curl-generator.texts.label-multiline') }}
      </n-checkbox>
      <OsCommandTabs :linux="linuxCommands" :macos="macCommands" :windows="windowsCommands" />
    </c-card>

    <c-card :title="t('tools.curl-generator.texts.title-http-headers')" mb-2>
      <n-dynamic-input
        v-model:value="form.headers"
        preset="pair"
        :key-placeholder="t('tools.curl-generator.texts.placeholder-header')"
        :value-placeholder="t('tools.curl-generator.texts.placeholder-value')"
      />
    </c-card>

    <c-card :title="t('tools.curl-generator.texts.title-body')" mb-2>
      <n-radio-group v-model:value="form.bodyType" mb-2>
        <n-radio v-for="type in bodyTypes" :key="type.value" :value="type.value" :label="type.label" />
      </n-radio-group>
      <c-input-text
        v-if="form.bodyType === 'json'"
        v-model:value="form.json"
        multiline
        rows="6"
        :placeholder="t('tools.curl-generator.texts.placeholder-enter-json-body')"
        :validation="jsonBodyValidation"
        raw-text
      />
      <template v-else-if="form.bodyType === 'urlencoded' || form.bodyType === 'multipart'">
        <n-dynamic-input
          v-model:value="form.formFields"
          preset="pair"
          :key-placeholder="t('tools.curl-generator.texts.placeholder-key')"
          :value-placeholder="
            form.bodyType === 'multipart'
              ? 'value, or @file.png to upload'
              : t('tools.curl-generator.texts.placeholder-value')
          "
        />
      </template>
      <template v-else-if="form.bodyType === 'raw'">
        <c-input-text
          v-model:value="form.rawContentType"
          label="Content-Type:"
          label-position="left"
          label-width="110px"
          raw-text
          mb-2
        />
        <c-input-text v-model:value="form.rawBody" multiline rows="5" placeholder="request body" raw-text />
      </template>
      <c-input-text
        v-else-if="form.bodyType === 'file'"
        v-model:value="form.bodyFile"
        label="File:"
        label-position="left"
        label-width="110px"
        placeholder="body.bin"
        raw-text
      />
    </c-card>

    <c-card :title="t('tools.curl-generator.texts.title-auth')" mb-2>
      <n-radio-group v-model:value="form.authType" mb-2>
        <n-radio v-for="type in authTypes" :key="type.value" :value="type.value" :label="type.label" />
      </n-radio-group>
      <n-space v-if="form.authType === 'basic' || form.authType === 'digest'">
        <c-input-text v-model:value="form.username" placeholder="username" raw-text />
        <c-input-text
          v-model:value="form.password"
          type="password"
          placeholder="password (leave empty to be prompted)"
          raw-text
        />
      </n-space>
      <c-input-text v-else-if="form.authType === 'bearer'" v-model:value="form.token" placeholder="token" raw-text />
    </c-card>

    <n-grid cols="1 m:2" x-gap="12" responsive="screen">
      <n-gi>
        <c-card :title="t('tools.curl-generator.texts.title-output')" mb-2>
          <n-space vertical>
            <n-checkbox v-model:checked="form.silent">-s silent: no progress meter</n-checkbox>
            <n-checkbox v-model:checked="form.showError">-S still show errors when silent</n-checkbox>
            <n-checkbox v-model:checked="form.verbose">-v verbose: show the whole conversation</n-checkbox>
            <n-checkbox v-model:checked="form.includeHeaders">-i include response headers</n-checkbox>
            <n-checkbox v-model:checked="form.headOnly">--head headers only (HEAD request)</n-checkbox>
            <n-checkbox v-model:checked="form.fail">--fail exit with an error on HTTP 4xx/5xx</n-checkbox>
            <n-checkbox v-model:checked="form.writeStatus">-w print status code and time</n-checkbox>
            <n-checkbox v-model:checked="form.remoteName" :disabled="!!form.outputFile"
              >-O save under the URL's file name</n-checkbox
            >
            <c-input-text
              v-model:value="form.outputFile"
              label="-o save to file:"
              label-position="left"
              label-width="130px"
              placeholder="out.html"
              raw-text
            />
          </n-space>
        </c-card>

        <c-card :title="t('tools.curl-generator.texts.title-redirects')" mb-2>
          <n-space vertical>
            <n-checkbox v-model:checked="form.followRedirects">-L follow redirects</n-checkbox>
            <template v-if="form.followRedirects">
              <n-form-item label="--max-redirs" label-placement="left" :show-feedback="false">
                <n-input-number v-model:value="form.maxRedirects" :min="0" clearable placeholder="50" />
              </n-form-item>
              <n-checkbox v-model:checked="form.locationTrusted"
                >--location-trusted send credentials to redirect targets</n-checkbox
              >
            </template>
          </n-space>
        </c-card>
      </n-gi>

      <n-gi>
        <c-card :title="t('tools.curl-generator.texts.title-tls')" mb-2>
          <n-space vertical>
            <n-checkbox v-model:checked="form.insecure">-k ignore certificate errors (testing only)</n-checkbox>
            <c-input-text
              v-model:value="form.cacert"
              label="--cacert"
              label-position="left"
              label-width="110px"
              placeholder="my-ca.pem"
              raw-text
            />
            <c-input-text
              v-model:value="form.clientCert"
              label="--cert"
              label-position="left"
              label-width="110px"
              placeholder="client.pem"
              raw-text
            />
            <c-input-text
              v-model:value="form.clientKey"
              label="--key"
              label-position="left"
              label-width="110px"
              placeholder="client.key"
              raw-text
            />
            <n-form-item label="Minimum TLS" label-placement="left" :show-feedback="false">
              <n-radio-group v-model:value="form.tlsMin">
                <n-radio value="" label="default" />
                <n-radio value="1.2" label="1.2" />
                <n-radio value="1.3" label="1.3" />
              </n-radio-group>
            </n-form-item>
            <n-form-item label="HTTP version" label-placement="left" :show-feedback="false">
              <n-radio-group v-model:value="form.httpVersion">
                <n-radio value="" label="default" />
                <n-radio value="1.1" label="1.1" />
                <n-radio value="2" label="2" />
                <n-radio value="3" label="3" />
              </n-radio-group>
            </n-form-item>
          </n-space>
        </c-card>

        <c-card :title="t('tools.curl-generator.texts.title-connection')" mb-2>
          <n-space vertical>
            <n-form-item label="--connect-timeout (s)" label-placement="left" :show-feedback="false">
              <n-input-number v-model:value="form.connectTimeout" :min="0" clearable placeholder="none" />
            </n-form-item>
            <n-form-item label="-m max time (s)" label-placement="left" :show-feedback="false">
              <n-input-number v-model:value="form.maxTime" :min="0" clearable placeholder="none" />
            </n-form-item>
            <n-form-item label="--retry" label-placement="left" :show-feedback="false">
              <n-input-number v-model:value="form.retry" :min="0" clearable placeholder="none" />
            </n-form-item>
            <n-form-item label="IP version" label-placement="left" :show-feedback="false">
              <n-radio-group v-model:value="form.ipVersion">
                <n-radio value="" label="any" />
                <n-radio value="4" label="-4" />
                <n-radio value="6" label="-6" />
              </n-radio-group>
            </n-form-item>
            <n-checkbox v-model:checked="form.compressed">--compressed ask for gzip/brotli</n-checkbox>
            <c-input-text
              v-model:value="form.resolve"
              label="--resolve"
              label-position="left"
              label-width="110px"
              placeholder="host:443:203.0.113.5"
              raw-text
            />
            <c-input-text
              v-model:value="form.proxy"
              label="-x proxy"
              label-position="left"
              label-width="110px"
              placeholder="socks5h://127.0.0.1:1080"
              raw-text
            />
            <c-input-text
              v-model:value="form.userAgent"
              label="-A user agent"
              label-position="left"
              label-width="110px"
              raw-text
            />
            <c-input-text
              v-model:value="form.cookie"
              label="-b cookies"
              label-position="left"
              label-width="110px"
              placeholder="name=value or cookies.txt"
              raw-text
            />
            <c-input-text
              v-model:value="form.cookieJar"
              label="-c cookie jar"
              label-position="left"
              label-width="110px"
              placeholder="cookies.txt"
              raw-text
            />
            <c-input-text
              v-model:value="form.limitRate"
              label="--limit-rate"
              label-position="left"
              label-width="110px"
              placeholder="1M"
              raw-text
            />
          </n-space>
        </c-card>
      </n-gi>
    </n-grid>

    <c-card :title="t('tools.curl-generator.texts.title-explained')">
      <n-table :bordered="false" size="small">
        <tbody>
          <tr v-for="(arg, index) in args" :key="index">
            <td class="flag">
              <code>{{ arg.flag }}</code>
            </td>
            <td>
              {{ arg.explain }}
              <div v-if="arg.value !== undefined" op-70>
                <code>{{ arg.value }}</code>
              </div>
            </td>
          </tr>
          <tr>
            <td class="flag">
              <code>URL</code>
            </td>
            <td>
              Where to send the request: scheme, host, optional :port, path and ?query.
              <div op-70>
                <code>{{ url }}</code>
              </div>
            </td>
          </tr>
        </tbody>
      </n-table>
    </c-card>
  </div>
</template>

<style lang="less" scoped>
.flag {
  white-space: nowrap;
  vertical-align: top;
}
</style>
