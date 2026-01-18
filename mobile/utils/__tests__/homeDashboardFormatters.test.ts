/**
 * Tests unitarios para homeDashboardFormatters.ts
 */

import {
  formatCaloriesText,
  formatProgressText,
  formatSimpleProgressText,
  formatPlanStatus
} from '../homeDashboardFormatters';

describe('HomeDashboard Formatters', () => {
  describe('formatCaloriesText', () => {
    it('should format valid calories', () => {
      expect(formatCaloriesText(2000)).toBe('2000 kcal');
      expect(formatCaloriesText(1500.5)).toBe('1501 kcal'); // rounds up
      expect(formatCaloriesText(1800.4)).toBe('1800 kcal'); // rounds down
    });

    it('should handle null and undefined', () => {
      expect(formatCaloriesText(null)).toBe('Sin objetivo');
      expect(formatCaloriesText(undefined)).toBe('Sin objetivo');
    });

    it('should handle zero', () => {
      expect(formatCaloriesText(0)).toBe('0 kcal');
    });
  });

  describe('formatProgressText', () => {
    it('should format progress with daily goal', () => {
      expect(formatProgressText(1200, 2000)).toBe('1200 / 2000 kcal');
      expect(formatProgressText(1500.7, 1800.3)).toBe('1501 / 1800 kcal');
    });

    it('should format progress without daily goal', () => {
      expect(formatProgressText(1200, null)).toBe('1200 kcal');
      expect(formatProgressText(1500.7, undefined)).toBe('1501 kcal');
    });

    it('should handle null/undefined consumed', () => {
      expect(formatProgressText(null, 2000)).toBe('Sin datos');
      expect(formatProgressText(undefined, 2000)).toBe('Sin datos');
    });

    it('should handle zero values', () => {
      expect(formatProgressText(0, 2000)).toBe('0 / 2000 kcal');
      expect(formatProgressText(1200, 0)).toBe('1200 / 0 kcal');
    });
  });

  describe('formatSimpleProgressText', () => {
    it('should format simple progress', () => {
      expect(formatSimpleProgressText(1200)).toBe('1200 kcal');
      expect(formatSimpleProgressText(1500.7)).toBe('1501 kcal');
    });

    it('should handle null and undefined', () => {
      expect(formatSimpleProgressText(null)).toBe('Sin datos');
      expect(formatSimpleProgressText(undefined)).toBe('Sin datos');
    });

    it('should handle zero', () => {
      expect(formatSimpleProgressText(0)).toBe('0 kcal');
    });
  });

  describe('formatPlanStatus', () => {
    it('should format active plan', () => {
      expect(formatPlanStatus(true)).toBe('Plan activo');
    });

    it('should format inactive plan', () => {
      expect(formatPlanStatus(false)).toBe('Plan inactivo');
    });

    it('should format unknown plan status', () => {
      expect(formatPlanStatus(null)).toBe('Sin datos');
      expect(formatPlanStatus(undefined)).toBe('Sin datos');
    });
  });
});

// Nota: Tests del hook useHomeDashboardFormatters se implementarán
// en la siguiente fase cuando se integre con el componente completo.
// Por ahora, las funciones puras están completamente testeadas.
