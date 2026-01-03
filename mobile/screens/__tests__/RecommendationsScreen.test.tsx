import React from 'react';
import { Alert } from 'react-native';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import RecommendationsScreen from '../RecommendationsScreen';
import { apiService } from '../../services/ApiService';
import { useAuth } from '../../contexts/AuthContext';

jest.mock('../../services/ApiService', () => ({
  apiService: {
    generateSmartRecommendations: jest.fn(),
    addProductToPlan: jest.fn(),
    recordRecommendationFeedback: jest.fn(),
  },
}));

jest.mock('../../contexts/AuthContext', () => ({
  useAuth: jest.fn(),
}));

jest.mock('../../utils/foodTranslation', () => ({
  translateFoodNameSync: (name: string) => name,
}));

const sampleItem = {
  barcode: '123',
  name: 'Greek Yogurt',
  brand: 'Test Brand',
  image_url: 'https://example.com/yogurt.png',
  calories_per_serving: 120,
  serving_size: '1 cup',
  protein_g: 12,
  fat_g: 4,
  carbs_g: 6,
  fiber_g: 2,
  recommendation_type: 'meal',
  reasons: ['high_protein', 'low_sugar'],
  confidence_score: 0.9,
  nutritional_score: {
    overall_score: 0.8,
    protein_score: 0.9,
    fiber_score: 0.6,
    micronutrient_score: 0.7,
    calorie_density_score: 0.5,
  },
  preference_match: 0.7,
  goal_alignment: 0.6,
};

const sampleResponse = {
  generated_at: '2024-01-01T00:00:00Z',
  meal_recommendations: [
    {
      meal_name: 'Breakfast',
      target_calories: 400,
      current_calories: 0,
      recommendations: [sampleItem],
      macro_gaps: {},
      micronutrient_gaps: ['fiber'],
    },
  ],
  daily_additions: [],
  snack_recommendations: [],
  nutritional_insights: {
    total_recommended_calories: 500,
    macro_distribution: {
      protein_percent: 30,
      fat_percent: 20,
      carbs_percent: 50,
    },
    nutritional_gaps: ['fiber'],
    health_benefits: ['energy'],
  },
  personalization_factors: [],
  total_recommendations: 1,
  avg_confidence: 0.9,
  recommendation_version: 'v1',
};

describe('RecommendationsScreen', () => {
  const onBackPress = jest.fn();
  const mockGenerate = apiService.generateSmartRecommendations as jest.Mock;
  const mockAddToPlan = apiService.addProductToPlan as jest.Mock;
  const mockRecordFeedback = apiService.recordRecommendationFeedback as jest.Mock;
  const mockUseAuth = useAuth as jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    mockUseAuth.mockReturnValue({ user: { id: 'user-123' } });
    mockGenerate.mockResolvedValue({ data: sampleResponse });
  });

  it('shows loading state while generating recommendations', async () => {
    let resolvePromise: ((value: unknown) => void) | null = null;
    const pendingPromise = new Promise(resolve => {
      resolvePromise = resolve;
    });

    mockGenerate.mockReturnValueOnce(pendingPromise);

    const { getByText } = render(<RecommendationsScreen onBackPress={onBackPress} />);
    expect(getByText('Generating smart recommendations...')).toBeTruthy();

    await act(async () => {
      resolvePromise?.({ data: sampleResponse });
    });
  });

  it('renders recommendations and updates meal context', async () => {
    const { getByText } = render(<RecommendationsScreen onBackPress={onBackPress} />);

    await waitFor(() => expect(getByText('🎯 Smart Recommendations')).toBeTruthy());
    expect(getByText('Greek Yogurt')).toBeTruthy();

    fireEvent.press(getByText('🌞 Lunch'));
    await waitFor(() => expect(mockGenerate).toHaveBeenCalledTimes(2));
    expect(mockGenerate.mock.calls[1][0]).toEqual(
      expect.objectContaining({ meal_context: 'lunch' })
    );
  });

  it('alerts when user is not signed in for actions', async () => {
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    mockUseAuth.mockReturnValue({ user: null });

    const { getByText } = render(<RecommendationsScreen onBackPress={onBackPress} />);

    await waitFor(() => expect(getByText('Greek Yogurt')).toBeTruthy());

    fireEvent.press(getByText('➕ Add to breakfast'));
    expect(alertSpy).toHaveBeenCalledWith(
      'Sign In Required',
      'Please log in to modify your meal plan.'
    );

    fireEvent.press(getByText('👍'));
    fireEvent.press(getByText('👎'));
    expect(alertSpy).toHaveBeenCalledWith(
      'Sign In Required',
      'Please log in to share feedback.'
    );
  });

  it('adds items to the meal plan and records feedback', async () => {
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    mockAddToPlan.mockResolvedValue({ data: { success: true, message: 'Added!' } });
    mockRecordFeedback.mockResolvedValue({});
    jest.spyOn(Date, 'now').mockReturnValue(123456);

    const { getByText } = render(<RecommendationsScreen onBackPress={onBackPress} />);

    await waitFor(() => expect(getByText('Greek Yogurt')).toBeTruthy());

    fireEvent.press(getByText('➕ Add to breakfast'));
    const addCall = alertSpy.mock.calls.find(call => call[0] === 'Add to Meal Plan');
    const addActions = addCall?.[2] as Array<{ text: string; onPress?: () => Promise<void> }>;
    await act(async () => {
      await addActions?.find(action => action.text === 'Add')?.onPress?.();
    });

    expect(mockAddToPlan).toHaveBeenCalledWith({
      barcode: '123',
      meal_type: 'breakfast',
      serving_size: '1 cup',
    });

    fireEvent.press(getByText('👍'));
    fireEvent.press(getByText('👎'));

    await waitFor(() => expect(mockRecordFeedback).toHaveBeenCalledTimes(2));
  });

  it('opens preferences modal and applies selections', async () => {
    const { getByText } = render(<RecommendationsScreen onBackPress={onBackPress} />);

    await waitFor(() => expect(getByText('⚙️')).toBeTruthy());
    fireEvent.press(getByText('⚙️'));

    await waitFor(() => expect(getByText('Recommendation Preferences')).toBeTruthy());
    fireEvent.press(getByText('vegetarian'));
    fireEvent.press(getByText('Mediterranean'));
    fireEvent.press(getByText('Apply Preferences'));

    await waitFor(() => expect(mockGenerate).toHaveBeenCalledTimes(2));
  });
});
