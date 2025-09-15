import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import * as Localization from 'expo-localization';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Translation files
import en from '../locales/en/translation.json';
import es from '../locales/es/translation.json';

const LANGUAGE_STORAGE_KEY = '@dietintel_language';

const languageDetector = {
  type: 'languageDetector' as const,
  async: true,
  detect: async (callback: (lng: string) => void) => {
    try {
      // First, try to get saved language from storage
      const savedLanguage = await AsyncStorage.getItem(LANGUAGE_STORAGE_KEY);
      if (savedLanguage) {
        callback(savedLanguage);
        return;
      }
      
      // If no saved language, detect from device locale
      const deviceLocale = Localization.locale;
      const languageCode = deviceLocale.split('-')[0];
      
      // Check if we support the detected language, otherwise fallback to English
      const supportedLanguage = ['en', 'es'].includes(languageCode) ? languageCode : 'en';
      callback(supportedLanguage);
    } catch (error) {
      console.warn('Language detection failed, defaulting to English:', error);
      callback('en');
    }
  },
  init: () => {},
  cacheUserLanguage: async (lng: string) => {
    try {
      await AsyncStorage.setItem(LANGUAGE_STORAGE_KEY, lng);
    } catch (error) {
      console.warn('Failed to save language preference:', error);
    }
  },
};

i18n
  .use(languageDetector)
  .use(initReactI18next)
  .init({
    compatibilityJSON: 'v3',
    resources: {
      en: {
        translation: en,
      },
      es: {
        translation: es,
      },
    },
    fallbackLng: 'en',
    debug: __DEV__,
    interpolation: {
      escapeValue: false,
    },
    react: {
      useSuspense: false,
    },
  });

export default i18n;

// Helper function to get current language
export const getCurrentLanguage = () => i18n.language;

// Helper function to change language
export const changeLanguage = async (language: string) => {
  console.log('🌐 i18n config: changeLanguage called with:', language);
  console.log('🌐 i18n.language before change:', i18n.language);

  await i18n.changeLanguage(language);

  console.log('🌐 i18n.language after change:', i18n.language);
  console.log('🌐 Language change completed successfully');
};

// Helper function to get supported languages
export const getSupportedLanguages = () => ['en', 'es'];