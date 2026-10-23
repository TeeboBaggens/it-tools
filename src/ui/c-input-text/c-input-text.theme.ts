import { defineThemes } from '../theme/theme.models';

export const { useTheme } = defineThemes({
  dark: {
    backgroundColor: '#342d28',
    borderColor: '#342d28',

    focus: {
      backgroundColor: '#c2a8941a',
    },
  },
  light: {
    backgroundColor: '#ffffff',
    borderColor: '#e0e0e69e',

    focus: {
      backgroundColor: '#ffffff',
    },
  },
});
