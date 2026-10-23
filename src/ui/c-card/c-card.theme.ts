import { defineThemes } from '../theme/theme.models';

export const { useTheme } = defineThemes({
  dark: {
    backgroundColor: '#26211d',
    borderColor: '#2e2823',
  },
  light: {
    backgroundColor: '#ffffff',
    borderColor: '#efeff5',
  },
});
