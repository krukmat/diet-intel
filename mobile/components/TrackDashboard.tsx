import React from 'react';
import {
  View,
  Text,
  ScrollView,
  ActivityIndicator,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { useTrackData } from '../hooks/useTrackData';
import { useMealTracking } from '../hooks/useMealTracking';
import { useWeightTracking } from '../hooks/useWeightTracking';
import { MealCard } from './MealCard';
import { WeightTracker } from './WeightTracker';
import { formatCalories, normalizeMealMacros } from '../utils/mealUtils';
import { trackDashboardStyles } from './styles/TrackDashboard.styles';

export const TrackDashboard: React.FC = () => {
  const trackData = useTrackData();
  const mealTracking = useMealTracking(trackData);
  const weightTracking = useWeightTracking();

  const handleMealPress = async (mealId: string) => {
    await mealTracking.consumeMealItem(mealId);
  };

  const handleWeightRecorded = (weight: number) => {
    // Refresh track data to get updated progress
    trackData.refetch();
  };

  const handleRefresh = () => {
    trackData.refetch();
  };

  if (trackData.loading && !trackData.dashboard) {
    return (
      <View style={trackDashboardStyles.loadingContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
        <Text style={trackDashboardStyles.loadingText}>Loading your progress...</Text>
      </View>
    );
  }

  if (trackData.error && !trackData.dashboard) {
    return (
      <View style={trackDashboardStyles.errorContainer}>
        <Text style={trackDashboardStyles.errorTitle}>Unable to load data</Text>
        <Text style={trackDashboardStyles.errorText}>{trackData.error}</Text>
        <TouchableOpacity style={trackDashboardStyles.retryButton} onPress={handleRefresh}>
          <Text style={trackDashboardStyles.retryButtonText}>Try Again</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const activePlan = trackData.dashboard?.active_plan;
  const progress = trackData.dashboard?.progress;
  const hasMeals = activePlan?.meals && activePlan.meals.length > 0;

  return (
    <ScrollView style={trackDashboardStyles.container} showsVerticalScrollIndicator={false}>
      {/* Header with refresh */}
      <View style={trackDashboardStyles.header}>
        <Text style={trackDashboardStyles.title}>Daily Progress</Text>
        <TouchableOpacity
          style={trackDashboardStyles.refreshButton}
          onPress={handleRefresh}
          disabled={trackData.loading}
        >
          <Text style={trackDashboardStyles.refreshButtonText}>
            {trackData.loading ? '↻' : '⟳'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Nutrition Progress Summary */}
      {progress && (
        <View style={trackDashboardStyles.progressContainer}>
          <Text style={trackDashboardStyles.sectionTitle}>Today's Nutrition</Text>

          <View style={trackDashboardStyles.progressGrid}>
            <View style={trackDashboardStyles.progressItem}>
              <Text style={trackDashboardStyles.progressValue}>
                {Math.round(progress.calories.consumed)} / {progress.calories.planned}
              </Text>
              <Text style={trackDashboardStyles.progressLabel}>Calories</Text>
              <Text style={trackDashboardStyles.progressPercent}>
                {progress.calories.percentage}%
              </Text>
            </View>

            <View style={trackDashboardStyles.progressItem}>
              <Text style={trackDashboardStyles.progressValue}>
                {Math.round(progress.protein.consumed)} / {progress.protein.planned}g
              </Text>
              <Text style={trackDashboardStyles.progressLabel}>Protein</Text>
              <Text style={trackDashboardStyles.progressPercent}>
                {progress.protein.percentage}%
              </Text>
            </View>

            <View style={trackDashboardStyles.progressItem}>
              <Text style={trackDashboardStyles.progressValue}>
                {Math.round(progress.fat.consumed)} / {progress.fat.planned}g
              </Text>
              <Text style={trackDashboardStyles.progressLabel}>Fat</Text>
              <Text style={trackDashboardStyles.progressPercent}>
                {progress.fat.percentage}%
              </Text>
            </View>

            <View style={trackDashboardStyles.progressItem}>
              <Text style={trackDashboardStyles.progressValue}>
                {Math.round(progress.carbs.consumed)} / {progress.carbs.planned}g
              </Text>
              <Text style={trackDashboardStyles.progressLabel}>Carbs</Text>
              <Text style={trackDashboardStyles.progressPercent}>
                {progress.carbs.percentage}%
              </Text>
            </View>
          </View>

          {activePlan && (
            <View style={trackDashboardStyles.targetContainer}>
              <Text style={trackDashboardStyles.targetText}>
                Daily Target: {formatCalories(activePlan.daily_calorie_target)}
              </Text>
            </View>
          )}
        </View>
      )}

      {/* Meals Section */}
      <View style={trackDashboardStyles.mealsContainer}>
        <Text style={trackDashboardStyles.sectionTitle}>Today's Meals</Text>

        {!hasMeals && !trackData.loading && (
          <View style={trackDashboardStyles.emptyState}>
            <Text style={trackDashboardStyles.emptyStateText}>No meals planned for today</Text>
            <Text style={trackDashboardStyles.emptyStateSubtext}>
              Create a meal plan to start tracking your nutrition
            </Text>
          </View>
        )}

        {hasMeals && activePlan?.meals.map((meal) => (
          <MealCard
            key={meal.id}
            mealItem={{
              id: meal.id,
              barcode: meal.barcode,
              name: meal.name,
              serving: meal.serving,
              calories: meal.calories,
              macros: normalizeMealMacros(meal.macros),
            }}
            consumptionState={mealTracking.getConsumptionStatus(meal.id)}
            onPress={() => handleMealPress(meal.id)}
          />
        ))}

        {trackData.loading && (
          <View style={trackDashboardStyles.loadingOverlay}>
            <ActivityIndicator size="small" color="#007AFF" />
            <Text style={trackDashboardStyles.loadingText}>Refreshing meals...</Text>
          </View>
        )}
      </View>

      {/* Weight Tracking Section */}
      <View style={trackDashboardStyles.weightContainer}>
        <Text style={trackDashboardStyles.sectionTitle}>Weight Tracking</Text>
        <WeightTracker
          weightTracking={weightTracking}
          onWeightRecorded={handleWeightRecorded}
        />
      </View>

      {/* Error Display */}
      {trackData.error && trackData.dashboard && (
        <View style={trackDashboardStyles.partialErrorContainer}>
          <Text style={trackDashboardStyles.partialErrorText}>
            Some data may be outdated: {trackData.error}
          </Text>
        </View>
      )}

      {/* Pending Operations Indicator */}
      {mealTracking.hasPendingConsumptions && (
        <View style={trackDashboardStyles.pendingContainer}>
          <ActivityIndicator size="small" color="#FF9800" />
          <Text style={trackDashboardStyles.pendingText}>Processing meal updates...</Text>
        </View>
      )}
    </ScrollView>
  );
};

export default TrackDashboard;
