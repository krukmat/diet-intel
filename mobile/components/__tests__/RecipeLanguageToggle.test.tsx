import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { Alert } from 'react-native';
import { RecipeLanguageToggle } from '../RecipeLanguageToggle';
import { changeLanguage } from '../../i18n/config';

const mockOn = jest.fn();
const mockOff = jest.fn();

jest.mock('../../i18n/config', () => ({
  getCurrentLanguage: jest.fn(() => 'en'),
  changeLanguage: jest.fn(),
}));

jest.mock('../../utils/recipeLanguageHelper', () => ({
  getCurrentRecipeLanguage: jest.fn(() => 'en'),
}));

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, fallback?: string) => fallback || key,
    i18n: {
      language: 'en',
      on: mockOn,
      off: mockOff,
    },
  }),
}));

describe('RecipeLanguageToggle', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('opens modal and changes language successfully', async () => {
    (changeLanguage as jest.Mock).mockResolvedValue(undefined);
    const alertSpy = jest.spyOn(Alert, 'alert');
    const onLanguageChange = jest.fn();

    const { getByText, getAllByText, queryByText } = render(
      <RecipeLanguageToggle showLabel={true} onLanguageChange={onLanguageChange} />
    );

    fireEvent.press(getAllByText('🇺🇸')[0]);
    expect(queryByText('🌐 Select Recipe Language')).toBeTruthy();

    fireEvent.press(getByText('Español'));

    await waitFor(() => {
      expect(changeLanguage).toHaveBeenCalledWith('es');
      expect(onLanguageChange).toHaveBeenCalledWith('es');
      expect(alertSpy).toHaveBeenCalled();
    });

    alertSpy.mockRestore();
  });

  it('shows error alert when language change fails', async () => {
    (changeLanguage as jest.Mock).mockRejectedValue(new Error('fail'));
    const alertSpy = jest.spyOn(Alert, 'alert');

    const { getByText, getAllByText } = render(<RecipeLanguageToggle />);

    fireEvent.press(getAllByText('🇺🇸')[0]);
    fireEvent.press(getByText('English'));

    await waitFor(() => {
      expect(alertSpy).toHaveBeenCalledWith(
        'Error',
        'Failed to change language. Please try again.'
      );
    });

    alertSpy.mockRestore();
  });
});
