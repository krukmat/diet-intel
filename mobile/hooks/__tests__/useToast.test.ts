import { renderHook, act } from '@testing-library/react-native';
import { useToast, ToastType } from '../useToast';

describe('useToast', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
  });

  it('adds and auto-dismisses toast', () => {
    const { result } = renderHook(() => useToast());

    let toastId = '';
    act(() => {
      toastId = result.current.success('Saved');
    });

    expect(result.current.toasts).toHaveLength(1);

    act(() => {
      jest.advanceTimersByTime(3000);
    });

    expect(result.current.toasts).toHaveLength(0);
    expect(toastId).toContain('toast_');
  });

  it('updates toast duration and keeps it visible', () => {
    const { result } = renderHook(() => useToast());

    let toastId = '';
    act(() => {
      toastId = result.current.info('Info');
    });

    act(() => {
      result.current.updateToast(toastId, { duration: 6000 });
      jest.advanceTimersByTime(3000);
    });

    expect(result.current.toasts).toHaveLength(1);
  });

  it('returns loading toast that does not auto-dismiss', () => {
    const { result } = renderHook(() => useToast());

    act(() => {
      result.current.loading('Loading');
      jest.advanceTimersByTime(10000);
    });

    expect(result.current.toasts).toHaveLength(1);
    expect(result.current.toasts[0].type).toBe(ToastType.LOADING);
  });

  it('wraps promise with success and error toasts', async () => {
    const { result } = renderHook(() => useToast());

    const promise = Promise.resolve('ok');

    await act(async () => {
      await result.current.promise(promise, { success: 'Done' });
    });

    expect(result.current.toasts.some(toast => toast.title === 'Done')).toBe(true);
  });

  it('dismisses all toasts and clears queue', () => {
    const { result } = renderHook(() => useToast());

    act(() => {
      result.current.success('First');
      result.current.error('Second');
    });

    expect(result.current.toasts).toHaveLength(2);

    act(() => {
      result.current.dismissAll();
    });

    expect(result.current.toasts).toHaveLength(0);
  });

  it('sends sync notification', () => {
    const { result } = renderHook(() => useToast());

    act(() => {
      result.current.syncNotification('Sync done', 'success');
    });

    expect(result.current.toasts[0].title).toBe('Sync Update');
  });
});
