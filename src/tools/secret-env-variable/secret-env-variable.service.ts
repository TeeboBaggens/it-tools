import type { OsCommand } from '@/components/OsCommandTabs.vue';
import { quotePosix, quotePowerShell } from '@/utils/shell-quote';

export type SecretScope = 'session' | 'command' | 'persist';

export interface SecretOptions {
  name: string;
  scope: SecretScope;
  command: string;
}

export function isValidVariableName(name: string): boolean {
  return /^[A-Za-z_]\w*$/.test(name);
}

function nameOf(options: SecretOptions) {
  return isValidVariableName(options.name) ? options.name : 'API_TOKEN';
}

function commandOf(options: SecretOptions) {
  return options.command.trim() || 'your-command --flag';
}

// Prompt without echoing, into a shell variable, then export it.
function bashRead(name: string) {
  return `read -rs -p ${quotePosix(`${name}: `)} ${name} && echo && export ${name}`;
}
function zshRead(name: string) {
  // zsh's read -p means "read from the coprocess"; the prompt goes after a ? instead.
  return `read -rs ${quotePosix(`${name}?${name}: `)} && echo && export ${name}`;
}
function fishRead(name: string) {
  return `read -sx -P ${quotePosix(`${name}: `)} ${name}`;
}
function shRead(name: string) {
  return `printf '%s: ' ${name}; stty -echo; IFS= read -r ${name}; stty echo; printf '\\n'; export ${name}`;
}
function pwsh7Read(name: string) {
  return `$env:${name} = Read-Host -Prompt ${quotePowerShell(name)} -MaskInput`;
}
function pwsh5Read(name: string) {
  return `$env:${name} = [Net.NetworkCredential]::new('', (Read-Host -Prompt ${quotePowerShell(name)} -AsSecureString)).Password`;
}

function checkPosix(name: string): OsCommand {
  return {
    title: 'Check it is set, without printing it (bash, zsh, sh)',
    code: `[ -n "$${name}" ] && echo "${name} is set (\${#${name}} characters)"`,
  };
}
function removePosix(name: string): OsCommand {
  return { title: 'Remove it when you are done', code: `unset ${name}`, note: `fish: set -e ${name}` };
}

function unixSession(name: string, shells: OsCommand[]): OsCommand[] {
  return [...shells, checkPosix(name), removePosix(name)];
}

export function buildLinuxCommands(options: SecretOptions): OsCommand[] {
  const name = nameOf(options);
  const command = commandOf(options);
  if (options.scope === 'command') {
    return [
      {
        title: 'bash',
        code: `( ${bashRead(name)} && ${command} )`,
        note: 'The parentheses run everything in a subshell: the variable disappears when the command ends.',
      },
      { title: 'zsh', code: `( ${zshRead(name)} && ${command} )` },
      { title: 'fish', code: `begin; ${fishRead(name)}; and ${command}; set -e ${name}; end` },
    ];
  }
  if (options.scope === 'persist') {
    return [
      {
        title: 'Store it once in the login keyring (GNOME Keyring / KWallet, via libsecret)',
        code: `secret-tool store --label=${quotePosix(name)} env ${name}`,
        note: 'secret-tool prompts for the value without showing it. Package: libsecret-tools (Debian/Ubuntu) or libsecret (Fedora/Arch). Needs a desktop session or a running keyring daemon.',
      },
      {
        title: 'Load it into a shell (add this line to ~/.bashrc or ~/.zshrc to do it every time)',
        code: `export ${name}="$(secret-tool lookup env ${name})"`,
      },
      {
        title: 'On a server without a keyring: a file only you can read',
        code: `mkdir -p ~/.config/secrets && chmod 700 ~/.config/secrets\n(umask 077; read -rs -p ${quotePosix(`${name}: `)} v && echo && printf '%s' "$v" > ~/.config/secrets/${name})\nexport ${name}="$(cat ~/.config/secrets/${name})"`,
        note: 'umask 077 creates the file as 600 (owner only). Anyone with root, or your account, can still read it. pass (passwordstore.org) adds GPG encryption on top.',
      },
      checkPosix(name),
    ];
  }
  return unixSession(name, [
    { title: 'bash', code: bashRead(name) },
    { title: 'zsh', code: zshRead(name) },
    { title: 'fish', code: fishRead(name) },
    { title: 'sh / dash (POSIX)', code: shRead(name) },
  ]);
}

export function buildMacCommands(options: SecretOptions): OsCommand[] {
  const name = nameOf(options);
  const command = commandOf(options);
  if (options.scope === 'command') {
    return [
      {
        title: 'zsh (the default shell)',
        code: `( ${zshRead(name)} && ${command} )`,
        note: 'The parentheses run everything in a subshell: the variable disappears when the command ends.',
      },
      { title: 'bash', code: `( ${bashRead(name)} && ${command} )` },
    ];
  }
  if (options.scope === 'persist') {
    return [
      {
        title: 'Store it once in the macOS Keychain',
        code: `security add-generic-password -a "$USER" -s ${quotePosix(name)} -w`,
        note: '-w as the last argument makes security prompt for the value (twice) without showing it. Add -U to replace an existing entry.',
      },
      {
        title: 'Load it into a shell (add this line to ~/.zshrc to do it every time)',
        code: `export ${name}="$(security find-generic-password -a "$USER" -s ${quotePosix(name)} -w)"`,
        note: 'The first time, macOS asks whether the security tool may read the item.',
      },
      checkPosix(name),
    ];
  }
  return unixSession(name, [
    { title: 'zsh (the default shell)', code: zshRead(name) },
    { title: 'bash', code: bashRead(name) },
  ]);
}

export function buildWindowsCommands(options: SecretOptions): OsCommand[] {
  const name = nameOf(options);
  const command = commandOf(options);
  const check: OsCommand = {
    title: 'Check it is set, without printing it',
    code: `if ($env:${name}) { "${name} is set ($($env:${name}.Length) characters)" }`,
  };
  const remove: OsCommand = { title: 'Remove it when you are done', code: `Remove-Item Env:${name}` };
  if (options.scope === 'command') {
    return [
      {
        title: 'PowerShell 7',
        code: `try {\n  ${pwsh7Read(name)}\n  ${command}\n} finally {\n  Remove-Item Env:${name} -ErrorAction SilentlyContinue\n}`,
        note: 'finally removes the variable even if the command fails.',
      },
      {
        title: 'Windows PowerShell 5.1',
        code: `try {\n  ${pwsh5Read(name)}\n  ${command}\n} finally {\n  Remove-Item Env:${name} -ErrorAction SilentlyContinue\n}`,
      },
    ];
  }
  if (options.scope === 'persist') {
    return [
      {
        title: 'One-time setup: an encrypted vault for your account',
        code: 'Install-Module Microsoft.PowerShell.SecretManagement, Microsoft.PowerShell.SecretStore -Scope CurrentUser\nRegister-SecretVault -Name LocalStore -ModuleName Microsoft.PowerShell.SecretStore -DefaultVault',
      },
      {
        title: 'Store it once',
        code: `Set-Secret -Name ${quotePowerShell(name)}`,
        note: 'Set-Secret prompts for the value without showing it. The vault has its own password (Set-SecretStoreConfiguration changes how long it stays unlocked).',
      },
      {
        title: 'Load it into a session (add this line to $PROFILE to do it every time)',
        code: `$env:${name} = Get-Secret -Name ${quotePowerShell(name)} -AsPlainText`,
      },
      check,
    ];
  }
  return [
    { title: 'PowerShell 7', code: pwsh7Read(name) },
    {
      title: 'Windows PowerShell 5.1',
      code: pwsh5Read(name),
      note: '5.1 has no -MaskInput: -AsSecureString hides the typing and NetworkCredential turns the result back into text.',
    },
    {
      title: 'Command Prompt (cmd), borrowing PowerShell for the hidden prompt',
      code: `for /f "usebackq delims=" %s in (\`powershell -NoProfile -Command "[Net.NetworkCredential]::new('', (Read-Host '${name}' -AsSecureString)).Password"\`) do @set "${name}=%s"`,
      note: 'cmd cannot read input without echoing it. In a .bat file write %%s instead of %s.',
      language: 'txt',
    },
    check,
    remove,
  ];
}

export const explanations: { part: string; explain: string }[] = [
  { part: 'read -s', explain: 'Silent: what you type is not shown (bash, zsh, fish).' },
  { part: 'read -r', explain: 'Raw: backslashes in the value are kept as typed instead of being treated as escapes.' },
  {
    part: "read -p 'NAME: '",
    explain:
      'bash: show a prompt. zsh writes the prompt after a ? in the variable name instead (read -rs "NAME?NAME: ").',
  },
  {
    part: '&& echo',
    explain: 'Print the line break that silent input swallowed, so the next prompt starts on a new line.',
  },
  {
    part: 'export',
    explain:
      'Make the variable visible to programs you start from this shell. Without it, only the shell itself sees it.',
  },
  {
    part: 'stty -echo',
    explain: 'sh/dash have no read -s: turn terminal echo off, read, then turn it back on with stty echo.',
  },
  { part: '-MaskInput / -AsSecureString', explain: 'PowerShell: hide what you type (shows * instead).' },
  {
    part: '$env:NAME',
    explain: 'PowerShell: the environment of the current session. It is gone when the window closes.',
  },
];

export const whyNotEcho = [
  'export NAME=secret (or echo secret | …) puts the secret in your shell history file and, while it runs, in the process list that other users can read with ps.',
  "read -s keeps it out of both: the value only exists in the shell's memory and in the environment of the programs you start.",
  'Programs you start can read it, and so can anything running as your user (/proc/<pid>/environ on Linux). Environment variables are for "not in history, not on screen", not for hiding from your own account.',
  "In bash, a command that starts with a space is left out of history when HISTCONTROL contains ignorespace (Ubuntu's default); zsh needs setopt HIST_IGNORE_SPACE. read -s is still the safer habit.",
];
