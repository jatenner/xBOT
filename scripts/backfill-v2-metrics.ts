#!/usr/bin/env tsx
/**
 * Backfill v2 metrics for existing outcomes
 * This script calculates v2 metrics for outcomes that don't have them yet
 */

import 'dotenv/config';
import { getSupabaseClient } from '../src/db';
import { 
  calculateV2ObjectiveMetrics, 
  extractContentStructureTypes,
  type FollowerAttributionData,
  type EngagementMetrics 
} from '../src/utils/v2ObjectiveScoreCalculator';

async function backfillV2Metrics() {
  const supabase = getSupabaseClient();
  
  console.log('[BACKFILL_V2] 🔍 Finding outcomes without v2 metrics...');
  
  // Get outcomes from last 3 days without v2 metrics
  const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);
  const { data: outcomes, error: fetchError } = await supabase
    .from('outcomes')
    .select('decision_id, tweet_id, engagement_rate, impressions, views, likes, retweets, replies, followers_gained, followers_before, followers_after, collected_at')
    .gte('collected_at', threeDaysAgo.toISOString())
    .or('followers_gained_weighted.is.null,primary_objective_score.is.null')
    .limit(50);
  
  if (fetchError) {
    console.error('[BACKFILL_V2] ❌ Failed to fetch outcomes:', fetchError.message);
    process.exit(1);
  }
  
  if (!outcomes || outcomes.length === 0) {
    console.log('[BACKFILL_V2] ✅ No outcomes need v2 metrics backfill');
    process.exit(0);
  }
  
  console.log(`[BACKFILL_V2] 📊 Found ${outcomes.length} outcomes to process`);
  
  let updated = 0;
  let failed = 0;
  
  for (const outcome of outcomes) {
    try {
      // Calculate engagement_rate if missing
      const viewsValue = outcome.views || outcome.impressions || 0;
      const likesValue = outcome.likes || 0;
      const retweetsValue = outcome.retweets || 0;
      const repliesValue = outcome.replies || 0;
      
      const engagementRate = outcome.engagement_rate !== null && outcome.engagement_rate !== undefined
        ? outcome.engagement_rate
        : (viewsValue > 0 ? ((likesValue + retweetsValue + repliesValue) / viewsValue) : 0);
      
      // Prepare follower attribution data
      const followersGained = outcome.followers_gained || 0;
      const attributionData: FollowerAttributionData = {
        followers_gained: followersGained,
        followers_before: outcome.followers_before,
        followers_after: outcome.followers_after,
        hours_since_post: outcome.collected_at 
          ? (Date.now() - new Date(outcome.collected_at).getTime()) / (1000 * 60 * 60)
          : undefined
      };
      
      const engagementData: EngagementMetrics = {
        engagement_rate: engagementRate,
        impressions: viewsValue,
        likes: likesValue,
        retweets: retweetsValue,
        replies: repliesValue
      };
      
      // Calculate v2 metrics
      const v2Result = calculateV2ObjectiveMetrics(attributionData, engagementData);
      
      // Get content for structure type extraction
      const { data: contentData } = await supabase
        .from('content_metadata')
        .select('content, decision_type')
        .eq('decision_id', outcome.decision_id)
        .single();
      
      let hook_type: string | undefined;
      let cta_type: string | undefined;
      let structure_type: string | undefined;
      
      if (contentData?.content) {
        const structureTypes = extractContentStructureTypes(
          contentData.content,
          contentData.decision_type
        );
        hook_type = structureTypes.hook_type;
        cta_type = structureTypes.cta_type;
        structure_type = structureTypes.structure_type;
      }
      
      // Update outcomes with v2 metrics
      const { error: updateError } = await supabase
        .from('outcomes')
        .update({
          followers_gained_weighted: v2Result.followers_gained_weighted,
          primary_objective_score: v2Result.primary_objective_score,
          hook_type,
          cta_type,
          structure_type
        })
        .eq('decision_id', outcome.decision_id);
      
      if (updateError) {
        console.error(`[BACKFILL_V2] ❌ Failed to update ${outcome.decision_id}:`, updateError.message);
        failed++;
      } else {
        console.log(`[BACKFILL_V2] ✅ Updated ${outcome.decision_id}: weighted=${v2Result.followers_gained_weighted.toFixed(2)}, score=${v2Result.primary_objective_score.toFixed(4)}`);
        updated++;
      }
      
    } catch (error: any) {
      console.error(`[BACKFILL_V2] ❌ Error processing ${outcome.decision_id}:`, error.message);
      failed++;
    }
  }
  
  console.log(`[BACKFILL_V2] ✅ Backfill complete: ${updated} updated, ${failed} failed`);
}

backfillV2Metrics()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('[BACKFILL_V2] ❌ Fatal error:', error.message);
    console.error(error.stack);
    process.exit(1);
  });

