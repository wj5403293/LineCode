export interface ThemeColors {
  bg: string;
  surface: string;
  surfaceElevated: string;
  surfaceLight: string;

  accent: string;
  accentDim: string;

  text: string;
  textSecondary: string;
  textTertiary: string;
  textOnColor: string;

  border: string;
  borderLight: string;
  inputBg: string;

  userBubble: string;
  aiBubble: string;

  danger: string;
  warning: string;
  success: string;
  processing: string;

  overlay: string;
  codeBg: string;
  codeBorder: string;

  accentMuted: string;
  accentMuted2: string;
  dangerMuted: string;
  dangerMuted2: string;
  processingMuted: string;

  diffAddBg: string;
  diffDelBg: string;
  diffAddText: string;
  diffDelText: string;
}

export interface SyntaxColors {
  keyword: string;
  string: string;
  comment: string;
  number: string;
  function: string;
  title: string;
  params: string;
  built_in: string;
  literal: string;
  type: string;
  class: string;
  attr: string;
  selector: string;
  tag: string;
  name: string;
  symbol: string;
  bullet: string;
  code: string;
  regexp: string;
  link: string;
  meta: string;
  deletion: string;
  addition: string;
  default: string;
}

export const darkSyntax: SyntaxColors = {
  keyword: '#FF7B72',
  string: '#A5D6FF',
  comment: '#8B949E',
  number: '#79C0FF',
  function: '#D2A8FF',
  title: '#D2A8FF',
  params: '#C9D1D9',
  built_in: '#79C0FF',
  literal: '#79C0FF',
  type: '#FFA657',
  class: '#FFA657',
  attr: '#79C0FF',
  selector: '#7EE787',
  tag: '#7EE787',
  name: '#7EE787',
  symbol: '#79C0FF',
  bullet: '#79C0FF',
  code: '#A5D6FF',
  regexp: '#A5D6FF',
  link: '#A5D6FF',
  meta: '#8B949E',
  deletion: '#FFA198',
  addition: '#AFF5B4',
  default: '#C9D1D9',
};

export const lightSyntax: SyntaxColors = {
  keyword: '#CF222E',
  string: '#0A3069',
  comment: '#6E7781',
  number: '#0550AE',
  function: '#8250DF',
  title: '#8250DF',
  params: '#24292F',
  built_in: '#0550AE',
  literal: '#0550AE',
  type: '#BF8700',
  class: '#BF8700',
  attr: '#0550AE',
  selector: '#116329',
  tag: '#116329',
  name: '#116329',
  symbol: '#0550AE',
  bullet: '#0550AE',
  code: '#0A3069',
  regexp: '#0A3069',
  link: '#0A3069',
  meta: '#6E7781',
  deletion: '#82071E',
  addition: '#116329',
  default: '#24292F',
};

export const darkColors: ThemeColors = {
  bg: '#000000',
  surface: '#0A0A0A',
  surfaceElevated: '#141414',
  surfaceLight: '#1C1C1E',

  accent: '#30D158',
  accentDim: '#1A3A2A',
  accentMuted: 'rgba(48,209,88,0.1)',
  accentMuted2: 'rgba(48,209,88,0.15)',

  text: '#FFFFFF',
  textSecondary: '#8E8E93',
  textTertiary: '#636366',
  textOnColor: '#FFFFFF',

  border: '#1C1C1E',
  borderLight: '#2C2C2E',
  inputBg: '#1C1C1E',

  userBubble: '#0A84FF',
  aiBubble: '#1C1C1E',

  danger: '#F85149',
  warning: '#FF9F0A',
  success: '#3FB950',
  processing: '#FF9800',

  overlay: 'rgba(0,0,0,0.6)',
  codeBg: 'rgba(255,255,255,0.04)',
  codeBorder: 'rgba(255,255,255,0.08)',

  dangerMuted: 'rgba(248,81,73,0.15)',
  dangerMuted2: 'rgba(248,81,73,0.20)',
  processingMuted: 'rgba(255,152,0,0.1)',

  diffAddBg: 'rgba(46,160,67,0.12)',
  diffDelBg: 'rgba(248,81,73,0.12)',
  diffAddText: '#3FB950',
  diffDelText: '#F85149',
};

export const lightColors: ThemeColors = {
  bg: '#F5F5F7',
  surface: '#FFFFFF',
  surfaceElevated: '#FFFFFF',
  surfaceLight: '#E8E8ED',

  accent: '#30D158',
  accentDim: '#D1F7D6',
  accentMuted: 'rgba(48,209,88,0.1)',
  accentMuted2: 'rgba(48,209,88,0.15)',

  text: '#1C1C1E',
  textSecondary: '#636366',
  textTertiary: '#AEAEB2',
  textOnColor: '#FFFFFF',

  border: '#D1D1D6',
  borderLight: '#E5E5EA',
  inputBg: '#FFFFFF',

  userBubble: '#0A84FF',
  aiBubble: '#E8E8ED',

  danger: '#FF3B30',
  warning: '#FF9500',
  success: '#28A745',
  processing: '#FF9500',

  overlay: 'rgba(0,0,0,0.4)',
  codeBg: 'rgba(0,0,0,0.04)',
  codeBorder: 'rgba(0,0,0,0.08)',

  dangerMuted: 'rgba(255,59,48,0.1)',
  dangerMuted2: 'rgba(255,59,48,0.15)',
  processingMuted: 'rgba(255,149,0,0.1)',

  diffAddBg: 'rgba(40,167,69,0.12)',
  diffDelBg: 'rgba(255,59,48,0.12)',
  diffAddText: '#28A745',
  diffDelText: '#FF3B30',
};

export const coffeeSyntax: SyntaxColors = {
  keyword: '#9B5C33',
  string: '#6F7D4D',
  comment: '#A58C72',
  number: '#B56B45',
  function: '#775F9A',
  title: '#775F9A',
  params: '#3E3328',
  built_in: '#7C6B43',
  literal: '#B56B45',
  type: '#8F6B2E',
  class: '#8F6B2E',
  attr: '#7A6848',
  selector: '#687846',
  tag: '#687846',
  name: '#687846',
  symbol: '#8F6B2E',
  bullet: '#8F6B2E',
  code: '#6C5642',
  regexp: '#6F7D4D',
  link: '#8D5C42',
  meta: '#A58C72',
  deletion: '#A0443E',
  addition: '#5E7447',
  default: '#3E3328',
};

export const coffeeColors: ThemeColors = {
  bg: '#F4EFE6',
  surface: '#EEE5D8',
  surfaceElevated: '#FBF7EF',
  surfaceLight: '#E7DCCA',

  accent: '#D97757',
  accentDim: '#F1D4C6',
  accentMuted: 'rgba(217,119,87,0.12)',
  accentMuted2: 'rgba(217,119,87,0.18)',

  text: '#2B2118',
  textSecondary: '#6C5A49',
  textTertiary: '#9B8976',
  textOnColor: '#FFFFFF',

  border: '#DDD0BF',
  borderLight: '#E8DDCF',
  inputBg: '#FFFBF3',

  userBubble: '#B86F50',
  aiBubble: '#EFE4D4',

  danger: '#B5473F',
  warning: '#B7791F',
  success: '#6A7F46',
  processing: '#C27A31',

  overlay: 'rgba(43,33,24,0.38)',
  codeBg: 'rgba(91,65,40,0.07)',
  codeBorder: 'rgba(91,65,40,0.14)',

  dangerMuted: 'rgba(181,71,63,0.12)',
  dangerMuted2: 'rgba(181,71,63,0.18)',
  processingMuted: 'rgba(194,122,49,0.12)',

  diffAddBg: 'rgba(106,127,70,0.14)',
  diffDelBg: 'rgba(181,71,63,0.12)',
  diffAddText: '#5E7447',
  diffDelText: '#A0443E',
};

export const customDefaultColors: ThemeColors = {
  ...lightColors,
  surface: '#FFFFFF',
  surfaceElevated: '#FFFFFF',
  surfaceLight: '#ECECF1',
  inputBg: '#FFFFFF',
  userBubble: '#0A84FF',
  aiBubble: '#F2F2F7',
  codeBg: '#F2F2F7',
  codeBorder: '#D9D9DE',
};
