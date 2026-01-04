import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import ExerciseSuggestionCard from '../ExerciseSuggestionCard';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, fallback?: string) => fallback || key,
  }),
}));

const baseExercise = {
  activity_type: 'running',
  intensity_level: 'high',
  duration_minutes: 30,
  estimated_calories_burned: 250,
  health_benefits: ['Improves cardio', 'Boosts mood', 'Builds stamina'],
  reasoning: 'Great for endurance',
};

describe('ExerciseSuggestionCard', () => {
  it('renders activity details and benefits', () => {
    const { getByText } = render(
      <ExerciseSuggestionCard exercise={baseExercise as any} />
    );

    expect(getByText('running')).toBeTruthy();
    expect(getByText('30 minutes')).toBeTruthy();
    expect(getByText('250 calories')).toBeTruthy();
    expect(getByText('Benefits:')).toBeTruthy();
    expect(getByText('• Improves cardio')).toBeTruthy();
    expect(getByText('• Boosts mood')).toBeTruthy();
    expect(getByText('+1 more')).toBeTruthy();
    expect(getByText('Why: Great for endurance')).toBeTruthy();
  });

  it('renders fallback icons and labels', () => {
    const exercise = {
      ...baseExercise,
      activity_type: 'unknown',
      intensity_level: 'unknown',
      health_benefits: [],
    };

    const { getAllByText, getByText } = render(
      <ExerciseSuggestionCard exercise={exercise as any} />
    );

    expect(getAllByText('unknown').length).toBeGreaterThan(0);
    expect(getByText('💪')).toBeTruthy();
  });

  it('triggers onPress when provided', () => {
    const onPress = jest.fn();
    const { getByText } = render(
      <ExerciseSuggestionCard exercise={baseExercise as any} onPress={onPress} />
    );

    fireEvent.press(getByText('running'));
    expect(onPress).toHaveBeenCalledTimes(1);
  });
});
