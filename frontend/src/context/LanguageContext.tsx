import React, { createContext, useContext, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import viVN from 'antd/locale/vi_VN';
import enUS from 'antd/locale/en_US';
import { Locale } from 'antd/es/locale';
import dayjs from 'dayjs';
import 'dayjs/locale/vi';
import 'dayjs/locale/en';
import { LANGUAGE_CODES, LanguageCode, STORAGE_KEYS } from '../constants';

export type Language = LanguageCode;

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: string, options?: any) => string;
  antdLocale: Locale;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export const LanguageProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { t, i18n } = useTranslation();

  const language: Language = useMemo(() => {
    const current = (i18n.language || LANGUAGE_CODES.EN).toLowerCase();
    return current.startsWith(LANGUAGE_CODES.VI) ? LANGUAGE_CODES.VI : LANGUAGE_CODES.EN;
  }, [i18n.language]);

  useEffect(() => {
    dayjs.locale(language === LANGUAGE_CODES.VI ? LANGUAGE_CODES.VI : LANGUAGE_CODES.EN);
  }, [language]);

  const setLanguage = (lang: Language) => {
    i18n.changeLanguage(lang);
    localStorage.setItem(STORAGE_KEYS.LANGUAGE, lang);
    dayjs.locale(lang === LANGUAGE_CODES.VI ? LANGUAGE_CODES.VI : LANGUAGE_CODES.EN);
  };

  const antdLocale = useMemo<Locale>(() => {
    return language === LANGUAGE_CODES.VI ? viVN : enUS;
  }, [language]);

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t: t as any, antdLocale }}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = (): LanguageContextType => {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
};
