import React from 'react';
import PlanScreen from './PlanScreen';

interface PlanScreenContainerProps {
  onBackPress: () => void;
  navigateToSmartDiet?: (context?: { planId?: string }) => void;
}

export default function PlanScreenContainer({
  onBackPress,
  navigateToSmartDiet,
}: PlanScreenContainerProps) {
  return (
    <PlanScreen
      onBackPress={onBackPress}
      navigateToSmartDiet={navigateToSmartDiet}
    />
  );
}
