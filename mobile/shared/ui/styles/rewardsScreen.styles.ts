/**
 * Rewards Screen Styles - DietIntel Mobile App
 * Screen-specific styles that combine modular components
 */

import { StyleSheet } from 'react-native';
import { colors } from './colors';
import { typography } from './typography';
import { spacing } from './spacing';
import { shadows } from './shadows';

export const rewardsScreenStyles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background
  },
  content: {
    flex: 1,
    paddingHorizontal: spacing.lg
  },
  header: {
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    flexDirection: 'row' as const,
    justifyContent: 'space-between' as const,
    alignItems: 'center' as const,
    ...shadows.card
  },
  headerTitle: {
    ...typography.h3,
    color: colors.text.white
  },
  backButton: {
    color: colors.text.white,
    fontSize: 16,
    fontWeight: '600' as const
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center' as const,
    alignItems: 'center' as const
  },
  loadingText: {
    ...typography.body,
    color: colors.text.secondary
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center' as const,
    alignItems: 'center' as const
  },
  errorText: {
    ...typography.body,
    color: colors.text.error,
    textAlign: 'center' as const
  },
  statsSection: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: spacing.lg,
    marginBottom: spacing.lg,
    ...shadows.card
  },
  sectionTitle: {
    ...typography.h3,
    color: colors.text.primary,
    marginBottom: spacing.md
  },
  statItem: {
    ...typography.body,
    color: colors.text.secondary,
    marginBottom: spacing.sm
  },
  achievementsSection: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: spacing.lg,
    flex: 1,
    ...shadows.card
  },
  achievementItem: {
    flexDirection: 'row' as const,
    marginBottom: spacing.md,
    padding: spacing.md,
    backgroundColor: colors.surfaceSecondary,
    borderRadius: 8
  },
  achievementIcon: {
    fontSize: 24,
    marginRight: spacing.md
  },
  achievementContent: {
    flex: 1
  },
  achievementTitle: {
    ...typography.body,
    fontWeight: '600' as const,
    color: colors.text.primary,
    marginBottom: 2
  },
  achievementDescription: {
    ...typography.bodySmall,
    color: colors.text.secondary,
    marginBottom: spacing.sm
  },
  achievementProgress: {
    ...typography.caption
  }
});

export default rewardsScreenStyles;
