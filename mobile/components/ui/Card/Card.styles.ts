/**
 * Card Component Styles
 * Token-based styling system for consistent card appearance
 *
 * Solves current card chaos:
 * - Stats cards: inconsistent shadows and padding
 * - Demo section: dark theme doesn't fit with rest of UI
 * - Feature buttons: different card-like styling
 * - Manual input: white card with different padding
 */

import { StyleSheet } from 'react-native';
import { tokens } from '../../../styles/tokens';
import {
  CardVariant,
  CardPadding,
  CardShadow,
  CardTheme,
  CardPaddingConfig,
  CardStyleConfig
} from './Card.types';

/**
 * Card Theme Configurations
 * Maps each variant to specific colors and styling
 */
const cardThemes: Record<CardVariant, CardTheme> = {
  default: {
    backgroundColor: tokens.colors.surface.card, // White
    borderColor: 'transparent',
    borderWidth: 0,
    pressedBackgroundColor: tokens.colors.surface.pressed, // Light gray when pressed
  },

  elevated: {
    backgroundColor: tokens.colors.surface.elevated, // White with higher shadow
    borderColor: 'transparent',
    borderWidth: 0,
    pressedBackgroundColor: tokens.colors.surface.pressed,
  },

  outlined: {
    backgroundColor: tokens.colors.surface.card, // White
    borderColor: tokens.colors.border.default, // Light border
    borderWidth: 1,
    pressedBackgroundColor: tokens.colors.surface.pressed,
  },

  interactive: {
    backgroundColor: tokens.colors.surface.card, // White
    borderColor: 'transparent',
    borderWidth: 0,
    pressedBackgroundColor: tokens.colors.surface.pressed,
  },
};

/**
 * Card Padding Configurations
 * Maps each padding size to specific dimensions
 */
const cardPadding: Record<CardPadding, CardPaddingConfig> = {
  sm: {
    horizontal: tokens.spacing.sm, // 8px
    vertical: tokens.spacing.sm, // 8px
  },

  md: {
    horizontal: tokens.layout.cardPadding, // 16px
    vertical: tokens.layout.cardPadding, // 16px
  },

  lg: {
    horizontal: tokens.layout.cardPaddingLarge, // 24px
    vertical: tokens.layout.cardPaddingLarge, // 24px
  },
};

/**
 * Card Shadow Configurations
 * Maps shadow levels to design token shadows
 */
const cardShadows = {
  none: tokens.shadows.none,
  sm: tokens.shadows.sm,
  md: tokens.shadows.md,
  lg: tokens.shadows.lg,
  xl: tokens.shadows.xl,
};

/**
 * Get default shadow for card variant
 */
const getDefaultShadow = (variant: CardVariant): CardShadow => {
  switch (variant) {
    case 'default':
      return 'sm'; // Subtle shadow for stats cards
    case 'elevated':
      return 'lg'; // Higher shadow for emphasis
    case 'outlined':
      return 'none'; // No shadow, border provides definition
    case 'interactive':
      return 'md'; // Medium shadow for feature buttons
    default:
      return 'sm';
  }
};

/**
 * Generate card container styles based on configuration
 */
export const getCardContainerStyle = (config: CardStyleConfig) => {
  const theme = cardThemes[config.variant];
  const padding = cardPadding[config.padding];
  const shadowLevel = config.shadow;
  const shadow = cardShadows[shadowLevel];

  return {
    // Layout
    paddingHorizontal: padding.horizontal,
    paddingVertical: padding.vertical,
    borderRadius: tokens.borderRadius.lg, // 12px for cards

    // Appearance
    backgroundColor: config.pressed && config.interactive
      ? theme.pressedBackgroundColor
      : theme.backgroundColor,
    borderColor: theme.borderColor,
    borderWidth: theme.borderWidth,

    // Shadow and elevation
    ...shadow,

    // Interactive feedback
    ...(config.interactive && {
      overflow: 'hidden' as const, // Ensure pressed state doesn't leak
    }),
  };
};

/**
 * Card Header Styles
 */
export const cardHeaderStyles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: tokens.spacing.sm, // 8px gap below header
  },

  textContainer: {
    flex: 1,
    marginRight: tokens.spacing.sm, // Space between text and action
  },

  title: {
    fontSize: tokens.typography.fontSize.lg, // 20px
    fontWeight: tokens.typography.fontWeight.semibold, // 600
    color: tokens.colors.text.primary,
    lineHeight: tokens.typography.fontSize.lg * tokens.typography.lineHeight.tight,
    marginBottom: tokens.spacing.xs, // 4px gap below title
  },

  subtitle: {
    fontSize: tokens.typography.fontSize.sm, // 14px
    fontWeight: tokens.typography.fontWeight.normal, // 400
    color: tokens.colors.text.secondary,
    lineHeight: tokens.typography.fontSize.sm * tokens.typography.lineHeight.normal,
  },

  action: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});

/**
 * Card Body Styles
 */
export const getCardBodyStyle = (spacing: 'xs' | 'sm' | 'md' | 'lg' | 'xl' = 'md') => ({
  gap: tokens.spacing[spacing], // Dynamic spacing between child elements
});

/**
 * Card Footer Styles
 */
export const getCardFooterStyle = (alignment: 'left' | 'center' | 'right' | 'space-between' = 'left') => ({
  flexDirection: 'row' as const,
  alignItems: 'center' as const,
  justifyContent: alignment === 'left' ? 'flex-start' as const
    : alignment === 'center' ? 'center' as const
    : alignment === 'right' ? 'flex-end' as const
    : 'space-between' as const,
  marginTop: tokens.spacing.sm, // 8px gap above footer
});

/**
 * Static styles that don't depend on props
 */
export const staticStyles = StyleSheet.create({
  // Base card container
  baseContainer: {
    overflow: 'hidden', // Ensures border radius is respected
  },

  // Stats card specific styles
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
  },

  statItem: {
    alignItems: 'center',
    flex: 1,
  },

  statValue: {
    fontSize: tokens.typography.fontSize['2xl'], // 28px
    fontWeight: tokens.typography.fontWeight.bold, // 700
    color: tokens.colors.primary[500],
    lineHeight: tokens.typography.fontSize['2xl'] * tokens.typography.lineHeight.tight,
    marginBottom: tokens.spacing.xs, // 4px
  },

  statLabel: {
    fontSize: tokens.typography.fontSize.sm, // 14px
    fontWeight: tokens.typography.fontWeight.normal, // 400
    color: tokens.colors.text.secondary,
    textAlign: 'center',
    lineHeight: tokens.typography.fontSize.sm * tokens.typography.lineHeight.normal,
  },

  // Action card specific styles
  actionContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },

  actionIcon: {
    marginRight: tokens.spacing.sm, // 8px
    alignItems: 'center',
    justifyContent: 'center',
    width: 40,
    height: 40,
    borderRadius: tokens.borderRadius.md, // 8px
  },

  actionContent: {
    flex: 1,
  },

  actionTitle: {
    fontSize: tokens.typography.fontSize.md, // 18px
    fontWeight: tokens.typography.fontWeight.semibold, // 600
    color: tokens.colors.text.primary,
    marginBottom: tokens.spacing.xs, // 4px
  },

  actionDescription: {
    fontSize: tokens.typography.fontSize.sm, // 14px
    fontWeight: tokens.typography.fontWeight.normal, // 400
    color: tokens.colors.text.secondary,
    lineHeight: tokens.typography.fontSize.sm * tokens.typography.lineHeight.normal,
  },

  // Interactive state indicator
  interactiveIndicator: {
    position: 'absolute',
    right: tokens.spacing.sm,
    top: tokens.spacing.sm,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: tokens.colors.primary[500],
  },
});

/**
 * Utility function to get complete card styles
 * Combines all style functions for easy consumption
 */
export const getCardStyles = (config: CardStyleConfig) => {
  // Ensure shadow is set (use default if not specified)
  const shadowLevel = config.shadow || getDefaultShadow(config.variant);
  const finalConfig = { ...config, shadow: shadowLevel };

  return {
    container: [staticStyles.baseContainer, getCardContainerStyle(finalConfig)],
    header: cardHeaderStyles,
    body: getCardBodyStyle(),
    footer: getCardFooterStyle(),
    stats: staticStyles.statsContainer,
    action: staticStyles.actionContainer,
  };
};

/**
 * Export configurations for external access
 */
export { cardThemes, cardPadding, cardShadows, getDefaultShadow };