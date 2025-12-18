/**
 * Gamification Utilities - Phase 5.1
 * Helper functions for achievement calculations, point calculations, and gamification logic
 *
 * Functions:
 * - calculateStreakBonus: Calculate multiplier based on daily streak
 * - calculatePointsPerMeal: Variable points based on macro balance
 * - getLevelFromPoints: Get user level from total points
 * - getNextMilestonePoints: Calculate points needed for next level
 * - shouldUnlockAchievement: Check if achievement conditions are met
 * - getBadgeProgress: Get progress percentage for badge
 * - formatPointsDisplay: Format points with suffixes (K, M)
 * - getAchievementRequirements: Get specific requirements for achievement type
 */

export interface StreakData {
  currentDay: number;
  longestStreak: number;
  lastLogDate: string;
}

export interface MealData {
  calories: number;
  protein: number;
  fat: number;
  carbs: number;
}

export interface AchievementRequirements {
  type: string;
  target: number;
  currentProgress: number;
}

/**
 * Calculate streak bonus multiplier
 * - Day 1-3: 1.0x (no bonus)
 * - Day 4-7: 1.2x (20% bonus)
 * - Day 8-14: 1.5x (50% bonus)
 * - Day 15-30: 2.0x (100% bonus)
 * - Day 30+: 2.5x (150% bonus)
 */
export function calculateStreakBonus(currentDay: number): number {
  if (currentDay <= 3) return 1.0;
  if (currentDay <= 7) return 1.2;
  if (currentDay <= 14) return 1.5;
  if (currentDay <= 30) return 2.0;
  return 2.5;
}

/**
 * Calculate streak multiplier for given streak number
 * Returns the bonus multiplier for points calculation
 */
export function calculateStreakMultiplier(streakDays: number): number {
  const bonus = calculateStreakBonus(streakDays);
  return bonus;
}

/**
 * Check if streak is still active (logged meal today or yesterday)
 */
export function isStreakActive(lastLogDate: string, todayString: string): boolean {
  const lastDate = new Date(lastLogDate);
  const today = new Date(todayString);

  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  const dayAfterLastLog = new Date(lastDate);
  dayAfterLastLog.setDate(dayAfterLastLog.getDate() + 1);

  // Streak is active if last log was today or yesterday
  return dayAfterLastLog.getTime() === today.getTime() ||
         dayAfterLastLog.getTime() === yesterday.getTime();
}

/**
 * Calculate points for a meal based on macro balance
 * Base: 50 points per meal
 * - Perfect macros (30/35/35 protein/fat/carbs): +25 bonus
 * - Balanced macros (±5%): +15 bonus
 * - Tracked all macros: +10 bonus
 * - Protein meets goal: +10 bonus
 */
export function calculatePointsPerMeal(mealData: MealData, dailyGoals: {
  protein: number;
  fat: number;
  carbs: number;
}): number {
  let points = 50; // Base points

  // Calculate macro percentages
  const totalCalories = mealData.calories || 1; // Avoid division by zero
  const proteinCals = mealData.protein * 4;
  const fatCals = mealData.fat * 9;
  const carbsCals = mealData.carbs * 4;

  const proteinPercent = (proteinCals / totalCalories) * 100;
  const fatPercent = (fatCals / totalCalories) * 100;
  const carbsPercent = (carbsCals / totalCalories) * 100;

  // Perfect macro ratio (30/35/35)
  const targetProtein = 30;
  const targetFat = 35;
  const targetCarbs = 35;

  const proteinDiff = Math.abs(proteinPercent - targetProtein);
  const fatDiff = Math.abs(fatPercent - targetFat);
  const carbsDiff = Math.abs(carbsPercent - targetCarbs);

  if (proteinDiff <= 2 && fatDiff <= 2 && carbsDiff <= 2) {
    points += 25; // Perfect macros
  } else if (proteinDiff <= 5 && fatDiff <= 5 && carbsDiff <= 5) {
    points += 15; // Balanced macros
  }

  // Bonus for tracking all macros
  if (mealData.protein > 0 && mealData.fat > 0 && mealData.carbs > 0) {
    points += 10;
  }

  // Bonus for meeting protein goal
  if (mealData.protein >= dailyGoals.protein * 0.9) {
    points += 10;
  }

  return points;
}

/**
 * Get user level based on total points
 * Level progression:
 * L1: 0-500 pts
 * L2: 501-1200 pts
 * L3: 1201-2100 pts
 * L4: 2101-3200 pts
 * L5: 3201-4500 pts
 * L6: 4501-6000 pts
 * L7: 6001-7500 pts
 * etc.
 */
export function getLevelFromPoints(totalPoints: number): number {
  if (totalPoints < 501) return 1;
  if (totalPoints < 1201) return 2;
  if (totalPoints < 2101) return 3;
  if (totalPoints < 3201) return 4;
  if (totalPoints < 4501) return 5;

  // For level 6+: each level needs 1500 more points
  // 4501 -> L6 (0*1500 + 4501 = 4501)
  // 6000 -> L6 (0*1500 + 6000 = 6000)
  // 6001 -> L7 (1*1500 + 6001 = 7501... no)
  // Actually: points 4501-6000 = level 6
  // points 6001-7500 = level 7
  // So: (points - 4500) / 1500 + 5 = level
  // (4501-4500)/1500 + 5 = 1/1500 + 5... but floor gives us 5, not 6
  // Need to use: Math.ceil((points - 4500) / 1500) + 5
  const basePoints = 4500;
  const pointsAboveBase = totalPoints - basePoints;
  const levelsSixPlus = Math.ceil(pointsAboveBase / 1500);

  return 5 + levelsSixPlus;
}

/**
 * Get points required to reach next level
 */
export function getNextMilestonePoints(currentLevel: number): number {
  const milestones = [
    0,    // Level 0 (not used)
    500,  // Level 1 needs 500 points to complete
    1200, // Level 2 needs 1200 points to complete
    2100, // Level 3 needs 2100 points to complete
    3200, // Level 4 needs 3200 points to complete
    4500, // Level 5 needs 4500 points to complete
  ];

  if (currentLevel < milestones.length - 1) {
    return milestones[currentLevel + 1];
  }

  // Level 5+ progression: 1500 additional points per level
  return 4500 + (currentLevel - 4) * 1500;
}

/**
 * Get total points needed for a specific level
 */
export function getPointsForLevel(level: number): number {
  if (level <= 1) return 0;
  if (level === 2) return 501;
  if (level === 3) return 1201;
  if (level === 4) return 2101;
  if (level === 5) return 3201;

  // Level 6+: Each level needs 1500 more points after reaching 4500
  return 4500 + (level - 5) * 1500;
}

/**
 * Check if achievement should be unlocked based on conditions
 * Achievement types:
 * - 'first_meal': One meal logged
 * - 'streak_7': 7-day streak
 * - 'streak_30': 30-day streak
 * - 'recipes_created': Created N recipes
 * - 'protein_master': Consistent protein intake
 * - 'meal_logger': 100 meals logged
 * - 'macro_balancer': 50 perfectly balanced meals
 * - 'social_butterfly': 10 friends added
 */
export function shouldUnlockAchievement(
  achievementType: string,
  requirements: AchievementRequirements
): boolean {
  const { target, currentProgress } = requirements;

  switch (achievementType) {
    case 'first_meal':
      return currentProgress >= 1;

    case 'streak_7':
      return currentProgress >= 7;

    case 'streak_30':
      return currentProgress >= 30;

    case 'recipes_created':
      return currentProgress >= target;

    case 'protein_master':
      // 20 consecutive days meeting protein goal
      return currentProgress >= 20;

    case 'meal_logger':
      return currentProgress >= 100;

    case 'macro_balancer':
      // 50 meals with perfect macro balance (±2%)
      return currentProgress >= 50;

    case 'social_butterfly':
      return currentProgress >= 10;

    case 'workout_warrior':
      return currentProgress >= 30; // 30 workouts logged

    case 'hydration_hero':
      return currentProgress >= 365; // 365 days tracking water

    default:
      return false;
  }
}

/**
 * Get progress percentage for a badge
 * Returns 0-100 representing completion percentage
 */
export function getBadgeProgress(
  currentProgress: number,
  targetProgress: number
): number {
  if (targetProgress === 0) return 0;

  const percentage = (currentProgress / targetProgress) * 100;
  return Math.min(Math.round(percentage), 100);
}

/**
 * Get remaining progress needed for badge
 */
export function getRemainingProgress(
  currentProgress: number,
  targetProgress: number
): number {
  return Math.max(0, targetProgress - currentProgress);
}

/**
 * Format points for display
 * - 0-999: Show as-is (e.g., "450")
 * - 1000-999999: Show with K (e.g., "1.2K")
 * - 1000000+: Show with M (e.g., "2.5M")
 */
export function formatPointsDisplay(points: number): string {
  if (points < 1000) {
    return points.toString();
  }

  if (points < 1000000) {
    const thousands = (points / 1000).toFixed(1);
    return `${thousands}K`;
  }

  const millions = (points / 1000000).toFixed(1);
  return `${millions}M`;
}

/**
 * Get specific requirements for achievement type
 * Useful for UI display of progress
 */
export function getAchievementRequirements(achievementType: string): {
  target: number;
  description: string;
  reward: number;
} {
  const requirements: Record<string, { target: number; description: string; reward: number }> = {
    'first_meal': {
      target: 1,
      description: 'Log your first meal',
      reward: 100
    },
    'streak_7': {
      target: 7,
      description: 'Maintain a 7-day logging streak',
      reward: 200
    },
    'streak_30': {
      target: 30,
      description: 'Maintain a 30-day logging streak',
      reward: 500
    },
    'meal_logger': {
      target: 100,
      description: 'Log 100 meals',
      reward: 300
    },
    'macro_balancer': {
      target: 50,
      description: 'Complete 50 meals with perfect macro balance',
      reward: 400
    },
    'recipes_created': {
      target: 10,
      description: 'Create 10 custom recipes',
      reward: 250
    },
    'protein_master': {
      target: 20,
      description: 'Meet protein goal for 20 consecutive days',
      reward: 350
    },
    'social_butterfly': {
      target: 10,
      description: 'Add 10 friends',
      reward: 150
    },
    'workout_warrior': {
      target: 30,
      description: 'Log 30 workouts',
      reward: 300
    },
    'hydration_hero': {
      target: 365,
      description: 'Track water for 365 days',
      reward: 1000
    }
  };

  return requirements[achievementType] || {
    target: 0,
    description: 'Unknown achievement',
    reward: 0
  };
}

/**
 * Calculate total points earned today
 * Takes into account all meals and activities
 */
export function calculateDailyPointsEarned(
  mealsLogged: number,
  streakDays: number,
  activitiesLogged: number = 0
): number {
  const streakBonus = calculateStreakBonus(streakDays);
  const baseMealPoints = mealsLogged * 50;
  const mealPointsWithStreak = baseMealPoints * streakBonus;
  const activityPoints = activitiesLogged * 25;

  return Math.floor(mealPointsWithStreak) + activityPoints;
}

/**
 * Get level progress as percentage
 * Shows how close user is to next level
 */
export function getLevelProgress(totalPoints: number, currentLevel: number): number {
  const currentLevelPoints = getPointsForLevel(currentLevel);
  const nextLevelPoints = getPointsForLevel(currentLevel + 1);

  if (nextLevelPoints === currentLevelPoints) return 0;

  const pointsInLevel = totalPoints - currentLevelPoints;
  const pointsNeededForLevel = nextLevelPoints - currentLevelPoints;

  const progress = (pointsInLevel / pointsNeededForLevel) * 100;
  return Math.min(Math.round(progress), 100);
}

/**
 * Get points needed to reach next level
 */
export function getPointsToNextLevel(totalPoints: number, currentLevel: number): number {
  const nextLevelPoints = getPointsForLevel(currentLevel + 1);
  return Math.max(0, nextLevelPoints - totalPoints);
}

/**
 * Validate streak calculation with date checking
 * Returns new streak count if continued, or 1 if restarted
 * Logic:
 * - Same day: Return streak + 1 (consecutive)
 * - Next day: Return streak + 1 (consecutive)
 * - 2+ days gap: Return 1 (reset)
 */
export function validateAndUpdateStreak(
  currentStreak: number,
  lastLogDate: string,
  todayString: string
): { streak: number; reset: boolean } {
  const lastDate = new Date(lastLogDate);
  const today = new Date(todayString);

  // Normalize to date-only comparison (ignore time)
  const lastDateStr = lastDate.toISOString().split('T')[0];
  const todayStr = today.toISOString().split('T')[0];

  // Calculate day difference
  const lastDateObj = new Date(lastDateStr);
  const todayObj = new Date(todayStr);
  const dayDiff = Math.floor((todayObj.getTime() - lastDateObj.getTime()) / (1000 * 60 * 60 * 24));

  // dayDiff = 0 (same day), 1 (next day), 2+ (gap)
  if (dayDiff <= 1) {
    return { streak: currentStreak + 1, reset: false };
  } else {
    return { streak: 1, reset: true };
  }
}
