import { renderHook, act } from '@testing-library/react-native';
import { useNavigation, useProgrammaticNavigation, useNavigationAnalytics } from '../useNavigation';

const mockNavigate = jest.fn();
const mockReset = jest.fn();
const mockGoBack = jest.fn();
const mockGetCurrentComponent = jest.fn();
const mockGetMetrics = jest.fn();
const mockCanNavigateTo = jest.fn();
let mockNavigationContext: Record<string, any>;
let mockNavigationState: { navigationContext: Record<string, any> };

jest.mock('../../NavigationCore', () => ({
  useSafeNavigation: () => ({
    navigate: mockNavigate,
    reset: mockReset,
    goBack: mockGoBack,
    canGoBack: true,
    currentScreen: 'track',
    get navigationContext() {
      return mockNavigationState.navigationContext;
    },
    set navigationContext(value) {
      mockNavigationState.navigationContext = value;
    },
    canNavigateTo: mockCanNavigateTo,
    getCurrentComponent: mockGetCurrentComponent,
    getMetrics: mockGetMetrics,
  }),
}));

describe('useNavigation', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockNavigationContext = { mode: 'test' };
    mockNavigationState = { navigationContext: mockNavigationContext };
    mockGetMetrics.mockReturnValue({
      history: ['splash', 'track'],
      previousScreen: 'splash',
      historyLength: 2,
      validTransitions: 4,
    });
    mockCanNavigateTo.mockReturnValue(true);
    mockGetCurrentComponent.mockResolvedValue(() => null);
  });

  it('navigates with validation when allowed', () => {
    const { result } = renderHook(() => useNavigation());

    const success = result.current.navigateWithValidation('plan');

    expect(success).toBe(true);
    expect(mockNavigate).toHaveBeenCalledWith('plan', undefined);
  });

  it('blocks navigation when validation fails', () => {
    mockCanNavigateTo.mockReturnValue(false);
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation();
    const { result } = renderHook(() => useNavigation());

    const success = result.current.navigateWithValidation('plan');

    expect(success).toBe(false);
    expect(mockNavigate).not.toHaveBeenCalled();
    expect(warnSpy).toHaveBeenCalled();
    warnSpy.mockRestore();
  });

  it('supports replace and reset navigation', () => {
    const { result } = renderHook(() => useNavigation());

    act(() => {
      result.current.navigateReplace('plan', { replace: false } as any);
      result.current.navigateAndClear('track');
    });

    expect(mockNavigate).toHaveBeenCalledWith('plan', { replace: true });
    expect(mockReset).toHaveBeenCalledWith('track', undefined);
  });

  it('exposes navigation state helpers', () => {
    const { result } = renderHook(() => useNavigation());

    expect(result.current.getCurrentRoute()).toBe('track');
    expect(result.current.isCurrentScreen('track')).toBe(true);
    expect(result.current.isCurrentScreen('plan')).toBe(false);
    expect(result.current.canNavigateTo('plan')).toBe(true);
  });

  it('manages navigation context', () => {
    const { result } = renderHook(() => useNavigation());

    act(() => {
      result.current.updateNavigationContext({ source: 'unit' });
    });

    expect(mockNavigationState.navigationContext).toEqual({ mode: 'test', source: 'unit' });

    act(() => {
      result.current.clearNavigationContext();
    });

    expect(mockNavigationState.navigationContext).toEqual({});
  });

  it('returns navigation history metrics', () => {
    const { result } = renderHook(() => useNavigation());

    expect(result.current.getNavigationHistory()).toEqual(['splash', 'track']);
    expect(result.current.getPreviousScreen()).toBe('splash');
    expect(result.current.getBackStackCount()).toBe(1);
  });
});

describe('useProgrammaticNavigation', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockCanNavigateTo.mockReturnValue(true);
  });

  it('blocks navigation to auth screens', () => {
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation();
    const { result } = renderHook(() => useProgrammaticNavigation());

    const allowed = result.current.navigateToAuthenticated('login');

    expect(allowed).toBe(false);
    expect(warnSpy).toHaveBeenCalled();
    warnSpy.mockRestore();
  });

  it('navigates to feature screens', () => {
    const { result } = renderHook(() => useProgrammaticNavigation());

    const allowed = result.current.navigateToFeature('recipes');

    expect(allowed).toBe(true);
    expect(mockNavigate).toHaveBeenCalledWith('recipes', undefined);
  });

  it('handles safe navigation with missing component', async () => {
    mockGetCurrentComponent.mockResolvedValue(null);
    const errorSpy = jest.spyOn(console, 'error').mockImplementation();
    const { result } = renderHook(() => useProgrammaticNavigation());

    const allowed = await result.current.navigateSafe('plan');

    expect(allowed).toBe(false);
    expect(errorSpy).toHaveBeenCalled();
    errorSpy.mockRestore();
  });
});

describe('useNavigationAnalytics', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetMetrics.mockReturnValue({
      historyLength: 3,
      validTransitions: 5,
    });
  });

  it('tracks navigation events', () => {
    const logSpy = jest.spyOn(console, 'log').mockImplementation();
    const { result } = renderHook(() => useNavigationAnalytics());

    result.current.trackNavigation('track', 'plan', { a: 1 } as any);

    expect(logSpy).toHaveBeenCalled();
    logSpy.mockRestore();
  });

  it('returns performance metrics', () => {
    const { result } = renderHook(() => useNavigationAnalytics());

    expect(result.current.getPerformanceMetrics()).toEqual({
      screenTransitions: 3,
      averageTransitionsPerSession: 3,
      currentRouteDepth: 3,
      contextDataSize: JSON.stringify({ mode: 'test' }).length,
      validTransitionsAvailable: 5,
    });
  });
});
