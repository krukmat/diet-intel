/**
 * Section Component
 * Content section with consistent spacing
 */

import React from 'react';
import { View, Text } from 'react-native';
import { SectionProps } from './Layout.types';
import { tokens } from '../../../styles/tokens';

export const Section: React.FC<SectionProps> = ({
  children,
  title,
  subtitle,
  action,
  spacing = 'md',
  noDivider = false,
  backgroundColor,
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

  const sectionStyle = {
    marginVertical: spacingValues[spacing],
    backgroundColor,
    ...(!noDivider && {
      borderBottomWidth: 1,
      borderBottomColor: tokens.colors.border.section,
      paddingBottom: spacingValues[spacing],
    }),
    ...style,
  };

  return (
    <View style={sectionStyle} testID={testID}>
      {(title || action) && (
        <View style={{
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: tokens.spacing.sm,
        }}>
          <View style={{ flex: 1 }}>
            {title && (
              <Text style={{
                fontSize: tokens.typography.fontSize.lg,
                fontWeight: tokens.typography.fontWeight.semibold,
                color: tokens.colors.text.primary,
                marginBottom: subtitle ? tokens.spacing.xs : 0,
              }}>
                {title}
              </Text>
            )}
            {subtitle && (
              <Text style={{
                fontSize: tokens.typography.fontSize.sm,
                color: tokens.colors.text.secondary,
              }}>
                {subtitle}
              </Text>
            )}
          </View>
          {action && (
            <View style={{ marginLeft: tokens.spacing.sm }}>
              {action}
            </View>
          )}
        </View>
      )}
      {children}
    </View>
  );
};