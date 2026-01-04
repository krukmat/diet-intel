import React from 'react';
import { render } from '@testing-library/react-native';
import HomeModals from '../HomeModals';

jest.mock('../ReminderSnippet', () => {
  const React = require('react');
  const { View } = require('react-native');
  return {
    __esModule: true,
    default: ({ visible }: { visible: boolean }) => (
      <View testID={visible ? 'reminder-visible' : 'reminder-hidden'} />
    ),
  };
});

jest.mock('../DeveloperSettingsModal', () => {
  const React = require('react');
  const { View } = require('react-native');
  return {
    __esModule: true,
    default: ({ visible }: { visible: boolean }) => (
      <View testID={visible ? 'developer-visible' : 'developer-hidden'} />
    ),
  };
});

jest.mock('../ApiConfigModal', () => {
  const React = require('react');
  const { View } = require('react-native');
  return {
    __esModule: true,
    default: ({ visible }: { visible: boolean }) => (
      <View testID={visible ? 'api-visible' : 'api-hidden'} />
    ),
  };
});

jest.mock('../LanguageSwitcher', () => {
  const React = require('react');
  const { View } = require('react-native');
  return {
    __esModule: true,
    default: ({ visible }: { visible: boolean }) => (
      <View testID={visible ? 'language-visible' : 'language-hidden'} />
    ),
  };
});

describe('HomeModals', () => {
  it('renders all modals with correct visibility', () => {
    const { getByTestId } = render(
      <HomeModals
        showReminderSnippet
        showReminders
        onCloseReminders={jest.fn()}
        showDeveloperSettings
        onCloseDeveloperSettings={jest.fn()}
        onOpenApiConfig={jest.fn()}
        showApiConfig
        onCloseApiConfig={jest.fn()}
        showLanguageSwitcher
        onCloseLanguageSwitcher={jest.fn()}
      />
    );

    expect(getByTestId('reminder-visible')).toBeTruthy();
    expect(getByTestId('developer-visible')).toBeTruthy();
    expect(getByTestId('api-visible')).toBeTruthy();
    expect(getByTestId('language-visible')).toBeTruthy();
  });

  it('hides modals when flags are false', () => {
    const { getByTestId } = render(
      <HomeModals
        showReminderSnippet={false}
        showReminders={false}
        onCloseReminders={jest.fn()}
        showDeveloperSettings={false}
        onCloseDeveloperSettings={jest.fn()}
        onOpenApiConfig={jest.fn()}
        showApiConfig={false}
        onCloseApiConfig={jest.fn()}
        showLanguageSwitcher={false}
        onCloseLanguageSwitcher={jest.fn()}
      />
    );

    expect(getByTestId('developer-hidden')).toBeTruthy();
    expect(getByTestId('api-hidden')).toBeTruthy();
    expect(getByTestId('language-hidden')).toBeTruthy();
  });
});
