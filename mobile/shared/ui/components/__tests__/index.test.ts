import * as Components from '../index';

describe('shared ui components index', () => {
  it('exports shared components', () => {
    expect(Components.LoadingSpinner).toBeDefined();
    expect(Components.FullScreenLoading).toBeDefined();
    expect(Components.EmptyState).toBeDefined();
    expect(Components.ErrorState).toBeDefined();
    expect(Components.HomePrimaryActions).toBeDefined();
  });
});
