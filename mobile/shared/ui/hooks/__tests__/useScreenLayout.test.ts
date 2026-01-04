import { renderHook, act } from '@testing-library/react-native';
import { useScreenLayout, useDynamicLayout, useLayoutAnimations } from '../useScreenLayout';

describe('useScreenLayout', () => {
  it('applies initial screen layout and exposes config', () => {
    const { result } = renderHook(() => useScreenLayout('login'));

    expect(result.current.layoutConfig.showHeader).toBe(false);
    expect(result.current.layoutConfig.contentPadding).toBe(32);
    expect(result.current.isLayoutDirty).toBe(false);
  });

  it('updates and resets layout config', () => {
    const { result } = renderHook(() => useScreenLayout('track'));

    act(() => {
      result.current.updateLayoutConfig({ headerTitle: 'Test', showFooter: true });
    });

    expect(result.current.layoutConfig.headerTitle).toBe('Test');
    expect(result.current.layoutConfig.showFooter).toBe(true);
    expect(result.current.isLayoutDirty).toBe(true);

    act(() => {
      result.current.resetLayoutConfig();
    });

    expect(result.current.layoutConfig.headerTitle).toBeUndefined();
    expect(result.current.isLayoutDirty).toBe(false);
  });

  it('returns layout for a specific screen', () => {
    const { result } = renderHook(() => useScreenLayout());

    const config = result.current.getLayoutForScreen('upload');
    expect(config.showBackButton).toBe(true);
    expect(config.headerTitle).toBe('Upload Label');
  });
});

describe('useDynamicLayout', () => {
  it('updates layout when screen changes', () => {
    const { result, rerender } = renderHook(({ screen }) => useDynamicLayout(screen), {
      initialProps: { screen: 'track' as const },
    });

    expect(result.current.layoutConfig.headerTitle).toBe('Track Food');

    rerender({ screen: 'plan' as const });

    expect(result.current.layoutConfig.headerTitle).toBe('Meal Plans');
  });
});

describe('useLayoutAnimations', () => {
  const originalRaf = global.requestAnimationFrame;

  beforeAll(() => {
    global.requestAnimationFrame = (cb: FrameRequestCallback) => {
      return setTimeout(() => cb(0), 0) as unknown as number;
    };
  });

  afterAll(() => {
    global.requestAnimationFrame = originalRaf;
  });

  it('starts animation', () => {
    jest.useFakeTimers();
    const { result } = renderHook(() => useLayoutAnimations());

    act(() => {
      result.current.startAnimation(10);
    });

    expect(result.current.isAnimating).toBe(true);
    jest.useRealTimers();
  });

  it('resets animation state', () => {
    const { result } = renderHook(() => useLayoutAnimations());

    act(() => {
      result.current.resetAnimation();
    });

    expect(result.current.isAnimating).toBe(false);
    expect(result.current.animationProgress).toBe(0);
  });
});
