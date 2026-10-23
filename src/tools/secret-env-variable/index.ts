import { defineTool } from '../tool';
import { translate as t } from '@/plugins/i18n.plugin';

export const tool = defineTool({
  name: t('tools.secret-env-variable.title'),
  path: '/secret-env-variable',
  description: t('tools.secret-env-variable.description'),
  keywords: [
    'env',
    'environment',
    'variable',
    'secret',
    'token',
    'password',
    'hidden',
    'read',
    'export',
    'keychain',
    'powershell',
    'bash',
    'zsh',
  ],
  component: () => import('./secret-env-variable.vue'),
  icon: defineAsyncComponent(() => import('@vicons/tabler/es/Key')),
  createdAt: new Date('2026-10-23'),
  category: 'Development',
});
