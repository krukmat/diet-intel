/**
 * Header Styles - DietIntel Mobile App
 * Centralized header component styles
 */

import { StyleSheet } from 'react-native';
import { colors } from './colors';
import { typography } from './typography';
import { spacing } from './spacing';
import { shadows } from './shadows';

export const headerStyles = StyleSheet.create({
  container: {
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    flexDirection: 'row' as const,
    justifyContent: 'space-between' as const,
    alignItems: 'center' as const,
    ...shadows.card
  },
  content: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    flex: 1
  },
  left: {
    width: 80,
    alignItems: 'flex-start' as const,
    justifyContent: 'center' as const,
  },
  center: {
    flex: 1,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  right: {
    width: 80,
    alignItems: 'flex-end' as const,
    justifyContent: 'center' as const,
  },
  title: {
    ...typography.h3,
    color: colors.text.white
  },
  subtitle: {
    color: colors.text.white,
    fontSize: 12,
    opacity: 0.8,
    marginTop: 2
  },
  backButton: {
    padding: 8,
  },
  backButtonText: {
    color: colors.text.white,
    fontSize: 18,
    fontWeight: '600' as const
  },
  pointsContainer: {
    alignItems: 'flex-end' as const,
  },
  pointsText: {
    color: colors.text.white,
    fontSize: 14,
    fontWeight: 'bold' as const,
  },
  levelText: {
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: 10,
  },
  achievementsContainer: {
    alignItems: 'flex-end' as const,
  },
  achievementsText: {
    color: colors.text.white,
    fontSize: 14,
    fontWeight: 'bold' as const,
  },
  achievementsLabel: {
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: 10,
  },
});

export default headerStyles;
