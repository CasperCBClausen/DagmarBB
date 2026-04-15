import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

import en from './locales/en/translation.json';
import da from './locales/da/translation.json';
import de from './locales/de/translation.json';
import es from './locales/es/translation.json';
import fr from './locales/fr/translation.json';
import nl from './locales/nl/translation.json';
import it from './locales/it/translation.json';

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      en: { translation: en },
      da: { translation: da },
      de: { translation: de },
      es: { translation: es },
      fr: { translation: fr },
      nl: { translation: nl },
      it: { translation: it },
    },
    fallbackLng: 'en',
    detection: {
      order: ['localStorage', 'navigator'],
      lookupLocalStorage: 'dagmar-lang',
      caches: ['localStorage'],
    },
    interpolation: { escapeValue: false },
  });

i18n.on('languageChanged', (lng) => {
  document.documentElement.lang = lng;
});

// Set initial lang on the html element
if (i18n.isInitialized) {
  document.documentElement.lang = i18n.language;
} else {
  i18n.on('initialized', () => {
    document.documentElement.lang = i18n.language;
  });
}

export default i18n;
