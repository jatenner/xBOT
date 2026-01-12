/**
 * 📊 CANDIDATE FEATURE LOGGER
 * 
 * Logs candidate scoring features for learning and analysis
 */

import { getSupabaseClient } from '../../db';
import { CandidateScore } from './candidateScorer';

export interface CandidateFeatures {
  candidate_tweet_id: string;
  feed_run_id?: string;
  candidate_score: number;
  topic_relevance_score: number;
  spam_score: number;
  velocity_score: number;
  recency_score: number;
  author_signal_score: number;
  author_follower_count?: number;
  author_verified?: boolean;
  current_likes: number;
  current_replies: number;
  current_retweets: number;
  age_minutes: number;
  predicted_24h_views: number;
  predicted_tier: number;
  features_json?: Record<string, any>;
}

/**
 * Log candidate features to database
 */
export async function logCandidateFeatures(
  features: CandidateFeatures
): Promise<void> {
  try {
    const supabase = getSupabaseClient();
    
    const { error } = await supabase
      .from('reply_candidate_features')
      .insert({
        candidate_tweet_id: features.candidate_tweet_id,
        feed_run_id: features.feed_run_id || null,
        candidate_score: features.candidate_score,
        topic_relevance_score: features.topic_relevance_score,
        spam_score: features.spam_score,
        velocity_score: features.velocity_score,
        recency_score: features.recency_score,
        author_signal_score: features.author_signal_score,
        author_follower_count: features.author_follower_count || null,
        author_verified: features.author_verified || false,
        current_likes: features.current_likes,
        current_replies: features.current_replies,
        current_retweets: features.current_retweets,
        age_minutes: features.age_minutes,
        predicted_24h_views: features.predicted_24h_views,
        predicted_tier: features.predicted_tier,
        features_json: features.features_json || null,
      });
    
    if (error) {
      console.warn(`[CANDIDATE_LOGGER] ⚠️ Failed to log features: ${error.message}`);
    } else {
      console.log(`[CANDIDATE_LOGGER] ✅ Logged features for ${features.candidate_tweet_id} (score=${features.candidate_score.toFixed(2)})`);
    }
  } catch (error: any) {
    console.warn(`[CANDIDATE_LOGGER] ⚠️ Error logging features: ${error.message}`);
  }
}
