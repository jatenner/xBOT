/**
 * Additional type definitions for build fixes
 */

export interface PostingResult {
  success: boolean;
  content?: string;
  tweetId?: string;
  reason?: string;
  error?: string;
  emergency_mode?: boolean;
  tweet_id?: string;
  was_posted?: boolean;
  confirmed?: boolean;
  performance_metrics?: {
    generation_time_ms: number;
    posting_time_ms: number;
    storage_time_ms: number;
    total_time_ms: number;
  };
  content_metadata?: {
    attempts_made: number;
    uniqueness_score?: number;
    template_used?: string;
    selection_method?: string;
  };
}

export interface ThreadPostResult {
  success: boolean;
  tweetIds: string[];
  error?: string;
}

export interface ResourceCheck {
  canLaunch: boolean;
  reason?: string;
}