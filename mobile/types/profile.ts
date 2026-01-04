// EPIC_A.A1: Interfaces TypeScript mínimas para perfiles sociales en móvil (~30 tokens)

export interface ProfileStats {
  followers_count: number;
  following_count: number;
  posts_count: number;
  points_total: number;
  level: number;
  badges_count: number;
}

export interface Profile {
  user_id: string;
  handle: string;
  bio?: string;
  avatar_url?: string;
  visibility: 'public' | 'followers_only';
  stats: ProfileStats;
  posts?: any[]; // Permitir any[] para flexibilidad inicial
  posts_notice?: string | null;
  follow_relation?: 'active' | null;
  block_relation?: 'blocked' | 'blocked_by' | null; // EPIC_A.A3: Block relation
}

// Request type for profile updates
export interface ProfileUpdatePayload {
  handle?: string;
  bio?: string;
  visibility?: 'public' | 'followers_only';
}

export const createEmptyProfileStats = (): ProfileStats => ({
  followers_count: 0,
  following_count: 0,
  posts_count: 0,
  points_total: 0,
  level: 0,
  badges_count: 0,
});

export const createEmptyProfile = (userId: string): Profile => ({
  user_id: userId,
  handle: '',
  visibility: 'public',
  stats: createEmptyProfileStats(),
  posts_notice: null,
  follow_relation: null,
  block_relation: null,
});
