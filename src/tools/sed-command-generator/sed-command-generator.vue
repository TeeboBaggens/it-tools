<script setup lang="ts">
import { useI18n } from 'vue-i18n';
import {
  type SedOptions,
  buildPowerShellCommand,
  buildSedCommand,
  explainSed,
  previewSed,
} from './sed-command-generator.service';
import type { OsCommand } from '@/components/OsCommandTabs.vue';

const { t } = useI18n();
const form = ref<SedOptions>({
  commandType: 'substitute',
  pattern: '',
  replacement: '',
  delimiter: '/',
  global: true,
  caseInsensitive: false,
  inPlace: false,
  backupSuffix: '',
  extendedRegex: false,
  targetFile: '',
});
const sampleText = ref('foo bar foo\n# a comment\nFOO baz');

const preview = computed(() => previewSed(form.value, sampleText.value));
const explanation = computed(() => explainSed(form.value));

const linuxCommands = computed<OsCommand[]>(() => [{ title: 'GNU sed', code: buildSedCommand(form.value, 'gnu') }]);
const macCommands = computed<OsCommand[]>(() => [
  {
    title: 'BSD sed (built in)',
    code: buildSedCommand(form.value, 'bsd'),
    note: "macOS sed needs an argument after -i: '' for no backup. brew install gnu-sed gives you gsed, which behaves like Linux.",
  },
]);
const windowsCommands = computed<OsCommand[]>(() => [
  {
    title: 'PowerShell',
    code: buildPowerShellCommand(form.value),
    note: 'Windows has no sed. -replace / -match use .NET regular expressions (groups are $1 and the whole match $0, not \\1 and &), and ignore case unless you write -creplace / -cmatch. With Set-Content, Windows PowerShell 5.1 writes the system code page: add -Encoding utf8 for UTF-8. In WSL or Git Bash, the Linux command works as is.',
  },
]);
</script>

<template>
  <div>
    <n-space justify="center" mb-1 mt-1>
      <n-p>
        {{ t('tools.sed-command-generator.texts.tag-for-more-information-about') }}
        <code>{{ t('tools.sed-command-generator.texts.tag-sed') }}</code>
        {{ t('tools.sed-command-generator.texts.tag-command-see') }}
        <c-link target="_blank" to="/sed-memo">
          {{ t('tools.sed-command-generator.texts.tag-sed-command-cheatsheet') }}
        </c-link>
      </n-p>
    </n-space>

    <n-form :model="form" label-placement="left" label-width="120px" mt-2>
      <n-space justify="center" mb-1 mt-1>
        <n-form-item :label="t('tools.sed-command-generator.texts.label-command-type')">
          <n-radio-group v-model:value="form.commandType" name="commandType">
            <n-radio-button value="substitute">
              {{ t('tools.sed-command-generator.texts.tag-substitute') }}
            </n-radio-button>
            <n-radio-button value="delete">
              {{ t('tools.sed-command-generator.texts.tag-delete') }}
            </n-radio-button>
            <n-radio-button value="extract">
              {{ t('tools.sed-command-generator.texts.tag-extract') }}
            </n-radio-button>
            <n-radio-button value="number">
              {{ t('tools.sed-command-generator.texts.tag-number-lines') }}
            </n-radio-button>
          </n-radio-group>
        </n-form-item>
      </n-space>

      <n-card v-if="form.commandType !== 'number'" :title="t('tools.sed-command-generator.texts.title-search-pattern')">
        <n-input
          v-model:value="form.pattern"
          :placeholder="t('tools.sed-command-generator.texts.placeholder-e-g-foo')"
        />
        <c-link target="_blank" to="/regex-memo">
          {{ t('tools.sed-command-generator.texts.tag-see-regex-cheatsheet') }}
        </c-link>
      </n-card>

      <n-form-item
        v-if="form.commandType === 'substitute'"
        :label="t('tools.sed-command-generator.texts.label-replacement')"
        mt-3
      >
        <n-input
          v-model:value="form.replacement"
          :placeholder="t('tools.sed-command-generator.texts.placeholder-e-g-bar')"
        />
      </n-form-item>

      <n-form-item
        v-if="form.commandType === 'substitute'"
        :label="t('tools.sed-command-generator.texts.label-delimiter')"
      >
        <n-input
          v-model:value="form.delimiter"
          :placeholder="t('tools.sed-command-generator.texts.placeholder-e-g-or')"
        />
      </n-form-item>

      <n-form-item v-if="form.commandType === 'substitute'" :label="t('tools.sed-command-generator.texts.label-flags')">
        <n-checkbox v-model:checked="form.global">
          {{ t('tools.sed-command-generator.texts.tag-global-g') }}
        </n-checkbox>
        <n-checkbox v-model:checked="form.caseInsensitive">
          {{ t('tools.sed-command-generator.texts.tag-case-insensitive-i') }}
        </n-checkbox>
      </n-form-item>

      <n-form-item :label="t('tools.sed-command-generator.texts.label-options')">
        <n-checkbox v-model:checked="form.inPlace">
          {{ t('tools.sed-command-generator.texts.tag-in-place-editing-i') }}
        </n-checkbox>
        <n-checkbox v-model:checked="form.extendedRegex">
          {{ t('tools.sed-command-generator.texts.tag-extended-regex-e') }}
        </n-checkbox>
      </n-form-item>

      <n-form-item v-if="form.inPlace" :label="t('tools.sed-command-generator.texts.label-backup-suffix')">
        <n-input v-model:value="form.backupSuffix" placeholder=".bak (empty: no backup)" />
      </n-form-item>

      <n-form-item :label="t('tools.sed-command-generator.texts.label-target-file')">
        <n-input
          v-model:value="form.targetFile"
          :placeholder="t('tools.sed-command-generator.texts.placeholder-e-g-file-txt')"
        />
      </n-form-item>

      <c-card :title="t('tools.sed-command-generator.texts.title-generated-sed-command')" mt-3>
        <OsCommandTabs :linux="linuxCommands" :macos="macCommands" :windows="windowsCommands" />
      </c-card>

      <c-card :title="t('tools.sed-command-generator.texts.title-try-it')" mt-3>
        <n-grid cols="1 m:2" x-gap="12" responsive="screen">
          <n-gi>
            <c-input-text
              v-model:value="sampleText"
              :label="t('tools.sed-command-generator.texts.label-sample-input')"
              multiline
              rows="6"
              raw-text
            />
          </n-gi>
          <n-gi>
            <c-input-text
              :value="preview.error || preview.output"
              :label="t('tools.sed-command-generator.texts.label-sample-output')"
              multiline
              rows="6"
              readonly
              raw-text
            />
          </n-gi>
        </n-grid>
        <n-p op-70 mt-2>
          {{ t('tools.sed-command-generator.texts.tag-preview-note') }}
        </n-p>
      </c-card>

      <c-card :title="t('tools.sed-command-generator.texts.title-explained')" mt-3>
        <n-table :bordered="false" size="small">
          <tbody>
            <tr v-for="(item, index) in explanation" :key="index">
              <td class="part">
                <code>{{ item.part }}</code>
              </td>
              <td>{{ item.explain }}</td>
            </tr>
          </tbody>
        </n-table>
      </c-card>
    </n-form>
  </div>
</template>

<style lang="less" scoped>
.part {
  white-space: nowrap;
  vertical-align: top;
}
</style>
