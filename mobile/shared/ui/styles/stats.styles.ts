/**
 * Stats Styles - DietIntel Mobile App
 * Centralized stats component styles
 */

import { StyleSheet } from 'react-native';
import { colors } from './colors';
import { typography } from './typography';
import { spacing, radius } from './spacing';
import { shadows } from './shadows';

export const statsStyles = StyleSheet.create({
  container: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.lg,
    marginBottom: spacing.lg,
    ...shadows.card
  },
  title: {
    ...typography.h3,
    color: colors.text.primary,
    marginBottom: spacing.md
  },
  statItem: {
    ...typography.body,
    color: colors.text.secondary,
    marginBottom: spacing.sm
  },
  primaryStatsRow: {
    flexDirection: 'row' as const,
    justifyContent: 'space-between' as const,
    marginBottom: spacing.lg,
  },
  secondaryStatsRow: {
    flexDirection: 'row' as const,
    justifyContent: 'space-between' as const,
    marginBottom: spacing.lg,
  },
  achievementsSummary: {
    marginTop: spacing.sm,
  },
  statCard: {
    flex: 1,
    backgroundColor: colors.surfaceSecondary,
    borderRadius: radius.md,
    padding: spacing.lg,
    alignItems: 'center' as const,
    marginHorizontal: spacing.sm,
    ...shadows.card
  },
  statHeader: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    marginBottom: spacing.md,
  },
  statIcon: {
    fontSize: 16,
    marginRight: 6,
  },
  statTitle: {
    fontSize: 12,
    color: colors.text.secondary,
    fontWeight: '500' as const,
    textAlign: 'center' as const,
  },
  statValue: {
    fontSize: 24,
    fontWeight: 'bold' as const,
    color: colors.text.accent,
    marginBottom: 4,
    textAlign: 'center' as const,
  },
  statSubtitle: {
    fontSize: 10,
    color: colors.text.tertiary,
    textAlign: 'center' as const,
  },
  progressSection: {
    backgroundColor: colors.surfaceSecondary,
    borderRadius: radius.md,
    padding: spacing.lg,
    marginBottom: spacing.lg,
    ...shadows.card
  },
  progressHeader: {
    flexDirection: 'row' as const,
    justifyContent: 'space-between' as const,
    alignItems: 'center' as const,
    marginBottom: spacing.sm,
  },
  progressTitle: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: colors.text.primary,
  },
  progressText: {
    fontSize: 12,
    color: colors.text.secondary,
    fontWeight: '500' as const,
  },
  progressBar: {
    height: 8,
    backgroundColor: colors.borders.light,
    borderRadius: 4,
    overflow: 'hidden' as const,
    marginBottom: spacing.sm,
  },
  progressFill: {
    height: '100%',
    backgroundColor: colors.primary,
    borderRadius: 4,
  },
  progressPercentage: {
    fontSize: 10,
    color: colors.text.secondary,
    textAlign: 'center' as const,
  },
  minimalContainer: {
    alignItems: 'center' as const,
    paddingHorizontal: spacing.sm,
  },
  minimalIcon: {
    fontSize: 20,
    marginBottom: 4,
  },
  minimalValue: {
    fontSize: 16,
    fontWeight: 'bold' as const,
    color: colors.text.accent,
    marginBottom: 2,
  },
  minimalLabel: {
    fontSize: 10,
    color: colors.text.secondary,
    textAlign: 'center' as const,
  },
});

export default statsStyles;
