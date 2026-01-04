import React from 'react';
import { Alert } from 'react-native';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
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
    t: (_key: string, fallback: string) => fallback,
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
  });

  it('renders the form and handles back navigation', () => {
    const { getByText } = render(
      <IntelligentFlowScreen onBackPress={mockOnBackPress} />
    );

    expect(getByText('🤖 Intelligent Flow')).toBeTruthy();
    fireEvent.press(getByText('← Back'));
    expect(mockOnBackPress).toHaveBeenCalledTimes(1);
  });

  it('runs sync flow and shows result payload', async () => {
    mockFlowService.runFlow.mockResolvedValue(baseFlowResponse);

    const { getByText, findByText } = render(
      <IntelligentFlowScreen onBackPress={mockOnBackPress} />
    );

    fireEvent.press(getByText('Run Sync'));

    await waitFor(() => {
      expect(mockFlowService.runFlow).toHaveBeenCalledWith({
        image_base64: expect.any(String),
        meal_type: 'lunch',
      });
    });

    expect(await findByText('Latest Result')).toBeTruthy();
    expect(await findByText(/"status": "complete"/)).toBeTruthy();
  });

  it('starts async flow and polls for completion', async () => {
    jest.useFakeTimers();
    mockFlowService.startFlow.mockResolvedValue({
      job_id: 'job-456',
      status: 'queued',
      created_at: '2024-01-01T00:00:00Z',
      updated_at: '2024-01-01T00:00:00Z',
    });
    mockFlowService.getJobStatus
      .mockResolvedValueOnce({
        job_id: 'job-456',
        status: 'running',
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
      } as any)
      .mockResolvedValueOnce({
        job_id: 'job-456',
        status: 'completed',
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
        result: baseFlowResponse,
      } as any);

    const { getByText, findByText } = render(
      <IntelligentFlowScreen onBackPress={mockOnBackPress} />
    );

    fireEvent.press(getByText('Run Async'));

    await waitFor(() => {
      expect(mockFlowService.startFlow).toHaveBeenCalled();
    });

    await waitFor(() => {
      expect(getByText('Job Status: queued')).toBeTruthy();
    });

    await waitFor(() => {
      jest.advanceTimersByTime(2000);
    });

    await waitFor(() => {
      expect(mockFlowService.getJobStatus).toHaveBeenCalled();
    });

    await waitFor(() => {
      jest.advanceTimersByTime(2000);
    });

    expect(await findByText('Latest Result')).toBeTruthy();
    jest.useRealTimers();
  });

  it('shows error state when sync flow fails', async () => {
    const alertSpy = jest.spyOn(Alert, 'alert');
    mockFlowService.runFlow.mockRejectedValue(new Error('API Error'));

    const { getByText, findByText } = render(
      <IntelligentFlowScreen onBackPress={mockOnBackPress} />
    );

    fireEvent.press(getByText('Run Sync'));

    expect(await findByText('Error')).toBeTruthy();
    expect(alertSpy).toHaveBeenCalledWith(
      'Intelligent Flow',
      'Failed to run intelligent flow. Check logs for details.'
    );
    alertSpy.mockRestore();
  });
});
