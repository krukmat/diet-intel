import React from 'react';
import { Alert } from 'react-native';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import PlanScreen, { CustomizeModal } from '../PlanScreen';
import { apiService } from '../../services/ApiService';
import { storeCurrentMealPlanId } from '../../utils/mealPlanUtils';

jest.mock('../../services/ApiService', () => ({
  apiService: {
    generateMealPlan: jest.fn(),
    getUserPlans: jest.fn(),
    setPlanActive: jest.fn(),
    customizeMealPlan: jest.fn(),
    getProductByBarcode: jest.fn(),
    searchProduct: jest.fn(),
    getDashboard: jest.fn(),
  },
}));

jest.mock('../../utils/mealPlanUtils', () => ({
  storeCurrentMealPlanId: jest.fn(() => Promise.resolve()),
}));

jest.mock('../../utils/foodTranslation', () => ({
  translateFoodNameSync: (name: string) => name,
}));

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, options?: Record<string, any>) => {
      if (key === 'plan.todaysCalories' && options?.calories != null) {
        return `Calories ${options.calories}`;
      }
      return key;
    },
  }),
}));

describe('PlanScreen', () => {
  const generateMealPlanMock = apiService.generateMealPlan as jest.Mock;
  const getUserPlansMock = apiService.getUserPlans as jest.Mock;
  const setPlanActiveMock = apiService.setPlanActive as jest.Mock;
  const customizeMealPlanMock = apiService.customizeMealPlan as jest.Mock;
  const getDashboardMock = apiService.getDashboard as jest.Mock;
  const storeCurrentMealPlanIdMock = storeCurrentMealPlanId as jest.Mock;
  const alertSpy = jest.spyOn(Alert, 'alert');

  const sampleDailyPlan = {
    plan_id: 'plan-abc123',
    daily_calorie_target: 2000,
    bmr: 1700,
    tdee: 2200,
    meals: [
      {
        name: 'Breakfast',
        target_calories: 500,
        actual_calories: 450,
        items: [
          {
            barcode: 'item-1',
            name: 'Eggs',
            serving: '2 units',
            calories: 150,
            macros: {
              protein_g: 12,
              fat_g: 10,
              carbs_g: 1,
            },
          },
        ],
      },
    ],
    metrics: {
      total_calories: 2000,
      protein_g: 120,
      fat_g: 70,
      carbs_g: 200,
      sugars_g: 30,
      salt_g: 5,
      protein_percent: 24,
      fat_percent: 31,
      carbs_percent: 45,
    },
    created_at: '2026-01-10T00:00:00Z',
    flexibility_used: false,
    optional_products_used: 0,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    alertSpy.mockImplementation(() => {});
    generateMealPlanMock.mockResolvedValue({ data: sampleDailyPlan });
    storeCurrentMealPlanIdMock.mockResolvedValue(undefined);
    getUserPlansMock.mockResolvedValue({
      data: [
        {
          plan_id: 'plan-abc123',
          is_active: true,
          created_at: '2026-01-01T00:00:00Z',
          daily_calorie_target: 1800,
        },
        {
          plan_id: 'plan-def456',
          is_active: false,
          created_at: '2026-01-02T00:00:00Z',
          daily_calorie_target: 1900,
        },
      ],
    });
    setPlanActiveMock.mockResolvedValue({
      data: {
        plan_id: 'plan-def456',
        is_active: true,
      },
    });
    getDashboardMock.mockResolvedValue({
      data: {
        progress: {
          calories: { consumed: 900, planned: 1800, percentage: 50 },
          protein: { consumed: 60, planned: 120, percentage: 50 },
          fat: { consumed: 30, planned: 60, percentage: 50 },
          carbs: { consumed: 100, planned: 200, percentage: 50 },
        },
      },
    });
  });

  it('renders plan list with active state', async () => {
    const { findByText } = render(<PlanScreen onBackPress={jest.fn()} />);

    expect(await findByText('plan.list.title')).toBeTruthy();
    expect(await findByText('Plan plan-abc123')).toBeTruthy();
    expect(await findByText('Plan plan-def456')).toBeTruthy();
    expect(await findByText('plan.list.deactivate')).toBeTruthy();
    expect(await findByText('plan.list.activate')).toBeTruthy();
  });

  it('activates an inactive plan via API', async () => {
    const { findByText } = render(<PlanScreen onBackPress={jest.fn()} />);

    const activateButton = await findByText('plan.list.activate');
    fireEvent.press(activateButton);

    await waitFor(() => {
      expect(setPlanActiveMock).toHaveBeenCalledWith('plan-def456', true);
    });
  });

  it('deactivates the active plan via API', async () => {
    setPlanActiveMock.mockResolvedValueOnce({
      data: {
        plan_id: 'plan-abc123',
        is_active: false,
      },
    });

    const { findByText } = render(<PlanScreen onBackPress={jest.fn()} />);

    const deactivateButton = await findByText('plan.list.deactivate');
    fireEvent.press(deactivateButton);

    await waitFor(() => {
      expect(setPlanActiveMock).toHaveBeenCalledWith('plan-abc123', false);
    });
  });

  it('shows loading state before plan is ready', async () => {
    let resolvePlan: (value: { data: typeof sampleDailyPlan }) => void;
    const pendingPlan = new Promise((resolve) => {
      resolvePlan = resolve;
    });

    generateMealPlanMock.mockReturnValueOnce(pendingPlan);

    const { findByText } = render(<PlanScreen onBackPress={jest.fn()} />);
    fireEvent.press(await findByText('plan.generateNewPlan', { exact: false }));
    expect(await findByText('plan.generating')).toBeTruthy();

    resolvePlan({ data: sampleDailyPlan });

    await waitFor(() => {
      expect(storeCurrentMealPlanIdMock).toHaveBeenCalledWith('plan-abc123');
    });
  });

  it('shows error state and retries on failure', async () => {
    generateMealPlanMock.mockRejectedValueOnce(new Error('fail'));
    generateMealPlanMock.mockResolvedValueOnce({ data: sampleDailyPlan });

    const { findByText } = render(<PlanScreen onBackPress={jest.fn()} />);

    fireEvent.press(await findByText('plan.generateNewPlan', { exact: false }));
    const retryButton = await findByText('plan.generateNewPlan', { exact: false });
    fireEvent.press(retryButton);

    await waitFor(() => {
      expect(generateMealPlanMock).toHaveBeenCalledTimes(2);
    });
  });

  it('navigates to Smart Diet when optimizing with a plan', async () => {
    const navigateToSmartDiet = jest.fn();
    const { findByText } = render(
      <PlanScreen onBackPress={jest.fn()} navigateToSmartDiet={navigateToSmartDiet} />
    );

    fireEvent.press(await findByText('plan.generateNewPlan', { exact: false }));
    const optimizeButton = await findByText('plan.optimize.button', { exact: false });
    fireEvent.press(optimizeButton);

    fireEvent.press(await findByText('plan.optimize.confirmCta'));

    expect(navigateToSmartDiet).toHaveBeenCalledWith({
      planId: 'plan-abc123',
      targetContext: 'optimize',
    });
  });

  it('alerts when optimizing without a plan id', async () => {
    generateMealPlanMock.mockResolvedValueOnce({
      data: {
        ...sampleDailyPlan,
        plan_id: null,
      },
    });

    const { findByText } = render(<PlanScreen onBackPress={jest.fn()} />);
    fireEvent.press(await findByText('plan.generateNewPlan', { exact: false }));
    const optimizeButton = await findByText('plan.optimize.button', { exact: false });
    fireEvent.press(optimizeButton);

    expect(alertSpy).toHaveBeenCalledWith('plan.optimize.title', 'plan.optimize.noPlan', [
      { text: 'common.ok' },
    ]);
  });

  it('customizes a meal and calls the API', async () => {
    customizeMealPlanMock.mockResolvedValueOnce({ data: {} });

    const { findAllByText, findByPlaceholderText, findByText } = render(
      <PlanScreen onBackPress={jest.fn()} />
    );

    fireEvent.press(await findByText('plan.generateNewPlan', { exact: false }));
    await findByText(/Breakfast/);
    const customizeButtons = await findAllByText('plan.customize');
    fireEvent.press(customizeButtons[0]);

    fireEvent.press(await findByText('plan.modal.manual', { exact: false }));
    fireEvent.changeText(await findByPlaceholderText('plan.modal.productNamePlaceholder'), 'Extra Item');
    fireEvent.press(await findByText('plan.modal.addItem'));

    await waitFor(() => {
      expect(customizeMealPlanMock).toHaveBeenCalledWith(
        expect.objectContaining({
          meal_type: 'breakfast',
          action: 'add',
          item: expect.objectContaining({ name: 'Extra Item' }),
        })
      );
    });
  });

  it('alerts when customizing a meal fails', async () => {
    customizeMealPlanMock.mockRejectedValueOnce(new Error('customize failed'));

    const { findAllByText, findByPlaceholderText, findByText } = render(
      <PlanScreen onBackPress={jest.fn()} />
    );

    fireEvent.press(await findByText('plan.generateNewPlan', { exact: false }));
    await findByText(/Breakfast/);
    const customizeButtons = await findAllByText('plan.customize');
    fireEvent.press(customizeButtons[0]);

    fireEvent.press(await findByText('plan.modal.manual', { exact: false }));
    fireEvent.changeText(await findByPlaceholderText('plan.modal.productNamePlaceholder'), 'Fail Item');
    fireEvent.press(await findByText('plan.modal.addItem'));

    await waitFor(() => {
      expect(alertSpy).toHaveBeenCalledWith('common.error', 'Failed to customize meal plan.');
    });
  });

  it('supports back navigation and regenerate actions', async () => {
    const onBackPress = jest.fn();
    const { findByText } = render(<PlanScreen onBackPress={onBackPress} />);

    fireEvent.press(await findByText('🏠'));
    expect(onBackPress).toHaveBeenCalled();

    fireEvent.press(await findByText('plan.generateNewPlan', { exact: false }));
    await waitFor(() => {
      expect(generateMealPlanMock).toHaveBeenCalledTimes(1);
    });
  });

  it('handles plan list fetch errors', async () => {
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    getUserPlansMock.mockRejectedValueOnce(new Error('fetch failed'));

    render(<PlanScreen onBackPress={jest.fn()} />);

    await waitFor(() => {
      expect(consoleSpy).toHaveBeenCalledWith(
        'Plan list fetch failed:',
        expect.any(Error)
      );
    });
    consoleSpy.mockRestore();
  });

  it('alerts when toggling plan state fails', async () => {
    setPlanActiveMock.mockRejectedValueOnce(new Error('toggle failed'));

    const { findByText } = render(<PlanScreen onBackPress={jest.fn()} />);
    fireEvent.press(await findByText('plan.list.activate'));

    await waitFor(() => {
      expect(alertSpy).toHaveBeenCalledWith('common.error', 'No se pudo cambiar el estado del plan.');
    });
  });

  it('logs when saving plan id fails', async () => {
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    storeCurrentMealPlanIdMock.mockRejectedValueOnce(new Error('store failed'));

    const { findByText } = render(<PlanScreen onBackPress={jest.fn()} />);
    fireEvent.press(await findByText('plan.generateNewPlan', { exact: false }));

    await waitFor(() => {
      expect(consoleSpy).toHaveBeenCalledWith(
        'PlanScreen Debug - Failed to store meal plan ID:',
        expect.any(Error)
      );
    });
    consoleSpy.mockRestore();
  });

  it('closes customize modal from the header button', async () => {
    const { findAllByText, findByText } = render(
      <PlanScreen onBackPress={jest.fn()} />
    );

    fireEvent.press(await findByText('plan.generateNewPlan', { exact: false }));
    const customizeButtons = await findAllByText('plan.customize');
    fireEvent.press(customizeButtons[0]);

    fireEvent.press(await findByText('✕'));
    expect(await findByText('plan.title')).toBeTruthy();
  });
});

describe('CustomizeModal', () => {
  const getProductByBarcodeMock = apiService.getProductByBarcode as jest.Mock;
  const searchProductMock = apiService.searchProduct as jest.Mock;
  const alertSpy = jest.spyOn(Alert, 'alert');

  beforeEach(() => {
    jest.clearAllMocks();
    alertSpy.mockImplementation(() => {});
  });

  it('adds item from barcode search', async () => {
    const onConfirm = jest.fn();
    const onClose = jest.fn();

    getProductByBarcodeMock.mockResolvedValueOnce({
      data: {
        code: '123',
        product_name: 'Test Product',
        serving_size: '100g',
        nutriments: {
          energy_kcal_100g: 120,
          proteins_100g: 8,
          fat_100g: 5,
          carbohydrates_100g: 15,
        },
      },
    });

    const { getByPlaceholderText, findByText } = render(
      <CustomizeModal
        visible
        onClose={onClose}
        onConfirm={onConfirm}
        mealType="Breakfast"
        translateMealName={(name) => name}
      />
    );

    fireEvent.changeText(getByPlaceholderText('scanner.manual.placeholder'), '123');
    fireEvent.press(await findByText('plan.modal.searchProduct'));

    await waitFor(() => {
      expect(onConfirm).toHaveBeenCalledWith(
        expect.objectContaining({
          barcode: '123',
          name: 'Test Product',
          calories: 120,
        })
      );
    });
    expect(onClose).toHaveBeenCalled();
  });

  it('adds item from manual entry', async () => {
    const onConfirm = jest.fn();
    const onClose = jest.fn();

    const { getByPlaceholderText, findByText } = render(
      <CustomizeModal
        visible
        onClose={onClose}
        onConfirm={onConfirm}
        mealType="Lunch"
        translateMealName={(name) => name}
      />
    );

    fireEvent.press(await findByText('plan.modal.manual', { exact: false }));
    fireEvent.changeText(getByPlaceholderText('plan.modal.productNamePlaceholder'), 'Manual Food');
    fireEvent.press(await findByText('plan.modal.addItem'));

    await waitFor(() => {
      expect(onConfirm).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'Manual Food',
        })
      );
    });
    expect(onClose).toHaveBeenCalled();
  });

  it('uses text search when selected', async () => {
    const onConfirm = jest.fn();
    const onClose = jest.fn();

    searchProductMock.mockResolvedValueOnce({
      data: {
        name: 'Text Result',
        serving_size: '100g',
        nutriments: {
          energy_kcal_100g: 90,
          proteins_100g: 7,
          fat_100g: 3,
          carbohydrates_100g: 12,
        },
      },
    });

    const { findAllByPlaceholderText, findByPlaceholderText, findByText } = render(
      <CustomizeModal
        visible
        onClose={onClose}
        onConfirm={onConfirm}
        mealType="Dinner"
        translateMealName={(name) => name}
      />
    );

    fireEvent.press(await findByText('plan.modal.text'));
    fireEvent.changeText(await findByPlaceholderText('plan.modal.searchProduct'), 'pasta');
    fireEvent.press(await findByText('plan.modal.searchProduct'));

    await waitFor(() => {
      expect(searchProductMock).toHaveBeenCalledWith('pasta');
    });
    expect(onConfirm).toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();
  });

  it('lets users return to search mode and barcode search', async () => {
    const onConfirm = jest.fn();
    const onClose = jest.fn();

    getProductByBarcodeMock.mockResolvedValueOnce({
      data: {
        code: '444',
        product_name: 'Barcode Item',
        serving_size: '100g',
        nutriments: {
          energy_kcal_100g: 80,
          proteins_100g: 6,
          fat_100g: 2,
          carbohydrates_100g: 11,
        },
      },
    });

    const { findByPlaceholderText, findByText } = render(
      <CustomizeModal
        visible
        onClose={onClose}
        onConfirm={onConfirm}
        mealType="Snack"
        translateMealName={(name) => name}
      />
    );

    fireEvent.press(await findByText('plan.modal.manual', { exact: false }));
    fireEvent.press(await findByText('plan.modal.search', { exact: false }));
    fireEvent.press(await findByText('plan.modal.barcode'));
    fireEvent.changeText(await findByPlaceholderText('scanner.manual.placeholder'), '444');
    fireEvent.press(await findByText('plan.modal.searchProduct'));

    await waitFor(() => {
      expect(getProductByBarcodeMock).toHaveBeenCalledWith('444');
    });
    expect(onConfirm).toHaveBeenCalled();
  });

  it('captures all manual fields before adding', async () => {
    const onConfirm = jest.fn();
    const onClose = jest.fn();

    const { findAllByPlaceholderText, findByPlaceholderText, findByText } = render(
      <CustomizeModal
        visible
        onClose={onClose}
        onConfirm={onConfirm}
        mealType="Dinner"
        translateMealName={(name) => name}
      />
    );

    fireEvent.press(await findByText('plan.modal.manual', { exact: false }));
    fireEvent.changeText(await findByPlaceholderText('plan.modal.productNamePlaceholder'), 'Full Manual');
    fireEvent.changeText(await findByPlaceholderText('plan.modal.brandPlaceholder'), 'Brand');
    fireEvent.changeText(await findByPlaceholderText('plan.modal.servingSizePlaceholder'), '2 units');
    const numericInputs = await findAllByPlaceholderText('0');
    fireEvent.changeText(numericInputs[0], '110');
    fireEvent.changeText(numericInputs[1], '12');
    fireEvent.changeText(numericInputs[2], '4');
    fireEvent.changeText(numericInputs[3], '18');
    fireEvent.press(await findByText('plan.modal.addItem'));

    await waitFor(() => {
      expect(onConfirm).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'Full Manual',
          calories: 110,
          macros: expect.objectContaining({
            protein_g: 12,
            fat_g: 4,
            carbs_g: 18,
          }),
        })
      );
    });
  });

  it('alerts when search fails', async () => {
    const onConfirm = jest.fn();
    const onClose = jest.fn();

    getProductByBarcodeMock.mockRejectedValueOnce(new Error('not found'));

    const { findByPlaceholderText, findByText } = render(
      <CustomizeModal
        visible
        onClose={onClose}
        onConfirm={onConfirm}
        mealType="Snack"
        translateMealName={(name) => name}
      />
    );

    fireEvent.changeText(await findByPlaceholderText('scanner.manual.placeholder'), '000');
    fireEvent.press(await findByText('plan.modal.searchProduct'));

    await waitFor(() => {
      expect(alertSpy).toHaveBeenCalledWith(
        'common.error',
        'Could not find product. Try manual entry instead.'
      );
    });
  });

  it('shows validation alert when manual name is missing', async () => {
    const onConfirm = jest.fn();
    const onClose = jest.fn();

    const { findByText } = render(
      <CustomizeModal
        visible
        onClose={onClose}
        onConfirm={onConfirm}
        mealType="Dinner"
        translateMealName={(name) => name}
      />
    );

    fireEvent.press(await findByText('plan.modal.manual', { exact: false }));
    fireEvent.press(await findByText('plan.modal.addItem'));

    expect(alertSpy).toHaveBeenCalled();
    expect(onConfirm).not.toHaveBeenCalled();
  });

});
