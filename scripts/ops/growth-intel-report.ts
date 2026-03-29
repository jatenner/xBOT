#!/usr/bin/env tsx
/**
 * 📊 GROWTH INTELLIGENCE REPORT
 *
 * Shows what's working and what's not across all posting dimensions.
 *
 * Usage: pnpm tsx scripts/ops/growth-intel-report.ts
 */

import 'dotenv/config';
import { runGrowthIntelligence } from '../../src/intelligence/growthIntelligence';

async function main() {
  const snapshot = await runGrowthIntelligence();

  console.log('\n╔══════════════════════════════════════════════════════════════╗');
  console.log('║              GROWTH INTELLIGENCE REPORT                      ║');
  console.log('╚══════════════════════════════════════════════════════════════╝');

  console.log(`\n📊 Data: ${snapshot.total_posts} posts, ${snapshot.total_with_outcomes} with outcomes, ${snapshot.total_replies} replies`);

  if (snapshot.total_with_outcomes === 0) {
    console.log('\n⚠️  No outcome data yet. Need metrics scraper to populate views/likes.');
    return;
  }

  // Action type comparison
  if (snapshot.by_action_type.length > 0) {
    console.log('\n📈 ACTION TYPE PERFORMANCE:');
    console.log('─'.repeat(70));
    console.log('Type       | n   | Avg Views | Avg Likes | Avg ER    | Reward | Followers');
    console.log('─'.repeat(70));
    for (const d of snapshot.by_action_type) {
      const bar = '█'.repeat(Math.min(15, Math.round(d.avg_reward / 2)));
      console.log(`${d.value.padEnd(10)} | ${String(d.sample_count).padStart(3)} | ${d.avg_views.toFixed(0).padStart(9)} | ${d.avg_likes.toFixed(1).padStart(9)} | ${(d.avg_engagement_rate * 100).toFixed(1).padStart(7)}% | ${d.avg_reward.toFixed(1).padStart(6)} | ${d.total_followers_gained} ${bar}`);
    }
  }

  // Archetype comparison
  if (snapshot.by_archetype.length > 0) {
    console.log('\n🎯 REPLY ARCHETYPE PERFORMANCE:');
    console.log('─'.repeat(60));
    for (const d of snapshot.by_archetype) {
      const bar = '█'.repeat(Math.min(15, Math.round(d.avg_reward / 2)));
      console.log(`  ${d.value.padEnd(22)} n=${String(d.sample_count).padStart(2)} reward=${d.avg_reward.toFixed(1).padStart(5)} views=${d.avg_views.toFixed(0).padStart(5)} ${bar}`);
    }
  }

  // Account tier comparison
  if (snapshot.by_account_tier.length > 0) {
    console.log('\n🏢 TARGET ACCOUNT TIER PERFORMANCE:');
    console.log('─'.repeat(60));
    for (const d of snapshot.by_account_tier) {
      const bar = '█'.repeat(Math.min(15, Math.round(d.avg_reward / 2)));
      console.log(`  ${d.value.padEnd(12)} n=${String(d.sample_count).padStart(2)} reward=${d.avg_reward.toFixed(1).padStart(5)} views=${d.avg_views.toFixed(0).padStart(5)} ${bar}`);
    }
  }

  // Hour performance
  if (snapshot.by_hour.length > 0) {
    console.log('\n🕐 POSTING HOUR PERFORMANCE (UTC):');
    console.log('─'.repeat(60));
    const sorted = [...snapshot.by_hour].sort((a, b) => parseInt(a.value) - parseInt(b.value));
    for (const d of sorted) {
      const bar = '█'.repeat(Math.min(15, Math.round(d.avg_reward / 2)));
      console.log(`  ${d.value.padStart(2)}:00 n=${String(d.sample_count).padStart(2)} reward=${d.avg_reward.toFixed(1).padStart(5)} views=${d.avg_views.toFixed(0).padStart(5)} ${bar}`);
    }
  }

  // Recommendations
  console.log('\n💡 RECOMMENDATIONS:');
  console.log('─'.repeat(60));
  if (snapshot.best_action_type) console.log(`  Best action type: ${snapshot.best_action_type}`);
  if (snapshot.best_archetype) console.log(`  Best archetype: ${snapshot.best_archetype}`);
  if (snapshot.best_account_tier) console.log(`  Best target tier: ${snapshot.best_account_tier}`);
  if (snapshot.best_hours.length > 0) console.log(`  Best hours (UTC): ${snapshot.best_hours.join(', ')}`);

  if (!snapshot.best_action_type && !snapshot.best_archetype) {
    console.log('  Need 3+ samples per dimension for recommendations.');
    console.log('  Keep running the daemon to accumulate data.');
  }
}

main().catch(e => { console.error('Fatal:', e.message); process.exit(1); });
