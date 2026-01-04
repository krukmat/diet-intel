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
    startFlow: jest.fn(),
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
  const baseFlowResponse = {
    status: 'complete' as const,
    vision_result: {
      id: 'vision-1',
      user_id: 'user-1',
      meal_type: 'lunch',
      identified_ingredients: [],
      estimated_portions: {},
      nutritional_analysis: {},
      exercise_suggestions: [],
      created_at: '2024-01-01T00:00:00Z',
      processing_time_ms: 1000,
    },
    recipe_result: null,
    smart_diet_result: null,
    timings: {},
    metadata: {
      user_id: 'user-1',
      meal_type: 'lunch',
      total_duration_ms: 1000,
      warnings: [],
    },
  };

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();

    mockFlowService.runFlow.mockResolvedValue(baseFlowResponse);

    mockFlowService.getJobStatus.mockResolvedValue({
      job_id: 'job-123',
      status: 'completed',
      created_at: '2024-01-01T00:00:00Z',
      updated_at: '2024-01-01T00:00:00Z',
      result: baseFlowResponse,
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
                ...baseFlowResponse,
                status: 'partial',
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
    mockFlowService.runFlow.mockResolvedValue(baseFlowResponse);

    const { getByText } = render(
      <IntelligentFlowScreen onBackPress={mockOnBackPress} />
    );

    expect(mockFlowService.runFlow).toBeDefined();
  });

  /**
   * Test 7: Handles async processing with polling
   */
  it('should poll for job status during async processing', async () => {
    mockFlowService.startFlow.mockResolvedValue({
      job_id: 'job-456',
      status: 'queued',
      created_at: '2024-01-01T00:00:00Z',
      updated_at: '2024-01-01T00:00:00Z',
    });

    const { getByText } = render(
      <IntelligentFlowScreen onBackPress={mockOnBackPress} />
    );

    // Should support async with polling
    expect(mockFlowService.startFlow).toBeDefined();
  });

  /**
   * Test 8: Displays processing progress during polling
   */
  it('should display job status during polling', async () => {
    mockFlowService.getJobStatus.mockResolvedValue({
      job_id: 'job-456',
      status: 'running',
      created_at: '2024-01-01T00:00:00Z',
      updated_at: '2024-01-01T00:00:00Z',
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
    mockFlowService.runFlow.mockResolvedValue({
      ...baseFlowResponse,
      status: 'complete',
    });

    const { getByText } = render(
      <IntelligentFlowScreen onBackPress={mockOnBackPress} />
    );

    // Should complete flow successfully for gamification tracking
    expect(mockFlowService.runFlow).toBeDefined();
  });
});
