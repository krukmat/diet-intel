/**
 * DietIntel Design System - Design Tokens
 * Comprehensive token system for consistent UI/UX across mobile app
 *
 * @version 1.0.0
 * @created 2025-09-15
 * @purpose Fix chaotic UI with systematic design approach
 */

// ===== COLOR SYSTEM =====

/**
 * Primary Brand Colors
 * Based on refined blue palette for better accessibility and visual hierarchy
 */
export const colors = {
  primary: {
    50: '#EBF4FF',   // Very light blue (subtle backgrounds)
    100: '#C3DAFE',  // Light blue (hover states)
    200: '#A3BFFA',  // Medium light (disabled buttons)
    300: '#7C95F0',  // Medium (secondary elements)
    400: '#5B7CE6',  // Medium dark (interactive elements)
    500: '#4C6FE0',  // Main brand color (refined blue)
    600: '#4338CA',  // Darker blue (active states)
    700: '#3730A3',  // Dark blue (text on light backgrounds)
    800: '#312E81',  // Very dark blue (emphasis)
    900: '#1E1B4B',  // Almost black blue (headings)
  },

  /**
   * Neutral Color System
   * Comprehensive grayscale for text, backgrounds, and borders
   */
  neutral: {
    0: '#FFFFFF',    // Pure white (cards, inputs)
    50: '#FAFAFA',   // Off white (main app background)
    100: '#F4F4F5',  // Light gray (card backgrounds)
    200: '#E4E4E7',  // Light border (dividers, input borders)
    300: '#D4D4D8',  // Medium light (disabled elements)
    400: '#A1A1AA',  // Medium gray (placeholder text)
    500: '#71717A',  // Text gray (secondary text)
    600: '#52525B',  // Dark gray (primary text on light)
    700: '#3F3F46',  // Very dark gray (headings, important text)
    800: '#27272A',  // Almost black (dark theme primary text)
    900: '#18181B',  // Pure black (maximum contrast)
  },

  /**
   * Semantic Colors
   * Status and feedback colors following accessibility standards
   */
  semantic: {
    success: {
      50: '#F0FDF4',   // Light green background
      100: '#DCFCE7',  // Success message background
      500: '#22C55E',  // Main success color
      600: '#16A34A',  // Success hover
      700: '#15803D',  // Success active
    },
    warning: {
      50: '#FFFBEB',   // Light yellow background
      100: '#FEF3C7',  // Warning message background
      500: '#F59E0B',  // Main warning color
      600: '#D97706',  // Warning hover
      700: '#B45309',  // Warning active
    },
    error: {
      50: '#FEF2F2',   // Light red background
      100: '#FEE2E2',  // Error message background
      500: '#EF4444',  // Main error color
      600: '#DC2626',  // Error hover
      700: '#B91C1C',  // Error active
    },
    info: {
      50: '#EFF6FF',   // Light blue background
      100: '#DBEAFE',  // Info message background
      500: '#3B82F6',  // Main info color
      600: '#2563EB',  // Info hover
      700: '#1D4ED8',  // Info active
    },
  },

  /**
   * Surface Colors
   * Background colors for different surfaces and elevations
   */
  surface: {
    background: '#FAFAFA',     // Main app background (neutral.50)
    card: '#FFFFFF',          // Card backgrounds (neutral.0)
    overlay: '#FFFFFF',       // Modal/overlay backgrounds
    elevated: '#FFFFFF',      // Elevated surfaces (with shadows)
    pressed: '#F4F4F5',      // Pressed state background (neutral.100)
  },

  /**
   * Text Color Hierarchy
   * Consistent text colors for different content levels
   */
  text: {
    primary: '#3F3F46',       // Main text color (neutral.700)
    secondary: '#71717A',     // Secondary text (neutral.500)
    tertiary: '#A1A1AA',      // Tertiary text (neutral.400)
    placeholder: '#D4D4D8',   // Placeholder text (neutral.300)
    inverse: '#FFFFFF',       // Text on dark backgrounds
    disabled: '#D4D4D8',      // Disabled text (neutral.300)
  },

  /**
   * Border Colors
   * Consistent border colors for components
   */
  border: {
    default: '#E4E4E7',       // Default border (neutral.200)
    strong: '#D4D4D8',        // Strong border (neutral.300)
    subtle: '#F4F4F5',        // Subtle border (neutral.100)
    focus: '#4C6FE0',         // Focus ring (primary.500)
    error: '#EF4444',         // Error border (semantic.error.500)
  },
} as const;

// ===== TYPOGRAPHY SYSTEM =====

/**
 * Typography Scale
 * Mobile-optimized font system with accessibility considerations
 */
export const typography = {
  /**
   * Font Families
   * System fonts for optimal performance and native feel
   */
  fontFamily: {
    primary: 'System',          // System font (San Francisco on iOS, Roboto on Android)
    secondary: 'SF Pro Text',   // iOS specific when needed
    mono: 'SF Mono',           // Monospace for code/numbers
  },

  /**
   * Font Size Scale
   * Based on 16px base with 1.125 (major second) ratio for better hierarchy
   */
  fontSize: {
    xs: 12,     // Fine print, captions, small labels
    sm: 14,     // Small text, secondary info, tags
    base: 16,   // Body text (accessibility baseline)
    md: 18,     // Emphasized body text, large labels
    lg: 20,     // Small headings, important info
    xl: 24,     // Section headings, card titles
    '2xl': 28,  // Page titles, main headings
    '3xl': 32,  // Hero text, app title
    '4xl': 36,  // Large hero text (rarely used on mobile)
  },

  /**
   * Font Weight System
   * Limited set for consistency and performance
   */
  fontWeight: {
    normal: '400',    // Regular text
    medium: '500',    // Emphasized text
    semibold: '600',  // Subheadings, important labels
    bold: '700',      // Headings, strong emphasis
  },

  /**
   * Line Height System
   * Optimized for readability on mobile screens
   */
  lineHeight: {
    tight: 1.1,      // Headlines, large text
    normal: 1.4,     // Body text, optimal readability
    relaxed: 1.6,    // Long form content, descriptions
  },

  /**
   * Letter Spacing
   * Subtle adjustments for optimal readability
   */
  letterSpacing: {
    tight: -0.025,    // Large headings
    normal: 0,        // Body text
    wide: 0.025,      // Small caps, labels
  },
} as const;

// ===== SPACING SYSTEM =====

/**
 * Spacing Scale
 * 4pt grid system for consistent layout and rhythm
 */
export const spacing = {
  xs: 4,      // Tight element spacing, small padding
  sm: 8,      // Small gaps, compact layouts
  md: 16,     // Standard component spacing (base unit)
  lg: 24,     // Large spacing, section separation
  xl: 32,     // Extra large gaps, major sections
  '2xl': 48,  // Page sections, major layout spacing
  '3xl': 64,  // Maximum spacing, hero sections
} as const;

/**
 * Semantic Spacing
 * Context-specific spacing values for components
 */
export const layout = {
  // Container and page-level spacing
  containerPadding: 16,        // Standard page margins (spacing.md)
  containerPaddingLarge: 24,   // Large screen page margins (spacing.lg)

  // Component internal spacing
  cardPadding: 16,             // Inside card elements (spacing.md)
  cardPaddingSmall: 12,        // Compact cards
  cardPaddingLarge: 24,        // Spacious cards (spacing.lg)

  // Interactive elements
  buttonPadding: 12,           // Button internal padding
  buttonPaddingSmall: 8,       // Small button padding (spacing.sm)
  buttonPaddingLarge: 16,      // Large button padding (spacing.md)

  inputPadding: 12,            // Input field internal padding
  inputPaddingVertical: 14,    // Vertical input padding for touch targets

  // Lists and grids
  listItemSpacing: 12,         // Between list items
  gridGap: 16,                 // Grid item spacing (spacing.md)
  gridGapSmall: 8,            // Compact grid spacing (spacing.sm)
} as const;

// ===== SHADOW & ELEVATION SYSTEM =====

/**
 * Shadow System
 * Mobile-optimized shadows for depth and hierarchy
 * Compatible with both iOS and Android
 */
export const shadows = {
  none: {
    shadowColor: 'transparent',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0,
    shadowRadius: 0,
    elevation: 0, // Android
  },

  sm: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },

  md: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 4,
  },

  lg: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 8,
  },

  xl: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 10,
    elevation: 12,
  },

  '2xl': {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 16,
  },
} as const;

// ===== BORDER RADIUS SYSTEM =====

/**
 * Border Radius Scale
 * Consistent rounding for components and surfaces
 */
export const borderRadius = {
  none: 0,      // Sharp corners
  sm: 4,        // Small elements, tags
  md: 8,        // Buttons, inputs, small cards
  lg: 12,       // Cards, larger components
  xl: 16,       // Large cards, hero sections
  '2xl': 24,    // Very large radius
  full: 999,    // Pills, circles, badges
} as const;

// ===== OPACITY SYSTEM =====

/**
 * Opacity Scale
 * Consistent opacity values for overlays and disabled states
 */
export const opacity = {
  0: 0,         // Fully transparent
  5: 0.05,      // Barely visible
  10: 0.1,      // Very light
  20: 0.2,      // Light overlay
  40: 0.4,      // Medium overlay
  60: 0.6,      // Strong overlay
  80: 0.8,      // Very strong
  90: 0.9,      // Almost opaque
  100: 1,       // Fully opaque
} as const;

// ===== TOUCH TARGET SYSTEM =====

/**
 * Touch Target Sizes
 * Mobile accessibility standards for interactive elements
 */
export const touchTargets = {
  minimum: 44,        // iOS/Android minimum (44pt/44dp)
  comfortable: 48,    // Preferred size for better usability
  large: 56,          // Large touch targets for primary actions
  extraLarge: 64,     // Maximum recommended size
} as const;

// ===== ANIMATION SYSTEM =====

/**
 * Animation and Transition Values
 * Consistent timing for smooth user experience
 */
export const animation = {
  duration: {
    fast: 150,        // Quick transitions
    normal: 250,      // Standard transitions
    slow: 350,        // Slower, more pronounced animations
    slower: 500,      // Dramatic transitions
  },

  easing: {
    linear: 'linear',
    easeIn: 'ease-in',
    easeOut: 'ease-out',
    easeInOut: 'ease-in-out',
  },
} as const;

// ===== Z-INDEX SYSTEM =====

/**
 * Z-Index Scale
 * Layering system for consistent stacking context
 */
export const zIndex = {
  base: 0,              // Default level
  elevated: 10,         // Cards, elevated surfaces
  dropdown: 100,        // Dropdowns, tooltips
  overlay: 1000,        // Modal overlays
  modal: 1100,          // Modal content
  popover: 1200,        // Popovers, context menus
  toast: 1300,          // Toast notifications
  debug: 9999,          // Debug overlays
} as const;

// ===== EXPORT ALL TOKENS =====

/**
 * Complete Design Token System
 * All tokens exported for easy consumption by components
 */
export const tokens = {
  colors,
  typography,
  spacing,
  layout,
  shadows,
  borderRadius,
  opacity,
  touchTargets,
  animation,
  zIndex,
} as const;

export default tokens;

// ===== TYPE EXPORTS =====

/**
 * TypeScript type exports for enhanced developer experience
 */
export type ColorToken = keyof typeof colors.primary;
export type SpacingToken = keyof typeof spacing;
export type FontSizeToken = keyof typeof typography.fontSize;
export type FontWeightToken = keyof typeof typography.fontWeight;
export type ShadowToken = keyof typeof shadows;
export type BorderRadiusToken = keyof typeof borderRadius;