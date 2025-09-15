/**
 * Layout Component Type Definitions
 * TypeScript interfaces for the DietIntel Layout system
 *
 * Solves current layout inconsistencies:
 * - Inconsistent screen padding and margins across screens
 * - No systematic spacing between sections
 * - Manual SafeArea handling leading to layout issues
 * - Different container styles causing visual chaos
 */

import { ReactNode } from 'react';
import { ViewStyle, ScrollViewProps } from 'react-native';

/**
 * Container Variant Types
 * Different container styles for various screen types
 */
export type ContainerVariant = 'screen' | 'modal' | 'form' | 'fullscreen';

/**
 * Container Padding Options
 * Standardized padding for consistent screen layouts
 */
export type ContainerPadding = 'none' | 'sm' | 'md' | 'lg';

/**
 * Section Spacing Options
 * Consistent spacing between content sections
 */
export type SectionSpacing = 'xs' | 'sm' | 'md' | 'lg' | 'xl';

/**
 * Grid Columns Configuration
 * Responsive grid system
 */
export type GridColumns = 1 | 2 | 3 | 4 | 6 | 12;

/**
 * Spacer Direction
 * Flexible spacing utility directions
 */
export type SpacerDirection = 'horizontal' | 'vertical';

/**
 * Container Component Props
 * Screen-level wrapper with safe areas and consistent styling
 */
export interface ContainerProps extends Omit<ScrollViewProps, 'style'> {
  /**
   * Container variant for different screen types
   * - screen: Standard app screen with safe areas
   * - modal: Modal screen with different spacing
   * - form: Form container with optimized keyboard handling
   * - fullscreen: Full viewport without safe areas
   * @default 'screen'
   */
  variant?: ContainerVariant;

  /**
   * Container padding size
   * - none: No padding (0px)
   * - sm: Small padding (8px)
   * - md: Standard padding (16px)
   * - lg: Large padding (24px)
   * @default 'md'
   */
  padding?: ContainerPadding;

  /**
   * Container content
   */
  children: ReactNode;

  /**
   * Enable scrolling
   * Makes container scrollable when content overflows
   * @default true
   */
  scrollable?: boolean;

  /**
   * Enable safe area handling
   * Automatically handles iPhone notches and Android system bars
   * @default true
   */
  safeArea?: boolean;

  /**
   * Enable keyboard avoidance
   * Automatically adjusts layout when keyboard appears
   * @default false
   */
  keyboardAware?: boolean;

  /**
   * Background color override
   * Uses design token background colors
   */
  backgroundColor?: string;

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
 * Section Component Props
 * Content section with consistent spacing and structure
 */
export interface SectionProps {
  /**
   * Section content
   */
  children: ReactNode;

  /**
   * Section title
   * Optional header text for the section
   */
  title?: string;

  /**
   * Section subtitle
   * Optional descriptive text below title
   */
  subtitle?: string;

  /**
   * Action element for section header
   * Button, link, or other interactive element
   */
  action?: ReactNode;

  /**
   * Spacing around section
   * Controls margin and internal spacing
   * @default 'md'
   */
  spacing?: SectionSpacing;

  /**
   * Hide section divider
   * Removes bottom border/divider line
   * @default false
   */
  noDivider?: boolean;

  /**
   * Section background color
   * Different from container background
   */
  backgroundColor?: string;

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
 * Spacer Component Props
 * Flexible spacing utility for consistent gaps
 */
export interface SpacerProps {
  /**
   * Spacing size
   * Uses design token spacing values
   * @default 'md'
   */
  size?: SectionSpacing;

  /**
   * Spacer direction
   * - horizontal: Creates horizontal space (width)
   * - vertical: Creates vertical space (height)
   * @default 'vertical'
   */
  direction?: SpacerDirection;

  /**
   * Flexible spacer
   * Takes up remaining space in flex container
   * @default false
   */
  flex?: boolean;

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
 * Grid Component Props
 * Responsive grid system for layout organization
 */
export interface GridProps {
  /**
   * Grid content
   */
  children: ReactNode;

  /**
   * Number of columns
   * Responsive grid columns (1-12)
   * @default 2
   */
  columns?: GridColumns;

  /**
   * Gap between grid items
   * Uses design token spacing values
   * @default 'md'
   */
  gap?: SectionSpacing;

  /**
   * Align items vertically
   * Controls cross-axis alignment
   * @default 'stretch'
   */
  alignItems?: 'flex-start' | 'center' | 'flex-end' | 'stretch';

  /**
   * Justify content horizontally
   * Controls main-axis alignment
   * @default 'flex-start'
   */
  justifyContent?: 'flex-start' | 'center' | 'flex-end' | 'space-between' | 'space-around' | 'space-evenly';

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
 * Grid Item Component Props
 * Individual item within grid system
 */
export interface GridItemProps {
  /**
   * Grid item content
   */
  children: ReactNode;

  /**
   * Column span
   * How many columns this item should occupy
   * @default 1
   */
  span?: number;

  /**
   * Offset columns
   * How many columns to offset this item
   * @default 0
   */
  offset?: number;

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
 * Internal Types for Styling System
 */

export interface ContainerTheme {
  backgroundColor: string;
  paddingHorizontal: number;
  paddingVertical: number;
  safeAreaTop: boolean;
  safeAreaBottom: boolean;
}

export interface SectionTheme {
  marginVertical: number;
  paddingHorizontal: number;
  paddingVertical: number;
  borderBottomWidth: number;
  borderBottomColor: string;
}

export interface SpacerConfig {
  size: number;
  direction: SpacerDirection;
}

export interface GridConfig {
  columns: GridColumns;
  gap: number;
  itemWidth: string;
}

export interface LayoutStyleConfig {
  variant: ContainerVariant;
  padding: ContainerPadding;
  safeArea: boolean;
  keyboardAware: boolean;
}

/**
 * Responsive Breakpoints
 * Screen size breakpoints for responsive design
 */
export interface ResponsiveBreakpoints {
  xs: number; // Extra small screens (phones in portrait)
  sm: number; // Small screens (phones in landscape)
  md: number; // Medium screens (tablets in portrait)
  lg: number; // Large screens (tablets in landscape)
  xl: number; // Extra large screens (desktop)
}

/**
 * Layout Context Type
 * Shared layout state and configuration
 */
export interface LayoutContextType {
  screenWidth: number;
  screenHeight: number;
  isLandscape: boolean;
  safeAreaInsets: {
    top: number;
    bottom: number;
    left: number;
    right: number;
  };
  breakpoint: keyof ResponsiveBreakpoints;
}