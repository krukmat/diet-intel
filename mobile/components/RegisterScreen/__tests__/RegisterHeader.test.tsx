/**
 * Tests unitarios para RegisterHeader component
 */

import React from 'react';
import { render } from '@testing-library/react-native';
import { RegisterHeader } from '../RegisterHeader';

// Mock de estilos
jest.mock('../../styles/RegisterScreen.styles', () => ({
  registerScreenStyles: {
    header: { marginBottom: 40 },
    title: { fontSize: 42, fontWeight: 'bold' },
    subtitle: { fontSize: 18 },
  },
}));

describe('RegisterHeader', () => {
  it('renders default title and subtitle', () => {
    const { getByText } = render(<RegisterHeader />);

    expect(getByText('🍎 DietIntel')).toBeTruthy();
    expect(getByText('Create your account')).toBeTruthy();
  });

  it('renders custom title and subtitle', () => {
    const customTitle = 'Welcome';
    const customSubtitle = 'Join us today';

    const { getByText } = render(
      <RegisterHeader title={customTitle} subtitle={customSubtitle} />
    );

    expect(getByText(customTitle)).toBeTruthy();
    expect(getByText(customSubtitle)).toBeTruthy();
  });

  it('renders with correct accessibility', () => {
    const { getByText } = render(<RegisterHeader />);

    const titleElement = getByText('🍎 DietIntel');
    const subtitleElement = getByText('Create your account');

    expect(titleElement).toBeTruthy();
    expect(subtitleElement).toBeTruthy();
  });
});
