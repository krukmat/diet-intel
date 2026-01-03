import * as visionTypes from '../visionLog';

describe('vision log types', () => {
  it('supports creating vision log response data', () => {
    const log = {
      id: 'log-1',
      user_id: 'user-1',
      image_url: 'https://example.com/1.png',
      meal_type: 'breakfast',
      identified_ingredients: [
        {
          name: 'Oatmeal',
          category: 'grain',
          estimated_grams: 100,
          confidence_score: 0.9,
          nutrition_per_100g: {
            calories: 200,
            protein_g: 8,
            fat_g: 4,
            carbs_g: 32,
          },
        },
      ],
      estimated_portions: {
        total_calories: 200,
        total_protein_g: 8,
        total_fat_g: 4,
        total_carbs_g: 32,
        confidence_score: 0.9,
      },
      nutritional_analysis: {
        total_calories: 200,
        macro_distribution: {
          protein_percent: 20,
          fat_percent: 20,
          carbs_percent: 60,
        },
        food_quality_score: 80,
        health_benefits: ['fiber'],
      },
      exercise_suggestions: [
        {
          activity_type: 'walking',
          duration_minutes: 20,
          estimated_calories_burned: 80,
          intensity_level: 'low',
          reasoning: 'balance meal',
          health_benefits: ['mood'],
        },
      ],
      created_at: '2024-01-01T00:00:00Z',
      processing_time_ms: 1200,
    };

    const state = {
      selectedImage: 'local-uri',
      isAnalyzing: false,
      analysisResult: log,
      showExerciseSuggestions: true,
      error: null,
    };

    expect(log.identified_ingredients[0].name).toBe('Oatmeal');
    expect(state.analysisResult?.id).toBe('log-1');
    expect(visionTypes).toBeDefined();
  });
});
