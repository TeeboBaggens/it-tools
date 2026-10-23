import { defineTool } from '../tool';
import { translate as t } from '@/plugins/i18n.plugin';

export const tool = defineTool({
  name: t('tools.network-troubleshooting.title'),
  path: '/network-troubleshooting',
  description: t('tools.network-troubleshooting.description'),
  keywords: [
    'network',
    'dns',
    'dig',
    'nslookup',
    'ping',
    'traceroute',
    'port',
    'nc',
    'netcat',
    'ss',
    'lsof',
    'netstat',
    'ssh',
    'tunnel',
    'firewall',
    'troubleshooting',
    'cheatsheet',
  ],
  component: () => import('./network-troubleshooting.vue'),
  icon: defineAsyncComponent(() => import('@vicons/tabler/es/Stethoscope')),
  createdAt: new Date('2026-10-23'),
  category: 'Shell / System',
});
