/**
 * Content Slot Performance Report
 * 
 * Analyzes performance metrics by content_slot
 * READ-ONLY: No mutations
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config();

interface SlotStats {
  content_slot: string;
  count: number;
  avg_engagement_rate: number | null;
  avg_followers_gained_weighted: number | null;
  top_post: {
    decision_id: string;
    content: string;
    followers_gained_weighted: number | null;
    primary_objective_score: number | null;
    engagement_rate: number | null;
  } | null;
  worst_post: {
    decision_id: string;
    content: string;
    followers_gained_weighted: number | null;
    primary_objective_score: number | null;
    engagement_rate: number | null;
  } | null;
}

async function generateReport() {
  const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  console.log('='.repeat(70));
  console.log('CONTENT SLOT PERFORMANCE REPORT');
  console.log('='.repeat(70));
  console.log('');

  // Get all content with content_slot from vw_learning
  const { data: slotData, error: slotError } = await supabase
    .from('vw_learning')
    .select('decision_id, content_slot, content, followers_gained_weighted, primary_objective_score, engagement_rate')
    .not('content_slot', 'is', null)
    .not('content_slot', 'eq', '');

  if (slotError) {
    console.error('❌ Error fetching slot data:', slotError.message);
    process.exit(1);
  }

  if (!slotData || slotData.length === 0) {
    console.log('⚠️  No slot data found');
    process.exit(0);
  }

  // Group by content_slot
  const slotMap = new Map<string, SlotStats>();

  slotData.forEach((row: any) => {
    const slot = row.content_slot || 'unknown';
    
    if (!slotMap.has(slot)) {
      slotMap.set(slot, {
        content_slot: slot,
        count: 0,
        avg_engagement_rate: null,
        avg_followers_gained_weighted: null,
        top_post: null,
        worst_post: null
      });
    }

    const stats = slotMap.get(slot)!;
    stats.count++;
  });

  // Calculate averages and find top/worst posts for each slot
  slotMap.forEach((stats, slot) => {
    const slotRows = slotData.filter((r: any) => r.content_slot === slot);
    
    // Calculate averages
    const engagementValues = slotRows
      .map((r: any) => r.engagement_rate)
      .filter((v: any) => v !== null && v !== undefined);
    stats.avg_engagement_rate = engagementValues.length > 0
      ? engagementValues.reduce((sum: number, v: number) => sum + v, 0) / engagementValues.length
      : null;

    const followersValues = slotRows
      .map((r: any) => r.followers_gained_weighted)
      .filter((v: any) => v !== null && v !== undefined);
    stats.avg_followers_gained_weighted = followersValues.length > 0
      ? followersValues.reduce((sum: number, v: number) => sum + v, 0) / followersValues.length
      : null;

    // Find top post
    const topPost = [...slotRows]
      .filter((r: any) => r.primary_objective_score !== null || r.followers_gained_weighted !== null)
      .sort((a: any, b: any) => {
        const scoreA = a.primary_objective_score ?? a.followers_gained_weighted ?? 0;
        const scoreB = b.primary_objective_score ?? b.followers_gained_weighted ?? 0;
        return scoreB - scoreA;
      })[0];

    if (topPost) {
      stats.top_post = {
        decision_id: topPost.decision_id,
        content: (topPost.content || '').substring(0, 200),
        followers_gained_weighted: topPost.followers_gained_weighted,
        primary_objective_score: topPost.primary_objective_score,
        engagement_rate: topPost.engagement_rate
      };
    }

    // Find worst post
    const worstPost = [...slotRows]
      .filter((r: any) => r.primary_objective_score !== null || r.followers_gained_weighted !== null)
      .sort((a: any, b: any) => {
        const scoreA = a.primary_objective_score ?? a.followers_gained_weighted ?? 0;
        const scoreB = b.primary_objective_score ?? b.followers_gained_weighted ?? 0;
        return scoreA - scoreB;
      })[0];

    if (worstPost) {
      stats.worst_post = {
        decision_id: worstPost.decision_id,
        content: (worstPost.content || '').substring(0, 200),
        followers_gained_weighted: worstPost.followers_gained_weighted,
        primary_objective_score: worstPost.primary_objective_score,
        engagement_rate: worstPost.engagement_rate
      };
    }
  });

  // Print summary
  console.log('TEXT SUMMARY:');
  console.log('-'.repeat(70));
  
  const sortedSlots = Array.from(slotMap.values())
    .sort((a, b) => b.count - a.count);

  sortedSlots.forEach((stats) => {
    console.log(`\n[${stats.content_slot}]`);
    console.log(`  Count: ${stats.count}`);
    console.log(`  Avg engagement_rate: ${stats.avg_engagement_rate?.toFixed(4) || 'N/A'}`);
    console.log(`  Avg followers_gained_weighted: ${stats.avg_followers_gained_weighted?.toFixed(3) || 'N/A'}`);
    
    if (stats.top_post) {
      console.log(`  Top post: score=${stats.top_post.primary_objective_score?.toFixed(4) || stats.top_post.followers_gained_weighted?.toFixed(3) || 'N/A'}`);
      console.log(`    "${stats.top_post.content}..."`);
    }
    
    if (stats.worst_post) {
      console.log(`  Worst post: score=${stats.worst_post.primary_objective_score?.toFixed(4) || stats.worst_post.followers_gained_weighted?.toFixed(3) || 'N/A'}`);
      console.log(`    "${stats.worst_post.content}..."`);
    }
  });

  // JSON output
  console.log('\n' + '='.repeat(70));
  console.log('JSON OUTPUT:');
  console.log('-'.repeat(70));
  console.log(JSON.stringify(sortedSlots, null, 2));

  console.log('\n' + '='.repeat(70));
  console.log('REPORT COMPLETE');
  console.log('='.repeat(70));
}

generateReport().catch((error) => {
  console.error('❌ Report failed:', error.message);
  process.exit(1);
});

