import React from 'react';
import { render } from '@testing-library/react-native';
import { WeightScreen } from '../WeightScreen';

const mockUseWeight = jest.fn();

jest.mock('../../hooks/useWeight', () => ({
  useWeight: () => mockUseWeight(),
}));

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, fallback?: string) => fallback || key,
  }),
}));

describe('WeightScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders stats with translated labels and formatted delta', () => {
    mockUseWeight.mockReturnValue({
      entries: [],
      stats: {
        currentWeight: 72.4,
        startingWeight: 75.0,
        targetWeight: 78.0,
        totalLost: 2.6,
      },
      loading: false,
      error: null,
      createWeight: jest.fn(),
      getHistory: jest.fn(),
      refresh: jest.fn(),
    });

    const { getByText } = render(<WeightScreen />);

    expect(getByText('weight.stats.current')).toBeTruthy();
    expect(getByText('weight.stats.start')).toBeTruthy();
    expect(getByText('weight.stats.delta')).toBeTruthy();
    expect(getByText('-2.6 kg')).toBeTruthy();
  });

  it('renders positive delta when weight increased', () => {
    mockUseWeight.mockReturnValue({
      entries: [],
      stats: {
        currentWeight: 80.0,
        startingWeight: 75.0,
        targetWeight: 85.0,
        totalLost: -5.0,
      },
      loading: false,
      error: null,
      createWeight: jest.fn(),
      getHistory: jest.fn(),
      refresh: jest.fn(),
    });

    const { getByText } = render(<WeightScreen />);

    expect(getByText('+5.0 kg')).toBeTruthy();
  });

  it('renders input placeholders and sections', () => {
    mockUseWeight.mockReturnValue({
      entries: [],
      stats: null,
      loading: false,
      error: null,
      createWeight: jest.fn(),
      getHistory: jest.fn(),
      refresh: jest.fn(),
    });

    const { getByText, getByPlaceholderText } = render(<WeightScreen />);

    expect(getByText('weight.sections.add')).toBeTruthy();
    expect(getByText('weight.sections.history')).toBeTruthy();
    expect(getByPlaceholderText('weight.input.placeholder')).toBeTruthy();
  });
});
