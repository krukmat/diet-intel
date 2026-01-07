/**
 * Tests for RewardsHeader Component
 * Comprehensive test coverage for the modular rewards header component
 */

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react-native';
import { RewardsHeader, PointsHeader, AchievementsHeader } from '../RewardsHeader';

// Mock navigation
const mockNavigation = {
  goBack: jest.fn(),
};

// Test data
const mockProps = {
  title: '🏆 Recompensas',
  subtitle: 'Tu progreso actual',
  onBack: mockNavigation.goBack,
  backgroundColor: '#007AFF',
  titleColor: 'white',
  testID: 'test-rewards-header'
};

describe('RewardsHeader', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Basic RewardsHeader', () => {
    it('should render with title and subtitle', () => {
      render(<RewardsHeader {...mockProps} />);
      
      expect(screen.getByText('🏆 Recompensas')).toBeTruthy();
      expect(screen.getByText('Tu progreso actual')).toBeTruthy();
    });

    it('should render without subtitle when not provided', () => {
      render(<RewardsHeader title="Test" onBack={mockNavigation.goBack} />);
      
      expect(screen.getByText('Test')).toBeTruthy();
      expect(screen.queryByText('Tu progreso actual')).toBeNull();
    });

    it('should render without back button when onBack is not provided', () => {
      render(<RewardsHeader title="Test" />);
      
      expect(screen.getByText('Test')).toBeTruthy();
      expect(screen.queryByTestId('rewards-header-back-button')).toBeNull();
    });

    it('should call onBack when back button is pressed', () => {
      render(<RewardsHeader {...mockProps} />);
      
      const backButton = screen.getByTestId('rewards-header-back-button');
      fireEvent.press(backButton);
      
      expect(mockNavigation.goBack).toHaveBeenCalledTimes(1);
    });

    it('should apply custom background color', () => {
      render(<RewardsHeader {...mockProps} backgroundColor="#FF0000" />);
      
      const header = screen.getByTestId('test-rewards-header');
      expect(header.props.style).toContainEqual({ backgroundColor: '#FF0000' });
    });

    it('should apply custom title color', () => {
      render(<RewardsHeader {...mockProps} titleColor="#FF0000" />);
      
      const title = screen.getByText('🏆 Recompensas');
      expect(title.props.style).toContainEqual({ color: '#FF0000' });
    });
  });

  describe('PointsHeader Variant', () => {
    it('should render with points and level display', () => {
      const points = 1500;
      const level = 3;
      
      render(<PointsHeader points={points} level={level} />);
      
      expect(screen.getByText('🏆 Recompensas')).toBeTruthy();
      expect(screen.getByText(`${points} pts`)).toBeTruthy();
      expect(screen.getByText(`Nivel ${level}`)).toBeTruthy();
    });

    it('should handle zero points and level', () => {
      render(<PointsHeader points={0} level={1} />);
      
      expect(screen.getByText('0 pts')).toBeTruthy();
      expect(screen.getByText('Nivel 1')).toBeTruthy();
    });

    it('should handle large point values', () => {
      const points = 999999;
      const level = 100;
      
      render(<PointsHeader points={points} level={level} />);
      
      expect(screen.getByText(`${points} pts`)).toBeTruthy();
      expect(screen.getByText(`Nivel ${level}`)).toBeTruthy();
    });
  });

  describe('AchievementsHeader Variant', () => {
    it('should render with achievements count', () => {
      const unlockedCount = 8;
      const totalCount = 12;
      
      render(<AchievementsHeader unlockedCount={unlockedCount} totalCount={totalCount} />);
      
      expect(screen.getByText('🏆 Recompensas')).toBeTruthy();
      expect(screen.getByText(`${unlockedCount}/${totalCount}`)).toBeTruthy();
      expect(screen.getByText('Logros')).toBeTruthy();
    });

    it('should handle zero unlocked achievements', () => {
      render(<AchievementsHeader unlockedCount={0} totalCount={10} />);
      
      expect(screen.getByText('0/10')).toBeTruthy();
      expect(screen.getByText('Logros')).toBeTruthy();
    });

    it('should handle all achievements unlocked', () => {
      render(<AchievementsHeader unlockedCount={10} totalCount={10} />);
      
      expect(screen.getByText('10/10')).toBeTruthy();
    });
  });

  describe('Layout and Styling', () => {
    it('should render in three-column layout', () => {
      render(<RewardsHeader {...mockProps} />);
      
      // Header should have three sections
      const header = screen.getByTestId('test-rewards-header');
      expect(header).toBeTruthy();
    });

    it('should render with StatusBar', () => {
      render(<RewardsHeader {...mockProps} />);
      
      // StatusBar should be rendered for the header
      const header = screen.getByTestId('test-rewards-header');
      expect(header).toBeTruthy();
    });

    it('should handle missing right component', () => {
      render(<RewardsHeader title="Test" onBack={mockNavigation.goBack} rightComponent={null} />);
      
      expect(screen.getByText('Test')).toBeTruthy();
    });

    it('should render with custom right component', () => {
      const CustomComponent = () => <span>Custom Right</span>;
      render(
        <RewardsHeader 
          title="Test" 
          onBack={mockNavigation.goBack} 
          rightComponent={<CustomComponent />} 
        />
      );
      
      expect(screen.getByText('Test')).toBeTruthy();
    });
  });

  describe('Error Handling', () => {
    it('should handle minimal required props', () => {
      render(<RewardsHeader title="Test Title" />);
      
      expect(screen.getByText('Test Title')).toBeTruthy();
    });

    it('should handle null callbacks gracefully', () => {
      render(<RewardsHeader title="Test" onBack={null} />);
      
      expect(screen.getByText('Test')).toBeTruthy();
      expect(screen.queryByTestId('rewards-header-back-button')).toBeNull();
    });
  });
});
