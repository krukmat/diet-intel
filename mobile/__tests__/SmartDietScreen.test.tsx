import React from 'react';
import { render, fireEvent, waitFor, screen } from '@testing-library/react-native';
import axios from 'axios';
import SmartDietScreen from '../screens/SmartDietScreen';

// Mock axios
const mockedAxios = axios as jest.Mocked<typeof axios>;

// Mock navigation
const mockNavigation = {
  navigate: jest.fn(),
  goBack: jest.fn(),
  setOptions: jest.fn(),
};

describe('SmartDietScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Mock successful API response
    mockedAxios.get.mockResolvedValue({
      data: {
        suggestions: [
          {
            id: 'suggestion_001',
            type: 'food_discovery',
            title: 'Greek Yogurt with Berries',
            description: 'High-protein breakfast option',
            confidence_score: 0.85,
            nutritional_impact: 'Improves protein intake by 15g',
            food_items: [
              {
                name: 'Greek Yogurt',
                barcode: '1234567890123',
                quantity: '1 cup',
                calories: 100,
                protein: 15,
                carbs: 6,
                fat: 0
              }
            ],
            metadata: {
              reasons: ['High protein content', 'Low calories', 'Fits breakfast profile'],
              meal_timing: 'breakfast'
            }
          }
        ],
        nutritional_summary: {
          total_calories: 968,
          macro_distribution: {
            protein_percent: 16.6,
            fat_percent: 27.4,
            carbs_percent: 52.4
          },
          daily_progress: {
            calories_remaining: 1032,
            protein_remaining: 84,
            fat_remaining: 45
          },
          health_benefits: [
            'Improved protein intake',
            'Better micronutrient profile'
          ]
        }
      }
    });
  });

  it('renders correctly on initial load', () => {
    const { getByText } = render(<SmartDietScreen navigation={mockNavigation} />);
    
    expect(getByText('Smart Diet')).toBeTruthy();
    expect(getByText('General')).toBeTruthy();
    expect(getByText('Optimize')).toBeTruthy();
    expect(getByText('Insights')).toBeTruthy();
  });

  it('displays loading state initially', () => {
    const { getByTestId } = render(<SmartDietScreen navigation={mockNavigation} />);
    
    expect(getByTestId('loading-indicator')).toBeTruthy();
  });

  it('switches between different contexts', async () => {
    const { getByText } = render(<SmartDietScreen navigation={mockNavigation} />);
    
    // Initially shows General context
    expect(getByText('General')).toBeTruthy();
    
    // Switch to Optimize context
    fireEvent.press(getByText('Optimize'));
    
    // Wait for state update
    await waitFor(() => {
      expect(mockedAxios.get).toHaveBeenCalledWith(
        expect.stringContaining('context=optimize')
      );
    });
  });

  it('displays suggestions after loading', async () => {
    const { getByText, queryByTestId } = render(<SmartDietScreen navigation={mockNavigation} />);
    
    // Wait for loading to complete
    await waitFor(() => {
      expect(queryByTestId('loading-indicator')).toBeNull();
    });
    
    // Check if suggestion is displayed
    expect(getByText('Greek Yogurt with Berries')).toBeTruthy();
    expect(getByText('High-protein breakfast option')).toBeTruthy();
    expect(getByText('85%')).toBeTruthy(); // confidence score
  });

  it('displays nutritional insights correctly', async () => {
    const { getByText } = render(<SmartDietScreen navigation={mockNavigation} />);
    
    // Switch to insights context
    fireEvent.press(getByText('Insights'));
    
    await waitFor(() => {
      expect(getByText('968 kcal')).toBeTruthy();
      expect(getByText('>i 16.6%')).toBeTruthy(); // protein percentage
      expect(getByText('>Q 27.4%')).toBeTruthy(); // fat percentage
      expect(getByText('<^ 52.4%')).toBeTruthy(); // carbs percentage
    });
  });

  it('handles API errors gracefully', async () => {
    // Mock API error
    mockedAxios.get.mockRejectedValue(new Error('Network error'));
    
    const { getByText } = render(<SmartDietScreen navigation={mockNavigation} />);
    
    await waitFor(() => {
      expect(getByText('Failed to generate suggestions. Please try again.')).toBeTruthy();
    });
  });

  it('displays retry button on error', async () => {
    // Mock API error
    mockedAxios.get.mockRejectedValue(new Error('Network error'));
    
    const { getByText } = render(<SmartDietScreen navigation={mockNavigation} />);
    
    await waitFor(() => {
      const retryButton = getByText('Retry');
      expect(retryButton).toBeTruthy();
    });
  });

  it('retries API call when retry button is pressed', async () => {
    // Mock initial error, then success
    mockedAxios.get
      .mockRejectedValueOnce(new Error('Network error'))
      .mockResolvedValue({
        data: {
          suggestions: [],
          nutritional_summary: {}
        }
      });
    
    const { getByText } = render(<SmartDietScreen navigation={mockNavigation} />);
    
    // Wait for error state
    await waitFor(() => {
      expect(getByText('Retry')).toBeTruthy();
    });
    
    // Press retry button
    fireEvent.press(getByText('Retry'));
    
    // Should make another API call
    await waitFor(() => {
      expect(mockedAxios.get).toHaveBeenCalledTimes(2);
    });
  });

  it('displays suggestion reasons correctly', async () => {
    const { getByText, queryByTestId } = render(<SmartDietScreen navigation={mockNavigation} />);
    
    await waitFor(() => {
      expect(queryByTestId('loading-indicator')).toBeNull();
    });
    
    expect(getByText('High protein content')).toBeTruthy();
    expect(getByText('Low calories')).toBeTruthy();
    expect(getByText('Fits breakfast profile')).toBeTruthy();
  });

  it('handles empty suggestions response', async () => {
    // Mock empty response
    mockedAxios.get.mockResolvedValue({
      data: {
        suggestions: [],
        nutritional_summary: {}
      }
    });
    
    const { getByText } = render(<SmartDietScreen navigation={mockNavigation} />);
    
    await waitFor(() => {
      expect(getByText('No suggestions available at the moment.')).toBeTruthy();
    });
  });

  it('applies correct context parameters to API calls', async () => {
    const { getByText } = render(<SmartDietScreen navigation={mockNavigation} />);
    
    // Test General context
    fireEvent.press(getByText('General'));
    await waitFor(() => {
      expect(mockedAxios.get).toHaveBeenCalledWith(
        expect.stringContaining('context=general')
      );
    });
    
    // Test Optimize context  
    fireEvent.press(getByText('Optimize'));
    await waitFor(() => {
      expect(mockedAxios.get).toHaveBeenCalledWith(
        expect.stringContaining('context=optimize')
      );
      expect(mockedAxios.get).toHaveBeenCalledWith(
        expect.stringContaining('current_meal_plan_id=demo_meal_plan_001')
      );
    });
    
    // Test Insights context
    fireEvent.press(getByText('Insights'));
    await waitFor(() => {
      expect(mockedAxios.get).toHaveBeenCalledWith(
        expect.stringContaining('context=insights')
      );
    });
  });

  it('displays confidence scores with correct formatting', async () => {
    const { getByText, queryByTestId } = render(<SmartDietScreen navigation={mockNavigation} />);
    
    await waitFor(() => {
      expect(queryByTestId('loading-indicator')).toBeNull();
    });
    
    // Check confidence score is displayed as percentage
    expect(getByText('85%')).toBeTruthy();
  });

  it('shows nutritional impact information', async () => {
    const { getByText, queryByTestId } = render(<SmartDietScreen navigation={mockNavigation} />);
    
    await waitFor(() => {
      expect(queryByTestId('loading-indicator')).toBeNull();
    });
    
    expect(getByText('Improves protein intake by 15g')).toBeTruthy();
  });

  it('handles context switching with proper loading states', async () => {
    const { getByText, getByTestId, queryByTestId } = render(<SmartDietScreen navigation={mockNavigation} />);
    
    // Wait for initial load
    await waitFor(() => {
      expect(queryByTestId('loading-indicator')).toBeNull();
    });
    
    // Mock delayed response for context switch
    let resolvePromise: (value: any) => void;
    const delayedPromise = new Promise(resolve => {
      resolvePromise = resolve;
    });
    mockedAxios.get.mockReturnValue(delayedPromise);
    
    // Switch context
    fireEvent.press(getByText('Optimize'));
    
    // Should show loading indicator
    expect(getByTestId('loading-indicator')).toBeTruthy();
    
    // Resolve the promise
    resolvePromise({
      data: {
        suggestions: [],
        nutritional_summary: {}
      }
    });
    
    // Loading should disappear
    await waitFor(() => {
      expect(queryByTestId('loading-indicator')).toBeNull();
    });
  });

  it('displays health benefits in insights', async () => {
    const { getByText } = render(<SmartDietScreen navigation={mockNavigation} />);
    
    // Switch to insights
    fireEvent.press(getByText('Insights'));
    
    await waitFor(() => {
      expect(getByText('Improved protein intake')).toBeTruthy();
      expect(getByText('Better micronutrient profile')).toBeTruthy();
    });
  });

  it('handles missing nutritional data gracefully', async () => {
    // Mock response with missing data
    mockedAxios.get.mockResolvedValue({
      data: {
        suggestions: [],
        nutritional_summary: null
      }
    });
    
    const { getByText } = render(<SmartDietScreen navigation={mockNavigation} />);
    
    fireEvent.press(getByText('Insights'));
    
    // Should not crash and should handle missing data
    await waitFor(() => {
      expect(getByText('Insights')).toBeTruthy();
    });
  });

  it('uses correct API endpoint format', async () => {
    render(<SmartDietScreen navigation={mockNavigation} />);
    
    await waitFor(() => {
      expect(mockedAxios.get).toHaveBeenCalledWith(
        expect.stringMatching(/\/smart-diet\/suggestions\?/)
      );
    });
  });
});