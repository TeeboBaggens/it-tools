<script setup lang="ts">
import Copy from '~icons/tabler/copy';
import { useThemeVars } from 'naive-ui';
import hljs from 'highlight.js/lib/core';
import bashHljs from 'highlight.js/lib/languages/bash';
import powershellHljs from 'highlight.js/lib/languages/powershell';
import { useCopy } from '@/composable/copy';
import { translate as t } from '@/plugins/i18n.plugin';

// One command (or a few related lines) to show for an OS, with an optional explanation.
export interface OsCommand {
  title: string;
  code: string;
  note?: string;
  // Defaults to bash on Linux/macOS and powershell on Windows.
  language?: 'bash' | 'powershell' | 'txt';
}

export type OsName = 'linux' | 'macos' | 'windows';

const props = defineProps<{
  linux?: OsCommand[];
  macos?: OsCommand[];
  windows?: OsCommand[];
  // Shown above the tabs, e.g. what the commands below have in common.
  intro?: string;
}>();

hljs.registerLanguage('bash', bashHljs);
hljs.registerLanguage('powershell', powershellHljs);

const themeVars = useThemeVars();

function guessOs(): OsName {
  const platform =
    (navigator as Navigator & { userAgentData?: { platform?: string } }).userAgentData?.platform ??
    navigator.platform ??
    '';
  if (/win/i.test(platform)) {
    return 'windows';
  }
  if (/mac/i.test(platform)) {
    return 'macos';
  }
  return 'linux';
}

// Shared by every tool that uses this component, so a Windows user only switches once.
const selectedOs = useStorage<OsName>('os-command-tabs:os', guessOs());

const tabs = computed(() =>
  (
    [
      { name: 'linux', label: 'Linux', commands: props.linux },
      { name: 'macos', label: 'macOS', commands: props.macos },
      { name: 'windows', label: 'Windows', commands: props.windows },
    ] as const
  ).filter((tab) => tab.commands && tab.commands.length > 0),
);

const { copy } = useCopy({ text: t('tools.copy.text.copied-to-the-clipboard') });

function languageFor(os: OsName, command: OsCommand) {
  return command.language ?? (os === 'windows' ? 'powershell' : 'bash');
}
</script>

<template>
  <div>
    <n-p v-if="intro" mb-2 op-80>
      {{ intro }}
    </n-p>
    <n-tabs v-model:value="selectedOs" type="line" animated>
      <n-tab-pane v-for="tab in tabs" :key="tab.name" :name="tab.name" :tab="tab.label">
        <div v-for="(command, index) in tab.commands" :key="index" class="os-command">
          <div class="os-command-title">
            {{ command.title }}
          </div>
          <div class="os-command-code">
            <n-config-provider :hljs="hljs">
              <n-code :code="command.code" :language="languageFor(tab.name, command)" word-wrap :trim="false" />
            </n-config-provider>
            <c-tooltip :tooltip="t('textareaCopyable.copy')" position="left" class="os-command-copy">
              <c-button circle variant="text" size="small" @click="copy(command.code)">
                <n-icon size="16" :component="Copy" />
              </c-button>
            </c-tooltip>
          </div>
          <div v-if="command.note" class="os-command-note">
            {{ command.note }}
          </div>
        </div>
      </n-tab-pane>
    </n-tabs>
  </div>
</template>

<style lang="less" scoped>
.os-command {
  margin-bottom: 14px;
}
.os-command-title {
  font-weight: 600;
  margin-bottom: 4px;
}
.os-command-code {
  position: relative;
  padding: 8px 40px 8px 10px;
  border-radius: 4px;
  background: v-bind('themeVars.codeColor');
  overflow-x: auto;
}
.os-command-copy {
  position: absolute;
  top: 4px;
  right: 4px;
}
.os-command-note {
  margin-top: 4px;
  font-size: 13px;
  opacity: 0.75;
}
</style>
