import type { GlobalThemeOverrides } from 'naive-ui';

// Taupe palette; keep in step with src/ui/theme/themes.ts.
export const lightThemeOverrides: GlobalThemeOverrides = {
  common: {
    primaryColor: '#7e6555FF',
    primaryColorHover: '#8b7262FF',
    primaryColorPressed: '#6a5446FF',
    primaryColorSuppl: '#8b7262FF',
    successColor: '#4f7f52FF',
    successColorHover: '#5d9160FF',
    successColorPressed: '#3e6641FF',
    successColorSuppl: '#5d9160FF',
    textColorBase: '#3a312b',
    // Keep <body> the same color as the Layout background: Safari 26+ ignores
    // theme-color and derives its browser chrome tint from the body background.
    bodyColor: '#f4f0eb',
  },

  Menu: {
    itemHeight: '32px',
  },

  Layout: { color: '#f4f0eb' },

  AutoComplete: {
    peers: {
      InternalSelectMenu: { height: '500px' },
    },
  },
};

export const darkThemeOverrides: GlobalThemeOverrides = {
  common: {
    primaryColor: '#c2a894FF',
    primaryColorHover: '#cdb5a2FF',
    primaryColorPressed: '#a8907cFF',
    primaryColorSuppl: '#cdb5a2FF',
    successColor: '#7fb07fFF',
    successColorHover: '#8fbd8fFF',
    successColorPressed: '#6a9a6aFF',
    successColorSuppl: '#8fbd8fFF',
    // Match the Layout background (see lightThemeOverrides.common.bodyColor)
    bodyColor: '#1c1916',
  },

  Notification: {
    color: '#342d28',
  },

  AutoComplete: {
    peers: {
      InternalSelectMenu: { height: '500px', color: '#211d1a' },
    },
  },

  Menu: {
    itemHeight: '32px',
  },

  Layout: {
    color: '#1c1916',
    siderColor: '#26211d',
    siderBorderColor: 'transparent',
  },

  Card: {
    color: '#26211d',
    borderColor: '#2e2823',
  },

  Table: {
    tdColor: '#26211d',
    thColor: '#3a322c',
  },
};
