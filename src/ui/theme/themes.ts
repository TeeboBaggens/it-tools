import { defineThemes } from './theme.models';

// Taupe: warm grey-brown accent on warm neutrals. Light accent #7e6555 (5.4:1 with white text),
// dark accent #c2a894 (7:1 on dark cards, 9:1 with black text).
export const { themes: appThemes, useTheme: useAppTheme } = defineThemes({
  light: {
    background: '#ffffff',
    text: {
      baseColor: '#3a312b',
      mutedColor: '#6e635b',
    },
    default: {
      color: 'rgba(72, 60, 50, 0.06)',
      colorHover: 'rgba(72, 60, 50, 0.1)',
      colorPressed: 'rgba(72, 60, 50, 0.22)',
    },
    primary: {
      color: '#7e6555',
      colorHover: '#8b7262',
      colorPressed: '#6a5446',
      colorFaded: '#7e65552f',
    },
    warning: {
      color: '#f59e0b',
      colorHover: '#f59e0b',
      colorPressed: '#f59e0b',
      colorFaded: '#f59e0b2f',
    },
    success: {
      color: '#4f7f52',
      colorHover: '#5d9160',
      colorPressed: '#3e6641',
      colorFaded: '#4f7f522f',
    },
    error: {
      color: '#d03050',
      colorHover: '#de576d',
      colorPressed: '#ab1f3f',
      colorFaded: '#d030502a',
    },
    loading_background: '#f4f0eb',
  },
  dark: {
    background: '#211d1a',
    text: {
      baseColor: '#ffffffd1',
      mutedColor: '#ffffff80',
    },
    default: {
      color: 'rgba(255, 255, 255, 0.08)',
      colorHover: 'rgba(255, 255, 255, 0.12)',
      colorPressed: 'rgba(255, 255, 255, 0.24)',
    },
    primary: {
      color: '#c2a894',
      colorHover: '#cdb5a2',
      colorPressed: '#a8907c',
      colorFaded: '#c2a8942f',
    },
    warning: {
      color: '#f59e0b',
      colorHover: '#f59e0b',
      colorPressed: '#f59e0b',
      colorFaded: '#f59e0b2f',
    },
    success: {
      color: '#7fb07f',
      colorHover: '#8fbd8f',
      colorPressed: '#6a9a6a',
      colorFaded: '#7fb07f2f',
    },
    error: {
      color: '#e88080',
      colorHover: '#e98b8b',
      colorPressed: '#e57272',
      colorFaded: '#e8808029',
    },
    loading_background: '#1c1916',
  },
});
