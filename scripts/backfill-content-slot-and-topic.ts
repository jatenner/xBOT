/**
 * 📊 BACKFILL CONTENT SLOT AND TOPIC INSPECTOR
 * 
 * Read-only script to analyze how many historical rows are missing:
 * - content_slot
 * - raw_topic
 * - v2 metrics (followers_gained_weighted, primary_objective_score)
 * 
 * This script is structured so it can later be flipped to write mode for backfilling.
 * For now, it only queries and logs counts.
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function analyzeBackfillNeeds() {
  console.log('📊 Analyzing backfill needs for content_slot, raw_topic, and v2 metrics...\n');

  try {
    // 1. Content metadata analysis
    const { data: contentStats, error: contentError } = await supabase
      .from('content_generation_metadata_comprehensive')
      .select('id, content_slot, raw_topic, decision_type, created_at', { count: 'exact' });

    if (contentError) {
      console.error('❌ Failed to query content_metadata:', contentError.message);
      return;
    }

    const totalContentRows = contentStats?.length || 0;
    const rowsWithNullSlot = contentStats?.filter(r => !r.content_slot).length || 0;
    const rowsWithNullTopic = contentStats?.filter(r => !r.raw_topic).length || 0;
    const repliesWithNullSlot = contentStats?.filter(r => r.decision_type === 'reply' && !r.content_slot).length || 0;
    const postsWithNullSlot = contentStats?.filter(r => r.decision_type !== 'reply' && !r.content_slot).length || 0;

    console.log('📋 CONTENT_METADATA ANALYSIS:');
    console.log(`   Total rows: ${totalContentRows}`);
    console.log(`   Rows with NULL content_slot: ${rowsWithNullSlot} (${((rowsWithNullSlot / totalContentRows) * 100).toFixed(1)}%)`);
    console.log(`   Rows with NULL raw_topic: ${rowsWithNullTopic} (${((rowsWithNullTopic / totalContentRows) * 100).toFixed(1)}%)`);
    console.log(`   Replies with NULL content_slot: ${repliesWithNullSlot}`);
    console.log(`   Posts with NULL content_slot: ${postsWithNullSlot}`);

    // 2. Outcomes v2 metrics analysis
    const { data: outcomesStats, error: outcomesError } = await supabase
      .from('outcomes')
      .select('decision_id, followers_gained_weighted, primary_objective_score, engagement_rate, collected_at', { count: 'exact' });

    if (outcomesError) {
      console.error('❌ Failed to query outcomes:', outcomesError.message);
      return;
    }

    const totalOutcomesRows = outcomesStats?.length || 0;
    const rowsWithNullV2Followers = outcomesStats?.filter(r => r.followers_gained_weighted === null).length || 0;
    const rowsWithNullV2Primary = outcomesStats?.filter(r => r.primary_objective_score === null).length || 0;
    const rowsWithNullEngagementRate = outcomesStats?.filter(r => r.engagement_rate === null).length || 0;
    const rowsWithBothV2Null = outcomesStats?.filter(r => r.followers_gained_weighted === null && r.primary_objective_score === null).length || 0;

    console.log('\n📊 OUTCOMES V2 METRICS ANALYSIS:');
    console.log(`   Total outcomes rows: ${totalOutcomesRows}`);
    console.log(`   Rows with NULL followers_gained_weighted: ${rowsWithNullV2Followers} (${((rowsWithNullV2Followers / totalOutcomesRows) * 100).toFixed(1)}%)`);
    console.log(`   Rows with NULL primary_objective_score: ${rowsWithNullV2Primary} (${((rowsWithNullV2Primary / totalOutcomesRows) * 100).toFixed(1)}%)`);
    console.log(`   Rows with NULL engagement_rate: ${rowsWithNullEngagementRate} (${((rowsWithNullEngagementRate / totalOutcomesRows) * 100).toFixed(1)}%)`);
    console.log(`   Rows with BOTH v2 metrics NULL: ${rowsWithBothV2Null} (${((rowsWithBothV2Null / totalOutcomesRows) * 100).toFixed(1)}%)`);

    // 3. Recent vs historical breakdown (last 7 days vs older)
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    
    const recentContent = contentStats?.filter(r => r.created_at && new Date(r.created_at) >= new Date(sevenDaysAgo)) || [];
    const recentContentTotal = recentContent.length;
    const recentContentNullSlot = recentContent.filter(r => !r.content_slot).length;
    const recentContentNullTopic = recentContent.filter(r => !r.raw_topic).length;

    const recentOutcomes = outcomesStats?.filter(r => r.collected_at && new Date(r.collected_at) >= new Date(sevenDaysAgo)) || [];
    const recentOutcomesTotal = recentOutcomes.length;
    const recentOutcomesNullV2 = recentOutcomes.filter(r => r.followers_gained_weighted === null && r.primary_objective_score === null).length;

    console.log('\n📅 RECENT (LAST 7 DAYS) ANALYSIS:');
    console.log(`   Content rows: ${recentContentTotal}`);
    console.log(`   Recent content with NULL content_slot: ${recentContentNullSlot} (${recentContentTotal > 0 ? ((recentContentNullSlot / recentContentTotal) * 100).toFixed(1) : 0}%)`);
    console.log(`   Recent content with NULL raw_topic: ${recentContentNullTopic} (${recentContentTotal > 0 ? ((recentContentNullTopic / recentContentTotal) * 100).toFixed(1) : 0}%)`);
    console.log(`   Outcomes rows: ${recentOutcomesTotal}`);
    console.log(`   Recent outcomes with NULL v2 metrics: ${recentOutcomesNullV2} (${recentOutcomesTotal > 0 ? ((recentOutcomesNullV2 / recentOutcomesTotal) * 100).toFixed(1) : 0}%)`);

    // 4. Summary and recommendations
    console.log('\n💡 BACKFILL RECOMMENDATIONS:');
    
    if (recentContentNullSlot > 0) {
      console.log(`   ⚠️  ${recentContentNullSlot} recent content rows missing content_slot - investigate why new content isn't getting slots`);
    } else {
      console.log(`   ✅ Recent content has content_slot coverage`);
    }

    if (recentContentNullTopic > 0) {
      console.log(`   ⚠️  ${recentContentNullTopic} recent content rows missing raw_topic - investigate topic generation failures`);
    } else {
      console.log(`   ✅ Recent content has raw_topic coverage`);
    }

    if (recentOutcomesNullV2 > 0) {
      console.log(`   ⚠️  ${recentOutcomesNullV2} recent outcomes missing v2 metrics - investigate v2 calculation logic`);
    } else {
      console.log(`   ✅ Recent outcomes have v2 metrics coverage`);
    }

    console.log('\n📝 NEXT STEPS:');
    console.log('   1. If recent content has gaps, fix the generation/scraping logic first');
    console.log('   2. For historical backfill, use this script as a template to add UPDATE statements');
    console.log('   3. Backfill strategy:');
    console.log('      - Replies: Set content_slot = \'reply\' for all decision_type = \'reply\'');
    console.log('      - Posts: Infer content_slot from generator_name or decision_type');
    console.log('      - Topics: Extract from existing content or set to \'health_general\'');
    console.log('      - v2 metrics: Recalculate using existing engagement data (if available)');

    console.log('\n✅ Analysis complete. This script is read-only. To enable backfilling, add UPDATE statements.');

  } catch (error: any) {
    console.error('❌ Analysis failed:', error.message);
    process.exit(1);
  }
}

analyzeBackfillNeeds()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('❌ Fatal error:', error);
    process.exit(1);
  });

