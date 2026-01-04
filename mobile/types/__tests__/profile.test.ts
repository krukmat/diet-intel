import { createEmptyProfile, createEmptyProfileStats } from '../profile';

describe('profile types', () => {
  it('supports creating profile-shaped data', () => {
    const profile = {
      user_id: 'user-1',
      handle: 'test_user',
      visibility: 'public',
      stats: {
        followers_count: 10,
        following_count: 5,
        posts_count: 3,
        points_total: 100,
        level: 2,
        badges_count: 1,
      },
      posts_notice: null,
      follow_relation: null,
      block_relation: null,
    };

    expect(profile.handle).toBe('test_user');
    expect(profile.stats.level).toBe(2);
    expect(createEmptyProfileStats()).toEqual({
      followers_count: 0,
      following_count: 0,
      posts_count: 0,
      points_total: 0,
      level: 0,
      badges_count: 0,
    });
    expect(createEmptyProfile('user-2').user_id).toBe('user-2');
  });
});
