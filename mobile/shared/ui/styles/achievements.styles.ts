/**
 * Achievements Styles - DietIntel Mobile App
 * Centralized achievements component styles
 */

import { StyleSheet } from 'react-native';
import { colors } from './colors';
import { typography } from './typography';
import { spacing, radius } from './spacing';
import { shadows } from './shadows';

export const achievementsStyles = StyleSheet.create({
  container: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.lg,
    flex: 1,
    ...shadows.card
  },
  sectionTitle: {
    ...typography.h3,
    color: colors.text.primary,
    marginBottom: spacing.md
  },
  sectionSubtitle: {
    ...typography.bodySmall,
    color: colors.text.secondary,
    marginBottom: spacing.lg
  },
  item: {
    flex: 1,
    backgroundColor: colors.surfaceSecondary,
    borderRadius: radius.md,
    padding: spacing.lg,
    alignItems: 'center' as const,
    marginHorizontal: spacing.sm,
    marginBottom: spacing.md,
    minHeight: 140,
    ...shadows.card
  },
  unlockedCard: {
    borderColor: colors.primary,
    backgroundColor: '#F0F8FF'
  },
  lockedCard: {
    borderColor: colors.borders.light,
    backgroundColor: colors.surfaceSecondary,
    opacity: 0.8
  },
  icon: {
    fontSize: 32,
    marginBottom: spacing.sm
  },
  lockedIcon: {
    opacity: 0.5
  },
  title: {
    ...typography.body,
    fontWeight: 'bold' as const,
    color: colors.text.primary,
    textAlign: 'center' as const,
    marginBottom: spacing.xs
  },
  lockedTitle: {
    color: colors.text.tertiary
  },
  description: {
    ...typography.bodySmall,
    color: colors.text.secondary,
    textAlign: 'center' as const,
    marginBottom: spacing.sm,
    lineHeight: 15
  },
  lockedDescription: {
    color: colors.borders.medium
  },
  progress: {
    ...typography.caption
  },
  pointsContainer: {
    backgroundColor: colors.primary,
    borderRadius: 16,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    marginTop: spacing.sm
  },
  pointsText: {
    color: colors.text.white,
    fontSize: 10,
    fontWeight: 'bold' as const
  },
  progressContainer: {
    width: '100%',
    alignItems: 'center' as const
  },
  progressText: {
    fontSize: 10,
    color: colors.text.secondary,
    marginBottom: spacing.xs
  },
  progressBar: {
    width: '100%',
    height: 4,
    backgroundColor: colors.borders.light,
    borderRadius: 2,
    overflow: 'hidden' as const
  },
  progressFill: {
    height: '100%',
    backgroundColor: colors.primary,
    borderRadius: 2
  },
  gridContainer: {
    paddingHorizontal: spacing.sm
  },
  columnWrapper: {
    justifyContent: 'space-between' as const,
    marginBottom: spacing.md
  },
  emptyState: {
    alignItems: 'center' as const,
    paddingVertical: spacing.xxl,
    paddingHorizontal: spacing.xl
  },
  emptyStateIcon: {
    fontSize: 48,
    marginBottom: spacing.lg
  },
  emptyStateTitle: {
    ...typography.h3,
    color: colors.text.primary,
    textAlign: 'center' as const,
    marginBottom: spacing.sm
  },
  emptyStateDescription: {
    ...typography.body,
    color: colors.text.secondary,
    textAlign: 'center' as const
  }
});

export default achievementsStyles;
