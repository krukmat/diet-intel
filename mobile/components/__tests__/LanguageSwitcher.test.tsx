import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import LanguageSwitcher, { LanguageToggle } from '../LanguageSwitcher';
import { changeLanguage, getCurrentLanguage } from '../../i18n/config';

jest.mock('../../i18n/config', () => ({
  changeLanguage: jest.fn(),
  getCurrentLanguage: jest.fn(),
  getSupportedLanguages: jest.fn(() => ['en', 'es']),
}));

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, fallback?: string) => fallback || key,
  }),
}));

describe('LanguageSwitcher', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('changes language and closes modal', async () => {
    (getCurrentLanguage as jest.Mock).mockReturnValue('en');
    const onClose = jest.fn();

    const { getByText } = render(
      <LanguageSwitcher visible={true} onClose={onClose} />
    );

    fireEvent.press(getByText('Español'));

    await waitFor(() => {
      expect(changeLanguage).toHaveBeenCalledWith('es');
      expect(onClose).toHaveBeenCalled();
    });
  });

  it('closes without change when selecting current language', () => {
    (getCurrentLanguage as jest.Mock).mockReturnValue('en');
    const onClose = jest.fn();

    const { getByText } = render(
      <LanguageSwitcher visible={true} onClose={onClose} />
    );

    fireEvent.press(getByText('English'));

    expect(changeLanguage).not.toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();
  });
});

describe('LanguageToggle', () => {
  it('renders flag based on current language', () => {
    (getCurrentLanguage as jest.Mock).mockReturnValue('es');
    const { getByText } = render(<LanguageToggle onPress={jest.fn()} />);

    expect(getByText('🇪🇸')).toBeTruthy();
  });

  it('triggers onPress', () => {
    (getCurrentLanguage as jest.Mock).mockReturnValue('en');
    const onPress = jest.fn();
    const { getByText } = render(<LanguageToggle onPress={onPress} />);

    fireEvent.press(getByText('🇺🇸'));
    expect(onPress).toHaveBeenCalled();
  });
});
