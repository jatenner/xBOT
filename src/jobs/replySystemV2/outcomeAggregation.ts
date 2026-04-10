/**
 * Outcome aggregation: update reply_account_performance and reply_source_performance
 * from actual reply_decisions + content_metadata + reply_opportunities.
 *
 * Outcome signal: reply_decisions.reward_24h (or outcomes.views/likes when reward_24h null).
 * Recomputes from scratch so safe to run repeatedly (idempotent).
 */

import { getSupabaseClient } from '../../db';

function normalizeUsername(u: string | null | undefined): string {
  if (!u || typeof u !== 'string') return '';
  return u.trim().toLowerCase().replace(/^@/, '');
}

function normalizeSource(s: string | null | undefined): string {
  if (!s || typeof s !== 'string') return 'unknown';
  return s.trim() || 'unknown';
}

export interface AggregateResult {
  decisions_processed: number;
  accounts_updated: number;
  sources_updated: number;
  errors: string[];
}

/**
 * Recompute account and source performance from reply_decisions (ALLOW only),
 * join content_metadata for target_username and reply_opportunities for discovery_source.
 * Uses reward_24h when present; else derives a proxy from outcomes table when available.
 */
export async function aggregateReplyOutcomes(): Promise<AggregateResult> {
  const supabase = getSupabaseClient();
  const errors: string[] = [];
  let decisionsProcessed = 0;

  const { data: decisions, error: decError } = await supabase
    .from('reply_decisions')
    .select('id, decision_id, target_tweet_id, posted_reply_tweet_id, reward_24h, engaged_at, created_at')
    .eq('decision', 'ALLOW')
    .order('created_at', { ascending: true });

  if (decError) {
    console.warn(`[OUTCOME_AGG] reply_decisions query failed: ${decError.message}`);
    return { decisions_processed: 0, accounts_updated: 0, sources_updated: 0, errors: [decError.message] };
  }

  if (!decisions || decisions.length === 0) {
    return { decisions_processed: 0, accounts_updated: 0, sources_updated: 0, errors: [] };
  }

  const decisionIds = [...new Set((decisions as any[]).map((d: any) => d.decision_id).filter(Boolean))];
  const targetTweetIds = [...new Set((decisions as any[]).map((d: any) => d.target_tweet_id).filter(Boolean))];

  // target_username: by decision_id first (content_metadata, then comprehensive), then by target_tweet_id (reply rows)
  const cmMap = new Map<string, string>();
  const usernameByTargetTweetId = new Map<string, string>();
  if (decisionIds.length > 0) {
    const { data: cmRows } = await supabase
      .from('content_metadata')
      .select('decision_id, target_username, target_tweet_id')
      .in('decision_id', decisionIds);
    if (cmRows) {
      for (const r of cmRows as { decision_id: string; target_username: string | null; target_tweet_id?: string | null }[]) {
        if (r.decision_id && r.target_username) {
          cmMap.set(r.decision_id, r.target_username);
          if (r.target_tweet_id) usernameByTargetTweetId.set(r.target_tweet_id, r.target_username);
        }
      }
    }
    const missingIds = decisionIds.filter((id: string) => !cmMap.get(id));
    if (missingIds.length > 0) {
      const { data: compRows } = await supabase
        .from('content_generation_metadata_comprehensive')
        .select('decision_id, target_username, target_tweet_id')
        .in('decision_id', missingIds);
      if (compRows) {
        for (const r of compRows as { decision_id: string; target_username: string | null; target_tweet_id?: string | null }[]) {
          if (r.decision_id && r.target_username) {
            cmMap.set(r.decision_id, r.target_username);
            if (r.target_tweet_id) usernameByTargetTweetId.set(r.target_tweet_id, r.target_username);
          }
        }
      }
    }
  }

  // discovery_source: reply_opportunities first, then features.discovery_source from content (for backfill/new pipeline)
  const oppMap = new Map<string, string>();
  const oppUsernameByTweetId = new Map<string, string>();
  if (targetTweetIds.length > 0) {
    const { data: oppRows } = await supabase
      .from('reply_opportunities')
      .select('target_tweet_id, discovery_source, target_username')
      .in('target_tweet_id', targetTweetIds);
    if (oppRows) {
      for (const r of oppRows as { target_tweet_id: string; discovery_source: string | null; target_username?: string | null }[]) {
        if (r.target_tweet_id) {
          oppMap.set(r.target_tweet_id, normalizeSource(r.discovery_source));
          if (r.target_username) oppUsernameByTweetId.set(r.target_tweet_id, normalizeUsername(r.target_username));
        }
      }
    }
  }
  // Fallback: resolve target_username by target_tweet_id (reply rows where decision_id didn't match)
  const tweetIdsWithoutUser = targetTweetIds.filter((tid: string) => !oppUsernameByTweetId.get(tid) && !usernameByTargetTweetId.get(tid));
  if (tweetIdsWithoutUser.length > 0) {
    const { data: byTweet } = await supabase
      .from('content_metadata')
      .select('target_tweet_id, target_username')
      .eq('decision_type', 'reply')
      .in('target_tweet_id', tweetIdsWithoutUser);
    if (byTweet) {
      for (const r of byTweet as { target_tweet_id: string; target_username: string | null }[]) {
        if (r.target_tweet_id && r.target_username) usernameByTargetTweetId.set(r.target_tweet_id, normalizeUsername(r.target_username));
      }
    }
  }

  const discoverySourceByDecisionId = new Map<string, string>();
  if (decisionIds.length > 0) {
    const { data: cmFeatures } = await supabase
      .from('content_metadata')
      .select('decision_id, features')
      .in('decision_id', decisionIds);
    if (cmFeatures) {
      for (const r of cmFeatures as { decision_id: string; features?: { discovery_source?: string } | null }[]) {
        const src = r.features?.discovery_source;
        if (r.decision_id && src) discoverySourceByDecisionId.set(r.decision_id, normalizeSource(src));
      }
    }
    const missingForSource = decisionIds.filter((id: string) => !discoverySourceByDecisionId.get(id));
    if (missingForSource.length > 0) {
      const { data: compFeatures } = await supabase
        .from('content_generation_metadata_comprehensive')
        .select('decision_id, features')
        .in('decision_id', missingForSource);
      if (compFeatures) {
        for (const r of compFeatures as { decision_id: string; features?: { discovery_source?: string } | null }[]) {
          const src = r.features?.discovery_source;
          if (r.decision_id && src) discoverySourceByDecisionId.set(r.decision_id, normalizeSource(src));
        }
      }
    }
  }

  const accountAgg = new Map<
    string,
    { attempted: number; posted: number; totalReward: number; lastAt: string | null }
  >();
  const sourceAgg = new Map<
    string,
    { attempted: number; posted: number; totalReward: number; lastAt: string | null }
  >();

  for (const d of decisions as any[]) {
    decisionsProcessed++;
    const targetUsername =
      normalizeUsername(cmMap.get(d.decision_id) ?? null) || oppUsernameByTweetId.get(d.target_tweet_id) || usernameByTargetTweetId.get(d.target_tweet_id) || '';
    const discoverySource =
      oppMap.get(d.target_tweet_id) ?? discoverySourceByDecisionId.get(d.decision_id) ?? 'unknown';
    const posted = !!d.posted_reply_tweet_id;
    const reward =
      d.reward_24h != null && !Number.isNaN(Number(d.reward_24h))
        ? Number(d.reward_24h)
        : null;
    const lastAt = d.engaged_at || d.created_at || null;

    if (targetUsername) {
      const cur = accountAgg.get(targetUsername) || {
        attempted: 0,
        posted: 0,
        totalReward: 0,
        lastAt: null as string | null,
      };
      cur.attempted += 1;
      if (posted) {
        cur.posted += 1;
        if (reward != null) cur.totalReward += reward;
        if (lastAt) cur.lastAt = lastAt;
      }
      accountAgg.set(targetUsername, cur);
    }

    const curSource = sourceAgg.get(discoverySource) || {
      attempted: 0,
      posted: 0,
      totalReward: 0,
      lastAt: null as string | null,
    };
    curSource.attempted += 1;
    if (posted) {
      curSource.posted += 1;
      if (reward != null) curSource.totalReward += reward;
      if (lastAt) curSource.lastAt = lastAt;
    }
    sourceAgg.set(discoverySource, curSource);
  }

  let accountsUpdated = 0;
  let sourcesUpdated = 0;

  for (const [username, agg] of accountAgg) {
    try {
      const avgReward = agg.posted > 0 ? agg.totalReward / agg.posted : null;
      await supabase.from('reply_account_performance').upsert(
        {
          target_username: username,
          replies_attempted: agg.attempted,
          replies_posted: agg.posted,
          total_reward_24h: agg.totalReward,
          avg_reward_24h: avgReward,
          last_interaction_at: agg.lastAt,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'target_username' }
      );
      accountsUpdated++;
    } catch (e: any) {
      errors.push(`account ${username}: ${e.message}`);
    }
  }

  for (const [source, agg] of sourceAgg) {
    try {
      const avgReward = agg.posted > 0 ? agg.totalReward / agg.posted : null;
      await supabase.from('reply_source_performance').upsert(
        {
          discovery_source: source,
          replies_attempted: agg.attempted,
          replies_posted: agg.posted,
          total_reward_24h: agg.totalReward,
          avg_reward_24h: avgReward,
          last_interaction_at: agg.lastAt,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'discovery_source' }
      );
      sourcesUpdated++;
    } catch (e: any) {
      errors.push(`source ${source}: ${e.message}`);
    }
  }

  if (decisionsProcessed > 0) {
    console.log(
      `[OUTCOME_AGG] processed=${decisionsProcessed} accounts=${accountsUpdated} sources=${sourcesUpdated}`
    );
  }
  return {
    decisions_processed: decisionsProcessed,
    accounts_updated: accountsUpdated,
    sources_updated: sourcesUpdated,
    errors,
  };
}
