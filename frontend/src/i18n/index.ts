import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import viTranslation from './locales/vi.json';
import enTranslation from './locales/en.json';
import { LANGUAGE_CODES, STORAGE_KEYS } from '../constants';

// Detect initial language based on rules:
// 1. localStorage 'tradewatch_lang' if user set it previously
// 2. browser language (navigator.language): if starts with 'vi' -> 'vi', else -> 'en'
const customDetector = {
  name: 'tradewatchDetector',
  lookup() {
    const saved = localStorage.getItem(STORAGE_KEYS.LANGUAGE);
    if (saved === LANGUAGE_CODES.VI || saved === LANGUAGE_CODES.EN) {
      return saved;
    }
    if (typeof navigator !== 'undefined') {
      const browserLang = (navigator.language || (navigator as any).userLanguage || '').toLowerCase();
      if (browserLang.startsWith(LANGUAGE_CODES.VI)) {
        return LANGUAGE_CODES.VI;
      }
    }
    return LANGUAGE_CODES.EN;
  },
  cacheUserLanguage(lng: string) {
    localStorage.setItem(STORAGE_KEYS.LANGUAGE, lng);
  },
};

const languageDetector = new LanguageDetector();
languageDetector.addDetector(customDetector);

i18n
  .use(languageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      [LANGUAGE_CODES.VI]: {
        translation: viTranslation,
      },
      [LANGUAGE_CODES.EN]: {
        translation: enTranslation,
      },
    },
    fallbackLng: LANGUAGE_CODES.EN,
    detection: {
      order: ['tradewatchDetector', 'localStorage', 'navigator'],
      lookupLocalStorage: STORAGE_KEYS.LANGUAGE,
      caches: ['localStorage'],
    },
    interpolation: {
      escapeValue: false, // React already escapes values
    },
  });

export default i18n;
