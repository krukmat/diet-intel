/**
 * useThemedStyles Hook for DietIntel Mobile App
 * Provides consistent theming and styling across all components
 */

import { useCallback, useState, useMemo } from 'react';
import { StyleSheet } from 'react-native';

interface Theme {
  colors: {
    primary: string;
    secondary: string;
    background: string;
    surface: string;
    text: string;
    textSecondary: string;
    border: string;
    error: string;
    success: string;
    warning: string;
    disabled: string;
    placeholder: string;
  };
  spacing: {
    xs: number;
    sm: number;
    md: number;
    lg: number;
    xl: number;
    xxl: number;
  };
  borderRadius: {
    sm: number;
    md: number;
    lg: number;
    xl: number;
  };
  shadows: {
    small: {
      shadowColor: string;
      shadowOffset: { width: number; height: number };
      shadowOpacity: number;
      shadowRadius: number;
      elevation: number;
    };
    medium: {
      shadowColor: string;
      shadowOffset: { width: number; height: number };
      shadowOpacity: number;
      shadowRadius: number;
      elevation: number;
    };
    large: {
      shadowColor: string;
      shadowOffset: { width: number; height: number };
      shadowOpacity: number;
      shadowRadius: number;
      elevation: number;
    };
  };
  typography: {
    h1: {
      fontSize: number;
      fontWeight: string;
      lineHeight: number;
    };
    h2: {
      fontSize: number;
      fontWeight: string;
      lineHeight: number;
    };
    h3: {
      fontSize: number;
      fontWeight: string;
      lineHeight: number;
    };
    body: {
      fontSize: number;
      fontWeight: string;
      lineHeight: number;
    };
    caption: {
      fontSize: number;
      fontWeight: string;
      lineHeight: number;
    };
  };
}

// Default light theme
const LIGHT_THEME: Theme = {
  colors: {
    primary: '#007AFF',
    secondary: '#5856D6',
    background: '#FFFFFF',
    surface: '#F2F2F7',
    text: '#000000',
    textSecondary: '#8E8E93',
    border: '#C6C6C8',
    error: '#FF3B30',
    success: '#34C759',
    warning: '#FF9500',
    disabled: '#D1D1D6',
    placeholder: '#C7C7CC'
  },
  spacing: {
    xs: 4,
    sm: 8,
    md: 16,
    lg: 24,
    xl: 32,
    xxl: 48
  },
  borderRadius: {
    sm: 4,
    md: 8,
    lg: 12,
    xl: 16
  },
  shadows: {
    small: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.1,
      shadowRadius: 2,
      elevation: 2
    },
    medium: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 4,
      elevation: 4
    },
    large: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.1,
      shadowRadius: 8,
      elevation: 8
    }
  },
  typography: {
    h1: {
      fontSize: 32,
      fontWeight: 'bold',
      lineHeight: 40
    },
    h2: {
      fontSize: 24,
      fontWeight: 'bold',
      lineHeight: 32
    },
    h3: {
      fontSize: 20,
      fontWeight: '600',
      lineHeight: 28
    },
    body: {
      fontSize: 16,
      fontWeight: '400',
      lineHeight: 24
    },
    caption: {
      fontSize: 14,
      fontWeight: '400',
      lineHeight: 20
    }
  }
};

// Dark theme
const DARK_THEME: Theme = {
  ...LIGHT_THEME,
  colors: {
    ...LIGHT_THEME.colors,
    background: '#000000',
    surface: '#1C1C1E',
    text: '#FFFFFF',
    textSecondary: '#8E8E93',
    border: '#38383A',
    placeholder: '#48484A'
  }
};

interface UseThemedStylesReturn {
  theme: Theme;
  isDark: boolean;
  toggleTheme: () => void;
  setTheme: (isDark: boolean) => void;
  colors: Theme['colors'];
  spacing: Theme['spacing'];
  borderRadius: Theme['borderRadius'];
  shadows: Theme['shadows'];
  typography: Theme['typography'];
  // Style utilities
  createStyles: <T extends Record<string, any>>(styles: (theme: Theme) => T) => T;
  getSpacing: (size: keyof Theme['spacing']) => number;
  getColor: (color: keyof Theme['colors']) => string;
  combineStyles: (...styles: any[]) => any[];
}

/**
 * Hook for managing themed styles
 */
export const useThemedStyles = (): UseThemedStylesReturn => {
  const [isDark, setIsDark] = useState(false);
  const theme = isDark ? DARK_THEME : LIGHT_THEME;

  // Toggle between light and dark theme
  const toggleTheme = useCallback(() => {
    setIsDark(prev => !prev);
  }, []);

  // Set specific theme
  const setTheme = useCallback((dark: boolean) => {
    setIsDark(dark);
  }, []);

  // Create styles with theme
  const createStyles = useCallback(<T extends Record<string, any>>(
    styles: (theme: Theme) => T
  ): T => {
    return styles(theme);
  }, []);

  // Get spacing value
  const getSpacing = useCallback((size: keyof Theme['spacing']): number => {
    return theme.spacing[size];
  }, [theme.spacing]);

  // Get color value
  const getColor = useCallback((color: keyof Theme['colors']): string => {
    return theme.colors[color];
  }, [theme.colors]);

  // Combine multiple style arrays
  const combineStyles = useCallback((...styles: any[]): any[] => {
    return styles.filter(Boolean).flat();
  }, []);

  return {
    theme,
    isDark,
    toggleTheme,
    setTheme,
    colors: theme.colors,
    spacing: theme.spacing,
    borderRadius: theme.borderRadius,
    shadows: theme.shadows,
    typography: theme.typography,
    createStyles,
    getSpacing,
    getColor,
    combineStyles
  };
};

/**
 * Hook for component-specific styles
 */
export const useComponentStyles = <T extends Record<string, any>>(
  styleFactory: (theme: Theme) => T
): T => {
  const { theme, createStyles } = useThemedStyles();
  return useMemo(() => createStyles(styleFactory), [theme, createStyles, styleFactory]);
};

/**
 * Hook for screen-specific styles
 */
export const useScreenStyles = (screenName?: string) => {
  const { theme, createStyles } = useThemedStyles();

  const screenStyles = useMemo(() => {
    const baseStyles = createStyles((theme) => StyleSheet.create({
      container: {
        flex: 1,
        backgroundColor: theme.colors.background,
        paddingHorizontal: theme.spacing.md,
        paddingVertical: theme.spacing.lg
      },
      header: {
        backgroundColor: theme.colors.primary,
        paddingHorizontal: theme.spacing.md,
        paddingVertical: theme.spacing.sm
      },
      content: {
        flex: 1,
        paddingVertical: theme.spacing.md
      },
      footer: {
        paddingHorizontal: theme.spacing.md,
        paddingVertical: theme.spacing.sm,
        borderTopWidth: 1,
        borderTopColor: theme.colors.border,
        backgroundColor: theme.colors.surface
      }
    }));

    // Add screen-specific overrides
    const screenOverrides = screenName ? createStyles((theme) => {
      switch (screenName) {
        case 'scanner':
          return StyleSheet.create({
            container: {
              ...baseStyles.container,
              backgroundColor: '#000000',
              paddingHorizontal: 0,
              paddingVertical: 0
            }
          });
        case 'splash':
        case 'login':
        case 'register':
          return StyleSheet.create({
            container: {
              ...baseStyles.container,
              backgroundColor: theme.colors.primary,
              justifyContent: 'center',
              alignItems: 'center'
            }
          });
        default:
          return {};
      }
    }) : {};

    return {
      ...baseStyles,
      ...screenOverrides
    };
  }, [theme, createStyles, screenName]);

  return screenStyles;
};

/**
 * Hook for responsive design styles
 */
export const useResponsiveStyles = () => {
  const { theme, createStyles } = useThemedStyles();
  const [screenWidth, setScreenWidth] = useState(375); // Default iPhone width

  // In a real app, you'd get this from Dimensions or a responsive library
  const updateScreenWidth = useCallback((width: number) => {
    setScreenWidth(width);
  }, []);

  // Breakpoints
  const breakpoints = {
    xs: 320,
    sm: 480,
    md: 768,
    lg: 1024,
    xl: 1200
  };

  // Get current screen size
  const screenSize = useMemo(() => {
    if (screenWidth < breakpoints.sm) return 'xs';
    if (screenWidth < breakpoints.md) return 'sm';
    if (screenWidth < breakpoints.lg) return 'md';
    if (screenWidth < breakpoints.xl) return 'lg';
    return 'xl';
  }, [screenWidth, breakpoints]);

  // Responsive spacing
  const responsiveSpacing = useMemo(() => {
    const multipliers = {
      xs: 0.5,
      sm: 0.75,
      md: 1,
      lg: 1.25,
      xl: 1.5
    };

    const multiplier = multipliers[screenSize as keyof typeof multipliers] || 1;

    return {
      xs: theme.spacing.xs * multiplier,
      sm: theme.spacing.sm * multiplier,
      md: theme.spacing.md * multiplier,
      lg: theme.spacing.lg * multiplier,
      xl: theme.spacing.xl * multiplier,
      xxl: theme.spacing.xxl * multiplier
    };
  }, [theme.spacing, screenSize]);

  // Create responsive styles
  const createResponsiveStyles = useCallback(<T extends Record<string, any>>(
    styles: (theme: Theme, spacing: typeof responsiveSpacing, screenSize: string) => T
  ): T => {
    return createStyles((theme) => styles(theme, responsiveSpacing, screenSize));
  }, [createStyles, responsiveSpacing, screenSize]);

  return {
    screenWidth,
    screenSize,
    breakpoints,
    responsiveSpacing,
    updateScreenWidth,
    createResponsiveStyles
  };
};

export default {
  useThemedStyles,
  useComponentStyles,
  useScreenStyles,
  useResponsiveStyles
};
