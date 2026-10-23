<script setup lang="ts">
import { useI18n } from 'vue-i18n';
import {
  type SecretScope,
  buildLinuxCommands,
  buildMacCommands,
  buildWindowsCommands,
  explanations,
  isValidVariableName,
  whyNotEcho,
} from './secret-env-variable.service';
import { useValidation } from '@/composable/validation';

const { t } = useI18n();

// Only the variable's name is typed here; the secret itself never touches this page.
const name = useStorage('secret-env-variable:name', 'API_TOKEN');
const scope = ref<SecretScope>('session');
const command = ref('');

const nameValidation = useValidation({
  source: name,
  rules: [
    {
      message: t('tools.secret-env-variable.texts.message-invalid-name'),
      validator: (value: string) => isValidVariableName(value),
    },
  ],
});

const options = computed(() => ({ name: name.value, scope: scope.value, command: command.value }));
const linux = computed(() => buildLinuxCommands(options.value));
const macos = computed(() => buildMacCommands(options.value));
const windows = computed(() => buildWindowsCommands(options.value));
</script>

<template>
  <div>
    <c-alert mb-3>
      {{ t('tools.secret-env-variable.texts.tag-never-here') }}
    </c-alert>

    <c-card mb-2>
      <c-input-text
        v-model:value="name"
        :label="t('tools.secret-env-variable.texts.label-name')"
        label-position="left"
        label-width="140px"
        :validation="nameValidation"
        raw-text
        mb-2
      />
      <n-form-item
        :label="t('tools.secret-env-variable.texts.label-scope')"
        label-placement="left"
        label-width="140px"
        :show-feedback="false"
      >
        <n-radio-group v-model:value="scope">
          <n-radio value="session" :label="t('tools.secret-env-variable.texts.label-scope-session')" />
          <n-radio value="command" :label="t('tools.secret-env-variable.texts.label-scope-command')" />
          <n-radio value="persist" :label="t('tools.secret-env-variable.texts.label-scope-persist')" />
        </n-radio-group>
      </n-form-item>
      <c-input-text
        v-if="scope === 'command'"
        v-model:value="command"
        :label="t('tools.secret-env-variable.texts.label-command')"
        label-position="left"
        label-width="140px"
        placeholder="your-command --flag"
        raw-text
        mt-2
      />
    </c-card>

    <c-card :title="t('tools.secret-env-variable.texts.title-commands')" mb-2>
      <OsCommandTabs :linux="linux" :macos="macos" :windows="windows" />
    </c-card>

    <c-card :title="t('tools.secret-env-variable.texts.title-why')" mb-2>
      <ul class="why">
        <li v-for="line in whyNotEcho" :key="line">
          {{ line }}
        </li>
      </ul>
    </c-card>

    <c-card :title="t('tools.secret-env-variable.texts.title-explained')">
      <n-table :bordered="false" size="small">
        <tbody>
          <tr v-for="item in explanations" :key="item.part">
            <td class="part">
              <code>{{ item.part }}</code>
            </td>
            <td>{{ item.explain }}</td>
          </tr>
        </tbody>
      </n-table>
    </c-card>
  </div>
</template>

<style lang="less" scoped>
.part {
  white-space: nowrap;
  vertical-align: top;
}
.why {
  margin: 0;
  padding-left: 20px;
  li {
    margin: 6px 0;
  }
}
</style>
