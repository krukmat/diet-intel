import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react-native';
import RewardsScreen from '../RewardsScreen';
import { GamificationProvider } from '../../contexts/GamificationContext';

// Mock useRewardsData hook
jest.mock('../../hooks/useRewardsData', () => ({
  useRewardsData: jest.fn(),
}));

// Import mock data
const mockAchievements = [
  {
    id: '1',
    title: 'Primera Comida',
    description: 'Registra tu primera comida',
    icon: '🍽️',
    points: 100,
    unlocked: true,
    progress: 1,
    target: 1,
    category: 'food'
  },
  {
    id: '2',
    title: 'Racha de 7 Días',
    description: 'Usa la app 7 días consecutivos',
    icon: '🔥',
    points: 200,
    unlocked: false,
    progress: 3,
    target: 7,
    category: 'streak'
  }
];

const mockRewardsData = {
  totalPoints: 1250,
  currentLevel: 3,
  levelProgress: 75,
  currentStreak: 5,
  longestStreak: 12,
  unlockedAchievements: [mockAchievements[0]],
  achievements: mockAchievements,
  achievementPoints: 300
};

const renderWithProviders = (ui: React.ReactElement) =>
  render(<GamificationProvider>{ui}</GamificationProvider>);

describe('RewardsScreen', () => {
  const mockUseRewardsData = require('../../hooks/useRewardsData').useRewardsData;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Loading State', () => {
    it('should render without crashing', () => {
      mockUseRewardsData.mockReturnValue({
        data: null,
        loading: true,
        error: null
      });

      renderWithProviders(<RewardsScreen />);
      expect(screen.getByText('Cargando recompensas...')).toBeTruthy();
    });

    it('should show loading state initially', () => {
      mockUseRewardsData.mockReturnValue({
        data: null,
        loading: true,
        error: null
      });

      renderWithProviders(<RewardsScreen />);
      expect(screen.getByText('Cargando recompensas...')).toBeTruthy();
    });

    it('should show loading state when data is loading', () => {
      mockUseRewardsData.mockReturnValue({
        data: null,
        loading: true,
        error: null
      });

      const { rerender } = renderWithProviders(<RewardsScreen />);
      expect(screen.getByText('Cargando recompensas...')).toBeTruthy();
    });
  });

  describe('Error State', () => {
    it('should show error state when there is an error', () => {
      mockUseRewardsData.mockReturnValue({
        data: null,
        loading: false,
        error: 'Error al cargar datos'
      });

      renderWithProviders(<RewardsScreen />);
      expect(screen.getByText('🏆 Recompensas')).toBeTruthy();
      expect(screen.getByText('Error: Error al cargar datos')).toBeTruthy();
    });

    it('should show error header when error occurs', () => {
      mockUseRewardsData.mockReturnValue({
        data: null,
        loading: false,
        error: 'Network error'
      });

      renderWithProviders(<RewardsScreen />);
      expect(screen.getByText('🏆 Recompensas')).toBeTruthy();
      expect(screen.getByText('Error: Network error')).toBeTruthy();
    });

    it('should handle null error gracefully', () => {
      mockUseRewardsData.mockReturnValue({
        data: null,
        loading: false,
        error: null
      });

      renderWithProviders(<RewardsScreen />);
      // Should show empty state or loading
      expect(screen.getByText('🏆 Recompensas')).toBeTruthy();
    });
  });

  describe('Success State', () => {
    beforeEach(() => {
      mockUseRewardsData.mockReturnValue({
        data: mockRewardsData,
        loading: false,
        error: null
      });
    });

    it('should render with data when loaded successfully', () => {
      renderWithProviders(<RewardsScreen />);
      
      expect(screen.getByText('🏆 Recompensas')).toBeTruthy();
      expect(screen.getByText('Estadísticas')).toBeTruthy();
      expect(screen.getByText('Puntos Totales: 1250')).toBeTruthy();
      expect(screen.getByText('Nivel: 3')).toBeTruthy();
      expect(screen.getByText('Progreso: 75%')).toBeTruthy();
      expect(screen.getByText('Racha Actual: 5 días')).toBeTruthy();
    });

    it('should display achievements section', () => {
      renderWithProviders(<RewardsScreen />);
      
      expect(screen.getByText('Logros (2)')).toBeTruthy();
      expect(screen.getByText('Primera Comida')).toBeTruthy();
      expect(screen.getByText('Racha de 7 Días')).toBeTruthy();
    });

    it('should show achievement status correctly', () => {
      renderWithProviders(<RewardsScreen />);
      
      // First achievement is unlocked
      expect(screen.getByText('✅ Desbloqueado')).toBeTruthy();
      // Second achievement shows progress
      expect(screen.getByText('3/7')).toBeTruthy();
    });

    it('should limit achievements to first 5', () => {
      const manyAchievements = {
        ...mockRewardsData,
        achievements: Array.from({ length: 10 }, (_, i) => ({
          ...mockAchievements[0],
          id: `achievement-${i}`,
          title: `Achievement ${i}`
        }))
      };

      mockUseRewardsData.mockReturnValue({
        data: manyAchievements,
        loading: false,
        error: null
      });

      renderWithProviders(<RewardsScreen />);
      
      // Should only show 5 achievements (slice(0, 5))
      expect(screen.queryByText('Achievement 5')).toBeNull();
      expect(screen.getByText('Achievement 4')).toBeTruthy();
    });
  });

  describe('Navigation', () => {
    it('should show back button when navigation is provided', () => {
      const mockGoBack = jest.fn();
      const mockNavigation = { goBack: mockGoBack };

      mockUseRewardsData.mockReturnValue({
        data: mockRewardsData,
        loading: false,
        error: null
      });

      renderWithProviders(<RewardsScreen navigation={mockNavigation} />);
      
      const backButton = screen.getByText('← Volver');
      expect(backButton).toBeTruthy();
    });

    it('should call goBack when back button is pressed', () => {
      const mockGoBack = jest.fn();
      const mockNavigation = { goBack: mockGoBack };

      mockUseRewardsData.mockReturnValue({
        data: mockRewardsData,
        loading: false,
        error: null
      });

      renderWithProviders(<RewardsScreen navigation={mockNavigation} />);
      
      const backButton = screen.getByText('← Volver');
      fireEvent.press(backButton);
      
      expect(mockGoBack).toHaveBeenCalledTimes(1);
    });

    it('should not show back button when navigation is not provided', () => {
      mockUseRewardsData.mockReturnValue({
        data: mockRewardsData,
        loading: false,
        error: null
      });

      renderWithProviders(<RewardsScreen />);
      
      expect(screen.queryByText('← Volver')).toBeNull();
    });
  });

  describe('Edge Cases', () => {
    it('should handle null data gracefully', () => {
      mockUseRewardsData.mockReturnValue({
        data: null,
        loading: false,
        error: null
      });

      renderWithProviders(<RewardsScreen />);
      
      expect(screen.getByText('🏆 Recompensas')).toBeTruthy();
      expect(screen.getByText('Estadísticas')).toBeTruthy();
    });

    it('should handle empty achievements array', () => {
      const emptyData = {
        ...mockRewardsData,
        achievements: [],
        unlockedAchievements: []
      };

      mockUseRewardsData.mockReturnValue({
        data: emptyData,
        loading: false,
        error: null
      });

      renderWithProviders(<RewardsScreen />);
      
      expect(screen.getByText('Logros (0)')).toBeTruthy();
      expect(screen.queryByText('Primera Comida')).toBeNull();
    });

    it('should handle zero values correctly', () => {
      const zeroData = {
        totalPoints: 0,
        currentLevel: 1,
        levelProgress: 0,
        currentStreak: 0,
        longestStreak: 0,
        unlockedAchievements: [],
        achievements: [],
        achievementPoints: 0
      };

      mockUseRewardsData.mockReturnValue({
        data: zeroData,
        loading: false,
        error: null
      });

      renderWithProviders(<RewardsScreen />);
      
      expect(screen.getByText('Puntos Totales: 0')).toBeTruthy();
      expect(screen.getByText('Nivel: 1')).toBeTruthy();
      expect(screen.getByText('Progreso: 0%')).toBeTruthy();
      expect(screen.getByText('Racha Actual: 0 días')).toBeTruthy();
    });
  });

  describe('Visual Structure', () => {
    beforeEach(() => {
      mockUseRewardsData.mockReturnValue({
        data: mockRewardsData,
        loading: false,
        error: null
      });
    });

    it('should have proper header structure', () => {
      renderWithProviders(<RewardsScreen />);
      
      const header = screen.getByText('🏆 Recompensas');
      expect(header).toBeTruthy();
    });

    it('should have stats section with correct title', () => {
      renderWithProviders(<RewardsScreen />);
      
      expect(screen.getByText('Estadísticas')).toBeTruthy();
    });

    it('should have achievements section with count', () => {
      renderWithProviders(<RewardsScreen />);
      
      expect(screen.getByText('Logros (2)')).toBeTruthy();
    });

    it('should render achievement items with proper structure', () => {
      renderWithProviders(<RewardsScreen />);
      
      expect(screen.getByText('🍽️')).toBeTruthy();
      expect(screen.getByText('Primera Comida')).toBeTruthy();
      expect(screen.getByText('Registra tu primera comida')).toBeTruthy();
    });
  });
});
