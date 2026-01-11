import React from 'react';
import { render } from '@testing-library/react-native';
import PlanScreenContainer from '../PlanScreenContainer';
import PlanScreen from '../PlanScreen';

jest.mock('../PlanScreen', () => ({
  __esModule: true,
  default: jest.fn(() => null),
}));

const mockedPlanScreen = PlanScreen as jest.MockedFunction<typeof PlanScreen>;

describe('PlanScreenContainer', () => {
  beforeEach(() => {
    mockedPlanScreen.mockClear();
  });

  it('renders the presentational screen with the provided props', () => {
    const onBackPress = jest.fn();
    const navigateToSmartDiet = jest.fn();

    render(
      <PlanScreenContainer
        onBackPress={onBackPress}
        navigateToSmartDiet={navigateToSmartDiet}
      />
    );

    expect(mockedPlanScreen).toHaveBeenCalledTimes(1);
    expect(mockedPlanScreen).toHaveBeenCalledWith(
      {
        onBackPress,
        navigateToSmartDiet,
      },
      {}
    );
  });
});
