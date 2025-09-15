/**
 * Card Component Type Definitions
 * TypeScript interfaces for the DietIntel Card system
 *
 * Solves current card inconsistencies:
 * - Stats cards (different shadows)
 * - Demo barcodes section (dark theme inconsistency)
 * - Feature button cards (different padding)
 * - Manual input cards (inconsistent styling)
 */

import { ReactNode } from 'react';
import { TouchableOpacityProps, ViewStyle } from 'react-native';

/**
 * Card Variant Types
 * Maps to current UI card-like elements to solve inconsistencies
 */
export type CardVariant = 'default' | 'elevated' | 'outlined' | 'interactive';

/**
 * Card Padding Options
 * Standardized internal spacing for different card purposes
 */
export type CardPadding = 'sm' | 'md' | 'lg';

/**
 * Card Shadow Levels
 * Elevation system for visual hierarchy
 */
export type CardShadow = 'none' | 'sm' | 'md' | 'lg' | 'xl';

/**
 * Main Card Component Props
 * Core card container with consistent styling
 */
export interface CardProps extends Omit<TouchableOpacityProps, 'style'> {
  /**
   * Visual variant of card
   * - default: Stats cards style (white background, subtle shadow)
   * - elevated: Demo section style (higher shadow for emphasis)
   * - outlined: Alternative to shadows (border instead)
   * - interactive: Feature buttons style (touchable with feedback)
   * @default 'default'
   */
  variant?: CardVariant;

  /**
   * Internal padding size
   * - sm: Compact cards (8px padding)
   * - md: Standard cards (16px padding)
   * - lg: Spacious cards (24px padding)
   * @default 'md'
   */
  padding?: CardPadding;

  /**
   * Shadow elevation level
   * Overrides default shadow for variant if specified
   */
  shadow?: CardShadow;

  /**
   * Card content
   * Use CardHeader, CardBody, CardFooter for structured layouts
   */
  children: ReactNode;

  /**
   * Press handler for interactive cards
   * Only applies when variant is 'interactive' or when specified
   */
  onPress?: () => void;

  /**
   * Custom style override
   * Should be used sparingly to maintain design consistency
   */
  style?: ViewStyle;

  /**
   * Test identifier for automated testing
   */
  testID?: string;

  /**
   * Background color override
   * Use design tokens (tokens.colors.surface.*)
   */
  backgroundColor?: string;

  /**
   * Border radius override
   * Use design tokens (tokens.borderRadius.*)
   */
  borderRadius?: number;
}

/**
 * Card Header Props
 * Standardized header section for cards
 */
export interface CardHeaderProps {
  /**
   * Primary title text
   * Main heading for the card
   */
  title: string;

  /**
   * Optional subtitle text
   * Secondary information below title
   */
  subtitle?: string;

  /**
   * Action element (button, icon, etc.)
   * Positioned on the right side of header
   */
  action?: ReactNode;

  /**
   * Custom title style
   * Override default title typography
   */
  titleStyle?: ViewStyle;

  /**
   * Custom subtitle style
   * Override default subtitle typography
   */
  subtitleStyle?: ViewStyle;

  /**
   * Header container style
   * Style the entire header section
   */
  style?: ViewStyle;

  /**
   * Test identifier
   */
  testID?: string;
}

/**
 * Card Body Props
 * Main content area of cards
 */
export interface CardBodyProps {
  /**
   * Body content
   * Main content of the card
   */
  children: ReactNode;

  /**
   * Internal spacing between elements
   * Uses design token spacing system
   * @default 'md'
   */
  spacing?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';

  /**
   * Custom style override
   */
  style?: ViewStyle;

  /**
   * Test identifier
   */
  testID?: string;
}

/**
 * Card Footer Props
 * Footer section for actions or additional info
 */
export interface CardFooterProps {
  /**
   * Footer content
   * Usually buttons or additional information
   */
  children: ReactNode;

  /**
   * Content alignment within footer
   * @default 'left'
   */
  alignment?: 'left' | 'center' | 'right' | 'space-between';

  /**
   * Custom style override
   */
  style?: ViewStyle;

  /**
   * Test identifier
   */
  testID?: string;
}

/**
 * Card Style Configuration
 * Internal interface for style generation
 */
export interface CardStyleConfig {
  variant: CardVariant;
  padding: CardPadding;
  shadow: CardShadow;
  interactive: boolean;
  pressed: boolean;
}

/**
 * Card Theme Configuration
 * Visual styling for each card variant
 */
export interface CardTheme {
  backgroundColor: string;
  borderColor: string;
  borderWidth: number;
  pressedBackgroundColor?: string;
}

/**
 * Card Padding Configuration
 * Padding values for each size variant
 */
export interface CardPaddingConfig {
  horizontal: number;
  vertical: number;
}

/**
 * Card Stats Interface
 * For statistics cards (Your Recipe Statistics section)
 */
export interface CardStatsProps {
  /**
   * Statistic items to display
   */
  stats: Array<{
    label: string;
    value: string | number;
    color?: string;
  }>;

  /**
   * Title for the stats section
   */
  title?: string;

  /**
   * Custom style
   */
  style?: ViewStyle;

  /**
   * Test identifier
   */
  testID?: string;
}

/**
 * Card Action Props
 * For interactive action cards (Quick Actions section)
 */
export interface CardActionProps {
  /**
   * Action title
   */
  title: string;

  /**
   * Action description
   */
  description: string;

  /**
   * Icon element
   */
  icon?: ReactNode;

  /**
   * Accent color for visual distinction
   */
  accentColor?: string;

  /**
   * Press handler
   */
  onPress: () => void;

  /**
   * Disabled state
   */
  disabled?: boolean;

  /**
   * Custom style
   */
  style?: ViewStyle;

  /**
   * Test identifier
   */
  testID?: string;
}