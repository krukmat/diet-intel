import React from 'react';
import { Alert } from 'react-native';
import { act, fireEvent, render } from '@testing-library/react-native';
import RecipeHomeScreen from '../RecipeHomeScreen';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, fallback?: string | Record<string, unknown>) => {
      if (typeof fallback === 'string') {
        return fallback;
      }
      if (fallback && typeof fallback === 'object' && 'defaultValue' in fallback) {
        return (fallback as { defaultValue: string }).defaultValue;
      }
      return key;
    },
    i18n: { language: 'en' },
  }),
}));

jest.mock('../../components/RecipeLanguageToggle', () => {
  const React = require('react');
  const { Text } = require('react-native');

  return {
    RecipeLanguageToggle: ({ onLanguageChange }: { onLanguageChange: (lang: string) => void }) =>
      React.createElement(
        Text,
        { testID: 'recipe-language-toggle', onPress: () => onLanguageChange('es') },
        'toggle-language'
      ),
  };
});

describe('RecipeHomeScreen', () => {
  const onBackPress = jest.fn();
  const navigateToGeneration = jest.fn();
  const navigateToSearch = jest.fn();
  const navigateToMyRecipes = jest.fn();

  beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('loads and renders stats after the initial loading state', async () => {
    jest.spyOn(console, 'log').mockImplementation(() => {});
    const { getByText, queryByText } = render(
      <RecipeHomeScreen
        onBackPress={onBackPress}
        navigateToGeneration={navigateToGeneration}
        navigateToSearch={navigateToSearch}
        navigateToMyRecipes={navigateToMyRecipes}
      />
    );

    expect(getByText('Cargando estadísticas...')).toBeTruthy();

    await act(async () => {
      jest.advanceTimersByTime(500);
    });

    expect(queryByText('Cargando estadísticas...')).toBeNull();
    expect(getByText('12')).toBeTruthy();
    expect(getByText('5')).toBeTruthy();
    expect(getByText('3')).toBeTruthy();
  });

  it('navigates to the target context when provided', async () => {
    render(
      <RecipeHomeScreen
        onBackPress={onBackPress}
        navigateToGeneration={navigateToGeneration}
        navigateToSearch={navigateToSearch}
        navigateToMyRecipes={navigateToMyRecipes}
        navigationContext={{ targetContext: 'generate' }}
      />
    );

    await act(async () => {
      jest.advanceTimersByTime(100);
    });

    expect(navigateToGeneration).toHaveBeenCalledTimes(1);
  });

  it('fires quick actions and random recipe alert', async () => {
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    const { getByText } = render(
      <RecipeHomeScreen
        onBackPress={onBackPress}
        navigateToGeneration={navigateToGeneration}
        navigateToSearch={navigateToSearch}
        navigateToMyRecipes={navigateToMyRecipes}
      />
    );

    fireEvent.press(getByText('🔧 Generar recetas'));
    expect(navigateToGeneration).toHaveBeenCalledTimes(1);

    fireEvent.press(getByText('🔍 Buscar Recetas'));
    expect(navigateToSearch).toHaveBeenCalledTimes(1);

    fireEvent.press(getByText('📚 Mis Recetas'));
    expect(navigateToMyRecipes).toHaveBeenCalledTimes(1);

    fireEvent.press(getByText('🎲 Random Recipe'));
    expect(alertSpy).toHaveBeenCalledWith(
      '🎲 Random Recipe',
      'Random recipe generation will be available in the next update!'
    );
  });

  it('reloads stats when language toggle is used', async () => {
    const { getByTestId, getByText } = render(
      <RecipeHomeScreen
        onBackPress={onBackPress}
        navigateToGeneration={navigateToGeneration}
        navigateToSearch={navigateToSearch}
        navigateToMyRecipes={navigateToMyRecipes}
      />
    );

    await act(async () => {
      jest.advanceTimersByTime(500);
    });

    fireEvent.press(getByTestId('recipe-language-toggle'));

    await act(async () => {
      jest.advanceTimersByTime(100);
    });

    expect(getByText('Cargando estadísticas...')).toBeTruthy();

    await act(async () => {
      jest.advanceTimersByTime(500);
    });
  });
});
