/**
 * Tests de navegación para RewardsScreen
 * Verifica la integración de navegación completa hacia la pantalla de recompensas
 */

import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import RewardsScreen from '../screens/RewardsScreen';
import { AuthProvider } from '../contexts/AuthContext';
import { ProfileProvider } from '../contexts/ProfileContext';
import { GamificationProvider } from '../contexts/GamificationContext';

jest.mock('../hooks/useRewardsData', () => ({
  useRewardsData: jest.fn(() => ({
    data: null,
    loading: false,
    error: null,
  })),
}));

const mockUseRewardsData = require('../hooks/useRewardsData').useRewardsData as jest.Mock;

// Mock de navegación simple
const mockNavigation = {
  goBack: jest.fn(),
};

// Datos de prueba para GamificationContext
const mockGamificationData = {
  totalPoints: 150,
  currentLevel: 2,
  levelProgress: 30,
  pointsToNextLevel: 850,
  currentStreak: 5,
  longestStreak: 12,
  achievements: [],
  unlockedAchievements: [],
  achievementPoints: 200,
  isLoading: false,
  error: null,
};

describe('RewardsScreen Navigation Integration', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseRewardsData.mockReturnValue({
      data: null,
      loading: false,
      error: null,
    });
  });

  it('debe renderizar correctamente el RewardsScreen con contexto', () => {
    const { getByText } = render(
      <AuthProvider>
        <ProfileProvider>
          <GamificationProvider>
            <RewardsScreen navigation={mockNavigation} />
          </GamificationProvider>
        </ProfileProvider>
      </AuthProvider>
    );

    expect(getByText('🏆 Recompensas')).toBeTruthy();
  });

  it('debe mostrar estadísticas de gamificación desde el contexto', () => {
    const { getByText } = render(
      <AuthProvider>
        <ProfileProvider>
          <GamificationProvider>
            <RewardsScreen navigation={mockNavigation} />
          </GamificationProvider>
        </ProfileProvider>
      </AuthProvider>
    );

    expect(getByText('Estadísticas')).toBeTruthy();
    expect(getByText('Puntos Totales: 0')).toBeTruthy();
    expect(getByText('Nivel: 1')).toBeTruthy();
  });

  it('debe mostrar sección de logros', () => {
    const { getByText } = render(
      <AuthProvider>
        <ProfileProvider>
          <GamificationProvider>
            <RewardsScreen navigation={mockNavigation} />
          </GamificationProvider>
        </ProfileProvider>
      </AuthProvider>
    );

    expect(getByText('Logros')).toBeTruthy();
    expect(getByText('Logros (0)')).toBeTruthy();
  });

  it('debe incluir botón de volver funcional', () => {
    const { getByText } = render(
      <AuthProvider>
        <ProfileProvider>
          <GamificationProvider>
            <RewardsScreen navigation={mockNavigation} />
          </GamificationProvider>
        </ProfileProvider>
      </AuthProvider>
    );

    const backButton = getByText('← Volver');
    expect(backButton).toBeTruthy();
    
    fireEvent.press(backButton);
    expect(mockNavigation.goBack).toHaveBeenCalledTimes(1);
  });

  it('debe manejar estado de carga', () => {
    mockUseRewardsData.mockReturnValue({
      data: null,
      loading: true,
      error: null,
    });
    const { getByText } = render(
      <AuthProvider>
        <ProfileProvider>
          <GamificationProvider>
        <RewardsScreen navigation={mockNavigation} />
          </GamificationProvider>
        </ProfileProvider>
      </AuthProvider>
    );

    expect(getByText('Cargando recompensas...')).toBeTruthy();
  });

  it('debe mostrar mensaje cuando no hay logros disponibles', () => {
    const { getByText } = render(
      <AuthProvider>
        <ProfileProvider>
          <GamificationProvider>
            <RewardsScreen navigation={mockNavigation} />
          </GamificationProvider>
        </ProfileProvider>
      </AuthProvider>
    );

    expect(getByText('No hay logros disponibles')).toBeTruthy();
  });

  it('debe mostrar estadísticas completas desde el contexto', () => {
    const { getByText } = render(
      <AuthProvider>
        <ProfileProvider>
          <GamificationProvider>
            <RewardsScreen navigation={mockNavigation} />
          </GamificationProvider>
        </ProfileProvider>
      </AuthProvider>
    );

    // Verifica que todas las estadísticas se muestren
    expect(getByText('Puntos Totales: 0')).toBeTruthy();
    expect(getByText('Nivel: 1')).toBeTruthy();
    expect(getByText('Progreso: 0%')).toBeTruthy();
    expect(getByText('Puntos al Siguiente Nivel: 1000')).toBeTruthy();
    expect(getByText('Racha Actual: 0 días')).toBeTruthy();
    expect(getByText('Racha Más Larga: 0 días')).toBeTruthy();
    expect(getByText('Puntos de Logros: 0')).toBeTruthy();
  });
});
