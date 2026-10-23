<script setup lang="ts">
import { useI18n } from 'vue-i18n';
import { useThemeVars } from 'naive-ui';

import InputCopyable from '../../components/InputCopyable.vue';
import {
  applyUmask,
  computeChmodOctalRepresentation,
  computeIcaclsGrants,
  computeChmodSymbolicRepresentation,
  computePermissionsFromChmodOctalRepresentation,
  computePermissionsFromChmodSymbolicRepresentation,
  computeUmaskRepresentation,
  isValidUmask,
} from './chmod-calculator.service';

import type { Group, GroupPermissions, Scope } from './chmod-calculator.types';
import type { OsCommand } from '@/components/OsCommandTabs.vue';
import { quotePosix, quotePowerShell } from '@/utils/shell-quote';
import { useValidation } from '@/composable/validation';

const { t } = useI18n();

const themeVars = useThemeVars();

const scopes: { scope: Scope; title: string }[] = [
  { scope: 'read', title: 'Read (4)' },
  { scope: 'write', title: 'Write (2)' },
  { scope: 'execute', title: 'Execute (1)' },
];
const groups: Group[] = ['owner', 'group', 'public'];

const permissions = ref({
  owner: { read: false, write: false, execute: false },
  group: { read: false, write: false, execute: false },
  public: { read: false, write: false, execute: false },
  flags: { setuid: false, setgid: false, stickybit: false },
});

const octalPermissionsInput = ref('000');
const octalPermissionsInputValidation = useValidation({
  source: octalPermissionsInput,
  rules: [
    {
      message: t('tools.chmod-calculator.texts.message-invalid-octal-permission-string'),
      validator: (value) => {
        try {
          computePermissionsFromChmodOctalRepresentation(value.trim());
          return true;
        } catch {
          return false;
        }
      },
    },
  ],
});
watch(octalPermissionsInput, (newPermissions) => {
  if (!octalPermissionsInputValidation.isValid) {
    return;
  }
  permissions.value = computePermissionsFromChmodOctalRepresentation(newPermissions.trim());
});

const symbolicPermissionsInput = ref('---------');
const symbolicPermissionsInputValidation = useValidation({
  source: symbolicPermissionsInput,
  rules: [
    {
      message: t('tools.chmod-calculator.texts.message-invalid-symbolic-permission-string'),
      validator: (value) => {
        try {
          computePermissionsFromChmodSymbolicRepresentation(value.trim());
          return true;
        } catch {
          return false;
        }
      },
    },
  ],
});
watch(symbolicPermissionsInput, (newPermissions) => {
  if (!symbolicPermissionsInputValidation.isValid) {
    return;
  }
  permissions.value = computePermissionsFromChmodSymbolicRepresentation(newPermissions.trim());
});

const octal = computed(() => computeChmodOctalRepresentation({ permissions: permissions.value }));
const symbolic = computed(() => computeChmodSymbolicRepresentation({ permissions: permissions.value }));
const umask = computed(() => computeUmaskRepresentation({ permissions: permissions.value }));

// --- How to read it -------------------------------------------------------------------------

const groupLabels: Record<Group, string> = { owner: 'Owner (u)', group: 'Group (g)', public: 'Others (o)' };

function digitBreakdown(permission: GroupPermissions) {
  const parts = [
    permission.read ? '4 (read)' : '',
    permission.write ? '2 (write)' : '',
    permission.execute ? '1 (execute)' : '',
  ].filter(Boolean);
  const digit = (permission.read ? 4 : 0) + (permission.write ? 2 : 0) + (permission.execute ? 1 : 0);
  return { digit, sum: parts.length > 0 ? parts.join(' + ') : '0 (nothing)' };
}

const explanation = computed(() => {
  const lines = groups.map((group) => {
    const { digit, sum } = digitBreakdown(permissions.value[group]);
    return `${groupLabels[group]}: ${digit} = ${sum}`;
  });
  const { setuid, setgid, stickybit } = permissions.value.flags;
  if (setuid || setgid || stickybit) {
    const flagParts = [setuid ? '4 (setuid)' : '', setgid ? '2 (setgid)' : '', stickybit ? '1 (sticky)' : ''].filter(
      Boolean,
    );
    lines.unshift(
      `Special (leading digit): ${octal.value.length === 4 ? octal.value[0] : 0} = ${flagParts.join(' + ')}`,
    );
  }
  return lines;
});

const flagNotes = computed(() => {
  const { setuid, setgid, stickybit } = permissions.value.flags;
  return [
    setuid
      ? 'setuid (s in the owner column): a program runs as its owner, not as whoever starts it (passwd does this to edit /etc/shadow). Capital S means setuid without execute, which is almost always a mistake.'
      : '',
    setgid
      ? "setgid (s in the group column): on a program, it runs with the file's group; on a directory, new files inherit the directory's group (handy for shared folders)."
      : '',
    stickybit
      ? 'sticky (t in the others column): in a directory everyone can write to, people can only delete their own files (/tmp is 1777).'
      : '',
  ].filter(Boolean);
});

// --- Commands ---------------------------------------------------------------------------------

const targetPath = ref('');
const recursive = ref(false);
const pathOrPlaceholder = computed(() => targetPath.value.trim() || 'path/to/file');

function symbolicClause(permission: GroupPermissions, special: string) {
  return `${permission.read ? 'r' : ''}${permission.write ? 'w' : ''}${permission.execute ? 'x' : ''}${special}`;
}

const symbolicChmod = computed(() => {
  const { owner, group, public: others, flags } = permissions.value;
  return `u=${symbolicClause(owner, flags.setuid ? 's' : '')},g=${symbolicClause(group, flags.setgid ? 's' : '')},o=${symbolicClause(others, flags.stickybit ? 't' : '')}`;
});

// Same mode without any execute bits: what files usually want when directories get octal.
const octalWithoutExecute = computed(() =>
  octal.value
    .split('')
    .map((digit, index, all) => (all.length === 4 && index === 0 ? digit : String(Number(digit) & 6)))
    .join(''),
);
const hasExecute = computed(() => groups.some((group) => permissions.value[group].execute));

const unixChmodCommands = computed<OsCommand[]>(() => {
  const path = quotePosix(pathOrPlaceholder.value);
  const r = recursive.value ? '-R ' : '';
  const list: OsCommand[] = [
    {
      title: 'Set exactly these permissions',
      code: `chmod ${r}${octal.value} ${path}`,
      note: recursive.value
        ? '-R also changes everything inside the directory, files and subdirectories alike.'
        : undefined,
    },
    {
      title: 'The same thing, written with letters',
      code: `chmod ${r}${symbolicChmod.value} ${path}`,
      note: 'u = owner, g = group, o = others; = sets exactly the letters listed. Use + or - instead (chmod g+w, chmod o-rwx) to change one bit and keep the rest.',
    },
  ];
  if (recursive.value && hasExecute.value) {
    list.push({
      title: 'Directories and files separately (usually what you want with -R)',
      code: `find ${path} -type d -exec chmod ${octal.value} {} +\nfind ${path} -type f -exec chmod ${octalWithoutExecute.value} {} +`,
      note: `chmod -R ${octal.value} would mark every file executable too. Directories need x to be entered; most files don't.`,
    });
  }
  return list;
});

const linuxCommands = computed<OsCommand[]>(() => [
  ...unixChmodCommands.value,
  {
    title: 'Check the result',
    code: `stat -c '%a %A %U:%G %n' ${quotePosix(pathOrPlaceholder.value)}\nls -ld ${quotePosix(pathOrPlaceholder.value)}`,
    note: 'stat prints the octal mode, the letters, owner:group and the name.',
  },
]);

const macCommands = computed<OsCommand[]>(() => [
  ...unixChmodCommands.value,
  {
    title: 'Check the result',
    code: `stat -f '%Lp %Sp %Su:%Sg %N' ${quotePosix(pathOrPlaceholder.value)}\nls -led ${quotePosix(pathOrPlaceholder.value)}`,
    note: 'macOS stat uses -f instead of -c. ls -e also lists ACL entries, which macOS can add on top of the mode bits (remove them with chmod -N).',
  },
]);

// Well-known SIDs work on every Windows language; names like "Everyone" only on English systems.
const windowsCommands = computed<OsCommand[]>(() => {
  const path = quotePowerShell(pathOrPlaceholder.value);
  const grants = computeIcaclsGrants({ permissions: permissions.value });
  const inherit = recursive.value ? '(OI)(CI)' : '';
  const accounts: { right: string | null; who: string; label: string }[] = [
    { right: grants.owner, who: '${env:USERNAME}', label: 'you' },
    { right: grants.group, who: '*S-1-5-32-545', label: 'Users' },
    { right: grants.public, who: '*S-1-1-0', label: 'Everyone' },
  ];
  const grantArgs = accounts
    .filter((account) => account.right)
    .map((account) => `"${account.who}:${inherit}${account.right}"`)
    .join(' ');
  const tree = recursive.value ? ' /T' : '';
  const mapping = accounts.map((account) => `${account.label}: ${account.right ?? 'nothing'}`).join(', ');
  return [
    {
      title: 'Add these rights (inherited permissions stay)',
      code: grantArgs ? `icacls ${path} /grant ${grantArgs}${tree}` : `# nothing to grant: all classes are 0`,
      note: `Windows (NTFS) has no mode bits; it uses access control lists. Owner → you, group → Users (*S-1-5-32-545), others → Everyone (*S-1-1-0). Rights used: ${mapping}. M = modify (read, write, execute, delete), RX = read & execute, R = read, W = write, X = execute/traverse.`,
    },
    {
      title: 'Make these the only rights (closest to chmod)',
      code: `icacls ${path} /inheritance:r /grant:r ${grantArgs || '"${env:USERNAME}:F"'}${tree}`,
      note: '/inheritance:r removes the rights inherited from the parent folder and /grant:r replaces existing grants. Make sure you keep access yourself. setuid, setgid and sticky have no Windows equivalent.',
    },
    {
      title: 'Check the result',
      code: `icacls ${path}\nGet-Acl ${path} | Format-List`,
      note: '(I) in the output marks a permission inherited from the parent folder; (OI)(CI) means files and subfolders inherit it.',
    },
  ];
});

// --- Umask ------------------------------------------------------------------------------------

const umaskInput = ref('022');
const umaskValidation = useValidation({
  source: umaskInput,
  rules: [{ message: 'A umask is 3 or 4 octal digits, like 022 or 0027', validator: (value) => isValidUmask(value) }],
});
const umaskResult = computed(() => (isValidUmask(umaskInput.value) ? applyUmask(umaskInput.value) : null));
const umaskSymbolic = (mode: string) =>
  computeChmodSymbolicRepresentation({ permissions: computePermissionsFromChmodOctalRepresentation(mode) });
const umaskValue = computed(() => (isValidUmask(umaskInput.value) ? umaskInput.value.trim().padStart(4, '0') : '0022'));

const umaskUnixCommands = computed<OsCommand[]>(() => [
  {
    title: 'See the current umask',
    code: 'umask        # octal, e.g. 0022\numask -S     # letters: what is allowed, e.g. u=rwx,g=rx,o=rx',
  },
  {
    title: 'Use it for one command only',
    code: `(umask ${umaskValue.value} && your-command)`,
    note: 'The parentheses start a subshell, so your own shell keeps its umask.',
  },
  {
    title: 'Use it for the rest of this shell session',
    code: `umask ${umaskValue.value}`,
  },
]);

const umaskLinuxCommands = computed<OsCommand[]>(() => [
  ...umaskUnixCommands.value,
  {
    title: 'Make it your default (bash)',
    code: `echo 'umask ${umaskValue.value}' >> ~/.bashrc`,
    note: 'Applies to new shells. System-wide defaults live in /etc/login.defs (UMASK) or pam_umask.',
  },
  {
    title: 'For a systemd service',
    code: `sudo systemctl edit your.service\n# add:\n[Service]\nUMask=${umaskValue.value}`,
    note: 'Services ignore your shell settings; files a service creates follow its own UMask=.',
  },
  {
    title: 'For files uploaded over SFTP (/etc/ssh/sshd_config)',
    code: `Subsystem sftp internal-sftp -u ${umaskValue.value}`,
  },
]);

const umaskMacCommands = computed<OsCommand[]>(() => [
  ...umaskUnixCommands.value,
  {
    title: 'Make it your default (zsh, the macOS shell)',
    code: `echo 'umask ${umaskValue.value}' >> ~/.zshrc`,
  },
  {
    title: 'For apps started from Finder/Dock too',
    code: `sudo launchctl config user umask ${umaskValue.value.replace(/^0/, '')}`,
    note: 'Takes effect after a restart.',
  },
]);

const umaskWindowsCommands = computed<OsCommand[]>(() => {
  const grants = umaskResult.value
    ? computeIcaclsGrants({ permissions: computePermissionsFromChmodOctalRepresentation(umaskResult.value.directory) })
    : { owner: null, group: null, public: null };
  const grantArgs = [
    grants.owner ? `"\${env:USERNAME}:(OI)(CI)${grants.owner}"` : '',
    grants.group ? `"*S-1-5-32-545:(OI)(CI)${grants.group}"` : '',
    grants.public ? `"*S-1-1-0:(OI)(CI)${grants.public}"` : '',
  ]
    .filter(Boolean)
    .join(' ');
  return [
    {
      title: "Windows has no umask: new files inherit their folder's permissions",
      code: `icacls 'C:\\path\\to\\folder'`,
      note: 'To control what new files get, set inheritable rights on the folder. (OI) = files inherit it, (CI) = subfolders inherit it.',
    },
    {
      title: 'Give new files and folders in a folder the same rights this umask would',
      code: grantArgs
        ? `icacls 'C:\\path\\to\\folder' /inheritance:r /grant:r ${grantArgs}`
        : '# this umask allows nothing',
      note: 'Owner → you, group → Users, others → Everyone, as in the chmod commands above.',
    },
  ];
});
</script>

<template>
  <div>
    <div mb-2 flex justify-center>
      <c-link target="_blank" to="/chmod-memo"> See <code>chmod</code> command cheatsheet. </c-link>
    </div>

    <n-space justify="center">
      <c-input-text
        v-model:value="octalPermissionsInput"
        :placeholder="t('tools.chmod-calculator.texts.placeholder-put-your-octal-permissions-here')"
        :label="t('tools.chmod-calculator.texts.label-copy-your-octal-permissions')"
        :validation="octalPermissionsInputValidation"
        mb-2
      />

      <c-input-text
        v-model:value="symbolicPermissionsInput"
        :placeholder="t('tools.chmod-calculator.texts.placeholder-put-your-symbolic-permissions-here')"
        :label="t('tools.chmod-calculator.texts.label-copy-your-symbolic-permissions')"
        :validation="symbolicPermissionsInputValidation"
        mb-2
      />
    </n-space>

    <n-divider />

    <n-table :bordered="false" :bottom-bordered="false" single-column class="permission-table">
      <thead>
        <tr>
          <th class="text-center" scope="col" />
          <th class="text-center" scope="col">
            {{ t('tools.chmod-calculator.texts.tag-owner-u') }}
          </th>
          <th class="text-center" scope="col">
            {{ t('tools.chmod-calculator.texts.tag-group-g') }}
          </th>
          <th class="text-center" scope="col">
            {{ t('tools.chmod-calculator.texts.tag-public-o') }}
          </th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="{ scope, title } of scopes" :key="scope">
          <td class="line-header">
            {{ title }}
          </td>
          <td v-for="group of groups" :key="group" class="text-center">
            <!-- <n-switch v-model:value="permissions[group][scope]" /> -->
            <n-checkbox v-model:checked="permissions[group][scope]" size="large" />
          </td>
        </tr>
        <tr>
          <td class="line-header">
            {{ t('tools.chmod-calculator.texts.tag-flags') }}
          </td>
          <td class="text-center">
            <n-checkbox v-model:checked="permissions.flags.setuid" size="large" />
          </td>
          <td class="text-center">
            <n-checkbox v-model:checked="permissions.flags.setgid" size="large" />
          </td>
          <td class="text-center">
            <n-checkbox v-model:checked="permissions.flags.stickybit" size="large" />
          </td>
        </tr>
      </tbody>
    </n-table>

    <div class="octal-result" mb-1>
      {{ octal }}
    </div>
    <div class="octal-result" mb-1>
      {{ symbolic }}
    </div>

    <c-card :title="t('tools.chmod-calculator.texts.title-how-to-read')" mb-2>
      <ul class="explanation" mb-2>
        <li v-for="line in explanation" :key="line">
          <code>{{ line }}</code>
        </li>
      </ul>
      <n-p v-for="note in flagNotes" :key="note">
        {{ note }}
      </n-p>
      <n-p op-80>
        r = read: see a file's contents, or list a directory. w = write: change a file, or create, rename and delete
        entries in a directory. x = execute: run a file as a program, or enter (cd into) a directory. Each digit is the
        sum of the bits it allows, so 7 = everything, 5 = read + execute, 0 = nothing.
      </n-p>
    </c-card>

    <c-card :title="t('tools.chmod-calculator.texts.title-chmod-command')" mb-2>
      <n-space align="center" mb-2>
        <c-input-text
          v-model:value="targetPath"
          :label="t('tools.chmod-calculator.texts.label-path')"
          label-position="left"
          placeholder="path/to/file"
          raw-text
          style="min-width: 320px"
        />
        <n-checkbox v-model:checked="recursive">
          {{ t('tools.chmod-calculator.texts.label-recursive') }}
        </n-checkbox>
      </n-space>
      <OsCommandTabs :linux="linuxCommands" :macos="macCommands" :windows="windowsCommands" />
    </c-card>

    <c-card :title="t('tools.chmod-calculator.texts.title-umask')">
      <n-p op-80>
        The umask decides the permissions of <em>new</em> files and directories. It lists the bits to take away: new
        files start from 666 (rw-rw-rw-) and new directories from 777 (rwxrwxrwx). With the usual umask 022 you get 644
        files and 755 directories. Files never get execute by default, whatever the umask.
      </n-p>

      <InputCopyable
        :label="t('tools.chmod-calculator.texts.label-umask-for-above')"
        label-position="left"
        label-width="260px"
        :value="umask.octal"
        readonly
        mb-1
      />
      <InputCopyable
        :label="t('tools.chmod-calculator.texts.label-symbolic')"
        label-position="left"
        label-width="260px"
        :value="umask.symbolic"
        readonly
        mb-3
      />

      <c-input-text
        v-model:value="umaskInput"
        :label="t('tools.chmod-calculator.texts.label-umask-input')"
        label-position="left"
        label-width="260px"
        :validation="umaskValidation"
        raw-text
        mb-2
      />
      <n-table v-if="umaskResult" :bordered="false" size="small" mb-3>
        <tbody>
          <tr>
            <td>{{ t('tools.chmod-calculator.texts.label-new-files') }}</td>
            <td>
              <code>666 &amp; ~{{ umaskValue.slice(1) }} = {{ umaskResult.file }}</code>
            </td>
            <td>
              <code>{{ umaskSymbolic(umaskResult.file) }}</code>
            </td>
          </tr>
          <tr>
            <td>{{ t('tools.chmod-calculator.texts.label-new-directories') }}</td>
            <td>
              <code>777 &amp; ~{{ umaskValue.slice(1) }} = {{ umaskResult.directory }}</code>
            </td>
            <td>
              <code>{{ umaskSymbolic(umaskResult.directory) }}</code>
            </td>
          </tr>
        </tbody>
      </n-table>

      <OsCommandTabs :linux="umaskLinuxCommands" :macos="umaskMacCommands" :windows="umaskWindowsCommands" />
    </c-card>
  </div>
</template>

<style lang="less" scoped>
.octal-result {
  text-align: center;
  font-size: 50px;
  font-family: monospace;
  color: v-bind('themeVars.primaryColor');
  margin: 20px 0;
}
.permission-table {
  td,
  th {
    padding: 15px;

    @media screen and (max-width: 600px) {
      padding: 5px;
    }
  }
}
.line-header {
  font-weight: bold;
  text-align: right;
  max-width: 80px;
}
.text-center {
  text-align: center;
}
.explanation {
  margin: 0;
  padding-left: 20px;
  li {
    margin: 4px 0;
  }
}
</style>
