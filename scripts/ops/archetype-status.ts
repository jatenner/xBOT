#!/usr/bin/env tsx
/**
 * 📊 ARCHETYPE LEARNING STATUS
 *
 * Shows current state of the archetype learning pipeline:
 * - Posted replies with archetype metadata
 * - Outcomes data (views, likes, engagement)
 * - Archetype performance aggregation
 * - Learning readiness
 *
 * Usage: pnpm tsx scripts/ops/archetype-status.ts
 */

import 'dotenv/config';
import { getSupabaseClient } from '../../src/db/index';

async function main() {
  const s = getSupabaseClient();
  const now = Date.now();

  // 1. Posted replies with archetype
  const { data: replies } = await s.from('content_generation_metadata_comprehensive')
    .select('decision_id, status, tweet_id, features, created_at')
    .eq('decision_type', 'reply')
    .eq('status', 'posted')
    .not('tweet_id', 'is', null)
    .order('created_at', { ascending: false })
    .limit(20);

  console.log('╔══════════════════════════════════════════════════════════════╗');
  console.log('║              ARCHETYPE LEARNING STATUS                       ║');
  console.log('╚══════════════════════════════════════════════════════════════╝');

  let withArch = 0, withoutArch = 0;
  const archetypeCounts: Record<string, number> = {};

  // Get outcomes for all replies
  const decIds = (replies || []).map(r => r.decision_id);
  const { data: outcomes } = await s.from('outcomes')
    .select('decision_id, views, likes, engagement_rate')
    .in('decision_id', decIds);
  const outcomeMap = new Map((outcomes || []).map(o => [o.decision_id, o]));

  console.log('\n📋 POSTED REPLIES:');
  console.log('─'.repeat(90));
  console.log('Date       | Decision  | Archetype            | Views | Likes | ER     | Outcome');
  console.log('─'.repeat(90));

  for (const r of (replies || [])) {
    const f = r.features as any;
    const arch = f?.reply_archetype || '—';
    if (arch !== '—') { withArch++; archetypeCounts[arch] = (archetypeCounts[arch] || 0) + 1; }
    else withoutArch++;

    const o = outcomeMap.get(r.decision_id);
    const views = o?.views != null ? String(o.views).padStart(5) : '  n/a';
    const likes = o?.likes != null ? String(o.likes).padStart(5) : '  n/a';
    const er = o?.engagement_rate != null ? (Number(o.engagement_rate) * 100).toFixed(1).padStart(5) + '%' : '   n/a';
    const outcomeStatus = !o ? '❌ missing' : (o.views != null ? '✅ scraped' : '⏳ pending');

    console.log(`${r.created_at?.slice(5, 16)} | ${r.decision_id?.slice(0, 8)}… | ${(arch).padEnd(20)} | ${views} | ${likes} | ${er} | ${outcomeStatus}`);
  }

  console.log('─'.repeat(90));
  console.log(`With archetype: ${withArch} | Without: ${withoutArch}`);

  // 2. Archetype performance from strategy_rewards
  const { data: rewards } = await s.from('strategy_rewards')
    .select('strategy_id, sample_count, mean_reward, total_reward, last_updated_at')
    .like('strategy_id', 'archetype_%')
    .order('mean_reward', { ascending: false });

  console.log('\n📊 ARCHETYPE PERFORMANCE (strategy_rewards):');
  console.log('─'.repeat(60));
  if (rewards?.length) {
    for (const r of rewards) {
      const name = r.strategy_id.replace('archetype_', '');
      const bar = '█'.repeat(Math.min(20, Math.round(r.mean_reward * 4)));
      console.log(`  ${name.padEnd(22)} n=${String(r.sample_count).padStart(3)} reward=${(r.mean_reward || 0).toFixed(2)} ${bar}`);
    }
  } else {
    console.log('  No archetype performance data yet');
  }

  // 3. Learning readiness
  const MIN_SAMPLES = 5;
  const archetypesWithData = (rewards || []).filter(r => r.sample_count >= MIN_SAMPLES);

  console.log('\n🎯 LEARNING READINESS:');
  console.log('─'.repeat(60));
  console.log(`  Replies with archetype metadata: ${withArch}`);
  console.log(`  Replies with outcomes data:      ${(outcomes || []).filter(o => o.views != null).length}`);
  console.log(`  Archetypes with ${MIN_SAMPLES}+ samples:     ${archetypesWithData.length}/5`);
  console.log(`  Current mode:                    ${archetypesWithData.length >= 2 ? '🟢 EXPLOIT (epsilon-greedy)' : '🟡 EXPLORE (random + context)'}`);

  if (withArch === 0) {
    console.log('\n  ⚠️  No replies have archetype metadata yet.');
    console.log('  → The archetype code is deployed but no new replies have been generated.');
    console.log('  → Run the daemon to generate new replies with archetype tags.');
  }
  if ((outcomes || []).filter(o => o.views != null).length === 0) {
    console.log('\n  ⚠️  No outcomes have views/likes data.');
    console.log('  → The metrics scraper needs to run to populate outcomes.');
    console.log('  → It runs on Mac Runner every 10 min when the daemon is active.');
  }

  const needForExploit = Math.max(0, (MIN_SAMPLES * 2) - withArch);
  if (needForExploit > 0) {
    console.log(`\n  📈 Need ~${needForExploit} more archetype-tagged replies before exploit mode activates.`);
    console.log(`  At 1-2 replies/hour, this takes ~${Math.ceil(needForExploit / 1.5)} hours of daemon operation.`);
  }
}

main().catch(e => { console.error('Fatal:', e.message); process.exit(1); });
