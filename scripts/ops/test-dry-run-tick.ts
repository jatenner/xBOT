/**
 * Test 1: Dry-Run Tick
 *
 * Runs the full decision pipeline WITHOUT posting:
 * 1. Strategy learner updates strategy
 * 2. Self-model updates
 * 3. Brain query provides recommendations
 * 4. pickNextAction decides what to do
 * 5. If reply: generates reply content
 * 6. Prints everything for human review
 *
 * LIVE_POSTS=false ensures nothing reaches Twitter.
 *
 * Usage: npx tsx scripts/ops/test-dry-run-tick.ts
 */

import 'dotenv/config';
import * as fs from 'fs';
import * as path from 'path';

// Load twitter session from file
if (!process.env.TWITTER_SESSION_B64) {
  const sessionPath = path.join(process.cwd(), 'twitter_session.b64');
  if (fs.existsSync(sessionPath)) {
    process.env.TWITTER_SESSION_B64 = fs.readFileSync(sessionPath, 'utf-8').trim();
  }
}

async function main() {
  console.log('\n' + '='.repeat(60));
  console.log('🧪 TEST 1: DRY-RUN TICK');
  console.log('   LIVE_POSTS=' + process.env.LIVE_POSTS);
  console.log('   SHADOW_MODE=' + process.env.SHADOW_MODE);
  console.log('   X_ACTIONS_ENABLED=' + process.env.X_ACTIONS_ENABLED);
  console.log('   X_MAX_ACTIONS_PER_DAY=' + process.env.X_MAX_ACTIONS_PER_DAY);
  console.log('='.repeat(60));

  if (process.env.LIVE_POSTS === 'true') {
    console.error('\n❌ ABORT: LIVE_POSTS=true — this is a DRY RUN only!');
    process.exit(1);
  }

  // Step 1: Update self-model
  console.log('\n--- STEP 1: Self-Model Update ---');
  try {
    const { runSelfModelUpdate } = await import('../../src/brain/selfModel');
    await runSelfModelUpdate();

    const { getSelfModel } = await import('../../src/brain/db');
    const model = await getSelfModel();
    if (model) {
      console.log(`  Phase: ${model.growth_phase}`);
      console.log(`  Followers: ${model.follower_count}`);
      console.log(`  7d avg views: ${Math.round(model.avg_views_7d ?? 0)}`);
      console.log(`  Expected views/reply: ${Math.round(model.expected_views_per_reply ?? 0)}`);
      console.log(`  Expected views/post: ${Math.round(model.expected_views_per_post ?? 0)}`);
      console.log(`  Working strategies: ${(model.working_strategies ?? []).length}`);
      console.log(`  Decaying strategies: ${(model.decaying_strategies ?? []).length}`);
    }
  } catch (e: any) {
    console.error(`  Error: ${e.message}`);
  }

  // Step 2: Brain recommendations
  console.log('\n--- STEP 2: Brain Recommendations ---');
  try {
    const { brainQuery } = await import('../../src/brain/brainQuery');

    const rec = await brainQuery.getQuickRecommendation();
    console.log(`  Action: ${rec.action} (confidence: ${rec.confidence})`);
    console.log(`  Reason: ${rec.reason}`);
    if (rec.suggested_format) console.log(`  Format: ${rec.suggested_format}`);
    if (rec.suggested_hook) console.log(`  Hook: ${rec.suggested_hook}`);
    if (rec.suggested_tone) console.log(`  Tone: ${rec.suggested_tone}`);
    if (rec.target_account) console.log(`  Target: @${rec.target_account}`);

    const health = await brainQuery.getStrategyHealth();
    console.log(`  Strategy health: ${health?.overall_health ?? 'unknown'}`);

    const trending = await brainQuery.getTrendingTopics(3);
    if (trending.length > 0) {
      console.log(`  Trending: ${trending.map(t => `"${t.keyword}" (${t.tweet_count})`).join(', ')}`);
    }
  } catch (e: any) {
    console.error(`  Error: ${e.message}`);
  }

  // Step 3: Load current strategy
  console.log('\n--- STEP 3: Current Strategy ---');
  try {
    const { getSupabaseClient } = await import('../../src/db');
    const s = getSupabaseClient();

    const { data: strategy } = await s.from('strategy_state').select('*').eq('id', 1).single();
    if (strategy) {
      console.log(`  Replies/day target: ${strategy.target_replies_per_day}`);
      console.log(`  Singles/day target: ${strategy.target_singles_per_day}`);
      console.log(`  Threads/day target: ${strategy.target_threads_per_day}`);
      console.log(`  Reply weight: ${strategy.reply_weight}`);
      console.log(`  Single weight: ${strategy.single_weight}`);
      console.log(`  Thread weight: ${strategy.thread_weight}`);
      console.log(`  Reply pacing: ${strategy.reply_pacing_minutes} min`);
      console.log(`  Peak hours: ${JSON.stringify(strategy.peak_hours)}`);
      console.log(`  Preferred topics: ${JSON.stringify(strategy.preferred_topics)}`);
      console.log(`  Preferred hooks: ${JSON.stringify(strategy.preferred_hooks)}`);
      console.log(`  Preferred archetypes: ${JSON.stringify(strategy.preferred_archetypes)}`);
      console.log(`  Avoided topics: ${JSON.stringify(strategy.avoided_topics)}`);
    }
  } catch (e: any) {
    console.error(`  Error: ${e.message}`);
  }

  // Step 4: Tick advisor
  console.log('\n--- STEP 4: Tick Advisor ---');
  try {
    const { getTickAdvice } = await import('../../src/intelligence/tickAdvisor');
    const advice = await getTickAdvice();
    console.log(`  Stage: ${advice.our_stage}`);
    console.log(`  Confidence: ${advice.confidence}`);
    console.log(`  Reply angles: ${advice.reply_preferences.preferred_angles.join(', ') || 'none'}`);
    console.log(`  Reply tones: ${advice.reply_preferences.preferred_tones.join(', ') || 'none'}`);
    console.log(`  Content formats: ${advice.content_preferences.preferred_formats.join(', ') || 'none'}`);
    console.log(`  Hot topics: ${advice.content_preferences.hot_topics.join(', ') || 'none'}`);
    console.log(`  Hour buckets: ${advice.targeting_preferences.preferred_hour_buckets.join(', ') || 'none'}`);
    console.log(`  Insights: ${advice.top_insights.length}`);
    for (const insight of advice.top_insights.slice(0, 3)) {
      console.log(`    "${insight.substring(0, 80)}..."`);
    }
  } catch (e: any) {
    console.error(`  Error: ${e.message}`);
  }

  // Step 5: Check action gate
  console.log('\n--- STEP 5: Action Gate ---');
  try {
    const { checkActionGate } = await import('../../src/safety/actionGate');
    const gate = await checkActionGate('reply');
    console.log(`  Allowed: ${gate.allowed}`);
    console.log(`  Reason: ${gate.reason || 'none'}`);
    if (gate.jitter_seconds) console.log(`  Jitter: ${gate.jitter_seconds}s`);
  } catch (e: any) {
    console.error(`  Error: ${e.message}`);
  }

  // Step 6: Check gradual ramp
  console.log('\n--- STEP 6: Gradual Ramp ---');
  try {
    const { checkGradualRamp } = await import('../../src/safety/gradualRamp');
    const ramp = await checkGradualRamp();
    console.log(`  Day: ${ramp.day}`);
    console.log(`  Max actions: ${ramp.max_actions}`);
    console.log(`  Actions today: ${ramp.actions_today}`);
    console.log(`  Allowed: ${ramp.allowed}`);
  } catch (e: any) {
    console.error(`  Error: ${e.message}`);
  }

  // Step 7: Check reply candidates
  console.log('\n--- STEP 7: Reply Candidates ---');
  try {
    const { getSupabaseClient } = await import('../../src/db');
    const s = getSupabaseClient();

    const { data: candidates, count } = await s
      .from('reply_candidate_queue')
      .select('candidate_tweet_id, overall_score, predicted_tier, source_type, metadata', { count: 'exact' })
      .eq('status', 'queued')
      .order('overall_score', { ascending: false })
      .limit(5);

    console.log(`  Queued candidates: ${count ?? 0}`);
    if (candidates && candidates.length > 0) {
      for (const c of candidates) {
        console.log(`    Score ${c.overall_score?.toFixed(1)} | Tier ${c.predicted_tier} | ${c.source_type} | ${c.candidate_tweet_id}`);
      }
    } else {
      console.log(`  No candidates in queue — reply system needs to fetch candidates first`);
    }
  } catch (e: any) {
    console.error(`  Error: ${e.message}`);
  }

  // Summary
  console.log('\n' + '='.repeat(60));
  console.log('🧪 DRY RUN COMPLETE');
  console.log('');
  console.log('Review the output above. If everything looks correct:');
  console.log('  - Action decisions make sense');
  console.log('  - Safety gates are working');
  console.log('  - Brain recommendations are reasonable');
  console.log('  - Strategy values are sensible');
  console.log('');
  console.log('Then Test 2: Export fresh session + enable LIVE_POSTS=true + X_MAX_ACTIONS_PER_DAY=1');
  console.log('='.repeat(60) + '\n');
}

main().catch(e => {
  console.error('Fatal:', e);
  process.exit(1);
});
