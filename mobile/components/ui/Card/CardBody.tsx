/**
 * CardBody Component
 * Main content area of cards with configurable spacing
 */

import React from 'react';
import { View } from 'react-native';
import { CardBodyProps } from './Card.types';
import { getCardBodyStyle } from './Card.styles';

export const CardBody: React.FC<CardBodyProps> = ({
  children,
  spacing = 'md',
  style,
  testID,
}) => {
  const bodyStyle = getCardBodyStyle(spacing);

  return (
    <View
      style={[bodyStyle, style]}
      testID={testID || 'card-body'}
    >
      {children}
    </View>
  );
};