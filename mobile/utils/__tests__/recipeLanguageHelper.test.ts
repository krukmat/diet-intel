import {
  getCurrentRecipeLanguage,
  isSpanishSelected,
  getLanguageDefaults,
  getLocalizedCuisineTypes,
  getLocalizedDietaryRestrictions,
  getLocalizedDifficultyLevels,
  getLocalizedMealTypes,
  formatRecipeTime,
  formatServings,
  formatIngredientQuantity,
  needsTranslation,
  enhanceRequestWithLanguage,
} from '../recipeLanguageHelper';

jest.mock('../../i18n/config', () => ({
  getCurrentLanguage: jest.fn(() => 'en'),
}));

describe('recipeLanguageHelper', () => {
  it('detects current language', () => {
    expect(getCurrentRecipeLanguage()).toBe('en');
    expect(isSpanishSelected()).toBe(false);
  });

  it('returns language defaults', () => {
    expect(getLanguageDefaults('es')).toEqual({
      target_language: 'es',
      defaultCuisineTypes: ['spanish', 'mediterranean', 'mexican', 'italian'],
      defaultMealType: 'lunch',
    });
  });

  it('provides localized cuisine labels', () => {
    const cuisines = getLocalizedCuisineTypes('es');
    expect(cuisines.spanish).toBe('Española');
  });

  it('returns other localized label maps', () => {
    expect(getLocalizedDietaryRestrictions('es').gluten_free).toBe('Sin Gluten');
    expect(getLocalizedDifficultyLevels('en').advanced).toBe('Advanced');
    expect(getLocalizedMealTypes('es').breakfast).toBe('Desayuno');
  });

  it('formats recipe time and servings', () => {
    expect(formatRecipeTime(45, 'en')).toBe('45 minutes');
    expect(formatRecipeTime(120, 'es')).toBe('2 horas');
    expect(formatServings(1, 'en')).toBe('1 serving');
    expect(formatServings(2, 'es')).toBe('2 porciónes');
    expect(formatRecipeTime(61, 'es')).toBe('1h 1m');
    expect(formatRecipeTime(120, 'en')).toBe('2 hours');
  });

  it('formats ingredient quantities', () => {
    expect(formatIngredientQuantity(2, 'cups', 'es')).toBe('2 tazas');
    expect(formatIngredientQuantity(1, 'piece', 'en')).toBe('1 piece');
    expect(formatIngredientQuantity('1/2', 'tablespoon', 'es')).toBe('1/2 cucharada');
    expect(formatIngredientQuantity(1, 'unknown', 'en')).toBe('1 unknown');
  });

  it('detects translation needs and enhances requests', () => {
    expect(needsTranslation('en')).toBe(false);
    expect(needsTranslation('fr')).toBe(false);
    expect(enhanceRequestWithLanguage({ target_language: 'es' })).toEqual({
      target_language: 'es',
    });
    expect(enhanceRequestWithLanguage({})).toEqual({
      target_language: 'en',
    });
  });
});
