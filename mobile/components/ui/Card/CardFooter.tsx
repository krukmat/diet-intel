/**
 * CardFooter Component
 * Footer section for actions or additional information
 */

import React from 'react';
import { View } from 'react-native';
import { CardFooterProps } from './Card.types';
import { getCardFooterStyle } from './Card.styles';

export const CardFooter: React.FC<CardFooterProps> = ({
  children,
  alignment = 'left',
  style,
  testID,
}) => {
  const footerStyle = getCardFooterStyle(alignment);

  return (
    <View
      style={[footerStyle, style]}
      testID={testID || 'card-footer'}
    >
      {children}
    </View>
  );
};