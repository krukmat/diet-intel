/**
 * CardHeader Component
 * Standardized header section for cards with title, subtitle, and action
 */

import React from 'react';
import { View, Text } from 'react-native';
import { CardHeaderProps } from './Card.types';
import { cardHeaderStyles } from './Card.styles';

export const CardHeader: React.FC<CardHeaderProps> = ({
  title,
  subtitle,
  action,
  titleStyle,
  subtitleStyle,
  style,
  testID,
}) => {
  return (
    <View
      style={[cardHeaderStyles.container, style]}
      testID={testID || 'card-header'}
    >
      <View style={cardHeaderStyles.textContainer}>
        <Text
          style={[cardHeaderStyles.title, titleStyle]}
          numberOfLines={2}
          ellipsizeMode="tail"
          testID={testID ? `${testID}-title` : 'card-header-title'}
        >
          {title}
        </Text>

        {subtitle && (
          <Text
            style={[cardHeaderStyles.subtitle, subtitleStyle]}
            numberOfLines={2}
            ellipsizeMode="tail"
            testID={testID ? `${testID}-subtitle` : 'card-header-subtitle'}
          >
            {subtitle}
          </Text>
        )}
      </View>

      {action && (
        <View
          style={cardHeaderStyles.action}
          testID={testID ? `${testID}-action` : 'card-header-action'}
        >
          {action}
        </View>
      )}
    </View>
  );
};