import { useState } from 'react';
import { apiService } from '../services/ApiService';
import { TFunction } from 'i18next';
import { Alert } from 'react-native';

export interface UseConsumptionLogicProps {
  t: TFunction;
  onConsumptionSuccess?: () => void;
}

export interface UseConsumptionLogicReturn {
  consumedItems: string[];
  consumingItem: string | null;
  handleConsumeItem: (itemBarcode: string) => Promise<void>;
  isItemConsumed: (itemBarcode: string) => boolean;
}

export const useConsumptionLogic = ({
  t,
  onConsumptionSuccess
}: UseConsumptionLogicProps): UseConsumptionLogicReturn => {
  const [consumedItems, setConsumedItems] = useState<string[]>([]);
  const [consumingItem, setConsumingItem] = useState<string | null>(null);

  const handleConsumeItem = async (itemBarcode: string) => {
    if (consumingItem) return; // Prevent multiple simultaneous requests

    setConsumingItem(itemBarcode);

    try {
      const response = await apiService.consumePlanItem(itemBarcode);

      if (response.data.success) {
        setConsumedItems(prev => [...prev, itemBarcode]);

        Alert.alert(
          t('common.success', 'Success'),
          t('plan.itemConsumed', 'Item marked as consumed')
        );

        // Call success callback if provided
        onConsumptionSuccess?.();
      } else {
        Alert.alert(
          t('common.error', 'Error'),
          response.data.message || t('plan.failedToConsume', 'Failed to consume item')
        );
      }
    } catch (error) {
      console.error('Failed to consume item:', error);
      Alert.alert(
        t('common.error', 'Error'),
        t('plan.failedToConsume', 'Failed to consume item')
      );
    } finally {
      setConsumingItem(null);
    }
  };

  const isItemConsumed = (itemBarcode: string): boolean => {
    return consumedItems.includes(itemBarcode);
  };

  return {
    consumedItems,
    consumingItem,
    handleConsumeItem,
    isItemConsumed,
  };
};
