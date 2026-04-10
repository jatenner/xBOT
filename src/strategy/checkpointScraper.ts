/**
 * CHECKPOINT SCRAPER
 *
 * Schedules and executes metrics scraping at specific time intervals after posting.
 * Instead of batch-scraping random posts, this ensures every post gets checked at:
 * 30min, 1h, 2h, 6h, 24h, 48h — capturing the full engagement curve.
 *
 * Called from the daemon tick loop every 10 ticks (~10 min).
 */

import { getSupabaseClient } from '../db';
import { updateOutcomes } from './growthLedgerWriter';

const CHECKPOINTS = [
  { name: '30min', offsetMinutes: 30 },
  { name: '1h', offsetMinutes: 60 },
  { name: '2h', offsetMinutes: 120 },
  { name: '6h', offsetMinutes: 360 },
  { name: '24h', offsetMinutes: 1440 },
  { name: '48h', offsetMinutes: 2880 },
];

/**
 * Schedule scrape checkpoints for a newly posted tweet.
 * Called immediately after a successful post.
 */
export async function scheduleCheckpoints(decisionId: string, tweetId: string, postedAt: Date): Promise<void> {
  try {
    const supabase = getSupabaseClient();
    const rows = CHECKPOINTS.map(cp => ({
      decision_id: decisionId,
      tweet_id: tweetId,
      checkpoint_name: cp.name,
      due_at: new Date(postedAt.getTime() + cp.offsetMinutes * 60 * 1000).toISOString(),
      status: 'pending',
    }));

    await supabase.from('scrape_checkpoints').insert(rows);
    console.log(`[CHECKPOINT] Scheduled ${rows.length} checkpoints for tweet ${tweetId}`);
  } catch (err: any) {
    console.warn(`[CHECKPOINT] Failed to schedule (non-fatal): ${err.message}`);
  }
}

/**
 * Process due checkpoints — scrape metrics for posts that have a checkpoint due NOW.
 * Called from daemon tick loop every ~10 minutes.
 *
 * Returns the number of checkpoints processed.
 */
export async function processDueCheckpoints(): Promise<number> {
  const supabase = getSupabaseClient();
  let processed = 0;

  try {
    // Find checkpoints that are due (due_at <= now, status = pending)
    const { data: dueCheckpoints } = await supabase
      .from('scrape_checkpoints')
      .select('id, decision_id, tweet_id, checkpoint_name, due_at')
      .eq('status', 'pending')
      .lte('due_at', new Date().toISOString())
      .order('due_at', { ascending: true })
      .limit(5); // Max 5 per cycle to avoid hogging browser

    if (!dueCheckpoints || dueCheckpoints.length === 0) {
      return 0;
    }

    console.log(`[CHECKPOINT] ${dueCheckpoints.length} checkpoint(s) due for scraping`);

    // Import scraping infrastructure
    const { ScrapingOrchestrator } = await import('../metrics/scrapingOrchestrator');
    const { UnifiedBrowserPool } = await import('../browser/UnifiedBrowserPool');

    const orchestrator = ScrapingOrchestrator.getInstance();
    const pool = UnifiedBrowserPool.getInstance();

    let page;
    try {
      page = await pool.acquirePage('checkpoint_scrape');
    } catch (err: any) {
      console.warn(`[CHECKPOINT] Browser unavailable, skipping: ${err.message}`);
      return 0;
    }

    try {
      for (const cp of dueCheckpoints) {
        try {
          const result = await orchestrator.scrapeAndStore(
            page,
            cp.tweet_id,
            { collectionPhase: `checkpoint_${cp.checkpoint_name}`, postedAt: new Date(cp.due_at) },
            { useAnalytics: false }
          );

          if (result.success && result.metrics) {
            const metrics = result.metrics as unknown as Record<string, unknown>;
            const views = Number(metrics.views) || 0;
            const likes = Number(metrics.likes) || 0;
            const replies = Number(metrics.replies) || 0;
            const retweets = Number(metrics.retweets) || 0;
            const engagementRate = views > 0 ? (likes + retweets + replies) / views : 0;

            // Update checkpoint record
            await supabase.from('scrape_checkpoints').update({
              status: 'completed',
              scraped_at: new Date().toISOString(),
              views, likes, replies, retweets,
              engagement_rate: engagementRate,
            }).eq('id', cp.id);

            // Update growth_ledger with latest outcomes
            await updateOutcomes(
              { decision_id: cp.decision_id },
              { views, likes, replies, retweets, engagement_rate: engagementRate }
            );

            processed++;
            console.log(`[CHECKPOINT] ✅ ${cp.checkpoint_name} for ${cp.tweet_id}: views=${views} likes=${likes}`);
          } else {
            // Mark as failed, will retry next cycle
            console.warn(`[CHECKPOINT] ⚠️ ${cp.checkpoint_name} scrape failed for ${cp.tweet_id}: ${result.error}`);
            // Don't mark as failed — leave as pending for retry (up to 3 retries handled by age)
            const cpAge = Date.now() - new Date(cp.due_at).getTime();
            if (cpAge > 2 * 60 * 60 * 1000) {
              // More than 2 hours overdue — mark as failed
              await supabase.from('scrape_checkpoints').update({
                status: 'failed',
                scraped_at: new Date().toISOString(),
              }).eq('id', cp.id);
            }
          }
        } catch (cpErr: any) {
          console.warn(`[CHECKPOINT] Error processing ${cp.checkpoint_name}: ${cpErr.message}`);
        }
      }
    } finally {
      await page.close();
    }
  } catch (err: any) {
    console.warn(`[CHECKPOINT] processDueCheckpoints failed (non-fatal): ${err.message}`);
  }

  return processed;
}
