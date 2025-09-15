/**
 * Grid Component
 * Responsive grid system
 */

import React from 'react';
import { View } from 'react-native';
import { GridProps, GridItemProps } from './Layout.types';
import { tokens } from '../../../styles/tokens';

export const Grid: React.FC<GridProps> = ({
  children,
  columns = 2,
  gap = 'md',
  alignItems = 'stretch',
  justifyContent = 'flex-start',
  style,
  testID,
}) => {
  const gapValues = {
    xs: tokens.spacing.xs,
    sm: tokens.spacing.sm,
    md: tokens.spacing.md,
    lg: tokens.spacing.lg,
    xl: tokens.spacing.xl,
  };

  const gridStyle = {
    flexDirection: 'row' as const,
    flexWrap: 'wrap' as const,
    alignItems,
    justifyContent,
    marginHorizontal: -gapValues[gap] / 2,
    ...style,
  };

  return (
    <View style={gridStyle} testID={testID}>
      {React.Children.map(children, (child, index) => {
        if (React.isValidElement(child)) {
          const itemWidth = `${(100 / columns) - (gapValues[gap] / columns)}%`;
          return (
            <View
              key={index}
              style={{
                width: itemWidth,
                marginHorizontal: gapValues[gap] / 2,
                marginVertical: gapValues[gap] / 2,
              }}
            >
              {child}
            </View>
          );
        }
        return child;
      })}
    </View>
  );
};

export const GridItem: React.FC<GridItemProps> = ({
  children,
  span = 1,
  offset = 0,
  style,
  testID,
}) => {
  return (
    <View style={[{ flex: span }, style]} testID={testID}>
      {children}
    </View>
  );
};