import AsyncStorage from '@react-native-async-storage/async-storage';
import { getCurrentLanguage } from '../../i18n/config';
import { TranslationService, translateFoodName, translateFoodNames } from '../translationService';

jest.mock('../../i18n/config', () => ({
  getCurrentLanguage: jest.fn(),
}));

const fetchMock = jest.fn();

const createResponse = (overrides: Partial<Response> & { json?: () => Promise<any> }) =>
  ({
    ok: true,
    status: 200,
    statusText: 'OK',
    json: async () => ({}),
    ...overrides,
  }) as Response;

const resetServiceInstance = () => {
  (TranslationService as any).instance = undefined;
  return TranslationService.getInstance();
};

const originalFetch = global.fetch;
const originalAbortSignal = global.AbortSignal;
const mockGetCurrentLanguage = getCurrentLanguage as jest.Mock;

beforeAll(() => {
  global.fetch = fetchMock as any;

  if (!global.AbortSignal || typeof global.AbortSignal.timeout !== 'function') {
    global.AbortSignal = {
      timeout: jest.fn(() => 'timeout'),
    } as any;
  }
});

afterAll(() => {
  global.fetch = originalFetch;
  global.AbortSignal = originalAbortSignal;
});

beforeEach(() => {
  jest.clearAllMocks();
  mockGetCurrentLanguage.mockReturnValue('es');
  fetchMock.mockReset();
  (AsyncStorage as any).__reset?.();
});

describe('TranslationService', () => {
  it('returns original text when empty or whitespace', async () => {
    const service = resetServiceInstance();
    await expect(service.translateText('')).resolves.toBe('');
    await expect(service.translateText('   ')).resolves.toBe('   ');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('returns original text when source and target match', async () => {
    const service = resetServiceInstance();
    const result = await service.translateText('hello', 'es', 'es');
    expect(result).toBe('hello');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('returns cached translation when available', async () => {
    const service = resetServiceInstance();
    const cacheKey = '@dietintel_translation_en_es_chicken breast';
    await AsyncStorage.setItem(
      cacheKey,
      JSON.stringify({ translation: 'cached', timestamp: Date.now() })
    );

    const result = await service.translateText('Chicken Breast', 'en', 'es');
    expect(result).toBe('cached');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('expires stale cache and refetches translation', async () => {
    const nowSpy = jest.spyOn(Date, 'now').mockReturnValue(100000);
    const service = resetServiceInstance();
    const cacheKey = '@dietintel_translation_en_es_banana';
    await AsyncStorage.setItem(
      cacheKey,
      JSON.stringify({
        translation: 'old',
        timestamp: 100000 - 8 * 24 * 60 * 60 * 1000,
      })
    );

    fetchMock.mockResolvedValue(
      createResponse({
        json: async () => ({
          success: true,
          translated_text: 'plátano',
        }),
      })
    );

    const result = await service.translateText('banana', 'en', 'es');
    expect(result).toBe('plátano');
    expect(AsyncStorage.removeItem).toHaveBeenCalledWith(cacheKey);
    nowSpy.mockRestore();
  });

  it('caches translations from the API response', async () => {
    const service = resetServiceInstance();
    fetchMock.mockResolvedValue(
      createResponse({
        json: async () => ({
          success: true,
          translated_text: 'hola',
        }),
      })
    );

    const result = await service.translateText('hello', 'en', 'es');
    expect(result).toBe('hola');
    expect(AsyncStorage.setItem).toHaveBeenCalledWith(
      '@dietintel_translation_en_es_hello',
      expect.any(String)
    );
  });

  it('uses fallback translation when API call fails', async () => {
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    const logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    const service = resetServiceInstance();

    fetchMock.mockResolvedValue(
      createResponse({
        ok: false,
        status: 500,
        statusText: 'Server Error',
      })
    );

    const result = await service.translateText('chicken breast', 'en', 'es');
    expect(result).toBe('pechuga de pollo');
    warnSpy.mockRestore();
    logSpy.mockRestore();
  });

  it('returns original text when API call fails without fallback', async () => {
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    const logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    const service = resetServiceInstance();

    fetchMock.mockRejectedValue(new Error('network down'));

    const result = await service.translateText('mystery', 'en', 'es');
    expect(result).toBe('mystery');
    warnSpy.mockRestore();
    logSpy.mockRestore();
  });

  it('returns original map when batch languages match', async () => {
    const service = resetServiceInstance();
    const result = await service.translateTexts(['one', 'two'], 'es', 'es');
    expect(result).toEqual({ one: 'one', two: 'two' });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('batch translates uncached items and uses fallbacks when needed', async () => {
    const service = resetServiceInstance();
    await AsyncStorage.setItem(
      '@dietintel_translation_en_es_apple',
      JSON.stringify({ translation: 'manzana', timestamp: Date.now() })
    );

    fetchMock.mockResolvedValue(
      createResponse({
        json: async () => ({
          translations: {
            'chicken breast': 'pollo',
            unknown: null,
          },
          source_lang: 'en',
          target_lang: 'es',
          total_count: 2,
          successful_count: 1,
          failed_count: 1,
        }),
      })
    );

    const result = await service.translateTexts(['apple', 'chicken breast', 'unknown'], 'en', 'es');
    expect(result).toEqual({
      apple: 'manzana',
      'chicken breast': 'pollo',
      unknown: 'unknown',
    });
    expect(AsyncStorage.setItem).toHaveBeenCalledWith(
      '@dietintel_translation_en_es_chicken breast',
      expect.any(String)
    );
  });

  it('falls back to individual translations on batch errors', async () => {
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    const service = resetServiceInstance();
    fetchMock.mockRejectedValue(new Error('batch failed'));

    const translateSpy = jest
      .spyOn(service, 'translateFoodName')
      .mockResolvedValue('fallback');

    const result = await service.translateTexts(['one', 'two'], 'en', 'es');
    expect(result).toEqual({ one: 'fallback', two: 'fallback' });
    expect(translateSpy).toHaveBeenCalledTimes(2);
    warnSpy.mockRestore();
  });

  it('fetches supported languages', async () => {
    const service = resetServiceInstance();
    fetchMock.mockResolvedValue(
      createResponse({
        json: async () => ({
          languages: { en: 'English', es: 'Spanish' },
          count: 2,
        }),
      })
    );

    await expect(service.getSupportedLanguages()).resolves.toEqual({
      en: 'English',
      es: 'Spanish',
    });
  });

  it('returns null when supported languages fetch fails', async () => {
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    const service = resetServiceInstance();
    fetchMock.mockResolvedValue(
      createResponse({
        ok: false,
        status: 500,
        statusText: 'Error',
      })
    );

    await expect(service.getSupportedLanguages()).resolves.toBeNull();
    warnSpy.mockRestore();
  });

  it('checks service availability', async () => {
    const service = resetServiceInstance();
    fetchMock.mockResolvedValue(createResponse({ ok: true }));
    await expect(service.isServiceAvailable()).resolves.toBe(true);

    fetchMock.mockResolvedValue(createResponse({ ok: false }));
    await expect(service.isServiceAvailable()).resolves.toBe(false);
  });

  it('clears translation cache keys', async () => {
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    const service = resetServiceInstance();

    (AsyncStorage.getAllKeys as jest.Mock).mockResolvedValue([
      '@dietintel_translation_en_es_hello',
      'other_key',
    ]);

    await service.clearCache();
    expect(AsyncStorage.multiRemove).toHaveBeenCalledWith([
      '@dietintel_translation_en_es_hello',
    ]);
    warnSpy.mockRestore();
  });
});

describe('translation helpers', () => {
  it('delegates translateFoodName to the singleton', async () => {
    fetchMock.mockResolvedValue(
      createResponse({
        json: async () => ({
          success: true,
          translated_text: 'hola',
        }),
      })
    );

    await expect(translateFoodName('hello', 'en', 'es')).resolves.toBe('hola');
  });

  it('delegates translateFoodNames to the singleton', async () => {
    fetchMock.mockResolvedValue(
      createResponse({
        json: async () => ({
          translations: { apple: 'manzana' },
          source_lang: 'en',
          target_lang: 'es',
          total_count: 1,
          successful_count: 1,
          failed_count: 0,
        }),
      })
    );

    await expect(translateFoodNames(['apple'], 'en', 'es')).resolves.toEqual({
      apple: 'manzana',
    });
  });
});
