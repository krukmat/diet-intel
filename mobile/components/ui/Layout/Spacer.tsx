/**
 * Spacer Component
 * Flexible spacing utility
 */

import React from 'react';
import { View } from 'react-native';
import { SpacerProps } from './Layout.types';
import { tokens } from '../../../styles/tokens';

export const Spacer: React.FC<SpacerProps> = ({
  size = 'md',
  direction = 'vertical',
  flex = false,
  style,
  testID,
}) => {
  const spacingValues = {
    xs: tokens.spacing.xs,
    sm: tokens.spacing.sm,
    md: tokens.spacing.md,
    lg: tokens.spacing.lg,
    xl: tokens.spacing.xl,
  };

  const spacerStyle = {
    ...(flex && { flex: 1 }),
    ...(direction === 'vertical' && {
      height: flex ? undefined : spacingValues[size],
      width: undefined,
    }),
    ...(direction === 'horizontal' && {
      width: flex ? undefined : spacingValues[size],
      height: undefined,
    }),
    ...style,
  };

  return <View style={spacerStyle} testID={testID} />;
};