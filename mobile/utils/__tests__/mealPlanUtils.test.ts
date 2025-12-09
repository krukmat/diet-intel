import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  storeCurrentMealPlanId,
  getCurrentMealPlanId,
  clearCurrentMealPlanId,
  hasCurrentMealPlanId,
} from '../mealPlanUtils';

// Mock AsyncStorage
jest.mock('@react-native-async-storage/async-storage', () => ({
  setItem: jest.fn(),
  getItem: jest.fn(),
  removeItem: jest.fn(),
}));

const mockAsyncStorage = AsyncStorage as jest.Mocked<typeof AsyncStorage>;

describe('Meal Plan Utils', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockAsyncStorage.setItem.mockResolvedValue(undefined);
    mockAsyncStorage.getItem.mockResolvedValue(null);
    mockAsyncStorage.removeItem.mockResolvedValue(undefined);
  });

  describe('storeCurrentMealPlanId', () => {
    it('should store meal plan ID in AsyncStorage', async () => {
      const planId = 'meal_plan_123';
      
      await storeCurrentMealPlanId(planId);
      
      expect(mockAsyncStorage.setItem).toHaveBeenCalledWith(
        'current_meal_plan_id',
        planId
      );
    });

    it('should throw error when AsyncStorage fails', async () => {
      const planId = 'meal_plan_123';
      mockAsyncStorage.setItem.mockRejectedValue(new Error('Storage error'));
      
      await expect(storeCurrentMealPlanId(planId)).rejects.toThrow('Storage error');
    });
  });

  describe('getCurrentMealPlanId', () => {
    it('should retrieve meal plan ID from AsyncStorage', async () => {
      const planId = 'meal_plan_123';
      mockAsyncStorage.getItem.mockResolvedValue(planId);
      
      const result = await getCurrentMealPlanId();
      
      expect(mockAsyncStorage.getItem).toHaveBeenCalledWith('current_meal_plan_id');
      expect(result).toBe(planId);
    });

    it('should return null when no plan ID exists', async () => {
      mockAsyncStorage.getItem.mockResolvedValue(null);
      
      const result = await getCurrentMealPlanId();
      
      expect(result).toBeNull();
    });

    it('should return null when AsyncStorage fails', async () => {
      mockAsyncStorage.getItem.mockRejectedValue(new Error('Storage error'));
      
      const result = await getCurrentMealPlanId();
      
      expect(result).toBeNull();
    });
  });

  describe('clearCurrentMealPlanId', () => {
    it('should remove meal plan ID from AsyncStorage', async () => {
      await clearCurrentMealPlanId();
      
      expect(mockAsyncStorage.removeItem).toHaveBeenCalledWith('current_meal_plan_id');
    });

    it('should throw error when AsyncStorage fails', async () => {
      mockAsyncStorage.removeItem.mockRejectedValue(new Error('Storage error'));
      
      await expect(clearCurrentMealPlanId()).rejects.toThrow('Storage error');
    });
  });

  describe('hasCurrentMealPlanId', () => {
    it('should return true when meal plan ID exists', async () => {
      mockAsyncStorage.getItem.mockResolvedValue('meal_plan_123');
      
      const result = await hasCurrentMealPlanId();
      
      expect(result).toBe(true);
    });

    it('should return false when no meal plan ID exists', async () => {
      mockAsyncStorage.getItem.mockResolvedValue(null);
      
      const result = await hasCurrentMealPlanId();
      
      expect(result).toBe(false);
    });

    it('should return false when AsyncStorage fails', async () => {
      mockAsyncStorage.getItem.mockRejectedValue(new Error('Storage error'));
      
      const result = await hasCurrentMealPlanId();
      
      expect(result).toBe(false);
    });
  });
});