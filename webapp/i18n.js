const i18next = require('i18next').default;
const Backend = require('i18next-fs-backend');
const middleware = require('i18next-http-middleware');

// Initialize i18next
i18next
  .use(Backend)
  .use(middleware.LanguageDetector)
  .init({
    // Debug mode for development
    debug: process.env.NODE_ENV === 'development',
    
    // Default and fallback language
    lng: 'en',
    fallbackLng: 'en',
    
    // Supported languages
    supportedLngs: ['en', 'es'],
    
    // Preload languages to ensure they're loaded
    preload: ['en', 'es'],
    
    // Backend configuration
    backend: {
      loadPath: __dirname + '/locales/{{lng}}/translation.json'
    },
    
    // Language detection
    detection: {
      // Order and from where user language should be detected
      order: ['cookie', 'header', 'querystring'],
      
      // Keys or params to lookup language from
      lookupCookie: 'i18next',
      lookupHeader: 'accept-language',
      lookupQuerystring: 'lng',
      
      // Cache user language
      caches: ['cookie'],
      
      // Cookie options
      cookieOptions: {
        maxAge: 365 * 24 * 60 * 60 * 1000, // 1 year
        httpOnly: false,
        sameSite: 'lax'
      }
    },
    
    // Interpolation
    interpolation: {
      escapeValue: false // not needed for server side rendering
    }
  });

module.exports = i18next;