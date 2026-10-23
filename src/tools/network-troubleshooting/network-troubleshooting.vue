<script setup lang="ts">
import { useI18n } from 'vue-i18n';
import {
  type NetworkInput,
  buildSections,
  checklist,
  isValidHost,
  recordTypes,
} from './network-troubleshooting.service';
import { useValidation } from '@/composable/validation';

const { t } = useI18n();

const input = useStorage<NetworkInput>(
  'network-troubleshooting:input',
  {
    host: 'example.com',
    port: 443,
    protocol: 'tcp',
    recordType: 'A',
    dnsServer: '',
    sshUser: '',
    sshPort: null,
    localPort: 8080,
    jumpHost: '',
  },
  undefined,
  { mergeDefaults: true },
);

const hostValidation = useValidation({
  source: computed(() => input.value.host),
  rules: [
    {
      message: t('tools.network-troubleshooting.texts.message-invalid-host'),
      validator: (value: string) => !value.trim() || isValidHost(value),
    },
  ],
});

const sections = computed(() => buildSections(input.value));
const recordTypeOptions = recordTypes.map((type) => ({ label: type, value: type }));
</script>

<template>
  <div>
    <c-card mb-2>
      <n-grid cols="1 s:2 l:3" x-gap="12" y-gap="8" responsive="screen">
        <n-gi>
          <c-input-text
            v-model:value="input.host"
            :label="t('tools.network-troubleshooting.texts.label-host')"
            placeholder="example.com or 203.0.113.5"
            :validation="hostValidation"
            raw-text
          />
        </n-gi>
        <n-gi>
          <n-form-item :label="t('tools.network-troubleshooting.texts.label-port')" :show-feedback="false">
            <n-input-number v-model:value="input.port" :min="1" :max="65535" w-full />
            <n-radio-group v-model:value="input.protocol" ml-2>
              <n-radio-button value="tcp">TCP</n-radio-button>
              <n-radio-button value="udp">UDP</n-radio-button>
            </n-radio-group>
          </n-form-item>
        </n-gi>
        <n-gi>
          <n-form-item :label="t('tools.network-troubleshooting.texts.label-record-type')" :show-feedback="false">
            <n-select v-model:value="input.recordType" :options="recordTypeOptions" />
          </n-form-item>
        </n-gi>
        <n-gi>
          <c-input-text
            v-model:value="input.dnsServer"
            :label="t('tools.network-troubleshooting.texts.label-dns-server')"
            placeholder="1.1.1.1 (optional)"
            raw-text
          />
        </n-gi>
        <n-gi>
          <c-input-text
            v-model:value="input.sshUser"
            :label="t('tools.network-troubleshooting.texts.label-ssh-user')"
            placeholder="user"
            raw-text
          />
        </n-gi>
        <n-gi>
          <n-form-item :label="t('tools.network-troubleshooting.texts.label-ssh-port')" :show-feedback="false">
            <n-input-number v-model:value="input.sshPort" :min="1" :max="65535" placeholder="22" clearable w-full />
          </n-form-item>
        </n-gi>
        <n-gi>
          <n-form-item :label="t('tools.network-troubleshooting.texts.label-local-port')" :show-feedback="false">
            <n-input-number v-model:value="input.localPort" :min="1" :max="65535" w-full />
          </n-form-item>
        </n-gi>
        <n-gi>
          <c-input-text
            v-model:value="input.jumpHost"
            :label="t('tools.network-troubleshooting.texts.label-jump-host')"
            placeholder="me@bastion.example.com (optional)"
            raw-text
          />
        </n-gi>
      </n-grid>
    </c-card>

    <c-card :title="t('tools.network-troubleshooting.texts.title-checklist')" mb-2>
      <ol class="checklist">
        <li v-for="step in checklist" :key="step">
          {{ step }}
        </li>
      </ol>
    </c-card>

    <c-card v-for="section in sections" :key="section.id" :title="section.title" mb-2>
      <n-p op-80>
        {{ section.intro }}
      </n-p>
      <OsCommandTabs :linux="section.linux" :macos="section.macos" :windows="section.windows" />
    </c-card>

    <n-p op-70>
      {{ t('tools.network-troubleshooting.texts.tag-see-also') }}
      <c-link to="/curl-generator">curl</c-link> · <c-link to="/vim-memo">vim</c-link> ·
      <c-link to="/sed-command-generator">sed</c-link> · <c-link to="/bash-memo">bash</c-link> ·
      <c-link to="/ipv4-subnet-calculator">subnets</c-link> ·
      <c-link to="/nmap-command-builder">nmap</c-link>
    </n-p>
  </div>
</template>

<style lang="less" scoped>
.checklist {
  margin: 0;
  padding-left: 22px;
  li {
    margin: 6px 0;
  }
}
</style>
