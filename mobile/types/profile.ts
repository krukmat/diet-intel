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
  follow_relation?: 'active' | 'blocked' | null;
}

// Request type for profile updates
export interface ProfileUpdatePayload {
  handle?: string;
  bio?: string;
  visibility?: 'public' | 'followers_only';
}
