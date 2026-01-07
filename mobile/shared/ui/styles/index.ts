/**
 * Main Styles Index - DietIntel Mobile App
 * Re-exports all style modules for backward compatibility
 */

// Import all modules first
import { colors } from './colors';
import { typography } from './typography';
import { spacing, radius } from './spacing';
import { shadows } from './shadows';
import { headerStyles } from './header.styles';
import { statsStyles } from './stats.styles';
import { achievementsStyles } from './achievements.styles';
import rewardsScreenStyles from './rewardsScreen.styles';

// Base design system exports
export { colors };
export { typography };
export { spacing, radius };
export { shadows };

// Component-specific styles exports
export { headerStyles };
export { statsStyles };
export { achievementsStyles };

// Legacy compatibility exports
export { colors as rewardsColors } from './colors';
export { typography as rewardsTypography } from './typography';
export { spacing as rewardsSpacing } from './spacing';
export { radius as rewardsRadius } from './spacing';
export { shadows as rewardsShadows } from './shadows';

// Combined screen styles for backward compatibility
export { rewardsScreenStyles };

// Layout patterns
export const layout = {
  safeArea: {
    flex: 1,
    backgroundColor: colors.background
  },
  scrollContent: {
    padding: spacing.lg
  },
  cardContainer: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.lg,
    marginBottom: spacing.lg,
    ...shadows.card
  }
};

// Theme object
export const theme = {
  colors,
  typography,
  spacing,
  radius,
  layout
};

export default {
  colors,
  typography,
  spacing,
  radius,
  shadows,
  headerStyles,
  statsStyles,
  achievementsStyles,
  layout,
  theme
};
