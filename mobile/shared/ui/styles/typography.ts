/**
 * Typography System - DietIntel Mobile App
 * Centralized typography definitions following design system
 */

import { colors } from './colors';

export const typography = {
  h1: {
    fontSize: 24,
    fontWeight: 'bold' as const,
    color: colors.text.primary,
    lineHeight: 32
  },
  h2: {
    fontSize: 20,
    fontWeight: 'bold' as const,
    color: colors.text.primary,
    lineHeight: 28
  },
  h3: {
    fontSize: 18,
    fontWeight: '600' as const,
    color: colors.text.primary,
    lineHeight: 24
  },
  body: {
    fontSize: 14,
    fontWeight: '400' as const,
    color: colors.text.secondary,
    lineHeight: 20
  },
  bodySmall: {
    fontSize: 12,
    fontWeight: '400' as const,
    color: colors.text.secondary,
    lineHeight: 16
  },
  caption: {
    fontSize: 11,
    fontWeight: '500' as const,
    color: colors.text.accent,
    lineHeight: 14
  }
};

export default typography;
