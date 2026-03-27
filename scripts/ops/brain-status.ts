/**
 * Brain System Status
 *
 * Prints a comprehensive status report of the brain system.
 *
 * Usage: npx tsx scripts/ops/brain-status.ts
 */

import 'dotenv/config';
import { getSupabaseClient } from '../../src/db';

const LOG = '[brain-status]';

async function main() {
  const supabase = getSupabaseClient();

  console.log('\n=== 🧠 BRAIN SYSTEM v2 STATUS ===\n');

  // 1. Brain tweets
  const { count: tweetCount } = await supabase.from('brain_tweets').select('id', { count: 'exact', head: true });
  const { count: recentTweets } = await supabase.from('brain_tweets').select('id', { count: 'exact', head: true })
    .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());

  console.log(`📊 TWEETS: ${tweetCount ?? 0} total, ${recentTweets ?? 0} in last 24h`);

  // Tweets by source
  const { data: bySource } = await supabase
    .from('brain_tweets')
    .select('discovery_source')
    .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());

  if (bySource && bySource.length > 0) {
    const sourceCounts: Record<string, number> = {};
    for (const t of bySource) {
      sourceCounts[t.discovery_source] = (sourceCounts[t.discovery_source] ?? 0) + 1;
    }
    for (const [source, count] of Object.entries(sourceCounts).sort((a, b) => b[1] - a[1])) {
      console.log(`   ${source}: ${count}`);
    }
  }

  // 2. Brain accounts
  const { count: accountCount } = await supabase.from('brain_accounts').select('id', { count: 'exact', head: true }).eq('is_active', true);
  console.log(`\n👥 ACCOUNTS: ${accountCount ?? 0} active`);

  const { data: tierData } = await supabase.from('brain_accounts').select('tier').eq('is_active', true);
  if (tierData) {
    const tiers: Record<string, number> = {};
    for (const a of tierData) tiers[a.tier] = (tiers[a.tier] ?? 0) + 1;
    for (const tier of ['S', 'A', 'B', 'C', 'dormant']) {
      if (tiers[tier]) console.log(`   ${tier}-tier: ${tiers[tier]}`);
    }
  }

  // 3. Brain keywords
  const { count: kwCount } = await supabase.from('brain_keywords').select('id', { count: 'exact', head: true }).eq('is_active', true);
  const { count: kwInactive } = await supabase.from('brain_keywords').select('id', { count: 'exact', head: true }).eq('is_active', false);
  console.log(`\n🔑 KEYWORDS: ${kwCount ?? 0} active, ${kwInactive ?? 0} deactivated`);

  const { data: topKw } = await supabase
    .from('brain_keywords')
    .select('keyword, avg_engagement_found, viral_tweets_found, search_count')
    .eq('is_active', true)
    .order('avg_engagement_found', { ascending: false, nullsFirst: false })
    .limit(5);

  if (topKw && topKw.length > 0) {
    console.log('   Top performing:');
    for (const kw of topKw) {
      console.log(`   "${kw.keyword}" — avg ${Math.round(kw.avg_engagement_found ?? 0)} likes, ${kw.viral_tweets_found ?? 0} viral, ${kw.search_count ?? 0} searches`);
    }
  }

  // 4. Classifications
  const { count: classCount } = await supabase.from('brain_classifications').select('id', { count: 'exact', head: true });
  console.log(`\n🏷️  CLASSIFICATIONS: ${classCount ?? 0} total`);

  const { data: domainData } = await supabase.from('brain_classifications').select('domain');
  if (domainData && domainData.length > 0) {
    const domains: Record<string, number> = {};
    for (const c of domainData) {
      const d = c.domain ?? 'unclassified';
      domains[d] = (domains[d] ?? 0) + 1;
    }
    const sorted = Object.entries(domains).sort((a, b) => b[1] - a[1]).slice(0, 8);
    for (const [domain, count] of sorted) {
      console.log(`   ${domain}: ${count}`);
    }
  }

  // 5. Snapshots
  const { count: snapCount } = await supabase.from('brain_tweet_snapshots').select('id', { count: 'exact', head: true });
  console.log(`\n📈 SNAPSHOTS: ${snapCount ?? 0} total`);

  // 6. Self-model
  const { data: selfModel } = await supabase.from('self_model_state').select('*').eq('id', 1).single();
  if (selfModel) {
    console.log(`\n🪞 SELF-MODEL:`);
    console.log(`   Followers: ${selfModel.follower_count}`);
    console.log(`   Phase: ${selfModel.growth_phase}`);
    console.log(`   7d avg views: ${Math.round(selfModel.avg_views_7d ?? 0)}`);
    console.log(`   30d avg views: ${Math.round(selfModel.avg_views_30d ?? 0)}`);
    console.log(`   7d followers gained: ${selfModel.followers_gained_7d ?? 0}`);
    console.log(`   Growth rate: ${(selfModel.growth_rate_daily ?? 0).toFixed(1)}/day`);
    console.log(`   Expected views/post: ${Math.round(selfModel.expected_views_per_post ?? 0)}`);
    console.log(`   Expected views/reply: ${Math.round(selfModel.expected_views_per_reply ?? 0)}`);
    console.log(`   Working strategies: ${(selfModel.working_strategies ?? []).length}`);
    console.log(`   Decaying strategies: ${(selfModel.decaying_strategies ?? []).length}`);
    console.log(`   Updated: ${selfModel.updated_at}`);
  } else {
    console.log('\n🪞 SELF-MODEL: Not initialized');
  }

  // 7. Feedback events
  const { count: feedbackCount } = await supabase.from('feedback_events').select('id', { count: 'exact', head: true });
  const { count: recentFeedback } = await supabase.from('feedback_events').select('id', { count: 'exact', head: true })
    .gte('created_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString());

  console.log(`\n📝 FEEDBACK: ${feedbackCount ?? 0} total, ${recentFeedback ?? 0} last 7d`);

  const { data: outcomes } = await supabase
    .from('feedback_events')
    .select('outcome_class')
    .gte('created_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString());

  if (outcomes && outcomes.length > 0) {
    const classes: Record<string, number> = {};
    for (const o of outcomes) {
      const c = o.outcome_class ?? 'unknown';
      classes[c] = (classes[c] ?? 0) + 1;
    }
    for (const [cls, count] of Object.entries(classes).sort((a, b) => b[1] - a[1])) {
      console.log(`   ${cls}: ${count}`);
    }
  }

  const { data: diagnoses } = await supabase
    .from('feedback_events')
    .select('failure_diagnosis')
    .not('failure_diagnosis', 'is', null)
    .gte('created_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString());

  if (diagnoses && diagnoses.length > 0) {
    console.log('   Failure diagnoses (30d):');
    const diag: Record<string, number> = {};
    for (const d of diagnoses) {
      diag[d.failure_diagnosis] = (diag[d.failure_diagnosis] ?? 0) + 1;
    }
    for (const [diagnosis, count] of Object.entries(diag).sort((a, b) => b[1] - a[1])) {
      console.log(`   ${diagnosis}: ${count}`);
    }
  }

  console.log('\n=== END BRAIN STATUS ===\n');
}

main().catch(err => {
  console.error(`${LOG} Fatal:`, err);
  process.exit(1);
});
