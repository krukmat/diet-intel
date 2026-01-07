/**
 * Tests for RewardsStats Component
 * Comprehensive test coverage for the modular rewards stats component
 */

import React from 'react';
import { render, screen, within } from '@testing-library/react-native';
import { RewardsStats } from '../RewardsStats';

// Mock data - simplified without external type imports
const mockRewardsData = {
  totalPoints: 1250,
  currentLevel: 3,
  levelProgress: 75,
  currentStreak: 5,
  longestStreak: 12,
  unlockedAchievements: [{ id: '1', title: 'Test', description: 'Test desc', icon: '🏆', points: 100, unlocked: true, progress: 1, target: 1, category: 'test' }],
  achievements: [{ id: '1', title: 'Test', description: 'Test desc', icon: '🏆', points: 100, unlocked: true, progress: 1, target: 1, category: 'test' }],
  achievementPoints: 300
};

describe('RewardsStats', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Basic RewardsStats', () => {
    it('should render with all stats data', () => {
      render(<RewardsStats data={mockRewardsData} />);
      
      expect(screen.getByText('Puntos Totales')).toBeTruthy();
      expect(screen.getByText('1250')).toBeTruthy();
      expect(screen.getByText('Nivel Actual')).toBeTruthy();
      expect(screen.getByText('3')).toBeTruthy();
    });

    it('should render streak information', () => {
      render(<RewardsStats data={mockRewardsData} />);
      
      expect(screen.getByText('Racha Actual')).toBeTruthy();
      const currentStreakCard = within(screen.getByTestId('rewards-stat-current-streak'));
      expect(currentStreakCard.getByText('5')).toBeTruthy();
      expect(currentStreakCard.getByText('días consecutivos')).toBeTruthy();
      expect(screen.getByText('Mejor Racha')).toBeTruthy();
      const longestStreakCard = within(screen.getByTestId('rewards-stat-longest-streak'));
      expect(longestStreakCard.getByText('12')).toBeTruthy();
      expect(longestStreakCard.getByText('récord personal')).toBeTruthy();
    });

    it('should render achievements summary', () => {
      render(<RewardsStats data={mockRewardsData} />);
      
      expect(screen.getByText('Logros Desbloqueados')).toBeTruthy();
      expect(screen.getByText('1/1')).toBeTruthy();
    });

    it('should display progress bar for next level', () => {
      render(<RewardsStats data={mockRewardsData} />);
      
      expect(screen.getByText('Progreso al Siguiente Nivel')).toBeTruthy();
      expect(screen.getByText('250/1000')).toBeTruthy();
    });

    it('should apply custom background color', () => {
      render(<RewardsStats data={mockRewardsData} backgroundColor="#FF0000" />);
      
      const statsContainer = screen.getByTestId('rewards-stats');
      expect(statsContainer.props.style).toContainEqual({ backgroundColor: '#FF0000' });
    });
  });

  describe('Edge Cases', () => {
    it('should handle zero points and level', () => {
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
      
      render(<RewardsStats data={zeroData} />);
      
      const totalPointsCard = within(screen.getByTestId('rewards-stat-total-points'));
      expect(totalPointsCard.getByText('0')).toBeTruthy();
      const levelCard = within(screen.getByTestId('rewards-stat-current-level'));
      expect(levelCard.getByText('1')).toBeTruthy();
      const levelProgress = within(screen.getByTestId('rewards-level-progress'));
      expect(levelProgress.getByText('0/1000')).toBeTruthy();
      expect(levelProgress.getByText('0% completado')).toBeTruthy();
    });

    it('should handle high values correctly', () => {
      const highData = {
        totalPoints: 999999,
        currentLevel: 999,
        levelProgress: 99,
        currentStreak: 365,
        longestStreak: 500,
        unlockedAchievements: mockRewardsData.unlockedAchievements,
        achievements: mockRewardsData.achievements,
        achievementPoints: 50000
      };
      
      render(<RewardsStats data={highData} />);
      
      expect(screen.getByText('999999')).toBeTruthy();
      expect(screen.getByText('999')).toBeTruthy();
      const highStreakCard = within(screen.getByTestId('rewards-stat-current-streak'));
      expect(highStreakCard.getByText('365')).toBeTruthy();
      expect(highStreakCard.getByText('días consecutivos')).toBeTruthy();
    });

    it('should handle empty achievements array', () => {
      const emptyData = {
        ...mockRewardsData,
        achievements: [],
        unlockedAchievements: [],
        achievementPoints: 0
      };
      
      render(<RewardsStats data={emptyData} />);
      
      expect(screen.getByText('0/0')).toBeTruthy();
      expect(screen.getByText('0 puntos ganados')).toBeTruthy();
    });
  });

  describe('Accessibility', () => {
    it('should have proper testIDs for all elements', () => {
      render(<RewardsStats data={mockRewardsData} />);
      
      expect(screen.getByTestId('rewards-stats')).toBeTruthy();
      expect(screen.getByTestId('rewards-stat-total-points')).toBeTruthy();
      expect(screen.getByTestId('rewards-stat-current-level')).toBeTruthy();
    });
  });
});
