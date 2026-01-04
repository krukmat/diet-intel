import { foodTranslation, translateFoodName, translateFoodNameAsync, translateFoodNames, translateFoodNamesAsync, translateFoodNameSync, FoodTranslationService } from '../foodTranslation';
import { translationService } from '../../services/translationService';
import i18n from '../../i18n/config';

jest.mock('../../services/translationService', () => ({
  translationService: {
    translateFoodName: jest.fn(),
    translateTexts: jest.fn(),
  },
}));

jest.mock('../../i18n/config', () => ({
  t: jest.fn(),
}));

describe('FoodTranslationService', () => {
  const mockTranslationService = translationService as jest.Mocked<typeof translationService>;
  const mockI18n = i18n as jest.Mocked<typeof i18n>;

  beforeEach(() => {
    jest.clearAllMocks();
    mockI18n.t.mockImplementation((key: string) => {
      const map: Record<string, string> = {
        'foods.chicken': 'Pollo',
        'plan.foods.Chicken Breast': 'Pechuga de Pollo',
        'foods.categories.fruit': 'Fruta',
      };
      return map[key] ?? key;
    });
  });

  it('returns fallback for invalid food names', async () => {
    await expect(foodTranslation.translateFoodName('', true)).resolves.toBe('');
    await expect(foodTranslation.translateFoodName(null as any, false)).resolves.toBe('');
  });

  it('uses API translation when available', async () => {
    mockTranslationService.translateFoodName.mockResolvedValueOnce('Pollo Asado');

    const result = await foodTranslation.translateFoodName('Grilled Chicken');
    expect(result).toBe('Pollo Asado');
  });

  it('falls back to legacy translation when API returns same value', async () => {
    mockTranslationService.translateFoodName.mockResolvedValueOnce('Chicken');

    const result = await foodTranslation.translateFoodName('Chicken');
    expect(result).toBe('Pollo');
  });

  it('falls back to legacy translation on API error', async () => {
    mockTranslationService.translateFoodName.mockRejectedValueOnce(new Error('API down'));

    const result = await foodTranslation.translateFoodName('Chicken Breast');
    expect(result).toBe('Pechuga de Pollo');
  });

  it('returns partial translation when exact match is missing', () => {
    const service = FoodTranslationService.getInstance();
    const result = service.translateFoodNameLegacy('Grilled chicken');
    expect(result).toBe('Pollo');
  });

  it('returns category translation when partial matches fail', () => {
    const service = FoodTranslationService.getInstance();
    const result = service.translateFoodNameLegacy('Green apple slices');
    expect(result).toBe('Fruta');
  });

  it('returns original when no translation and fallback enabled', () => {
    const service = FoodTranslationService.getInstance();
    const result = service.translateFoodNameLegacy('Unknown food');
    expect(result).toBe('Unknown food');
  });

  it('batch translates using API map', async () => {
    mockTranslationService.translateTexts.mockResolvedValueOnce({
      apple: 'Manzana',
    });

    const result = await foodTranslation.translateFoodNames(['apple', 'bread']);
    expect(result).toEqual(['Manzana', 'bread']);
  });

  it('batch translates using legacy when API fails', async () => {
    mockTranslationService.translateTexts.mockRejectedValueOnce(new Error('API down'));

    const result = await foodTranslation.translateFoodNames(['chicken']);
    expect(result).toEqual(['Pollo']);
  });

  it('detects if translation exists', async () => {
    mockTranslationService.translateFoodName.mockResolvedValueOnce('Pollo');
    await expect(foodTranslation.hasTranslation('Chicken')).resolves.toBe(true);
  });

  it('exposes helper functions', async () => {
    mockTranslationService.translateFoodName.mockResolvedValueOnce('Pollo');
    expect(await translateFoodName('Chicken')).toBe('Pollo');

    mockTranslationService.translateFoodName.mockResolvedValueOnce('Pollo');
    expect(await translateFoodNameAsync('Chicken')).toBe('Pollo');

    mockTranslationService.translateTexts.mockResolvedValueOnce({ chicken: 'Pollo' });
    expect(await translateFoodNames(['chicken'])).toEqual(['Pollo']);

    mockTranslationService.translateTexts.mockResolvedValueOnce({ chicken: 'Pollo' });
    expect(await translateFoodNamesAsync(['chicken'])).toEqual(['Pollo']);

    expect(translateFoodNameSync('Chicken')).toBe('Pollo');
  });
});
