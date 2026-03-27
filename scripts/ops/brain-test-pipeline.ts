/**
 * Brain System Pipeline Test
 *
 * Tests the non-browser components of the brain system:
 * 1. Self-model update (reads from existing outcomes/growth_ledger)
 * 2. Feedback loop (processes recent outcomes into feedback events)
 * 3. Phase advisor (generates tier-segmented recommendations)
 * 4. Brain query interface (answers questions)
 * 5. Keyword pool management
 * 6. Account tiering
 *
 * Does NOT test browser-dependent feeds (those require Playwright).
 *
 * Usage: npx tsx scripts/ops/brain-test-pipeline.ts
 */

import 'dotenv/config';
import { getSupabaseClient } from '../../src/db';

async function main() {
  console.log('\n=== 🧠 BRAIN PIPELINE TEST ===\n');

  // 1. Self-model update
  console.log('--- 1. SELF-MODEL UPDATE ---');
  try {
    const { runSelfModelUpdate } = await import('../../src/brain/selfModel');
    await runSelfModelUpdate();

    const supabase = getSupabaseClient();
    const { data } = await supabase.from('self_model_state').select('*').eq('id', 1).single();
    if (data) {
      console.log(`  ✅ Followers: ${data.follower_count} | Phase: ${data.growth_phase}`);
      console.log(`  ✅ 7d: ${Math.round(data.avg_views_7d ?? 0)} avg views, ${data.total_posts_7d ?? 0} posts, ${data.total_replies_7d ?? 0} replies`);
      console.log(`  ✅ 30d: ${Math.round(data.avg_views_30d ?? 0)} avg views`);
      console.log(`  ✅ Growth: +${data.followers_gained_7d ?? 0} followers/7d, ${(data.growth_rate_daily ?? 0).toFixed(1)}/day`);
      console.log(`  ✅ Working strategies: ${(data.working_strategies ?? []).length}, Decaying: ${(data.decaying_strategies ?? []).length}`);
      const bestFmt = (data.best_formats ?? []).slice(0, 3).map((f: any) => `${f.name}(${Math.round(f.avg_views)}v)`);
      if (bestFmt.length > 0) console.log(`  ✅ Best formats: ${bestFmt.join(', ')}`);
      const bestHrs = (data.best_posting_hours ?? []).slice(0, 3).map((h: any) => `${h.name}h(${Math.round(h.avg_views)}v)`);
      if (bestHrs.length > 0) console.log(`  ✅ Best hours: ${bestHrs.join(', ')}`);
    } else {
      console.log('  ⚠️ Self-model state not found');
    }
  } catch (e: any) {
    console.error(`  ❌ Self-model error: ${e.message}`);
  }

  // 2. Feedback loop
  console.log('\n--- 2. FEEDBACK LOOP ---');
  try {
    const { runFeedbackLoop } = await import('../../src/brain/feedbackLoop');
    const result = await runFeedbackLoop();
    console.log(`  ✅ Created ${result.events_created} feedback events`);
  } catch (e: any) {
    console.error(`  ❌ Feedback loop error: ${e.message}`);
  }

  // 3. Phase advisor
  console.log('\n--- 3. PHASE ADVISOR ---');
  try {
    const { getPhaseAdvice } = await import('../../src/brain/phaseAdvisor');
    const advice = await getPhaseAdvice();
    if (advice) {
      console.log(`  ✅ Phase: ${advice.growth_phase} | Relevant tiers: ${advice.relevant_tiers.join(',')}`);
      console.log(`  ✅ Recommended hooks: ${advice.recommended_hooks.length}`);
      console.log(`  ✅ Recommended tones: ${advice.recommended_tones.length}`);
      console.log(`  ✅ Recommended formats: ${advice.recommended_formats.length}`);
      console.log(`  ✅ Recommended hours: ${advice.recommended_hours.length}`);
      console.log(`  ✅ Strategy notes: ${advice.strategy_notes.length} notes`);
      if (advice.strategy_notes.length > 0) {
        console.log(`     "${advice.strategy_notes[0].substring(0, 80)}..."`);
      }
    } else {
      console.log('  ⚠️ No phase advice available (no self-model)');
    }
  } catch (e: any) {
    console.error(`  ❌ Phase advisor error: ${e.message}`);
  }

  // 4. Brain query
  console.log('\n--- 4. BRAIN QUERY ---');
  try {
    const { brainQuery } = await import('../../src/brain/brainQuery');

    const rec = await brainQuery.getQuickRecommendation();
    console.log(`  ✅ Quick recommendation: ${rec.action} (${rec.confidence})`);
    console.log(`     Reason: ${rec.reason}`);
    if (rec.suggested_format) console.log(`     Format: ${rec.suggested_format}`);
    if (rec.suggested_hook) console.log(`     Hook: ${rec.suggested_hook}`);
    if (rec.target_account) console.log(`     Target: @${rec.target_account}`);

    const trending = await brainQuery.getTrendingTopics(5);
    console.log(`  ✅ Trending topics: ${trending.length}`);

    const targets = await brainQuery.getRecommendedTargets('reply', 5);
    console.log(`  ✅ Recommended reply targets: ${targets.length}`);
    for (const t of targets.slice(0, 3)) {
      console.log(`     @${t.username} (${t.followers} followers, ${(t.avg_engagement * 100).toFixed(1)}% engagement, tier ${t.tier})`);
    }

    const health = await brainQuery.getStrategyHealth();
    console.log(`  ✅ Strategy health: ${health?.overall_health ?? 'unknown'}`);

    const gaps = await brainQuery.getContentGaps(3);
    console.log(`  ✅ Content gaps: ${gaps.length}`);
  } catch (e: any) {
    console.error(`  ❌ Brain query error: ${e.message}`);
  }

  // 5. Keyword pool management
  console.log('\n--- 5. KEYWORD POOL ---');
  try {
    const { runKeywordPoolManagement } = await import('../../src/brain/keywordPool');
    const result = await runKeywordPoolManagement();
    console.log(`  ✅ Added: ${result.keywords_added}, Deactivated: ${result.keywords_deactivated}, Reprioritized: ${result.keywords_reprioritized}`);
  } catch (e: any) {
    console.error(`  ❌ Keyword pool error: ${e.message}`);
  }

  // 6. Account tiering
  console.log('\n--- 6. ACCOUNT TIERING ---');
  try {
    const { runAccountTiering } = await import('../../src/brain/accountTiering');
    const result = await runAccountTiering();
    console.log(`  ✅ Tiered ${result.total_accounts} accounts`);
    console.log(`     S: ${result.tiers['S'] ?? 0}, A: ${result.tiers['A'] ?? 0}, B: ${result.tiers['B'] ?? 0}, C: ${result.tiers['C'] ?? 0}, dormant: ${result.tiers['dormant'] ?? 0}`);
    console.log(`     Promotions: ${result.promotions}, Demotions: ${result.demotions}`);
  } catch (e: any) {
    console.error(`  ❌ Account tiering error: ${e.message}`);
  }

  // 7. Account discovery (from existing brain_tweets — will be empty since no scraping yet)
  console.log('\n--- 7. ACCOUNT DISCOVERY ---');
  try {
    const { runAccountDiscovery } = await import('../../src/brain/accountDiscoveryEngine');
    const result = await runAccountDiscovery();
    console.log(`  ✅ Discovered: ${result.accounts_discovered} new accounts`);
  } catch (e: any) {
    console.error(`  ❌ Account discovery error: ${e.message}`);
  }

  // Summary
  console.log('\n--- SUMMARY ---');
  const supabase = getSupabaseClient();
  const { count: accounts } = await supabase.from('brain_accounts').select('id', { count: 'exact', head: true }).eq('is_active', true);
  const { count: keywords } = await supabase.from('brain_keywords').select('id', { count: 'exact', head: true }).eq('is_active', true);
  const { count: tweets } = await supabase.from('brain_tweets').select('id', { count: 'exact', head: true });
  const { count: classifications } = await supabase.from('brain_classifications').select('id', { count: 'exact', head: true });
  const { count: feedback } = await supabase.from('feedback_events').select('id', { count: 'exact', head: true });

  console.log(`  Accounts: ${accounts ?? 0}`);
  console.log(`  Keywords: ${keywords ?? 0}`);
  console.log(`  Tweets: ${tweets ?? 0}`);
  console.log(`  Classifications: ${classifications ?? 0}`);
  console.log(`  Feedback events: ${feedback ?? 0}`);

  console.log('\n=== PIPELINE TEST COMPLETE ===\n');
  console.log('Next steps:');
  console.log('  1. Set BRAIN_FEEDS_ENABLED=true to activate browser-based scraping');
  console.log('  2. Brain feeds will start discovering tweets automatically');
  console.log('  3. Run `npx tsx scripts/ops/brain-status.ts` to monitor progress');
}

main().catch(e => {
  console.error('Fatal:', e);
  process.exit(1);
});
