import AsyncStorage from '@react-native-async-storage/async-storage';

const CURRENT_MEAL_PLAN_KEY = 'current_meal_plan_id';

/**
 * Store the current meal plan ID in AsyncStorage
 * @param planId - The meal plan ID to store
 */
export const storeCurrentMealPlanId = async (planId: string): Promise<void> => {
  try {
    await AsyncStorage.setItem(CURRENT_MEAL_PLAN_KEY, planId);
  } catch (error) {
    console.error('Failed to store meal plan ID:', error);
    throw error;
  }
};

/**
 * Retrieve the current meal plan ID from AsyncStorage
 * @returns The current meal plan ID or null if not found
 */
export const getCurrentMealPlanId = async (): Promise<string | null> => {
  try {
    return await AsyncStorage.getItem(CURRENT_MEAL_PLAN_KEY);
  } catch (error) {
    console.error('Failed to retrieve meal plan ID:', error);
    return null;
  }
};

/**
 * Clear the current meal plan ID from AsyncStorage
 */
export const clearCurrentMealPlanId = async (): Promise<void> => {
  try {
    await AsyncStorage.removeItem(CURRENT_MEAL_PLAN_KEY);
  } catch (error) {
    console.error('Failed to clear meal plan ID:', error);
    throw error;
  }
};

/**
 * Check if a current meal plan ID exists
 * @returns True if a meal plan ID is stored, false otherwise
 */
export const hasCurrentMealPlanId = async (): Promise<boolean> => {
  try {
    const planId = await AsyncStorage.getItem(CURRENT_MEAL_PLAN_KEY);
    return planId !== null;
  } catch (error) {
    console.error('Failed to check meal plan ID existence:', error);
    return false;
  }
};