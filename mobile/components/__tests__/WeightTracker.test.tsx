import React from 'react';
import { render, fireEvent, screen, waitFor } from '@testing-library/react-native';
import { Alert } from 'react-native';
import { WeightTracker } from '../WeightTracker';
import { useWeightTracking } from '../../hooks/useWeightTracking';

// Mock the hook
jest.mock('../../hooks/useWeightTracking');
const mockUseWeightTracking = useWeightTracking as jest.MockedFunction<typeof useWeightTracking>;

// Mock Alert
jest.spyOn(Alert, 'alert').mockImplementation(() => {});

describe('WeightTracker', () => {
  const mockWeightTracking = {
    recordingState: {
      status: 'idle' as const,
      lastWeight: undefined,
      lastRecordedAt: undefined,
      error: undefined,
    },
    recordWeight: jest.fn(),
    clearRecordingState: jest.fn(),
    validateWeightInput: jest.fn(),
    formatWeightDisplay: jest.fn(),
  };

  const mockOnWeightRecorded = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    mockUseWeightTracking.mockReturnValue(mockWeightTracking);
    // Ensure validateWeightInput returns complete objects
    mockWeightTracking.validateWeightInput.mockReturnValue({
      isValid: true,
      error: undefined
    });
  });

  it('renders with idle state', () => {
    render(<WeightTracker weightTracking={mockWeightTracking} />);

    // Check for title by finding it within the header container
    const titleElements = screen.getAllByText('Record Weight');
    expect(titleElements.length).toBeGreaterThan(0); // Title exists

    expect(screen.getByText('Enter your weight')).toBeTruthy();
    expect(screen.getByTestId('weight-input')).toBeTruthy();
    expect(screen.getByTestId('record-weight-button')).toBeTruthy();
  });

  it('shows formatted weight when input is entered', () => {
    mockWeightTracking.formatWeightDisplay.mockReturnValue('75.5 kg');

    render(<WeightTracker weightTracking={mockWeightTracking} />);

    const input = screen.getByPlaceholderText('Enter weight (kg)');
    fireEvent.changeText(input, '75.5');

    expect(mockWeightTracking.formatWeightDisplay).toHaveBeenCalledWith(75.5);
    expect(screen.getByText('75.5 kg')).toBeTruthy();
  });

  it('validates weight input and shows validation message', () => {
    mockWeightTracking.validateWeightInput.mockReturnValue({
      isValid: false,
      error: 'Weight must be between 0.1 and 500 kg',
    });

    render(<WeightTracker weightTracking={mockWeightTracking} />);

    const input = screen.getByPlaceholderText('Enter weight (kg)');
    fireEvent.changeText(input, '600');

    expect(mockWeightTracking.validateWeightInput).toHaveBeenCalledWith('600');
    expect(screen.getByText('Weight must be between 0.1 and 500 kg')).toBeTruthy();
  });

  it('shows valid weight message for valid input', () => {
    mockWeightTracking.validateWeightInput.mockReturnValue({
      isValid: true,
    });

    render(<WeightTracker weightTracking={mockWeightTracking} />);

    const input = screen.getByPlaceholderText('Enter weight (kg)');
    fireEvent.changeText(input, '75.5');

    expect(screen.getByText('Valid weight')).toBeTruthy();
  });

  it('records weight successfully', async () => {
    mockWeightTracking.validateWeightInput.mockReturnValue({ isValid: true });
    mockWeightTracking.recordWeight.mockResolvedValue(true);

    render(<WeightTracker weightTracking={mockWeightTracking} onWeightRecorded={mockOnWeightRecorded} />);

    const input = screen.getByTestId('weight-input');
    const button = screen.getByTestId('record-weight-button');

    fireEvent.changeText(input, '75.5');
    fireEvent.press(button);

    await waitFor(() => {
      expect(mockWeightTracking.recordWeight).toHaveBeenCalledWith(75.5);
    });

    expect(mockOnWeightRecorded).toHaveBeenCalledWith(75.5);
    expect(Alert.alert).toHaveBeenCalledWith('Success', 'Weight recorded successfully!');
  });

  it('shows error alert for invalid weight', () => {
    mockWeightTracking.validateWeightInput.mockReturnValue({
      isValid: false,
      error: 'Invalid weight',
    });

    render(<WeightTracker weightTracking={mockWeightTracking} />);

    const input = screen.getByTestId('weight-input');
    const button = screen.getByTestId('record-weight-button');

    fireEvent.changeText(input, 'invalid');
    fireEvent.press(button);

    expect(Alert.alert).toHaveBeenCalledWith('Invalid Weight', 'Invalid weight');
    expect(mockWeightTracking.recordWeight).not.toHaveBeenCalled();
  });

  it('shows error alert when recording fails', async () => {
    mockWeightTracking.validateWeightInput.mockReturnValue({ isValid: true });
    mockWeightTracking.recordWeight.mockResolvedValue(false);
    mockWeightTracking.recordingState.error = 'Network error';

    render(<WeightTracker weightTracking={mockWeightTracking} />);

    const input = screen.getByTestId('weight-input');
    const button = screen.getByTestId('record-weight-button');

    fireEvent.changeText(input, '75.5');
    fireEvent.press(button);

    await waitFor(() => {
      expect(Alert.alert).toHaveBeenCalledWith('Error', 'Network error');
    });
  });

  it('shows recording state with activity indicator', () => {
    const recordingState = {
      ...mockWeightTracking.recordingState,
      status: 'recording' as const,
    };

    mockUseWeightTracking.mockReturnValue({
      ...mockWeightTracking,
      recordingState,
    });

    render(<WeightTracker weightTracking={{ ...mockWeightTracking, recordingState }} />);

    expect(screen.getByText('Recording weight...')).toBeTruthy();
    // ActivityIndicator should be present but hard to test directly
  });

  it('shows recorded state with last weight', () => {
    const recordedState = {
      status: 'recorded' as const,
      lastWeight: 75.5,
      lastRecordedAt: new Date('2024-01-01'),
      error: undefined,
    };

    mockUseWeightTracking.mockReturnValue({
      ...mockWeightTracking,
      recordingState: recordedState,
    });

    render(<WeightTracker weightTracking={{ ...mockWeightTracking, recordingState: recordedState }} />);

    expect(screen.getByText('Weight recorded: 75.5 kg')).toBeTruthy();
    expect(screen.getByText('Last recorded:')).toBeTruthy();
    expect(screen.getByText('1/1/2024')).toBeTruthy();
  });

  it('shows failed state with error and clear button', () => {
    const failedState = {
      status: 'failed' as const,
      lastWeight: undefined,
      lastRecordedAt: undefined,
      error: 'Failed to save weight',
    };

    mockUseWeightTracking.mockReturnValue({
      ...mockWeightTracking,
      recordingState: failedState,
    });

    render(<WeightTracker weightTracking={{ ...mockWeightTracking, recordingState: failedState }} />);

    expect(screen.getByText('Failed to record weight')).toBeTruthy();
    expect(screen.getByText('Failed to save weight')).toBeTruthy();
    expect(screen.getByText('Clear Error')).toBeTruthy();
  });

  it('clears error state when clear button is pressed', () => {
    const failedState = {
      status: 'failed' as const,
      lastWeight: undefined,
      lastRecordedAt: undefined,
      error: 'Failed to save weight',
    };

    mockUseWeightTracking.mockReturnValue({
      ...mockWeightTracking,
      recordingState: failedState,
    });

    render(<WeightTracker weightTracking={{ ...mockWeightTracking, recordingState: failedState }} />);

    const clearButton = screen.getByTestId('clear-error-button');
    fireEvent.press(clearButton);

    expect(mockWeightTracking.clearRecordingState).toHaveBeenCalledTimes(1);
  });

  it('disables input when recording', () => {
    const recordingState = {
      ...mockWeightTracking.recordingState,
      status: 'recording' as const,
    };

    render(<WeightTracker weightTracking={{ ...mockWeightTracking, recordingState }} />);

    const input = screen.getByPlaceholderText('Enter weight (kg)');
    expect(input.props.editable).toBe(false);
  });

  it('disables record button when no input or recording', () => {
    render(<WeightTracker weightTracking={mockWeightTracking} />);

    const button = screen.getByTestId('record-weight-button');
    expect(button.props.disabled).toBe(true);

    const input = screen.getByTestId('weight-input');
    fireEvent.changeText(input, '75.5');

    // Button should be enabled now
    expect(button.props.disabled).toBe(false);
  });

  it('disables record button when recording', () => {
    const recordingState = {
      ...mockWeightTracking.recordingState,
      status: 'recording' as const,
    };

    render(<WeightTracker weightTracking={{ ...mockWeightTracking, recordingState }} />);

    const button = screen.getByTestId('record-weight-button');
    expect(button.props.disabled).toBe(true);
  });

  it('clears input after successful recording', async () => {
    mockWeightTracking.validateWeightInput.mockReturnValue({ isValid: true });
    mockWeightTracking.recordWeight.mockResolvedValue(true);

    render(<WeightTracker weightTracking={mockWeightTracking} />);

    const input = screen.getByTestId('weight-input');
    const button = screen.getByTestId('record-weight-button');

    fireEvent.changeText(input, '75.5');
    fireEvent.press(button);

    await waitFor(() => {
      expect(input.props.value).toBe('');
    });
  });

  it('limits input length to 6 characters', () => {
    render(<WeightTracker weightTracking={mockWeightTracking} />);

    const input = screen.getByPlaceholderText('Enter weight (kg)');
    expect(input.props.maxLength).toBe(6);
  });

  it('uses decimal-pad keyboard type', () => {
    render(<WeightTracker weightTracking={mockWeightTracking} />);

    const input = screen.getByPlaceholderText('Enter weight (kg)');
    expect(input.props.keyboardType).toBe('decimal-pad');
  });
});
