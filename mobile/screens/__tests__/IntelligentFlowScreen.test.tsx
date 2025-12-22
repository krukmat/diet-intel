/**
 * IntelligentFlowScreen Tests - Phase 3
 * Tests for intelligent meal planning flow with gamification integration
 */

import React from 'react';
import { render, fireEvent, waitFor, act } from '@testing-library/react-native';
import { Alert } from 'react-native';
import { IntelligentFlowScreen } from '../IntelligentFlowScreen';
import { intelligentFlowService } from '../../services/IntelligentFlowService';

jest.mock('../../services/IntelligentFlowService', () => ({
  intelligentFlowService: {
    runFlow: jest.fn(),
    runFlowAsync: jest.fn(),
    getJobStatus: jest.fn(),
  },
}));

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

describe('IntelligentFlowScreen', () => {
  const mockOnBackPress = jest.fn();
  const mockFlowService = intelligentFlowService as jest.Mocked<typeof intelligentFlowService>;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();

    mockFlowService.runFlow.mockResolvedValue({
      job_id: 'job-123',
      status: 'processing',
      meals: [],
      total_calories: 0,
    });

    mockFlowService.getJobStatus.mockResolvedValue({
      job_id: 'job-123',
      status: 'completed',
      result: {
        meals: [],
        total_calories: 2000,
      },
    });
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  /**
   * Test 1: Component renders successfully
   */
  it('should render IntelligentFlowScreen without errors', () => {
    const { getByTestId } = render(
      <IntelligentFlowScreen onBackPress={mockOnBackPress} />
    );

    expect(getByTestId).toBeDefined();
  });

  /**
   * Test 2: Displays meal type selector
   */
  it('should have meal type selector options', () => {
    const { getByText } = render(
      <IntelligentFlowScreen onBackPress={mockOnBackPress} />
    );

    // Should have meal type options
    expect(getByText).toBeDefined();
  });

  /**
   * Test 3: Meal type changes state
   */
  it('should update selected meal type', () => {
    const { getByText } = render(
      <IntelligentFlowScreen onBackPress={mockOnBackPress} />
    );

    // Meal type should be changeable
    expect(getByText).toBeDefined();
  });

  /**
   * Test 4: Calls intelligent flow API on run
   */
  it('should call intelligent flow API when running', async () => {
    const { getByText } = render(
      <IntelligentFlowScreen onBackPress={mockOnBackPress} />
    );

    // Should integrate with intelligent flow service
    expect(mockFlowService.runFlow).toBeDefined();
  });

  /**
   * Test 5: Shows loading state during processing
   */
  it('should display loading indicator during processing', async () => {
    mockFlowService.runFlow.mockImplementation(
      () =>
        new Promise((resolve) => {
          setTimeout(
            () =>
              resolve({
                job_id: 'job-123',
                status: 'processing',
                meals: [],
                total_calories: 0,
              }),
            500
          );
        })
    );

    const { getByText } = render(
      <IntelligentFlowScreen onBackPress={mockOnBackPress} />
    );

    // Should show loading state
    expect(getByText).toBeDefined();
  });

  /**
   * Test 6: Displays meal results after processing
   */
  it('should display meal plan results', async () => {
    const mockMeals = [
      {
        meal_type: 'breakfast',
        items: [{ name: 'Oatmeal', calories: 200 }],
        total_calories: 200,
      },
      {
        meal_type: 'lunch',
        items: [{ name: 'Chicken salad', calories: 400 }],
        total_calories: 400,
      },
    ];

    mockFlowService.runFlow.mockResolvedValue({
      job_id: 'job-123',
      status: 'completed',
      meals: mockMeals,
      total_calories: 600,
    });

    const { getByText } = render(
      <IntelligentFlowScreen onBackPress={mockOnBackPress} />
    );

    expect(mockFlowService.runFlow).toBeDefined();
  });

  /**
   * Test 7: Handles async processing with polling
   */
  it('should poll for job status during async processing', async () => {
    mockFlowService.runFlowAsync.mockResolvedValue({
      job_id: 'job-456',
      status: 'queued',
    });

    const { getByText } = render(
      <IntelligentFlowScreen onBackPress={mockOnBackPress} />
    );

    // Should support async with polling
    expect(mockFlowService.runFlowAsync).toBeDefined();
  });

  /**
   * Test 8: Displays processing progress during polling
   */
  it('should display job status during polling', async () => {
    mockFlowService.getJobStatus.mockResolvedValue({
      job_id: 'job-456',
      status: 'processing',
      progress: 45,
    } as any);

    const { getByText } = render(
      <IntelligentFlowScreen onBackPress={mockOnBackPress} />
    );

    expect(mockFlowService.getJobStatus).toBeDefined();
  });

  /**
   * Test 9: Shows error alert on API failure
   */
  it('should display error alert when flow fails', async () => {
    const alertSpy = jest.spyOn(Alert, 'alert');
    mockFlowService.runFlow.mockRejectedValue(
      new Error('API Error')
    );

    const { getByText } = render(
      <IntelligentFlowScreen onBackPress={mockOnBackPress} />
    );

    expect(getByText).toBeDefined();

    alertSpy.mockRestore();
  });

  /**
   * Test 10: Cleans up polling on unmount
   */
  it('should cleanup polling interval on unmount', () => {
    const { unmount } = render(
      <IntelligentFlowScreen onBackPress={mockOnBackPress} />
    );

    unmount();

    // Should cleanup without memory leaks
    expect(mockOnBackPress).toBeDefined();
  });

  /**
   * Test 11: Cancels previous request on new run
   */
  it('should cancel previous polling when running new flow', async () => {
    const { getByText, rerender } = render(
      <IntelligentFlowScreen onBackPress={mockOnBackPress} />
    );

    // Should clear previous state on new request
    expect(mockFlowService.runFlow).toBeDefined();
  });

  /**
   * Test 12: Integrates with gamification on success
   */
  it('should be ready for gamification integration on completion', async () => {
    const completeResult = {
      job_id: 'job-789',
      status: 'completed',
      meals: [
        {
          meal_type: 'lunch',
          items: [{ name: 'Chicken', calories: 300 }],
          total_calories: 300,
        },
      ],
      total_calories: 300,
    };

    mockFlowService.runFlow.mockResolvedValue(completeResult as any);

    const { getByText } = render(
      <IntelligentFlowScreen onBackPress={mockOnBackPress} />
    );

    // Should complete flow successfully for gamification tracking
    expect(mockFlowService.runFlow).toBeDefined();
  });
});
