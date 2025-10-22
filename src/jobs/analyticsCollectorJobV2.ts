/**
 * 📊 ANALYTICS COLLECTOR JOB V2
 * 
 * Collects real Twitter/X engagement metrics in two passes:
 * - Pass 1: T+1h after posting (early engagement signals)
 * - Pass 2: T+24h after posting (final metrics with follower attribution)
 * 
 * Growth-Focused Metrics:
 * - follows: New followers attributed to this post
 * - profile_visits: How many users clicked through to profile
 * - link_clicks: External link engagement
 * - Standard metrics: impressions, likes, retweets, replies, bookmarks
 */

import { getSupabaseClient } from '../db';
import { isRealMetricsAllowed } from '../config/envFlags';

interface PostedDecisionForCollection {
  id: number;
  decision_id: string;
  tweet_id: string;
  posted_at: string;
  decision_type: string;
  bandit_arm?: string;
}

interface TweetMetrics {
  impressions: number;
  likes: number;
  retweets: number;
  replies: number;
  bookmarks: number;
  quotes: number;
  profile_visits: number;
  link_clicks: number;
  follows: number; // NEW: followers gained (attributed via timing analysis)
}

export async function analyticsCollectorJobV2(): Promise<void> {
  console.log('[ANALYTICS_COLLECTOR] 📊 Starting real analytics collection (V2)...');

  const analyticsCheck = isRealMetricsAllowed();
  if (!analyticsCheck.allowed) {
    console.log(`[ANALYTICS_COLLECTOR] ⏭️ Skipping: ${analyticsCheck.reason}`);
    return;
  }

  try {
    const supabase = getSupabaseClient();

    // === PASS 1: T+1h Collection (Early Signals) ===
    await collectPass1(supabase);

    // === PASS 2: T+24h Collection (Final Metrics + Follower Attribution) ===
    await collectPass2(supabase);

    console.log('[ANALYTICS_COLLECTOR] ✅ Real analytics collection completed');
  } catch (error: any) {
    console.error('[ANALYTICS_COLLECTOR] ❌ Analytics collection failed:', error.message);
  }
}

/**
 * PASS 1: Collect early engagement metrics (T+1h after posting)
 */
async function collectPass1(supabase: any): Promise<void> {
  const now = new Date();
  const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
  const twoHoursAgo = new Date(now.getTime() - 2 * 60 * 60 * 1000);

  // Find posts between T+1h and T+2h that need pass 1 collection
  const { data: decisions, error } = await supabase
    .from('posted_decisions')
    .select('id, decision_id, tweet_id, posted_at, decision_type, bandit_arm')
    .not('tweet_id', 'is', null)
    .gte('posted_at', twoHoursAgo.toISOString())
    .lte('posted_at', oneHourAgo.toISOString())
    .order('posted_at', { ascending: false });

  if (error) throw error;
  if (!decisions || decisions.length === 0) {
    console.log('[ANALYTICS_COLLECTOR] ℹ️ No posts ready for Pass 1 (T+1h)');
    return;
  }

  console.log(`[ANALYTICS_COLLECTOR] 🔍 Found ${decisions.length} posts for Pass 1 (T+1h)`);

  for (const decision of decisions as PostedDecisionForCollection[]) {
    try {
      // Check if pass 1 already collected
      const { data: existing } = await supabase
        .from('outcomes')
        .select('id, collected_pass')
        .eq('decision_id', decision.decision_id)
        .single();

      if (existing && existing.collected_pass >= 1) {
        continue; // Already collected pass 1
      }

      // Collect metrics from Twitter/X
      const metrics = await fetchTwitterMetrics(decision.tweet_id, 1);
      if (!metrics) {
        console.warn(`[ANALYTICS_COLLECTOR] ⚠️ Could not fetch metrics for tweet_id=${decision.tweet_id}`);
        continue;
      }

      // Compute derived metrics
      const er = (metrics.likes + metrics.retweets + metrics.replies) / Math.max(1, metrics.impressions);
      const fpki = (1000 * metrics.follows) / Math.max(1, metrics.impressions);
      const retweet_rate = metrics.retweets / Math.max(1, metrics.impressions);
      const reply_rate = metrics.replies / Math.max(1, metrics.impressions);

      // Compute composite reward (growth-focused)
      const reward_composite = computeCompositeReward({
        fpki,
        retweet_rate,
        reply_rate,
        novelty: 0.5, // Will be populated from content_metadata features
        dup_penalty: 0,
        impressions: metrics.impressions
      });

      // UPSERT outcome
      const { error: upsertError } = await supabase
        .from('outcomes')
        .upsert({
          decision_id: decision.decision_id,
          tweet_id: decision.tweet_id,
          impressions: metrics.impressions,
          likes: metrics.likes,
          retweets: metrics.retweets,
          replies: metrics.replies,
          bookmarks: metrics.bookmarks,
          quotes: metrics.quotes,
          profile_visits: metrics.profile_visits,
          link_clicks: metrics.link_clicks,
          follows: metrics.follows,
          er_calculated: er,
          reward_composite: reward_composite,
          simulated: false,
          collected_pass: 1,
          collected_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'decision_id'
        });

      if (upsertError) throw upsertError;

      console.log(
        `[ANALYTICS_COLLECTOR] ✅ Pass 1 stored: decision_id=${decision.decision_id} ` +
        `ER=${(er * 100).toFixed(2)}% FPKI=${fpki.toFixed(2)} follows=${metrics.follows}`
      );
    } catch (innerError: any) {
      console.error(
        `[ANALYTICS_COLLECTOR] ❌ Pass 1 failed for tweet_id=${decision.tweet_id}: ${innerError.message}`
      );
    }
  }
}

/**
 * PASS 2: Collect final metrics (T+24h after posting) with follower attribution
 */
async function collectPass2(supabase: any): Promise<void> {
  const now = new Date();
  const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const twentyFiveHoursAgo = new Date(now.getTime() - 25 * 60 * 60 * 1000);

  // Find posts between T+24h and T+25h that need pass 2 collection
  const { data: decisions, error } = await supabase
    .from('posted_decisions')
    .select('id, decision_id, tweet_id, posted_at, decision_type, bandit_arm')
    .not('tweet_id', 'is', null)
    .gte('posted_at', twentyFiveHoursAgo.toISOString())
    .lte('posted_at', twentyFourHoursAgo.toISOString())
    .order('posted_at', { ascending: false });

  if (error) throw error;
  if (!decisions || decisions.length === 0) {
    console.log('[ANALYTICS_COLLECTOR] ℹ️ No posts ready for Pass 2 (T+24h)');
    return;
  }

  console.log(`[ANALYTICS_COLLECTOR] 🔍 Found ${decisions.length} posts for Pass 2 (T+24h)`);

  for (const decision of decisions as PostedDecisionForCollection[]) {
    try {
      // Collect final metrics from Twitter/X
      const metrics = await fetchTwitterMetrics(decision.tweet_id, 2);
      if (!metrics) {
        console.warn(`[ANALYTICS_COLLECTOR] ⚠️ Could not fetch metrics for tweet_id=${decision.tweet_id}`);
        continue;
      }

      // Compute derived metrics
      const er = (metrics.likes + metrics.retweets + metrics.replies) / Math.max(1, metrics.impressions);
      const fpki = (1000 * metrics.follows) / Math.max(1, metrics.impressions);
      const retweet_rate = metrics.retweets / Math.max(1, metrics.impressions);
      const reply_rate = metrics.replies / Math.max(1, metrics.impressions);

      // Compute composite reward (growth-focused)
      const reward_composite = computeCompositeReward({
        fpki,
        retweet_rate,
        reply_rate,
        novelty: 0.5, // TODO: fetch from content_metadata.novelty
        dup_penalty: 0,
        impressions: metrics.impressions
      });

      // UPSERT outcome with pass 2 data
      const { error: upsertError } = await supabase
        .from('outcomes')
        .upsert({
          decision_id: decision.decision_id,
          tweet_id: decision.tweet_id,
          impressions: metrics.impressions,
          likes: metrics.likes,
          retweets: metrics.retweets,
          replies: metrics.replies,
          bookmarks: metrics.bookmarks,
          quotes: metrics.quotes,
          profile_visits: metrics.profile_visits,
          link_clicks: metrics.link_clicks,
          follows: metrics.follows,
          er_calculated: er,
          reward_composite: reward_composite,
          simulated: false,
          collected_pass: 2,
          collected_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'decision_id'
        });

      if (upsertError) throw upsertError;

      // 📊 INTELLIGENCE LAYER: Capture follower count AFTER (24h)
      try {
        const { followerAttributionService } = await import('../intelligence/followerAttributionService');
        await followerAttributionService.captureFollowerCountAfter(decision.tweet_id);
      } catch (attrError: any) {
        console.warn(`[ANALYTICS_COLLECTOR] ⚠️ Follower capture after failed: ${attrError.message}`);
      }

      // 🎣 INTELLIGENCE LAYER: Store hook performance
      try {
        const { hookAnalysisService } = await import('../intelligence/hookAnalysisService');
        const { data: outcome } = await supabase
          .from('outcomes')
          .select('*')
          .eq('tweet_id', decision.tweet_id)
          .single();
        
        if (outcome) {
          await hookAnalysisService.storeHookPerformance(outcome);
        }
      } catch (hookError: any) {
        console.warn(`[ANALYTICS_COLLECTOR] ⚠️ Hook performance storage failed: ${hookError.message}`);
      }

      // ⏰ INTELLIGENCE LAYER: Update time performance aggregates
      try {
        const { timeOptimizationService } = await import('../intelligence/timeOptimizationService');
        await timeOptimizationService.updateTimePerformance();
      } catch (timeError: any) {
        console.warn(`[ANALYTICS_COLLECTOR] ⚠️ Time performance update failed: ${timeError.message}`);
      }

      console.log(
        `[ANALYTICS_COLLECTOR] ✅ Pass 2 stored: decision_id=${decision.decision_id} ` +
        `ER=${(er * 100).toFixed(2)}% FPKI=${fpki.toFixed(2)} follows=${metrics.follows} (final)`
      );
    } catch (innerError: any) {
      console.error(
        `[ANALYTICS_COLLECTOR] ❌ Pass 2 failed for tweet_id=${decision.tweet_id}: ${innerError.message}`
      );
    }
  }
}

/**
 * Fetch Twitter/X metrics via Playwright scraping
 * 🔧 FIXED: Now uses UnifiedBrowserPool + ScrapingOrchestrator for real scraping
 */
async function fetchTwitterMetrics(tweetId: string, pass: number): Promise<TweetMetrics | null> {
  let page = null;
  let browserPool = null;

  try {
    console.log(`[ANALYTICS_COLLECTOR] 🔍 Scraping tweet ${tweetId} (pass ${pass})...`);
    
    // Get browser pool instance (manages browsers with session)
    const { UnifiedBrowserPool } = await import('../browser/UnifiedBrowserPool');
    browserPool = UnifiedBrowserPool.getInstance();
    
    // Acquire a page with loaded Twitter session
    page = await browserPool.acquirePage(`analytics_pass_${pass}`);
    console.log(`[ANALYTICS_COLLECTOR] ✅ Browser acquired with session`);
    
    // Use the proven scraping orchestrator
    const { ScrapingOrchestrator } = await import('../metrics/scrapingOrchestrator');
    const orchestrator = ScrapingOrchestrator.getInstance();
    
    // Scrape and validate metrics
    const result = await orchestrator.scrapeAndStore(
      page,
      tweetId,
      {
        collectionPhase: pass === 1 ? 'T+1h' : 'T+24h',
        postedAt: new Date() // Will be updated if we have the actual posted_at
      }
    );
    
    if (!result.success || !result.metrics) {
      console.warn(`[ANALYTICS_COLLECTOR] ⚠️ Scraping failed for tweet ${tweetId}: ${result.error || 'Unknown error'}`);
      return null;
    }
    
    console.log(
      `[ANALYTICS_COLLECTOR] ✅ Scraped: ${result.metrics.likes}❤️ ${result.metrics.retweets}🔄 ` +
      `${result.metrics.replies}💬 ${result.metrics.views || 0}👁️`
    );
    
    // Convert to expected format
    return {
      impressions: result.metrics.views || 0,
      likes: result.metrics.likes || 0,
      retweets: result.metrics.retweets || 0,
      replies: result.metrics.replies || 0,
      bookmarks: result.metrics.bookmarks || 0,
      quotes: result.metrics.quote_tweets || 0,
      profile_visits: result.metrics.profile_clicks || 0,
      link_clicks: 0, // Not available from basic scraping
      follows: 0 // Will be calculated separately via follower attribution
    };
    
  } catch (error: any) {
    console.error(`[ANALYTICS_COLLECTOR] ❌ Failed to fetch Twitter metrics: ${error.message}`);
    console.error(`[ANALYTICS_COLLECTOR] Stack: ${error.stack}`);
    return null;
  } finally {
    // Release the browser page back to the pool
    if (page && browserPool) {
      try {
        await browserPool.releasePage(page);
        console.log(`[ANALYTICS_COLLECTOR] 🔄 Browser released back to pool`);
      } catch (releaseError: any) {
        console.warn(`[ANALYTICS_COLLECTOR] ⚠️ Failed to release page: ${releaseError.message}`);
      }
    }
  }
}

/**
 * Compute growth-focused composite reward
 * 
 * Formula:
 * reward = 0.5*fpki + 0.3*retweet_rate + 0.15*reply_rate + 0.05*novelty - 0.1*dup_penalty
 * 
 * Exposure weighting: multiply by min(1, 1000 / max(1, impressions))
 * to prevent high-reach posts from dominating
 */
function computeCompositeReward(params: {
  fpki: number;
  retweet_rate: number;
  reply_rate: number;
  novelty: number;
  dup_penalty: number;
  impressions: number;
}): number {
  const baseReward =
    0.5 * params.fpki +
    0.3 * params.retweet_rate +
    0.15 * params.reply_rate +
    0.05 * params.novelty -
    0.1 * params.dup_penalty;

  // Exposure weighting to prevent large-reach dominance
  const exposureWeight = Math.min(1, 1000 / Math.max(1, params.impressions));

  return baseReward * exposureWeight;
}

// Export for use in learning job
export { computeCompositeReward };
