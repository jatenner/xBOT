/**
 * OPS_PROOF runner - shared logic for CLI and HTTP endpoint.
 * Proves xBOT can: navigate, fetch candidates, post one, scrape metrics, write learning rows.
 */

export interface ProofResult {
  step: string;
  ok: boolean;
  message?: string;
  data?: unknown;
}

export interface OpsProofOptions {
  postOne?: boolean;
  skipFetch?: boolean;
}

export interface OpsProofOutcome {
  results: ProofResult[];
  exitCode: number;
}

async function scrapeMetricsForTweet(tweetId: string): Promise<{
  likes: number;
  retweets: number;
  replies: number;
  impressions: number;
}> {
  const { UnifiedBrowserPool } = await import('../browser/UnifiedBrowserPool');
  const pool = UnifiedBrowserPool.getInstance();
  const url = `https://x.com/i/status/${tweetId}`;

  const result = await pool.withContext(
    'ops_proof_metrics',
    async (ctx) => {
      const page = await ctx.newPage();
      try {
        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
        await page.waitForSelector('[data-testid="tweet"]', { timeout: 15000 }).catch(() => null);

        const metrics = await page.evaluate(() => {
          const extractNum = (t: string | null | undefined): number => {
            if (!t || !/\d/.test(t)) return 0;
            const m = t.match(/([\d,\.]+)([KM])?/);
            if (!m) return 0;
            let n = parseFloat(m[1].replace(/,/g, ''));
            if (m[2] === 'K') n *= 1000;
            if (m[2] === 'M') n *= 1000000;
            return Math.floor(n);
          };
          const sel = (arr: string[]) => {
            for (const s of arr) {
              const el = document.querySelector(s);
              if (el?.textContent) return extractNum(el.textContent);
            }
            return 0;
          };
          return {
            likes: sel(['[data-testid="like"] span', '[aria-label*="like"]']),
            retweets: sel(['[data-testid="retweet"] span', '[aria-label*="repost"]']),
            replies: sel(['[data-testid="reply"] span', '[aria-label*="repl"]']),
            impressions: sel(['[aria-label*="view"]', '[aria-label*="impression"]']),
          };
        });
        return metrics;
      } finally {
        await page.close();
      }
    },
    1
  );

  return (
    result ?? {
      likes: 0,
      retweets: 0,
      replies: 0,
      impressions: 0,
    }
  );
}

export async function runOpsProof(options: OpsProofOptions = {}): Promise<OpsProofOutcome> {
  const { postOne = process.env.POST_ONE === 'true', skipFetch = process.env.OPS_PROOF_FETCH === 'false' } = options;
  const results: ProofResult[] = [];
  let exitCode = 0;

  const mode = process.env.MODE || 'unset';
  const xActionsEnabled = process.env.X_ACTIONS_ENABLED === 'true';
  const shadowMode = process.env.SHADOW_MODE !== 'false';
  const dryRun = process.env.DRY_RUN === '1' || process.env.DRY_RUN === 'true';
  const postingEnabled = process.env.POSTING_ENABLED === 'true';

  const { isXActionsEnabled } = await import('../safety/actionGate');
  const effectiveXActions = isXActionsEnabled();

  results.push({
    step: 'mode_flags',
    ok: true,
    data: { mode, xActionsEnabled, shadowMode, dryRun, postingEnabled, effectiveXActions },
  });

  try {
    const { getSupabaseClient } = await import('../db');
    const { runNavHeartbeat } = await import('../rateController/hourlyTick');
    const supabase = getSupabaseClient();
    const heartbeatOk = await runNavHeartbeat(supabase);
    const reason = heartbeatOk ? 'SAFE_GOTO_OK' : 'SAFE_GOTO_FAIL';
    results.push({ step: 'nav_heartbeat', ok: heartbeatOk, message: reason });
    if (!heartbeatOk) exitCode = 1;
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    results.push({ step: 'nav_heartbeat', ok: false, message: msg });
    exitCode = 1;
  }

  try {
    const { getSupabaseClient } = await import('../db');
    const supabase = getSupabaseClient();
    const { count: queueCount, error: queueErr } = await supabase
      .from('reply_candidate_queue')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'queued')
      .gt('expires_at', new Date().toISOString());
    const queueTotal = queueErr ? -1 : (queueCount ?? 0);
    let fetchedCount = queueTotal;
    if (!skipFetch && !process.env.PROOF_MODE) {
      try {
        const { fetchCuratedCandidates } = await import('../jobs/replySystemV2/curatedCandidateFetcher');
        const curated = await fetchCuratedCandidates();
        fetchedCount = curated.queued > 0 ? curated.queued : queueTotal;
      } catch {
        /* non-fatal */
      }
    }
    results.push({
      step: 'candidate_fetch',
      ok: queueErr === null,
      data: { queue_count: queueTotal, fetched_count: fetchedCount },
    });
    if (queueErr) exitCode = 1;
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    results.push({ step: 'candidate_fetch', ok: false, message: msg });
    exitCode = 1;
  }

  let postedTweetId: string | null = null;
  const decisionId = `ops_proof_${Date.now()}`;

  if (postOne) {
    try {
      const { getSupabaseClient } = await import('../db');
      const supabase = getSupabaseClient();
      const content = `OPS_PROOF: session ok, posting ok. ${new Date().toISOString()}`;
      const { executeAuthorizedPost } = await import('../posting/PostingGuard');
      const result = await executeAuthorizedPost({
        decision_id: decisionId,
        pipeline_source: 'test_only',
        content,
        decision_type: 'single',
        job_run_id: `ops_proof_${Date.now()}`,
      });
      if (result.success && result.tweet_id) {
        postedTweetId = result.tweet_id;
        await supabase.from('system_events').insert({
          event_type: 'ops_proof_posted',
          severity: 'info',
          message: `OPS_PROOF posted tweet_id=${postedTweetId}`,
          event_data: { tweet_id: postedTweetId, decision_id: decisionId },
          created_at: new Date().toISOString(),
        });
        results.push({ step: 'post_one', ok: true, data: { tweet_id: postedTweetId } });
      } else {
        const errMsg = result.error || result.blocked_reason || 'unknown';
        results.push({ step: 'post_one', ok: false, message: errMsg });
        exitCode = 1;
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      results.push({ step: 'post_one', ok: false, message: msg });
      exitCode = 1;
    }
  } else {
    results.push({ step: 'post_one', ok: true, message: 'skipped' });
  }

  let metrics: { likes: number; retweets: number; replies: number; impressions: number } | null = null;
  if (postedTweetId) {
    try {
      const scraped = await scrapeMetricsForTweet(postedTweetId);
      metrics = scraped;
      results.push({ step: 'metrics_scrape', ok: true, data: scraped });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      results.push({ step: 'metrics_scrape', ok: false, message: msg });
      exitCode = 1;
    }
  } else {
    results.push({ step: 'metrics_scrape', ok: true, message: 'skipped' });
  }

  if (postedTweetId && metrics) {
    try {
      const { getSupabaseClient } = await import('../db');
      const supabase = getSupabaseClient();
      const { storeTweetMetrics } = await import('../db');
      await storeTweetMetrics({
        tweet_id: postedTweetId,
        likes_count: metrics.likes,
        retweets_count: metrics.retweets,
        replies_count: metrics.replies,
        impressions_count: metrics.impressions,
        learning_metadata: { source: 'ops_proof', decision_id: decisionId },
      });
      const { error: outcomesErr } = await supabase.from('outcomes').upsert(
        {
          decision_id: decisionId,
          tweet_id: postedTweetId,
          likes: metrics.likes,
          retweets: metrics.retweets,
          replies: metrics.replies,
          views: metrics.impressions,
          impressions: metrics.impressions,
          collected_at: new Date().toISOString(),
          data_source: 'ops_proof',
          simulated: false,
        },
        { onConflict: 'decision_id' }
      );
      if (outcomesErr) {
        await supabase.from('outcomes').insert({
          decision_id: decisionId,
          tweet_id: postedTweetId,
          likes: metrics.likes,
          retweets: metrics.retweets,
          replies: metrics.replies,
          views: metrics.impressions,
          impressions: metrics.impressions,
          collected_at: new Date().toISOString(),
          data_source: 'ops_proof',
          simulated: false,
        });
      }
      await supabase.from('learning_posts').upsert(
        {
          tweet_id: postedTweetId,
          content: 'OPS_PROOF',
          likes_count: metrics.likes,
          retweets_count: metrics.retweets,
          replies_count: metrics.replies,
          impressions_count: metrics.impressions,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'tweet_id' }
      );
      const { data: inOutcomes } = await supabase.from('outcomes').select('tweet_id').eq('tweet_id', postedTweetId).maybeSingle();
      const { data: inLearning } = await supabase.from('learning_posts').select('tweet_id').eq('tweet_id', postedTweetId).maybeSingle();
      const { data: inMetrics } = await supabase.from('tweet_metrics').select('tweet_id').eq('tweet_id', postedTweetId).maybeSingle();
      const outcomesOk = !!inOutcomes;
      const learningOk = !!inLearning;
      const metricsOk = !!inMetrics;
      const pipelineOk = outcomesOk && learningOk && metricsOk;
      results.push({
        step: 'pipeline_verify',
        ok: pipelineOk,
        data: { outcomes: outcomesOk, learning_posts: learningOk, tweet_metrics: metricsOk },
      });
      if (!pipelineOk) exitCode = 1;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      results.push({ step: 'pipeline_verify', ok: false, message: msg });
      exitCode = 1;
    }
  } else {
    results.push({ step: 'pipeline_verify', ok: true, message: 'skipped' });
  }

  return { results, exitCode };
}
