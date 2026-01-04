const setupConfig = () => {
  jest.resetModules();

  const asyncStorage = {
    getItem: jest.fn(),
    setItem: jest.fn(),
  };

  const i18nInstance = {
    language: 'en',
    use: jest.fn().mockReturnThis(),
    init: jest.fn().mockResolvedValue(undefined),
    changeLanguage: jest.fn().mockImplementation(async (language: string) => {
      i18nInstance.language = language;
    }),
  };

  const initReactI18next = { type: '3rdParty', init: jest.fn() };

  jest.doMock('@react-native-async-storage/async-storage', () => asyncStorage);
  jest.doMock('expo-localization', () => ({ locale: 'es-ES' }));
  jest.doMock('react-i18next', () => ({ initReactI18next }));
  jest.doMock('i18next', () => ({
    __esModule: true,
    default: i18nInstance,
    ...i18nInstance,
  }));

  let configModule: typeof import('../config') | undefined;
  jest.isolateModules(() => {
    configModule = require('../config');
  });

  return {
    config: configModule!,
    i18nInstance,
    asyncStorage,
    initReactI18next,
  };
};

describe('i18n config', () => {
  it('initializes i18n with detector and react adapter', () => {
    const { i18nInstance, initReactI18next } = setupConfig();

    expect(i18nInstance.use).toHaveBeenCalledTimes(2);
    const detector = i18nInstance.use.mock.calls[0][0];
    expect(detector).toMatchObject({ type: 'languageDetector', async: true });
    expect(i18nInstance.use).toHaveBeenCalledWith(initReactI18next);
    expect(i18nInstance.init).toHaveBeenCalledWith(
      expect.objectContaining({
        fallbackLng: 'en',
        resources: expect.any(Object),
      }),
    );
  });

  it('changes language and persists preference', async () => {
    const { config, i18nInstance, asyncStorage } = setupConfig();
    const logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});

    await config.changeLanguage('es');

    expect(i18nInstance.changeLanguage).toHaveBeenCalledWith('es');
    expect(asyncStorage.setItem).toHaveBeenCalledWith('@dietintel_language', 'es');

    logSpy.mockRestore();
  });

  it('returns current language', () => {
    const { config, i18nInstance } = setupConfig();

    i18nInstance.language = 'es';

    expect(config.getCurrentLanguage()).toBe('es');
  });

  it('returns supported languages', () => {
    const { config } = setupConfig();

    expect(config.getSupportedLanguages()).toEqual(['en', 'es']);
  });
});
