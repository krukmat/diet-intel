export interface DiscoverFeedItem {
  id: string;
  author_id: string;
  author_handle?: string;
  text: string;
  rank_score: number;
  reason: string;
  created_at: string;
  media?: Array<{ type: string; url: string }>;
  metadata: {
    likes_count: number;
    comments_count: number;
  };
}

export interface DiscoverFeedResponse {
  items: DiscoverFeedItem[];
  next_cursor?: string | null;
  variant?: string;
  request_id?: string | null;
}

export const createFeedMetadata = (likesCount = 0, commentsCount = 0) => ({
  likes_count: likesCount,
  comments_count: commentsCount,
});

export const createEmptyDiscoverFeedResponse = (): DiscoverFeedResponse => ({
  items: [],
  next_cursor: null,
});
