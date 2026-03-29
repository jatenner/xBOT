#!/usr/bin/env tsx
/**
 * Safe backfill for reply learning: ensure recent reply_decisions have
 * target_username and discovery_source so aggregateReplyOutcomes() can attribute them.
 *
 * - Only ALLOW decisions, last 90 days (configurable via BACKFILL_DAYS).
 * - Infers target_username from content_metadata or content_generation_metadata_comprehensive.
 * - Infers discovery_source from reply_opportunities or features.discovery_source.
 * - Upserts reply_opportunities so target_tweet_id has target_username/discovery_source when missing.
 * - Then runs aggregateReplyOutcomes().
 *
 * Usage: pnpm exec tsx scripts/ops/reply-learning-backfill.ts
 */

import 'dotenv/config';
import { getSupabaseClient } from '../../src/db';
import { aggregateReplyOutcomes } from '../../src/jobs/replySystemV2/outcomeAggregation';

const BACKFILL_DAYS = parseInt(process.env.BACKFILL_DAYS || '90', 10);
const DRY_RUN = process.argv.includes('--dry-run');

async function main() {
  const supabase = getSupabaseClient();
  const since = new Date(Date.now() - BACKFILL_DAYS * 24 * 60 * 60 * 1000).toISOString();

  const { data: decisions, error: decErr } = await supabase
    .from('reply_decisions')
    .select('id, decision_id, target_tweet_id')
    .eq('decision', 'ALLOW')
    .gte('created_at', since)
    .order('created_at', { ascending: false });

  if (decErr || !decisions?.length) {
    console.log('[REPLY_LEARNING_BACKFILL] No recent ALLOW decisions or error:', decErr?.message || 'none');
    const result = await aggregateReplyOutcomes();
    console.log(`[REPLY_LEARNING_BACKFILL] Ran aggregation: accounts=${result.accounts_updated} sources=${result.sources_updated}`);
    return;
  }

  const decisionIds = [...new Set((decisions as any[]).map((d: any) => d.decision_id).filter(Boolean))];
  const targetTweetIds = [...new Set((decisions as any[]).map((d: any) => d.target_tweet_id).filter(Boolean))];

  const cmMap = new Map<string, string>();
  const compMap = new Map<string, string>();
  const usernameByTweetId = new Map<string, string>();
  if (decisionIds.length) {
    const { data: cm } = await supabase.from('content_metadata').select('decision_id, target_username, target_tweet_id').in('decision_id', decisionIds);
    if (cm) for (const r of cm as any[]) {
      if (r.decision_id && r.target_username) { cmMap.set(r.decision_id, r.target_username); if (r.target_tweet_id) usernameByTweetId.set(r.target_tweet_id, r.target_username); }
    }
    const missing = decisionIds.filter((id: string) => !cmMap.get(id));
    if (missing.length) {
      const { data: comp } = await supabase.from('content_generation_metadata_comprehensive').select('decision_id, target_username, target_tweet_id').in('decision_id', missing);
      if (comp) for (const r of comp as any[]) {
        if (r.decision_id && r.target_username) { compMap.set(r.decision_id, r.target_username); if (r.target_tweet_id) usernameByTweetId.set(r.target_tweet_id, r.target_username); }
      }
    }
  }
  for (const tid of targetTweetIds) {
    if (usernameByTweetId.get(tid)) continue;
    const { data: byTweet } = await supabase.from('content_metadata').select('target_tweet_id, target_username').eq('decision_type', 'reply').eq('target_tweet_id', tid).maybeSingle();
    if (byTweet?.target_username) usernameByTweetId.set(tid, byTweet.target_username);
  }

  const featuresSourceByDecisionId = new Map<string, string>();
  if (decisionIds.length) {
    const { data: cmF } = await supabase.from('content_metadata').select('decision_id, features').in('decision_id', decisionIds);
    if (cmF) for (const r of cmF as any[]) { if (r.decision_id && r.features?.discovery_source) featuresSourceByDecisionId.set(r.decision_id, String(r.features.discovery_source).trim() || 'backfill_reply_decision'); }
    const missingF = decisionIds.filter((id: string) => !featuresSourceByDecisionId.get(id));
    if (missingF.length) {
      const { data: compF } = await supabase.from('content_generation_metadata_comprehensive').select('decision_id, features').in('decision_id', missingF);
      if (compF) for (const r of compF as any[]) { if (r.decision_id && r.features?.discovery_source) featuresSourceByDecisionId.set(r.decision_id, String(r.features.discovery_source).trim() || 'backfill_reply_decision'); }
    }
  }

  const { data: opps } = await supabase.from('reply_opportunities').select('target_tweet_id, target_username, discovery_source').in('target_tweet_id', targetTweetIds);
  const oppByTweetId = new Map<string, { target_username: string | null; discovery_source: string | null }>();
  if (opps) for (const o of opps as any[]) { if (o.target_tweet_id) oppByTweetId.set(o.target_tweet_id, { target_username: o.target_username ?? null, discovery_source: o.discovery_source ?? null }); }

  let updated = 0;
  let inserted = 0;
  for (const d of decisions as any[]) {
    const targetUsername = cmMap.get(d.decision_id) ?? compMap.get(d.decision_id) ?? usernameByTweetId.get(d.target_tweet_id) ?? null;
    const discoverySource = featuresSourceByDecisionId.get(d.decision_id) ?? oppByTweetId.get(d.target_tweet_id)?.discovery_source ?? 'backfill_reply_decision';
    if (!targetUsername) continue;
    const existing = oppByTweetId.get(d.target_tweet_id);
    if (existing) {
      const u: Record<string, string> = {};
      if (!existing.target_username) u.target_username = targetUsername;
      if (!existing.discovery_source) u.discovery_source = discoverySource;
      if (Object.keys(u).length && !DRY_RUN) {
        await supabase.from('reply_opportunities').update(u).eq('target_tweet_id', d.target_tweet_id);
        updated++;
      }
    } else {
      if (!DRY_RUN) {
        await supabase.from('reply_opportunities').upsert(
          {
            target_tweet_id: d.target_tweet_id,
            target_tweet_url: `https://x.com/i/status/${d.target_tweet_id}`,
            target_username: targetUsername,
            target_tweet_content: null,
            tweet_posted_at: new Date().toISOString(),
            replied_to: true,
            is_root_tweet: true,
            root_tweet_id: d.target_tweet_id,
            discovery_source: discoverySource,
            status: 'replied',
          },
          { onConflict: 'target_tweet_id' }
        );
        inserted++;
      }
    }
  }

  console.log(`[REPLY_LEARNING_BACKFILL] decisions=${decisions.length} updated_opps=${updated} inserted_opps=${inserted} dry_run=${DRY_RUN}`);

  const result = await aggregateReplyOutcomes();
  console.log(`[REPLY_LEARNING_BACKFILL] aggregation: accounts=${result.accounts_updated} sources=${result.sources_updated} errors=${result.errors.length}`);
  if (result.errors.length) result.errors.forEach((e) => console.warn('[REPLY_LEARNING_BACKFILL]', e));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
