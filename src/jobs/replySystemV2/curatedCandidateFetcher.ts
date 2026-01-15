/**
 * 🎯 CURATED CANDIDATE FETCHER
 * 
 * Fetches candidates from whitelisted accounts only (curated mode)
 * Filters by: author handle, recency (6h), root-only
 */

import { getSupabaseClient } from '../../db/index';

const REPLY_TARGET_MODE = process.env.REPLY_TARGET_MODE || 'curated';
const CURATED_HANDLES_STR = process.env.REPLY_CURATED_HANDLES || '';
const CURATED_HANDLES = CURATED_HANDLES_STR
  .split(',')
  .map(h => h.trim().toLowerCase().replace('@', ''))
  .filter(Boolean);

const MAX_AGE_HOURS = 6;
const MAX_AGE_MS = MAX_AGE_HOURS * 60 * 60 * 1000;

/**
 * Check if curated mode is enabled
 */
export function isCuratedMode(): boolean {
  return REPLY_TARGET_MODE === 'curated';
}

/**
 * Get curated handles whitelist
 */
export function getCuratedHandles(): string[] {
  return CURATED_HANDLES;
}

/**
 * Fetch curated candidates and persist to reply_candidate_queue
 */
export async function fetchCuratedCandidates(): Promise<{
  fetched: number;
  queued: number;
  errors: string[];
}> {
  if (!isCuratedMode()) {
    return { fetched: 0, queued: 0, errors: ['Curated mode not enabled'] };
  }

  if (CURATED_HANDLES.length === 0) {
    return { fetched: 0, queued: 0, errors: ['No curated handles configured'] };
  }

  const supabase = getSupabaseClient();
  const errors: string[] = [];
  let fetched = 0;
  let queued = 0;

  const cutoffTime = new Date(Date.now() - MAX_AGE_MS).toISOString();

  console.log(`[CURATED_FETCHER] 🎯 Fetching candidates from ${CURATED_HANDLES.length} curated handles (last ${MAX_AGE_HOURS}h)`);

  // Try X API first if available (fallback to feed pipeline)
  try {
    // Check if X API client exists
    let xApi: any = null;
    try {
      const { XApiClient } = await import('../../posting/xApiClient');
      xApi = new XApiClient();
    } catch (importError) {
      // X API client not available, skip
      throw new Error('X API client not available');
    }
    
    for (const handle of CURATED_HANDLES) {
      try {
        // Fetch user's recent tweets via X API
        const tweets = await xApi.getUserTweets(handle, { maxResults: 25 });
        
        for (const tweet of tweets) {
          // Filter: root only, within time window
          if (tweet.in_reply_to_status_id || tweet.in_reply_to_user_id) {
            continue; // Skip replies
          }

          const tweetTime = new Date(tweet.created_at);
          if (tweetTime.getTime() < Date.now() - MAX_AGE_MS) {
            continue; // Too old
          }

          fetched++;

          // Persist to reply_candidate_queue (author_handle stored in metadata)
          // Required fields: overall_score, predicted_tier, source_type
          const { error: insertError } = await supabase
            .from('reply_candidate_queue')
            .insert({
              candidate_tweet_id: tweet.id,
              overall_score: 75.0, // Default score for curated candidates
              predicted_tier: 2, // Default tier 2 (>=1000 views)
              source_type: 'curated',
              created_at: tweet.created_at,
              status: 'queued',
              expires_at: new Date(Date.now() + 60 * 60 * 1000).toISOString(), // 1h TTL
              metadata: {
                source: 'curated_x_api',
                author_handle: handle,
                tweet_text_preview: tweet.text?.substring(0, 100),
              },
            })
            .select();

          if (insertError) {
            // May be duplicate, that's OK
            if (!insertError.message.includes('duplicate') && !insertError.message.includes('unique')) {
              errors.push(`Insert error for ${tweet.id}: ${insertError.message}`);
            }
          } else {
            queued++;
          }
        }
      } catch (handleError: any) {
        errors.push(`Error fetching ${handle}: ${handleError.message}`);
      }
    }
  } catch (xApiError: any) {
    console.log(`[CURATED_FETCHER] ⚠️ X API not available, falling back to feed pipeline: ${xApiError.message}`);
    // Fall through to feed pipeline
  }

  // Fallback: Use existing feed pipeline but filter by author
  if (fetched === 0) {
    console.log(`[CURATED_FETCHER] 🔄 Using feed pipeline fallback...`);
    
    // Query reply_opportunities filtered by author handles (use target_username)
    const { data: opportunities, error: oppError } = await supabase
      .from('reply_opportunities')
      .select('target_tweet_id, target_username, tweet_posted_at, target_in_reply_to_tweet_id')
      .in('target_username', CURATED_HANDLES)
      .gte('tweet_posted_at', cutoffTime)
      .is('target_in_reply_to_tweet_id', null) // Root only
      .eq('is_root_tweet', true)
      .eq('replied_to', false)
      .order('tweet_posted_at', { ascending: false })
      .limit(100);

    if (oppError) {
      errors.push(`Feed pipeline error: ${oppError.message}`);
    } else if (opportunities) {
      for (const opp of opportunities) {
        fetched++;

        const { error: insertError } = await supabase
          .from('reply_candidate_queue')
          .insert({
            candidate_tweet_id: opp.target_tweet_id,
            overall_score: 75.0, // Default score for curated candidates
            predicted_tier: 2, // Default tier 2
            source_type: 'curated',
            created_at: opp.tweet_posted_at,
            status: 'queued',
            expires_at: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
            metadata: {
              source: 'curated_feed_pipeline',
              author_handle: opp.target_username,
            },
          })
          .select();

        if (insertError) {
          if (!insertError.message.includes('duplicate') && !insertError.message.includes('unique')) {
            errors.push(`Insert error for ${opp.tweet_id}: ${insertError.message}`);
          }
        } else {
          queued++;
        }
      }
    }
  }

  console.log(`[CURATED_FETCHER] ✅ Fetched ${fetched} candidates, queued ${queued} new entries`);
  if (errors.length > 0) {
    console.log(`[CURATED_FETCHER] ⚠️ ${errors.length} errors: ${errors.slice(0, 3).join(', ')}`);
  }

  return { fetched, queued, errors };
}
