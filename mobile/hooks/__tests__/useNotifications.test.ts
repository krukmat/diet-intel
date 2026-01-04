import { renderHook, waitFor } from '@testing-library/react-native';
import { useNotifications } from '../useNotifications';
import { notificationService } from '../../services/NotificationService';

jest.mock('../../services/NotificationService', () => ({
  notificationService: {
    initialize: jest.fn(),
    getPendingNavigationIntent: jest.fn(),
  },
}));

describe('useNotifications', () => {
  const navigateToScreen = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('does nothing when initialization fails', async () => {
    (notificationService.initialize as jest.Mock).mockResolvedValue(false);

    renderHook(() => useNotifications(navigateToScreen));

    await waitFor(() => {
      expect(notificationService.initialize).toHaveBeenCalled();
    });

    expect(navigateToScreen).not.toHaveBeenCalled();
  });

  it('does nothing when there is no pending intent', async () => {
    (notificationService.initialize as jest.Mock).mockResolvedValue(true);
    (notificationService.getPendingNavigationIntent as jest.Mock).mockResolvedValue(null);

    renderHook(() => useNotifications(navigateToScreen));

    await waitFor(() => {
      expect(notificationService.getPendingNavigationIntent).toHaveBeenCalled();
    });

    expect(navigateToScreen).not.toHaveBeenCalled();
  });

  it('ignores unsupported intents', async () => {
    (notificationService.initialize as jest.Mock).mockResolvedValue(true);
    (notificationService.getPendingNavigationIntent as jest.Mock).mockResolvedValue({ type: 'other' });

    renderHook(() => useNotifications(navigateToScreen));

    await waitFor(() => {
      expect(notificationService.getPendingNavigationIntent).toHaveBeenCalled();
    });

    expect(navigateToScreen).not.toHaveBeenCalled();
  });

  it('navigates to recommendations for smart diet intent', async () => {
    (notificationService.initialize as jest.Mock).mockResolvedValue(true);
    (notificationService.getPendingNavigationIntent as jest.Mock).mockResolvedValue({
      type: 'smart_diet_navigation',
      context: 'optimize',
    });

    renderHook(() => useNotifications(navigateToScreen));

    await waitFor(() => {
      expect(navigateToScreen).toHaveBeenCalledWith('recommendations', {
        targetContext: 'optimize',
        sourceScreen: 'notification',
      });
    });
  });
});
