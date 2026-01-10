import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import HomeDashboard from '../HomeDashboard';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, fallback?: string) => fallback || key,
  }),
}));

jest.mock('../LanguageSwitcher', () => {
  const React = require('react');
  const { Text, TouchableOpacity } = require('react-native');
  return {
    LanguageToggle: ({ onPress }: { onPress: () => void }) => (
      <TouchableOpacity onPress={onPress} testID="language-toggle">
        <Text>Lang</Text>
      </TouchableOpacity>
    ),
  };
});

jest.mock('../../shared/ui/components', () => {
  const React = require('react');
  const { Text, TouchableOpacity, View } = require('react-native');
  return {
    HomeToolActions: ({ actions }: { actions: Array<{ id: string; onPress: () => void }> }) => (
      <View>
        {actions.map(action => (
          <TouchableOpacity
            key={action.id}
            onPress={action.onPress}
            testID={`tool-${action.id}`}
          >
            <Text>{action.id}</Text>
          </TouchableOpacity>
        ))}
      </View>
    ),
    HomePrimaryActions: ({ actions }: { actions: Array<{ id: string; onPress: () => void }> }) => (
      <View>
        {actions.map(action => (
          <TouchableOpacity
            key={action.id}
            onPress={action.onPress}
            testID={`primary-${action.id}`}
          >
            <Text>{action.id}</Text>
          </TouchableOpacity>
        ))}
      </View>
    ),
  };
});

describe('HomeDashboard', () => {
  const baseProps = {
    title: 'DietIntel',
    subtitle: 'Welcome',
    version: 'v1',
    toolActions: [{ id: 'tool', label: 'Tool', onPress: jest.fn() }],
    primaryActions: [{ id: 'primary', label: 'Primary', onPress: jest.fn() }],
    secondaryActions: [{ id: 'secondary', label: 'Secondary', onPress: jest.fn() }],
    showDeveloperSettings: true,
    showNotifications: true,
    onLogout: jest.fn(),
    onShowDeveloperSettings: jest.fn(),
    onShowNotifications: jest.fn(),
    onShowLanguageSwitcher: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders header content', () => {
    const { getByText } = render(<HomeDashboard {...baseProps} />);

    expect(getByText('DietIntel')).toBeTruthy();
    expect(getByText('Welcome')).toBeTruthy();
    expect(getByText('v1')).toBeTruthy();
  });

  it('triggers header actions', () => {
    const { getByTestId, getByText } = render(<HomeDashboard {...baseProps} />);

    fireEvent.press(getByTestId('tool-tool'));
    fireEvent.press(getByTestId('primary-primary'));
    fireEvent.press(getByTestId('language-toggle'));
    fireEvent.press(getByText('🚪'));
    fireEvent.press(getByText('⚙️'));
    fireEvent.press(getByText('🔔'));

    expect(baseProps.toolActions[0].onPress).toHaveBeenCalled();
    expect(baseProps.primaryActions[0].onPress).toHaveBeenCalled();
    expect(baseProps.onShowLanguageSwitcher).toHaveBeenCalled();
    expect(baseProps.onLogout).toHaveBeenCalled();
    expect(baseProps.onShowDeveloperSettings).toHaveBeenCalled();
    expect(baseProps.onShowNotifications).toHaveBeenCalled();
  });

  it('hides optional header buttons when disabled', () => {
    const { queryByText } = render(
      <HomeDashboard
        {...baseProps}
        showDeveloperSettings={false}
        showNotifications={false}
      />
    );

    expect(queryByText('⚙️')).toBeNull();
    expect(queryByText('🔔')).toBeNull();
  });
});
