import { renderHook } from '@testing-library/react-native';
import { useHomeActions } from '../useHomeActions';

jest.mock('../../config/homeActions', () => ({
  getHomeActions: jest.fn((group: string) => [`${group}-action`]),
}));

describe('useHomeActions', () => {
  it('returns grouped actions', () => {
    const { result } = renderHook(() => useHomeActions());

    expect(result.current.primaryActions).toEqual(['primary-action']);
    expect(result.current.secondaryActions).toEqual(['secondary-action']);
    expect(result.current.toolActions).toEqual(['tool-action']);
  });
});
