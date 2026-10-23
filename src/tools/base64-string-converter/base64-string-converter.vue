<script setup lang="ts">
import { useI18n } from 'vue-i18n';
import { useCopy } from '@/composable/copy';
import { base64ToText, isValidBase64, textToBase64 } from '@/utils/base64';
import { withDefaultOnError } from '@/utils/defaults';
import { useITStorage, useQueryParam, useQueryParamOrStorage } from '@/composable/queryParams';
import type { OsCommand } from '@/components/OsCommandTabs.vue';
import { quotePosix, quotePowerShell } from '@/utils/shell-quote';

const { t } = useI18n();

const encodeUrlSafe = useITStorage('base64-string-converter:encode-url-safe', false);
const decodeUrlSafe = useITStorage('base64-string-converter:decode-url-safe', false);

const encoding = useQueryParamOrStorage({
  storageName: 'base64-string-converter:encoding',
  name: 'encoding',
  defaultValue: 'utf8',
});

const textInput = useQueryParam({ tool: 'base64-string-converter', name: 'text', defaultValue: '' });
const base64Output = computed(() =>
  textToBase64(textInput.value, { makeUrlSafe: encodeUrlSafe.value, encoding: encoding.value }),
);
const { copy: copyTextBase64 } = useCopy({
  source: base64Output,
  text: t('tools.base64-string-converter.texts.text-base64-string-copied-to-the-clipboard'),
});

const base64Input = useQueryParam({ tool: 'base64-string-converter', name: 'base64', defaultValue: '' });
const textOutput = computed(() =>
  withDefaultOnError(
    () => base64ToText(base64Input.value.trim(), { makeUrlSafe: decodeUrlSafe.value, encoding: encoding.value }),
    '',
  ),
);
const { copy: copyText } = useCopy({
  source: textOutput,
  text: t('tools.base64-string-converter.texts.text-string-copied-to-the-clipboard'),
});
const b64ValidationRules = [
  {
    message: t('tools.base64-string-converter.texts.message-invalid-base64-string'),
    validator: (value: string) => isValidBase64(value.trim(), { makeUrlSafe: decodeUrlSafe.value }),
  },
];
const b64ValidationWatch = [decodeUrlSafe];

const encodings = [
  { label: 'UTF-8', value: 'utf8' },
  { label: 'UTF-8 (Alias: UTF8)', value: 'utf-8' },

  { label: 'UTF-16LE', value: 'utf16le' },
  { label: 'UTF-16BE', value: 'utf16be' },

  { label: 'UTF-7', value: 'utf7' },
  { label: 'UTF-7 (IMAP)', value: 'utf7imap' },

  { label: 'UTF-32LE', value: 'utf32le' },
  { label: 'UTF-32BE', value: 'utf32be' },

  { label: 'ISO-8859-1 (Latin-1)', value: 'latin1' },
  { label: 'ISO-8859-2 (Central European)', value: 'iso-8859-2' },
  { label: 'ISO-8859-3 (South European)', value: 'iso-8859-3' },
  { label: 'ISO-8859-4 (North European)', value: 'iso-8859-4' },
  { label: 'ISO-8859-5 (Cyrillic)', value: 'iso-8859-5' },
  { label: 'ISO-8859-6 (Arabic)', value: 'iso-8859-6' },
  { label: 'ISO-8859-7 (Greek)', value: 'iso-8859-7' },
  { label: 'ISO-8859-8 (Hebrew)', value: 'iso-8859-8' },
  { label: 'ISO-8859-9 (Turkish)', value: 'iso-8859-9' },
  { label: 'ISO-8859-10 (Nordic)', value: 'iso-8859-10' },
  { label: 'ISO-8859-13 (Baltic)', value: 'iso-8859-13' },
  { label: 'ISO-8859-14 (Celtic)', value: 'iso-8859-14' },
  { label: 'ISO-8859-15 (Latin-9)', value: 'iso-8859-15' },
  { label: 'ISO-8859-16 (Romanian)', value: 'iso-8859-16' },

  { label: 'Windows-1250 (Central European)', value: 'win1250' },
  { label: 'Windows-1251 (Cyrillic)', value: 'win1251' },
  { label: 'Windows-1252 (Western European)', value: 'win1252' },
  { label: 'Windows-1253 (Greek)', value: 'win1253' },
  { label: 'Windows-1254 (Turkish)', value: 'win1254' },
  { label: 'Windows-1255 (Hebrew)', value: 'win1255' },
  { label: 'Windows-1256 (Arabic)', value: 'win1256' },
  { label: 'Windows-1257 (Baltic)', value: 'win1257' },
  { label: 'Windows-1258 (Vietnamese)', value: 'win1258' },

  { label: 'KOI8-R (Russian)', value: 'koi8-r' },
  { label: 'KOI8-U (Ukrainian)', value: 'koi8-u' },

  { label: 'GBK (Simplified Chinese)', value: 'gbk' },
  { label: 'GB2312 (Simplified Chinese)', value: 'gb2312' },
  { label: 'GB18030 (Simplified Chinese)', value: 'gb18030' },

  { label: 'Big5 (Traditional Chinese)', value: 'big5' },

  { label: 'Shift-JIS (Japanese)', value: 'shift_jis' },
  { label: 'EUC-JP (Japanese)', value: 'euc-jp' },

  { label: 'MacRoman', value: 'macroman' },
  { label: 'MacGreek', value: 'macgreek' },
  { label: 'MacTurkish', value: 'macturkish' },
  { label: 'MacCyrillic', value: 'maccyrillic' },
  { label: 'MacCentralEurope', value: 'maccentraleurope' },
  { label: 'MacIceland', value: 'maciceland' },
];

// --- The same thing on the command line ----------------------------------------------------
// Short samples keep the commands readable; the commands work on any text.
const sampleText = computed(() => (textInput.value || 'hello world').slice(0, 60));
const sampleBase64 = computed(() => (base64Input.value.trim() || 'aGVsbG8gd29ybGQ=').slice(0, 80));
const urlSafeEncode = computed(() => (encodeUrlSafe.value ? " | tr '+/' '-_' | tr -d '='" : ''));
const urlSafeDecode = computed(() => (decodeUrlSafe.value ? "tr '_-' '/+' | " : ''));
const encodingNote = computed(() =>
  encoding.value === 'utf8' || encoding.value === 'utf-8'
    ? undefined
    : `These commands use the terminal's own encoding (normally UTF-8). For ${encoding.value}, convert first, e.g. iconv -f utf-8 -t ${encoding.value}.`,
);

const linuxCommands = computed<OsCommand[]>(() => [
  {
    title: 'Encode text',
    code: `printf '%s' ${quotePosix(sampleText.value)} | base64 -w0${urlSafeEncode.value}`,
    note: `printf, not echo: echo adds a newline that would be encoded too. -w0 keeps it on one line (GNU base64 wraps at 76 characters).${encodingNote.value ? ` ${encodingNote.value}` : ''}`,
  },
  {
    title: 'Decode',
    code: `printf '%s' ${quotePosix(sampleBase64.value)} | ${urlSafeDecode.value}base64 -d`,
    note: decodeUrlSafe.value
      ? 'URL-safe input: tr puts back + and / first. base64 -d may complain about missing = padding but still prints the result.'
      : undefined,
  },
  {
    title: 'Encode / decode a file',
    code: 'base64 -w0 photo.png > photo.png.b64\nbase64 -d photo.png.b64 > photo-copy.png',
  },
]);

const macCommands = computed<OsCommand[]>(() => [
  {
    title: 'Encode text',
    code: `printf '%s' ${quotePosix(sampleText.value)} | base64${urlSafeEncode.value}`,
    note: 'macOS base64 does not wrap lines, so it needs no -w0.',
  },
  {
    title: 'Decode',
    code: `printf '%s' ${quotePosix(sampleBase64.value)} | ${urlSafeDecode.value}base64 -d`,
    note: 'Before macOS 13 the decode flag is -D.',
  },
  {
    title: 'Encode / decode a file',
    code: 'base64 -i photo.png -o photo.png.b64\nbase64 -d -i photo.png.b64 -o photo-copy.png',
  },
]);

const windowsCommands = computed<OsCommand[]>(() => [
  {
    title: 'Encode text (PowerShell)',
    code: `[Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes(${quotePowerShell(sampleText.value, { always: true })}))${encodeUrlSafe.value ? ".TrimEnd('=').Replace('+', '-').Replace('/', '_')" : ''}`,
    note: 'Text has to become bytes first: UTF8 here. [Text.Encoding]::Unicode would give UTF-16, a different result.',
  },
  {
    title: 'Decode (PowerShell)',
    code: decodeUrlSafe.value
      ? `$b = ${quotePowerShell(sampleBase64.value, { always: true })}.Replace('-', '+').Replace('_', '/')\n$b = $b.PadRight($b.Length + (4 - $b.Length % 4) % 4, '=')\n[Text.Encoding]::UTF8.GetString([Convert]::FromBase64String($b))`
      : `[Text.Encoding]::UTF8.GetString([Convert]::FromBase64String(${quotePowerShell(sampleBase64.value, { always: true })}))`,
  },
  {
    title: 'Encode / decode a file',
    code: "[Convert]::ToBase64String([IO.File]::ReadAllBytes('photo.png')) | Set-Content photo.png.b64\n[IO.File]::WriteAllBytes('photo-copy.png', [Convert]::FromBase64String((Get-Content -Raw photo.png.b64)))",
    note: 'cmd also has certutil -encode / -decode, which adds BEGIN/END CERTIFICATE lines around the data.',
  },
]);
</script>

<template>
  <c-card :title="t('tools.base64-string-converter.texts.title-string-to-base64')">
    <n-space>
      <n-form-item :label="t('tools.base64-string-converter.texts.label-encode-url-safe')" label-placement="left">
        <n-switch v-model:value="encodeUrlSafe" />
      </n-form-item>
      <c-select
        :label="t('tools.base64-string-converter.texts.text-encoding')"
        label-position="left"
        style="width: 400px"
        v-model:value="encoding"
        :options="encodings"
        searchable
      />
    </n-space>
    <c-input-text
      v-model:value="textInput"
      multiline
      :placeholder="t('tools.base64-string-converter.texts.placeholder-put-your-string-here')"
      rows="5"
      :label="t('tools.base64-string-converter.texts.label-string-to-encode')"
      raw-text
      mb-5
    />

    <c-input-text
      :label="t('tools.base64-string-converter.texts.label-base64-of-string')"
      :value="base64Output"
      multiline
      readonly
      :placeholder="
        t('tools.base64-string-converter.texts.placeholder-the-base64-encoding-of-your-string-will-be-here')
      "
      rows="5"
      mb-5
    />

    <div flex justify-center>
      <c-button @click="copyTextBase64()">
        {{ t('tools.base64-string-converter.texts.tag-copy-base64') }}
      </c-button>
    </div>
  </c-card>

  <c-card :title="t('tools.base64-string-converter.texts.title-base64-to-string')">
    <n-space>
      <n-form-item :label="t('tools.base64-string-converter.texts.label-decode-url-safe')" label-placement="left">
        <n-switch v-model:value="decodeUrlSafe" />
      </n-form-item>
      <c-select
        :label="t('tools.base64-string-converter.texts.text-encoding')"
        label-position="left"
        style="width: 400px"
        v-model:value="encoding"
        :options="encodings"
        searchable
      />
    </n-space>
    <c-input-text
      v-model:value="base64Input"
      multiline
      :placeholder="t('tools.base64-string-converter.texts.placeholder-your-base64-string')"
      rows="5"
      :validation-rules="b64ValidationRules"
      :validation-watch="b64ValidationWatch"
      :label="t('tools.base64-string-converter.texts.label-base64-string-to-decode')"
      mb-5
    />

    <c-input-text
      v-model:value="textOutput"
      :label="t('tools.base64-string-converter.texts.label-decoded-string')"
      :placeholder="t('tools.base64-string-converter.texts.placeholder-the-decoded-string-will-be-here')"
      multiline
      rows="5"
      readonly
      mb-5
    />

    <div flex justify-center>
      <c-button @click="copyText()">
        {{ t('tools.base64-string-converter.texts.tag-copy-decoded-string') }}
      </c-button>
    </div>
  </c-card>

  <c-card :title="t('tools.base64-string-converter.texts.title-commands')">
    <OsCommandTabs :linux="linuxCommands" :macos="macCommands" :windows="windowsCommands" />
  </c-card>
</template>
