import React from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator } from 'react-native';
import { MealItem } from '../utils/mealUtils';
import { MealConsumptionState } from '../hooks/useMealTracking';
import { formatCalories } from '../utils/mealUtils';
import { mealCardStyles } from './styles/MealCard.styles';

export interface MealCardProps {
  mealItem: MealItem;
  consumptionState?: MealConsumptionState;
  onPress: () => void;
  disabled?: boolean;
}

export const MealCard: React.FC<MealCardProps> = ({
  mealItem,
  consumptionState,
  onPress,
  disabled = false,
}) => {
  const getCardStyle = (): any => {
    let cardStyle = { ...mealCardStyles.card };

    if (consumptionState?.status === 'consumed') {
      cardStyle = { ...cardStyle, ...mealCardStyles.cardConsumed };
    } else if (consumptionState?.status === 'failed') {
      cardStyle = { ...cardStyle, ...mealCardStyles.cardError };
    }

    return cardStyle;
  };

  const getStatusIcon = (): string => {
    switch (consumptionState?.status) {
      case 'consuming':
        return '⏳';
      case 'consumed':
        return '✅';
      case 'failed':
        return '❌';
      case 'pending':
        return '🔄';
      default:
        return '';
    }
  };

  const getStatusText = (): string => {
    switch (consumptionState?.status) {
      case 'consuming':
        return 'Consuming...';
      case 'consumed':
        return 'Consumed';
      case 'failed':
        return 'Failed to consume';
      case 'pending':
        return 'Retrying...';
      default:
        return '';
    }
  };

  return (
    <TouchableOpacity
      style={getCardStyle()}
      onPress={onPress}
      disabled={disabled || consumptionState?.status === 'consuming'}
      activeOpacity={disabled ? 1 : 0.7}
    >
      <View style={mealCardStyles.header}>
        <Text style={mealCardStyles.name} numberOfLines={1}>
          {mealItem.name}
        </Text>
        {consumptionState?.status === 'consuming' && (
          <ActivityIndicator size="small" color="#007AFF" />
        )}
        {consumptionState?.status && consumptionState.status !== 'consuming' && (
          <Text style={mealCardStyles.statusIcon}>{getStatusIcon()}</Text>
        )}
      </View>

      <View style={mealCardStyles.details}>
        <Text style={mealCardStyles.serving}>{mealItem.serving}</Text>
        <Text style={mealCardStyles.calories}>
          {formatCalories(mealItem.calories)}
        </Text>
      </View>

      <View style={mealCardStyles.macros}>
        <Text style={mealCardStyles.macro}>
          P: {mealItem.macros.protein_g}g
        </Text>
        <Text style={mealCardStyles.macro}>
          C: {mealItem.macros.carbs_g}g
        </Text>
        <Text style={mealCardStyles.macro}>
          F: {mealItem.macros.fat_g}g
        </Text>
      </View>

      {consumptionState?.status && (
        <View style={mealCardStyles.statusContainer}>
          <Text style={[
            mealCardStyles.statusText,
            consumptionState.status === 'failed' && mealCardStyles.statusTextError,
          ]}>
            {getStatusText()}
          </Text>
          {consumptionState.lastError && (
            <Text style={mealCardStyles.errorText} numberOfLines={2}>
              {consumptionState.lastError}
            </Text>
          )}
        </View>
      )}
    </TouchableOpacity>
  );
};

export default MealCard;
