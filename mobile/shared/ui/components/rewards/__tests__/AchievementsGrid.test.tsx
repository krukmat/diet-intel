/**
 * Tests for AchievementsGrid Component
 * Comprehensive test coverage for the modular achievements grid component
 */

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react-native';
import { AchievementsGrid } from '../AchievementsGrid';

// Mock data
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
  },
  {
    id: '3',
    title: 'Scanner Master',
    description: 'Escanea 10 productos',
    icon: '📷',
    points: 150,
    unlocked: true,
    progress: 10,
    target: 10,
    category: 'scanning'
  }
];

describe('AchievementsGrid', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Basic Rendering', () => {
    it('should render with achievements list', () => {
      render(<AchievementsGrid achievements={mockAchievements} />);
      
      expect(screen.getByText('🏆 Logros')).toBeTruthy();
      expect(screen.getByText('Desbloquea logros completando desafíos (3 total)')).toBeTruthy();
      expect(screen.getByText('Primera Comida')).toBeTruthy();
      expect(screen.getByText('Racha de 7 Días')).toBeTruthy();
      expect(screen.getByText('Scanner Master')).toBeTruthy();
    });

    it('should display achievement count correctly', () => {
      render(<AchievementsGrid achievements={mockAchievements} />);
      
      expect(screen.getByText(/\(3\s*total\)/)).toBeTruthy();
    });

    it('should apply custom background color', () => {
      render(<AchievementsGrid achievements={mockAchievements} backgroundColor="#FF0000" />);
      
      const gridContainer = screen.getByTestId('achievements-grid');
      expect(gridContainer.props.style).toContainEqual({ backgroundColor: '#FF0000' });
    });
  });

  describe('Achievement States', () => {
    it('should display unlocked achievements with proper styling', () => {
      render(<AchievementsGrid achievements={mockAchievements} />);
      
      const firstAchievement = screen.getByText('Primera Comida');
      expect(firstAchievement).toBeTruthy();
      
      // Unlocked achievements should show points
      expect(screen.getByText(/\+\s*100\s*pts/)).toBeTruthy();
    });

    it('should display locked achievements with progress', () => {
      render(<AchievementsGrid achievements={mockAchievements} />);
      
      const lockedAchievement = screen.getByText('Racha de 7 Días');
      expect(lockedAchievement).toBeTruthy();
      
      // Locked achievements should show progress
      expect(screen.getByText('3/7')).toBeTruthy();
    });

    it('should show different icons for locked vs unlocked', () => {
      render(<AchievementsGrid achievements={mockAchievements} />);
      
      expect(screen.getByText('🍽️')).toBeTruthy(); // Unlocked
      expect(screen.getByText('🔥')).toBeTruthy(); // Locked
      expect(screen.getByText('📷')).toBeTruthy(); // Unlocked
    });
  });

  describe('Interaction', () => {
    it('should call onAchievementPress when achievement is tapped', () => {
      const mockOnPress = jest.fn();
      render(<AchievementsGrid achievements={mockAchievements} onAchievementPress={mockOnPress} />);
      
      const firstAchievement = screen.getByTestId('achievement-1');
      fireEvent.press(firstAchievement);
      
      expect(mockOnPress).toHaveBeenCalledWith(mockAchievements[0]);
    });

    it('should allow interaction for unlocked achievements', () => {
      const mockOnPress = jest.fn();
      render(<AchievementsGrid achievements={mockAchievements} onAchievementPress={mockOnPress} />);
      
      const unlockedAchievement = screen.getByTestId('achievement-1');
      fireEvent.press(unlockedAchievement);
      
      expect(mockOnPress).toHaveBeenCalledWith(mockAchievements[0]);
    });
  });

  describe('Empty States', () => {
    it('should display empty state when no achievements', () => {
      render(<AchievementsGrid achievements={[]} />);
      
      expect(screen.getByText('No hay logros disponibles')).toBeTruthy();
      expect(screen.getByText('Continúa usando la app para desbloquear logros')).toBeTruthy();
      expect(screen.getByText('🔒')).toBeTruthy();
    });

    it('should show empty state for unlocked filter with no unlocked achievements', () => {
      const lockedOnly = mockAchievements.filter(a => !a.unlocked);
      render(<AchievementsGrid achievements={lockedOnly} initialFilter="unlocked" />);

      // Should show empty state when all achievements are filtered out
      expect(screen.getByText('No hay logros desbloqueados')).toBeTruthy();
    });

    it('should show empty state for locked filter with no locked achievements', () => {
      const unlockedOnly = mockAchievements.filter(a => a.unlocked);
      render(<AchievementsGrid achievements={unlockedOnly} initialFilter="locked" />);
      
      // Should show empty state when all achievements are filtered out
      expect(screen.getByText('No hay logros bloqueados')).toBeTruthy();
    });
  });

  describe('Grid Layout', () => {
    it('should render achievements in grid format', () => {
      render(<AchievementsGrid achievements={mockAchievements} />);
      
      // Should have FlatList with numColumns={2}
      const flatList = screen.getByTestId('achievements-flatlist');
      expect(flatList).toBeTruthy();
    });

    it('should use proper testIDs for achievements', () => {
      render(<AchievementsGrid achievements={mockAchievements} />);
      
      expect(screen.getByTestId('achievement-1')).toBeTruthy();
      expect(screen.getByTestId('achievement-2')).toBeTruthy();
      expect(screen.getByTestId('achievement-3')).toBeTruthy();
    });

    it('should have main grid container testID', () => {
      render(<AchievementsGrid achievements={mockAchievements} />);
      
      expect(screen.getByTestId('achievements-grid')).toBeTruthy();
      expect(screen.getByTestId('achievements-flatlist')).toBeTruthy();
    });
  });

  describe('Edge Cases', () => {
    it('should handle single achievement', () => {
      const singleAchievement = [mockAchievements[0]];
      render(<AchievementsGrid achievements={singleAchievement} />);
      
      expect(screen.getByText('Primera Comida')).toBeTruthy();
      expect(screen.getByText(/\(1\s*total\)/)).toBeTruthy();
    });

    it('should handle large achievement list', () => {
      const manyAchievements = Array.from({ length: 20 }, (_, i) => ({
        ...mockAchievements[i % 3],
        id: `achievement-${i}`,
        title: `Achievement ${i}`,
        description: `Description for achievement ${i}`
      }));
      
      render(<AchievementsGrid achievements={manyAchievements} />);
      
      expect(screen.getByText(/\(20\s*total\)/)).toBeTruthy();
    });

    it('should handle achievements with zero progress', () => {
      const zeroProgressAchievement = {
        ...mockAchievements[1],
        progress: 0,
        unlocked: false
      };
      
      render(<AchievementsGrid achievements={[zeroProgressAchievement]} />);
      
      expect(screen.getByText(/0\s*\/\s*7/)).toBeTruthy();
    });

    it('should handle achievements at 100% progress but not unlocked', () => {
      const fullProgressLocked = {
        ...mockAchievements[1],
        progress: 7,
        target: 7,
        unlocked: false // Still locked for some reason
      };
      
      render(<AchievementsGrid achievements={[fullProgressLocked]} />);
      
      // Should show progress as 7/7 even if not unlocked
      expect(screen.getByText(/7\s*\/\s*7/)).toBeTruthy();
    });
  });

  describe('Visual Styling', () => {
    it('should show different colors for unlocked vs locked achievements', () => {
      render(<AchievementsGrid achievements={mockAchievements} />);
      
      // Should render both unlocked and locked achievement cards
      expect(screen.getByText('Primera Comida')).toBeTruthy();
      expect(screen.getByText('Racha de 7 Días')).toBeTruthy();
    });

    it('should display points for unlocked achievements', () => {
      render(<AchievementsGrid achievements={mockAchievements} />);
      
      // First and third achievements are unlocked
      expect(screen.getByText(/\+\s*100\s*pts/)).toBeTruthy();
      expect(screen.getByText(/\+\s*150\s*pts/)).toBeTruthy();
    });

    it('should display progress for locked achievements', () => {
      render(<AchievementsGrid achievements={mockAchievements} />);
      
      // Second achievement is locked
      expect(screen.getByText(/3\s*\/\s*7/)).toBeTruthy();
    });
  });
});
