export const LANGUAGE_CODES = {
  VI: 'vi',
  EN: 'en',
} as const;

export type LanguageCode = (typeof LANGUAGE_CODES)[keyof typeof LANGUAGE_CODES];

export interface LanguageOption {
  code: LanguageCode;
  label: string;
  flag: string;
  shortLabel: string;
}

export const LANGUAGE_OPTIONS: LanguageOption[] = [
  {
    code: LANGUAGE_CODES.VI,
    label: 'Tiếng Việt',
    flag: '🇻🇳',
    shortLabel: '🇻🇳 VI',
  },
  {
    code: LANGUAGE_CODES.EN,
    label: 'English',
    flag: '🇬🇧',
    shortLabel: '🇬🇧 EN',
  },
];

export const STORAGE_KEYS = {
  LANGUAGE: 'tradewatch_lang',
  THEME: 'tradewatch_theme',
  TOKEN: 'tradewatch_token',
  USER: 'tradewatch_user',
} as const;

export const USER_ROLES = {
  ADMIN: 'admin',
  USER: 'user',
} as const;

export type UserRole = (typeof USER_ROLES)[keyof typeof USER_ROLES];

export const ROLE_LABELS = {
  ADMIN: 'ADMIN',
  USER: 'USER',
} as const;

export const THEME_MODES = {
  LIGHT: 'light',
  DARK: 'dark',
} as const;

export type ThemeMode = (typeof THEME_MODES)[keyof typeof THEME_MODES];

export const BOT_STATUS = {
  RUNNING: 'RUNNING',
  PAUSED: 'PAUSED',
} as const;
