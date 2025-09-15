/**
 * Container Component
 * Screen-level wrapper solving inconsistent layouts
 */

import React from 'react';
import { View, ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ContainerProps } from './Layout.types';
import { tokens } from '../../../styles/tokens';

export const Container: React.FC<ContainerProps> = ({
  variant = 'screen',
  padding = 'md',
  children,
  scrollable = true,
  safeArea = true,
  keyboardAware = false,
  backgroundColor,
  style,
  testID,
  ...scrollProps
}) => {
  const insets = useSafeAreaInsets();

  const paddingValues = {
    none: 0,
    sm: tokens.spacing.sm,
    md: tokens.spacing.md,
    lg: tokens.spacing.lg,
  };

  const containerStyle = {
    flex: 1,
    backgroundColor: backgroundColor || tokens.colors.background.default,
    paddingTop: safeArea ? insets.top : 0,
    paddingBottom: safeArea ? insets.bottom : 0,
    paddingLeft: safeArea ? insets.left : 0,
    paddingRight: safeArea ? insets.right : 0,
    ...style,
  };

  const contentStyle = {
    flex: 1,
    padding: paddingValues[padding],
  };

  if (scrollable) {
    return (
      <View style={containerStyle} testID={testID}>
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={contentStyle}
          keyboardShouldPersistTaps="handled"
          {...scrollProps}
        >
          {children}
        </ScrollView>
      </View>
    );
  }

  return (
    <View style={[containerStyle, contentStyle]} testID={testID}>
      {children}
    </View>
  );
};