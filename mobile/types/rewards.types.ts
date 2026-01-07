export interface Achievement {
  id: string;
  title: string;
  description: string;
  unlocked: boolean;
  progress: number;
  target: number;
  points: number;
  icon: string;
}

export interface RewardsScreenData {
  totalPoints: number;
  currentLevel: number;
  levelProgress: number;
  pointsToNextLevel: number;
  currentStreak: number;
  longestStreak: number;
  achievements: Achievement[];
  unlockedAchievements: Achievement[];
  achievementPoints: number;
}

export interface RewardsScreenProps {
  navigation?: {
    goBack: () => void;
  };
}
