import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { Alert } from 'react-native';
import AppHeader from '../AppHeader';
import { useTranslation } from 'react-i18next';

// Mock de dependencias
jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

jest.mock('../../contexts/AuthContext', () => ({
  useAuth: () => ({
    user: {
      full_name: 'Test User',
      is_developer: false,
    },
    logout: jest.fn(),
  }),
}));

describe('AppHeader', () => {
  const mockProps = {
    onLogout: jest.fn(),
    onLanguageToggle: jest.fn(),
    onDeveloperSettings: jest.fn(),
    onRemindersToggle: jest.fn(),
    developerConfig: null,
    featureToggles: {
      reminderNotifications: true,
    },
  };

  let alertSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    alertSpy = jest.spyOn(Alert, 'alert').mockReturnValue();
  });

  afterEach(() => {
    alertSpy.mockRestore();
  });

  describe('Rendering básico', () => {
    it('muestra el título de la aplicación', () => {
      const { getByText } = render(<AppHeader {...mockProps} />);
      expect(getByText('app.title')).toBeTruthy();
    });

    it('muestra el texto de bienvenida con el nombre del usuario', () => {
      const { getByText } = render(<AppHeader {...mockProps} />);
      expect(getByText('auth.welcome')).toBeTruthy();
    });

    it('muestra la versión de la aplicación', () => {
      const { getByText } = render(<AppHeader {...mockProps} />);
      expect(getByText('app.version')).toBeTruthy();
    });
  });

  describe('Botones de acción', () => {
    it('muestra el botón de cambio de idioma', () => {
      const { getByTestId } = render(<AppHeader {...mockProps} />);
      const languageButton = getByTestId('language-toggle');
      expect(languageButton).toBeTruthy();
    });

    it('llama onLanguageToggle cuando se presiona el botón de idioma', () => {
      const { getByTestId } = render(<AppHeader {...mockProps} />);
      const languageButton = getByTestId('language-toggle');

      fireEvent.press(languageButton);
      expect(mockProps.onLanguageToggle).toHaveBeenCalled();
    });

    it('muestra el botón de logout', () => {
      const { getByTestId } = render(<AppHeader {...mockProps} />);
      const logoutButton = getByTestId('logout-button');
      expect(logoutButton).toBeTruthy();
    });

    it('llama onLogout cuando se presiona el botón de logout', () => {
      const { getByTestId } = render(<AppHeader {...mockProps} />);
      const logoutButton = getByTestId('logout-button');

      fireEvent.press(logoutButton);
      expect(mockProps.onLogout).toHaveBeenCalled();
    });
  });

  describe('Estados condicionales', () => {
    it('muestra botón de developer settings cuando usuario es desarrollador', () => {
      const propsWithDeveloper = {
        ...mockProps,
        developerConfig: { isDeveloperModeEnabled: true },
      };

      const { getByTestId } = render(<AppHeader {...propsWithDeveloper} />);
      const devButton = getByTestId('developer-settings-button');
      expect(devButton).toBeTruthy();
    });

    it('oculta botón de developer settings cuando usuario no es desarrollador', () => {
      const { queryByTestId } = render(<AppHeader {...mockProps} />);
      const devButton = queryByTestId('developer-settings-button');
      expect(devButton).toBeNull();
    });

    it('muestra botón de notificaciones cuando reminderNotifications está habilitado', () => {
      const { getByTestId } = render(<AppHeader {...mockProps} />);
      const notificationsButton = getByTestId('notifications-button');
      expect(notificationsButton).toBeTruthy();
    });

    it('oculta botón de notificaciones cuando reminderNotifications está deshabilitado', () => {
      const propsWithoutNotifications = {
        ...mockProps,
        featureToggles: { reminderNotifications: false },
      };

      const { queryByTestId } = render(<AppHeader {...propsWithoutNotifications} />);
      const notificationsButton = queryByTestId('notifications-button');
      expect(notificationsButton).toBeNull();
    });
  });

  describe('Interacciones', () => {
    it('llama onDeveloperSettings cuando se presiona el botón de desarrollador', () => {
      const propsWithDeveloper = {
        ...mockProps,
        developerConfig: { isDeveloperModeEnabled: true },
      };

      const { getByTestId } = render(<AppHeader {...propsWithDeveloper} />);
      const devButton = getByTestId('developer-settings-button');

      fireEvent.press(devButton);
      expect(mockProps.onDeveloperSettings).toHaveBeenCalled();
    });

    it('llama onRemindersToggle cuando se presiona el botón de notificaciones', () => {
      const { getByTestId } = render(<AppHeader {...mockProps} />);
      const notificationsButton = getByTestId('notifications-button');

      fireEvent.press(notificationsButton);
      expect(mockProps.onRemindersToggle).toHaveBeenCalled();
    });
  });

  describe('Estilos y accesibilidad', () => {
    it('aplica estilos correctos al contenedor principal', () => {
      const { getByTestId } = render(<AppHeader {...mockProps} />);
      const container = getByTestId('header-container');

      expect(container.props.style).toBeDefined();
    });

    it('tiene elementos interactivos identificables', () => {
      const { getByTestId } = render(<AppHeader {...mockProps} />);

      // Verificar que hay elementos interactivos con testID
      expect(getByTestId('language-toggle')).toBeTruthy();
      expect(getByTestId('logout-button')).toBeTruthy();
      expect(getByTestId('notifications-button')).toBeTruthy();
    });
  });
});
