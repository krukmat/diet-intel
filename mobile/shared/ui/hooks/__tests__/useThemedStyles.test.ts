import { renderHook, act } from '@testing-library/react-native';
import { useThemedStyles, useComponentStyles, useScreenStyles, useResponsiveStyles } from '../useThemedStyles';

describe('useThemedStyles', () => {
  it('toggles theme and updates state', () => {
    const { result } = renderHook(() => useThemedStyles());

    expect(result.current.isDark).toBe(false);

    act(() => {
      result.current.toggleTheme();
    });

    expect(result.current.isDark).toBe(true);
  });

  it('sets theme directly', () => {
    const { result } = renderHook(() => useThemedStyles());

    act(() => {
      result.current.setTheme(true);
    });

    expect(result.current.isDark).toBe(true);
  });

  it('returns style utilities', () => {
    const { result } = renderHook(() => useThemedStyles());

    const styles = result.current.createStyles(theme => ({
      container: { backgroundColor: theme.colors.background },
    }));

    expect(styles.container.backgroundColor).toBe(result.current.colors.background);
    expect(result.current.getSpacing('md')).toBe(result.current.spacing.md);
    expect(result.current.getColor('primary')).toBe(result.current.colors.primary);
    expect(result.current.combineStyles(null, { a: 1 }, { b: 2 })).toEqual([{ a: 1 }, { b: 2 }]);
  });
});

describe('useComponentStyles', () => {
  it('creates component styles with theme', () => {
    const { result } = renderHook(() =>
      useComponentStyles(theme => ({
        text: { color: theme.colors.text },
      }))
    );

    expect(result.current.text.color).toBeDefined();
  });
});

describe('useScreenStyles', () => {
  it('returns screen-specific overrides', () => {
    const { result } = renderHook(() => useScreenStyles('login'));

    expect(result.current.container.backgroundColor).toBeDefined();
  });
});

describe('useResponsiveStyles', () => {
  it('updates screen size and spacing', () => {
    const { result } = renderHook(() => useResponsiveStyles());

    act(() => {
      result.current.updateScreenWidth(320);
    });

    expect(result.current.screenSize).toBe('xs');
    expect(result.current.responsiveSpacing.xs).toBeGreaterThan(0);
  });
});
