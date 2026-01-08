/**
 * Backfill relevance_score and replyability_score for existing opportunities
 * Only updates rows where both scores are 0 or null
 */

import 'dotenv/config';
import { getSupabaseClient } from '../src/db/index';
import { computeRelevanceScore, computeReplyabilityScore } from '../src/ai/relevanceReplyabilityScorer';

// Parse time window from argv
const timeArg = process.argv.find(arg => arg.startsWith('--minutes='))?.replace('--minutes=', '') ||
                process.argv.find(arg => arg.startsWith('--hours='))?.replace('--hours=', '') ||
                process.argv[2] || '1440'; // Default 24 hours (1440 minutes)

let timeWindowMinutes: number;
if (timeArg.includes('hours')) {
  const hours = parseInt(timeArg.replace('hours', ''), 10);
  timeWindowMinutes = hours * 60;
} else {
  timeWindowMinutes = parseInt(timeArg, 10);
}

if (isNaN(timeWindowMinutes) || timeWindowMinutes <= 0) {
  console.error(`❌ Invalid time window: ${timeArg}`);
  process.exit(1);
}

const cutoffTime = new Date(Date.now() - timeWindowMinutes * 60 * 1000);

async function backfillScores() {
  console.log(`🔄 Backfilling opportunity scores (last ${timeWindowMinutes} minutes)`);
  console.log(`   Cutoff: ${cutoffTime.toISOString()}\n`);
  
  const supabase = getSupabaseClient();
  
  // Find opportunities with scores = 0 or null
  const { data: opportunities, error: queryError } = await supabase
    .from('reply_opportunities')
    .select('target_tweet_id, target_username, target_tweet_content, target_tweet_url, relevance_score, replyability_score, created_at')
    .gte('created_at', cutoffTime.toISOString())
    .or('relevance_score.is.null,relevance_score.eq.0')
    .or('replyability_score.is.null,replyability_score.eq.0')
    .limit(1000); // Process in batches
  
  if (queryError) {
    console.error(`❌ Error querying opportunities: ${queryError.message}`);
    process.exit(1);
  }
  
  if (!opportunities || opportunities.length === 0) {
    console.log(`✅ No opportunities need backfilling (all have scores)`);
    process.exit(0);
  }
  
  console.log(`📊 Found ${opportunities.length} opportunities to backfill\n`);
  
  let updatedCount = 0;
  let skippedCount = 0;
  const samples: any[] = [];
  
  for (const opp of opportunities) {
    // Skip if both scores are already > 0
    const currentRelevance = Number(opp.relevance_score) || 0;
    const currentReplyability = Number(opp.replyability_score) || 0;
    
    if (currentRelevance > 0 && currentReplyability > 0) {
      skippedCount++;
      continue;
    }
    
    // Compute scores
    const relevanceScore = computeRelevanceScore(
      opp.target_tweet_content || '',
      opp.target_username || ''
    );
    const replyabilityScore = computeReplyabilityScore(
      opp.target_tweet_content || ''
    );
    
    // Update if scores changed
    if (relevanceScore !== currentRelevance || replyabilityScore !== currentReplyability) {
      const { error: updateError } = await supabase
        .from('reply_opportunities')
        .update({
          relevance_score: relevanceScore,
          replyability_score: replyabilityScore,
          selection_reason: 'backfill_v1',
        })
        .eq('target_tweet_id', opp.target_tweet_id);
      
      if (updateError) {
        console.error(`❌ Failed to update ${opp.target_tweet_id}: ${updateError.message}`);
        skippedCount++;
        continue;
      }
      
      updatedCount++;
      
      // Collect samples
      if (samples.length < 5) {
        samples.push({
          tweet_id: opp.target_tweet_id,
          author: opp.target_username,
          relevance: relevanceScore.toFixed(2),
          replyability: replyabilityScore.toFixed(2),
        });
      }
    } else {
      skippedCount++;
    }
  }
  
  console.log(`\n✅ Backfill complete:`);
  console.log(`   Scanned: ${opportunities.length}`);
  console.log(`   Updated: ${updatedCount}`);
  console.log(`   Skipped: ${skippedCount}`);
  
  if (samples.length > 0) {
    console.log(`\n📊 Sample updates:`);
    samples.forEach((sample, i) => {
    console.log(`   ${i + 1}. @${sample.author} tweet_id=${sample.tweet_id}`);
    console.log(`      relevance=${sample.relevance} replyability=${sample.replyability}`);
    });
  }
  
  process.exit(0);
}

backfillScores().catch(console.error);

