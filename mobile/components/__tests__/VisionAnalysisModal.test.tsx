import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import VisionAnalysisModal from '../VisionAnalysisModal';
import type { VisionLogResponse } from '../../types/visionLog';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (_key: string, fallback: string) => fallback,
  }),
}));

const baseAnalysis: VisionLogResponse = {
  id: 'log-1',
  user_id: 'user-1',
  image_url: 'https://example.com/image.jpg',
  meal_type: 'lunch',
  identified_ingredients: [
    {
      name: 'Chicken',
      category: 'protein',
      estimated_grams: 150,
      confidence_score: 0.9,
      nutrition_per_100g: {
        calories: 165,
        protein_g: 31,
        fat_g: 4,
        carbs_g: 0,
      },
    },
  ],
  estimated_portions: {
    total_calories: 400,
    total_protein_g: 35,
    total_fat_g: 12,
    total_carbs_g: 20,
    confidence_score: 0.88,
  },
  nutritional_analysis: {
    total_calories: 400,
    macro_distribution: {
      protein_percent: 35,
      fat_percent: 30,
      carbs_percent: 35,
    },
    food_quality_score: 8,
    health_benefits: ['High protein', 'Low sugar'],
  },
  exercise_suggestions: [
    {
      activity_type: 'walking',
      duration_minutes: 20,
      estimated_calories_burned: 100,
      intensity_level: 'low',
      reasoning: 'Light walk',
      health_benefits: ['Cardio'],
    },
  ],
  created_at: '2026-01-01T00:00:00Z',
  processing_time_ms: 1200,
};

describe('VisionAnalysisModal', () => {
  it('renders analysis details and exercise suggestions', () => {
    const { getByText } = render(
      <VisionAnalysisModal
        visible
        analysis={baseAnalysis}
        onClose={jest.fn()}
        onRetry={jest.fn()}
      />
    );

    expect(getByText('Analysis Results')).toBeTruthy();
    expect(getByText('Meal Type: lunch')).toBeTruthy();
    expect(getByText('Chicken')).toBeTruthy();
    expect(getByText('150g')).toBeTruthy();
    expect(getByText('400 calories')).toBeTruthy();
    expect(getByText('Protein: 35g')).toBeTruthy();
    expect(getByText('Fat: 12g')).toBeTruthy();
    expect(getByText('Carbs: 20g')).toBeTruthy();
    expect(getByText('Quality Score: 8/10')).toBeTruthy();
    expect(getByText('• High protein')).toBeTruthy();
    expect(getByText('Exercise Suggestions')).toBeTruthy();
    expect(getByText('walking')).toBeTruthy();
    expect(getByText('20 min • 100 cal • low')).toBeTruthy();
  });

  it('handles close actions and hides exercise section when empty', () => {
    const onClose = jest.fn();
    const { getByText, queryByText } = render(
      <VisionAnalysisModal
        visible
        analysis={{ ...baseAnalysis, exercise_suggestions: [] }}
        onClose={onClose}
        onRetry={jest.fn()}
      />
    );

    fireEvent.press(getByText('✕'));
    fireEvent.press(getByText('Close'));

    expect(onClose).toHaveBeenCalledTimes(2);
    expect(queryByText('Exercise Suggestions')).toBeNull();
  });
});
