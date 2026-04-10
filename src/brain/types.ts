/**
 * Brain System v2 — Type Definitions
 *
 * Domain-agnostic Twitter intelligence types.
 * These types mirror the brain_* database tables.
 */

// =============================================================================
// Enums
// =============================================================================

export type AccountTier = 'S' | 'A' | 'B' | 'C' | 'dormant';

export type GrowthPhase =
  | 'cold_start'      // < 500 followers
  | 'early_traction'  // 500 - 2,000
  | 'growth'          // 2,000 - 10,000
  | 'authority'        // 10,000 - 50,000
  | 'scale';          // 50,000+

export type TweetType = 'original' | 'reply' | 'quote' | 'retweet' | 'thread';

export type MediaType = 'none' | 'image' | 'video' | 'gif' | 'poll' | 'link';

export type DiscoverySource =
  | 'trending'
  | 'keyword'
  | 'timeline'
  | 'foryou'
  | 'viral_capture'
  | 'reply_tree'
  | 'mention_graph'
  | 'retweet_graph'
  | 'quote_graph'
  | 'seed'
  | 'census_timeline';

export type AccountDiscoveryMethod =
  | 'seed'
  | 'retweet_graph'
  | 'quote_graph'
  | 'reply_tree'
  | 'viral_author'
  | 'mention'
  | 'trending'
  | 'foryou';

export type KeywordSource =
  | 'seed'
  | 'trending'
  | 'entity_extraction'
  | 'topic_expansion'
  | 'bio_extraction';

export type EngagementTrajectory =
  | 'rising'
  | 'peaked'
  | 'decaying'
  | 'flatline'
  | 'second_wave';

export type OutcomeClass =
  | 'breakout'         // > 3x expected
  | 'above_expected'   // 1.5x - 3x expected
  | 'expected'         // 0.5x - 1.5x expected
  | 'below_expected'   // 0.2x - 0.5x expected
  | 'failure';         // < 0.2x expected

export type FailureDiagnosis =
  | 'content_bad'
  | 'timing_bad'
  | 'algo_didnt_push'
  | 'topic_mismatch'
  | 'authority_gap'
  | 'saturation';

// Classification dimensions
export type Domain =
  | 'health' | 'tech' | 'finance' | 'business' | 'politics'
  | 'entertainment' | 'sports' | 'science' | 'crypto'
  | 'personal_dev' | 'humor' | 'news' | 'culture' | 'other';

export type HookType =
  | 'contrarian' | 'myth_bust' | 'question' | 'surprising_stat'
  | 'personal_story' | 'bold_claim' | 'curiosity_gap' | 'controversy'
  | 'social_proof' | 'how_to' | 'analogy' | 'observation'
  | 'list' | 'hot_take' | 'data_driven' | 'other';

export type Tone =
  | 'authoritative' | 'casual' | 'provocative' | 'educational'
  | 'vulnerable' | 'humorous' | 'urgent' | 'inspirational'
  | 'conversational' | 'analytical' | 'other';

export type ContentFormat =
  | 'one_liner' | 'short' | 'medium' | 'long' | 'thread'
  | 'list' | 'story' | 'data_driven' | 'question' | 'hot_take'
  | 'tutorial' | 'framework' | 'analogy' | 'meme_text' | 'other';

export type EmotionalTrigger =
  | 'fear' | 'curiosity' | 'anger' | 'hope' | 'humor'
  | 'surprise' | 'outrage' | 'inspiration' | 'fomo'
  | 'empathy' | 'nostalgia' | 'belonging' | 'identity' | 'other';

export type Specificity = 'vague' | 'moderate' | 'specific' | 'hyper_specific';
export type Actionability = 'none' | 'low' | 'moderate' | 'high';
export type IdentitySignal = 'none' | 'aspirational' | 'tribal' | 'contrarian' | 'expert' | 'relatable';

// =============================================================================
// Core Interfaces
// =============================================================================

export interface BrainTweet {
  id?: string;
  tweet_id: string;
  author_username: string;
  author_followers: number | null;
  author_following: number | null;
  author_tier: AccountTier | null;

  // Content
  content: string;
  media_type: MediaType;
  tweet_type: TweetType;
  is_thread: boolean;
  thread_position: number | null;
  parent_tweet_id: string | null;
  reply_to_username: string | null;
  reply_delay_minutes: number | null;
  reply_target_followers: number | null;

  // Raw metrics
  views: number;
  likes: number;
  retweets: number;
  replies: number;
  bookmarks: number;
  quotes: number;

  // Computed ratios
  view_to_follower_ratio: number | null;
  like_to_view_ratio: number | null;
  bookmark_to_like_ratio: number | null;
  reply_to_like_ratio: number | null;
  retweet_to_like_ratio: number | null;
  quote_to_retweet_ratio: number | null;
  engagement_rate: number | null;
  viral_multiplier: number | null;

  // Timing
  posted_at: string | null;
  posted_hour_utc: number | null;
  posted_day_of_week: number | null;
  scraped_at: string;

  // Discovery
  discovery_source: DiscoverySource;
  discovery_keyword: string | null;
  discovery_feed_run_id: string | null;

  // Re-scrape
  rescrape_count: number;
  last_rescrape_at: string | null;
  peak_likes: number | null;
  peak_views: number | null;
  peak_velocity: number | null;
  time_to_peak_minutes: number | null;
  engagement_trajectory: EngagementTrajectory | null;

  // Content features
  content_features: ContentFeatures | null;

  created_at: string;
}

export interface BrainTweetSnapshot {
  id?: string;
  tweet_id: string;
  views: number | null;
  likes: number | null;
  retweets: number | null;
  replies: number | null;
  bookmarks: number | null;
  quotes: number | null;
  scraped_at: string;
}

export interface BrainAccount {
  id?: string;
  username: string;
  display_name: string | null;
  followers_count: number | null;
  following_count: number | null;
  bio_text: string | null;
  verified: boolean;
  account_age_days: number | null;

  // Tier
  tier: AccountTier;
  tier_score: number;
  tier_updated_at: string;

  // Domain
  primary_domain: Domain | null;
  domain_confidence: number | null;

  // Rolling performance
  avg_views_30d: number | null;
  avg_likes_30d: number | null;
  avg_engagement_rate_30d: number | null;
  viral_rate_30d: number | null;
  hit_rate_30d: number | null;
  tweet_frequency_daily: number | null;
  ff_ratio: number | null;

  // Discovery
  discovery_method: AccountDiscoveryMethod;
  discovered_from_username: string | null;
  discovered_at: string;

  // Scraping
  is_active: boolean;
  last_scraped_at: string | null;
  scrape_priority: number;
  scrape_success_count: number;
  scrape_failure_count: number;
  tweets_collected_count: number;
  consecutive_failures: number;

  created_at: string;
  updated_at: string;
}

export interface BrainKeyword {
  id?: string;
  keyword: string;
  source: KeywordSource;
  source_detail: string | null;
  domain_hint: string | null;

  // Performance
  tweets_found_total: number;
  tweets_found_last_run: number;
  avg_engagement_found: number | null;
  viral_tweets_found: number;
  unique_authors_found: number;

  // Scheduling
  priority: number;
  last_searched_at: string | null;
  search_count: number;
  staleness_score: number;

  // Status
  is_active: boolean;
  deactivated_reason: string | null;
  deactivated_at: string | null;

  created_at: string;
  updated_at: string;
}

export interface BrainClassification {
  id?: string;
  tweet_id: string;

  // Stage 2
  domain: Domain | null;
  domain_confidence: number | null;
  hook_type: HookType | null;
  tone: Tone | null;
  format: ContentFormat | null;
  emotional_trigger: EmotionalTrigger | null;
  specificity: Specificity | null;
  actionability: Actionability | null;
  identity_signal: IdentitySignal | null;
  controversy_level: number | null;
  novelty_level: number | null;

  // Stage 4
  reply_tree_depth: number | null;
  top_reply_count: number | null;
  amplifier_accounts: AmplifierAccount[] | null;
  quote_sentiment_distribution: SentimentDistribution | null;
  algo_boost_detected: boolean | null;
  conversation_quality: string | null;

  // Metadata
  classification_stage: number;
  classified_at: string;
  classification_model: string;
  classification_cost_cents: number | null;
}

export interface SelfModelState {
  id: 1;

  // Current state
  follower_count: number;
  following_count: number;
  growth_phase: GrowthPhase;

  // Rolling 7d
  avg_views_7d: number | null;
  avg_likes_7d: number | null;
  avg_engagement_rate_7d: number | null;
  total_posts_7d: number;
  total_replies_7d: number;

  // Rolling 30d
  avg_views_30d: number | null;
  avg_likes_30d: number | null;
  avg_engagement_rate_30d: number | null;
  total_posts_30d: number;
  total_replies_30d: number;

  // Best patterns
  best_formats: PatternPerformance[];
  best_topics: PatternPerformance[];
  best_hooks: PatternPerformance[];
  best_posting_hours: PatternPerformance[];
  best_archetypes: PatternPerformance[];
  worst_formats: PatternPerformance[];
  worst_topics: PatternPerformance[];

  // Expectations
  expected_views_per_post: number | null;
  expected_likes_per_post: number | null;
  expected_views_per_reply: number | null;
  expected_likes_per_reply: number | null;
  expected_engagement_rate: number | null;

  // Growth velocity
  followers_gained_7d: number;
  followers_gained_30d: number;
  growth_rate_daily: number | null;
  growth_acceleration: number | null;

  // Strategy health
  working_strategies: StrategyHealth[];
  decaying_strategies: StrategyHealth[];
  untested_strategies: StrategyHealth[];

  updated_at: string;
}

export interface FeedbackEvent {
  id?: string;
  decision_id: string | null;
  tweet_id: string | null;
  action_type: string;

  // Expected
  expected_views: number | null;
  expected_likes: number | null;
  expected_engagement_rate: number | null;

  // Actual
  actual_views: number | null;
  actual_likes: number | null;
  actual_engagement_rate: number | null;
  actual_followers_gained: number | null;

  // Delta
  views_delta: number | null;
  likes_delta: number | null;
  engagement_delta: number | null;

  // Diagnosis
  outcome_class: OutcomeClass | null;
  failure_diagnosis: FailureDiagnosis | null;
  diagnosis_confidence: number | null;
  diagnosis_details: Record<string, any> | null;

  // Context
  content_features: Record<string, any> | null;
  classification: Record<string, any> | null;
  target_username: string | null;
  target_tier: string | null;
  posted_hour_utc: number | null;
  posted_day_of_week: number | null;
  growth_phase: GrowthPhase | null;
  follower_count_at_post: number | null;

  measured_at: string | null;
  created_at: string;
}

// =============================================================================
// Supporting Types
// =============================================================================

export interface ContentFeatures {
  char_count: number;
  word_count: number;
  sentence_count: number;
  line_count: number;
  line_break_count: number;
  char_utilization_pct: number;
  has_numbers: boolean;
  number_count: number;
  has_question: boolean;
  question_count: number;
  has_exclamation: boolean;
  opening_pattern: string;
  opening_word: string;
  closing_pattern: string;
  has_emoji: boolean;
  emoji_count: number;
  has_url: boolean;
  has_mention: boolean;
  mention_count: number;
  has_hashtag: boolean;
  hashtag_count: number;
  has_list: boolean;
  has_bullet_points: boolean;
  avg_word_length: number;
  readability: 'simple' | 'moderate' | 'technical';
  starts_with_number: boolean;
  starts_with_question: boolean;
  starts_with_bold_claim: boolean;
  contains_mechanism: boolean;
  contains_specific_data: boolean;
}

export interface PatternPerformance {
  name: string;
  avg_views: number;
  avg_likes: number;
  avg_engagement_rate: number;
  sample_size: number;
  last_used: string | null;
}

export interface StrategyHealth {
  strategy: string;
  dimension: string;
  effectiveness_7d: number;
  effectiveness_30d: number;
  sample_size: number;
  trend: 'improving' | 'stable' | 'declining';
  started_at: string;
  last_confirmed: string;
}

export interface AmplifierAccount {
  username: string;
  followers: number;
  engagement_type: 'like' | 'retweet' | 'quote' | 'reply';
}

export interface SentimentDistribution {
  positive: number;
  negative: number;
  neutral: number;
}

// =============================================================================
// Query Result Types (used by brainQuery.ts)
// =============================================================================

export interface PhasePattern {
  dimension: string;
  value: string;
  avg_engagement_rate: number;
  avg_views: number;
  avg_likes: number;
  sample_size: number;
  account_tier: AccountTier;
  confidence: 'high' | 'medium' | 'low';
}

export interface TimingWindow {
  hour_utc: number;
  day_of_week: number | null;
  avg_engagement_rate: number;
  avg_views: number;
  sample_size: number;
  account_tier: AccountTier;
}

export interface TrendingTopic {
  keyword: string;
  tweet_count: number;
  avg_engagement: number;
  avg_views: number;
  top_tweet_ids: string[];
  first_seen_at: string;
}

export interface ContentGap {
  dimension: string;
  value: string;
  external_performance: number;
  our_attempts: number;
  potential_lift: number;
  confidence: 'high' | 'medium' | 'low';
}

export interface StrategyHealthSummary {
  working: StrategyHealth[];
  decaying: StrategyHealth[];
  untested: string[];
  overall_health: 'healthy' | 'stagnating' | 'declining';
}

// =============================================================================
// Helper: Growth phase thresholds
// =============================================================================

export const GROWTH_PHASE_THRESHOLDS: Record<GrowthPhase, { min: number; max: number }> = {
  cold_start: { min: 0, max: 499 },
  early_traction: { min: 500, max: 1999 },
  growth: { min: 2000, max: 9999 },
  authority: { min: 10000, max: 49999 },
  scale: { min: 50000, max: Infinity },
};

export function getGrowthPhase(followerCount: number): GrowthPhase {
  if (followerCount < 500) return 'cold_start';
  if (followerCount < 2000) return 'early_traction';
  if (followerCount < 10000) return 'growth';
  if (followerCount < 50000) return 'authority';
  return 'scale';
}

// =============================================================================
// Helper: Compute engagement ratios from raw metrics
// =============================================================================

export function computeRatios(tweet: {
  views: number;
  likes: number;
  retweets: number;
  replies: number;
  bookmarks: number;
  quotes: number;
  author_followers: number | null;
}): {
  view_to_follower_ratio: number | null;
  like_to_view_ratio: number | null;
  bookmark_to_like_ratio: number | null;
  reply_to_like_ratio: number | null;
  retweet_to_like_ratio: number | null;
  quote_to_retweet_ratio: number | null;
  engagement_rate: number | null;
  viral_multiplier: number | null;
} {
  const { views, likes, retweets, replies, bookmarks, quotes, author_followers } = tweet;

  const totalEngagement = likes + retweets + replies + bookmarks + quotes;

  return {
    view_to_follower_ratio: author_followers && author_followers > 0
      ? views / author_followers : null,
    like_to_view_ratio: views > 0 ? likes / views : null,
    bookmark_to_like_ratio: likes > 0 ? bookmarks / likes : null,
    reply_to_like_ratio: likes > 0 ? replies / likes : null,
    retweet_to_like_ratio: likes > 0 ? retweets / likes : null,
    quote_to_retweet_ratio: retweets > 0 ? quotes / retweets : null,
    engagement_rate: views > 0 ? totalEngagement / views : null,
    viral_multiplier: author_followers && author_followers > 0
      ? views / author_followers : null,
  };
}

// =============================================================================
// Growth Observatory Types
// =============================================================================

export type GrowthStatus = 'unknown' | 'boring' | 'interesting' | 'hot' | 'explosive';

export type AccountType =
  | 'content_creator'
  | 'follow_farmer'
  | 'celebrity'
  | 'brand'
  | 'bot'
  | 'dormant'
  | 'viewer';

export type RetrospectiveStatus = 'pending' | 'analyzed' | 'insufficient_data' | 'skipped';

export type StrategyVerdict = 'in_progress' | 'working' | 'failed' | 'inconclusive';

export type ShelfStatus = 'active' | 'shelved' | 'revisiting';

export interface BrainAccountSnapshot {
  id?: string;
  username: string;
  followers_count: number | null;
  following_count: number | null;
  bio_text: string | null;
  checked_at: string;
}

export interface BrainGrowthEvent {
  id?: string;
  username: string;
  detected_at: string;
  growth_rate_before: number | null;
  growth_rate_after: number | null;
  acceleration_factor: number | null;
  trigger_type: string;
  growth_phase_at_detection: string | null;
  followers_at_detection: number | null;
  retrospective_status: RetrospectiveStatus;
  retrospective_id: string | null;
}

export interface BrainAccountProfile {
  id?: string;
  username: string;
  account_type: AccountType | null;
  niche: string | null;
  sub_niches: string[];
  voice_style: string | null;
  posting_frequency_daily: number | null;
  reply_ratio: number | null;
  avg_reply_target_size: number | null;
  active_hours: Record<string, number> | null;
  content_style_summary: string | null;
  ff_ratio: number | null;
  profile_confidence: number | null;
  profiled_at: string;
  profile_version: number;
}

export interface BrainRetrospectiveAnalysis {
  id?: string;
  username: string;
  growth_event_id: string | null;
  period_before_start: string | null;
  period_before_end: string | null;
  period_during_start: string | null;
  period_during_end: string | null;
  before_stats: Record<string, any> | null;
  during_stats: Record<string, any> | null;
  key_changes: Record<string, any>[] | null;
  external_correlations: Record<string, any> | null;
  analysis_summary: string | null;
  analysis_model: string;
  analyzed_at: string;
}

export interface BrainStrategyLibraryEntry {
  id?: string;
  stage: GrowthPhase;
  strategy_name: string;
  strategy_category: string | null;
  win_rate: number | null;
  sample_size: number;
  winning_patterns: Record<string, any>;
  losing_patterns: Record<string, any>;
  key_differentiators: Record<string, any>;
  avg_growth_rate: number | null;
  median_days_to_next_stage: number | null;
  confidence: 'high' | 'medium' | 'low';
  updated_at: string;
}

export interface BrainStrategyMemoryEntry {
  id?: string;
  strategy_name: string;
  test_number: number;
  test_period_start: string | null;
  test_period_end: string | null;
  our_results: Record<string, any> | null;
  benchmark: Record<string, any> | null;
  diagnosis: string | null;
  verdict: StrategyVerdict;
  next_action: string | null;
  shelf_status: ShelfStatus;
  revisit_at: string | null;
  shelved_reason: string | null;
  created_at: string;
  updated_at: string;
}

export interface BrainDailyContext {
  id?: string;
  context_date: string;
  trending_topics: string[];
  major_events: string[];
  notes: string | null;
}

// Growth thresholds by account size (% per week)
export const GROWTH_THRESHOLDS: Record<string, { boring: number; interesting: number; hot: number; explosive: number }> = {
  tiny:   { boring: 2, interesting: 10, hot: 30, explosive: 50 },   // 0-500
  small:  { boring: 1, interesting: 5,  hot: 15, explosive: 30 },   // 500-5K
  medium: { boring: 0.5, interesting: 3, hot: 10, explosive: 15 },  // 5K-50K
  large:  { boring: 0.2, interesting: 1, hot: 5,  explosive: 10 },  // 50K+
};

export function getAccountSizeBucket(followers: number): string {
  if (followers < 500) return 'tiny';
  if (followers < 5000) return 'small';
  if (followers < 50000) return 'medium';
  return 'large';
}

// =============================================================================
// Follower Range — fine-grained bucketing for growth attribution
// Distinct from getAccountSizeBucket (4 coarse buckets for growth thresholds)
// and from GrowthPhase (which tracks OUR account's phase, not external accounts)
// =============================================================================

export type FollowerRange =
  | 'nano'        // 0 – 500
  | 'micro'       // 500 – 2,000
  | 'small'       // 2,000 – 10,000
  | 'mid'         // 10,000 – 50,000
  | 'large'       // 50,000 – 200,000
  | 'mega'        // 200,000 – 1,000,000
  | 'celebrity';  // 1,000,000+

export const FOLLOWER_RANGE_BOUNDS: Record<FollowerRange, { min: number; max: number }> = {
  nano:      { min: 0,         max: 500 },
  micro:     { min: 500,       max: 2_000 },
  small:     { min: 2_000,     max: 10_000 },
  mid:       { min: 10_000,    max: 50_000 },
  large:     { min: 50_000,    max: 200_000 },
  mega:      { min: 200_000,   max: 1_000_000 },
  celebrity: { min: 1_000_000, max: Infinity },
};

export const FOLLOWER_RANGE_ORDER: FollowerRange[] = [
  'nano', 'micro', 'small', 'mid', 'large', 'mega', 'celebrity',
];

export function getFollowerRange(followers: number): FollowerRange {
  if (followers < 500) return 'nano';
  if (followers < 2_000) return 'micro';
  if (followers < 10_000) return 'small';
  if (followers < 50_000) return 'mid';
  if (followers < 200_000) return 'large';
  if (followers < 1_000_000) return 'mega';
  return 'celebrity';
}

export interface RangeStrategy {
  id?: string;
  follower_range: FollowerRange;
  niche: string | null;
  strategy_name: string;
  strategy_category: string | null;
  sample_size: number;
  winning_patterns: Record<string, unknown>;
  losing_patterns: Record<string, unknown>;
  key_differentiators: Record<string, unknown>;
  avg_growth_rate: number | null;
  median_days_in_range: number | null;
  confidence: string;
}

export interface RangeTransition {
  id?: string;
  from_range: FollowerRange;
  to_range: FollowerRange;
  niche: string | null;
  sample_size: number;
  avg_days_to_transition: number | null;
  common_strategies: Record<string, unknown>;
  content_patterns: Record<string, unknown>;
  engagement_patterns: Record<string, unknown>;
  timing_patterns: Record<string, unknown>;
}
