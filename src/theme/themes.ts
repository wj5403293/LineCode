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

export const vscodeSyntax: SyntaxColors = {
  keyword: '#C586C0',
  string: '#CE9178',
  comment: '#6A9955',
  number: '#B5CEA8',
  function: '#DCDCAA',
  title: '#DCDCAA',
  params: '#D4D4D4',
  built_in: '#4EC9B0',
  literal: '#569CD6',
  type: '#4EC9B0',
  class: '#4EC9B0',
  attr: '#9CDCFE',
  selector: '#D7BA7D',
  tag: '#569CD6',
  name: '#9CDCFE',
  symbol: '#D4D4D4',
  bullet: '#D7BA7D',
  code: '#CE9178',
  regexp: '#D16969',
  link: '#3794FF',
  meta: '#9B9B9B',
  deletion: '#F48771',
  addition: '#B5CEA8',
  default: '#D4D4D4',
};

export const vscodeColors: ThemeColors = {
  bg: '#1E1E1E',
  surface: '#252526',
  surfaceElevated: '#2D2D30',
  surfaceLight: '#333333',

  accent: '#007ACC',
  accentDim: '#073A5A',
  accentMuted: 'rgba(0,122,204,0.16)',
  accentMuted2: 'rgba(0,122,204,0.24)',

  text: '#D4D4D4',
  textSecondary: '#A6A6A6',
  textTertiary: '#6A6A6A',
  textOnColor: '#FFFFFF',

  border: '#3C3C3C',
  borderLight: '#454545',
  inputBg: '#3C3C3C',

  userBubble: '#094771',
  aiBubble: '#252526',

  danger: '#F48771',
  warning: '#CCA700',
  success: '#89D185',
  processing: '#DCDCAA',

  overlay: 'rgba(0,0,0,0.58)',
  codeBg: '#1E1E1E',
  codeBorder: '#3C3C3C',

  dangerMuted: 'rgba(244,135,113,0.14)',
  dangerMuted2: 'rgba(244,135,113,0.22)',
  processingMuted: 'rgba(220,220,170,0.12)',

  diffAddBg: 'rgba(137,209,133,0.12)',
  diffDelBg: 'rgba(244,135,113,0.12)',
  diffAddText: '#89D185',
  diffDelText: '#F48771',
};

export const githubDarkSyntax: SyntaxColors = darkSyntax;

export const githubDarkColors: ThemeColors = {
  bg: '#0D1117',
  surface: '#010409',
  surfaceElevated: '#161B22',
  surfaceLight: '#21262D',

  accent: '#2F81F7',
  accentDim: '#0D419D',
  accentMuted: 'rgba(47,129,247,0.12)',
  accentMuted2: 'rgba(47,129,247,0.20)',

  text: '#E6EDF3',
  textSecondary: '#8B949E',
  textTertiary: '#6E7681',
  textOnColor: '#FFFFFF',

  border: '#30363D',
  borderLight: '#21262D',
  inputBg: '#0D1117',

  userBubble: '#1F6FEB',
  aiBubble: '#161B22',

  danger: '#F85149',
  warning: '#D29922',
  success: '#3FB950',
  processing: '#D29922',

  overlay: 'rgba(1,4,9,0.68)',
  codeBg: '#0D1117',
  codeBorder: '#30363D',

  dangerMuted: 'rgba(248,81,73,0.14)',
  dangerMuted2: 'rgba(248,81,73,0.22)',
  processingMuted: 'rgba(210,153,34,0.12)',

  diffAddBg: 'rgba(46,160,67,0.14)',
  diffDelBg: 'rgba(248,81,73,0.14)',
  diffAddText: '#3FB950',
  diffDelText: '#F85149',
};

export const gruvboxSyntax: SyntaxColors = {
  keyword: '#FB4934',
  string: '#B8BB26',
  comment: '#928374',
  number: '#D3869B',
  function: '#FABD2F',
  title: '#FABD2F',
  params: '#EBDBB2',
  built_in: '#83A598',
  literal: '#D3869B',
  type: '#8EC07C',
  class: '#8EC07C',
  attr: '#FE8019',
  selector: '#B8BB26',
  tag: '#FB4934',
  name: '#EBDBB2',
  symbol: '#83A598',
  bullet: '#83A598',
  code: '#B8BB26',
  regexp: '#FE8019',
  link: '#83A598',
  meta: '#928374',
  deletion: '#FB4934',
  addition: '#B8BB26',
  default: '#EBDBB2',
};

export const gruvboxColors: ThemeColors = {
  bg: '#282828',
  surface: '#1D2021',
  surfaceElevated: '#32302F',
  surfaceLight: '#3C3836',

  accent: '#FABD2F',
  accentDim: '#665C2E',
  accentMuted: 'rgba(250,189,47,0.14)',
  accentMuted2: 'rgba(250,189,47,0.22)',

  text: '#EBDBB2',
  textSecondary: '#BDAE93',
  textTertiary: '#928374',
  textOnColor: '#282828',

  border: '#504945',
  borderLight: '#665C54',
  inputBg: '#1D2021',

  userBubble: '#458588',
  aiBubble: '#32302F',

  danger: '#FB4934',
  warning: '#FE8019',
  success: '#B8BB26',
  processing: '#FABD2F',

  overlay: 'rgba(29,32,33,0.66)',
  codeBg: '#1D2021',
  codeBorder: '#504945',

  dangerMuted: 'rgba(251,73,52,0.14)',
  dangerMuted2: 'rgba(251,73,52,0.22)',
  processingMuted: 'rgba(250,189,47,0.13)',

  diffAddBg: 'rgba(184,187,38,0.13)',
  diffDelBg: 'rgba(251,73,52,0.13)',
  diffAddText: '#B8BB26',
  diffDelText: '#FB4934',
};

export const highContrastSyntax: SyntaxColors = {
  keyword: '#FC5FA3',
  string: '#00FF66',
  comment: '#9EA0A6',
  number: '#FFD60A',
  function: '#00D7FF',
  title: '#00D7FF',
  params: '#FFFFFF',
  built_in: '#5AE4FF',
  literal: '#FFD60A',
  type: '#A78BFA',
  class: '#A78BFA',
  attr: '#FF9F0A',
  selector: '#00FF66',
  tag: '#5AE4FF',
  name: '#FFFFFF',
  symbol: '#FFD60A',
  bullet: '#FFD60A',
  code: '#00FF66',
  regexp: '#FF9F0A',
  link: '#64D2FF',
  meta: '#9EA0A6',
  deletion: '#FF453A',
  addition: '#30D158',
  default: '#FFFFFF',
};

export const highContrastColors: ThemeColors = {
  bg: '#000000',
  surface: '#050505',
  surfaceElevated: '#101010',
  surfaceLight: '#1A1A1A',

  accent: '#64D2FF',
  accentDim: '#063B4C',
  accentMuted: 'rgba(100,210,255,0.16)',
  accentMuted2: 'rgba(100,210,255,0.24)',

  text: '#FFFFFF',
  textSecondary: '#C7C7CC',
  textTertiary: '#8E8E93',
  textOnColor: '#000000',

  border: '#666666',
  borderLight: '#3A3A3C',
  inputBg: '#111111',

  userBubble: '#004D80',
  aiBubble: '#101010',

  danger: '#FF453A',
  warning: '#FFD60A',
  success: '#30D158',
  processing: '#FF9F0A',

  overlay: 'rgba(0,0,0,0.75)',
  codeBg: '#000000',
  codeBorder: '#555555',

  dangerMuted: 'rgba(255,69,58,0.18)',
  dangerMuted2: 'rgba(255,69,58,0.26)',
  processingMuted: 'rgba(255,159,10,0.16)',

  diffAddBg: 'rgba(48,209,88,0.18)',
  diffDelBg: 'rgba(255,69,58,0.18)',
  diffAddText: '#30D158',
  diffDelText: '#FF453A',
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
