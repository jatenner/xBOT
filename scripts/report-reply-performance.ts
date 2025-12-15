/**
 * Reply Performance Report
 * 
 * Analyzes reply performance metrics
 * READ-ONLY: No mutations
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config();

interface ReplyStats {
  target_username: string;
  priority_score: number | null;
  followers_gained: number | null;
  engagement_rate: number | null;
  primary_objective_score: number | null;
  reply_type: string | null;
  generator_used: string | null;
  decision_id: string;
  content: string;
}

async function generateReport() {
  const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  console.log('='.repeat(70));
  console.log('REPLY PERFORMANCE REPORT');
  console.log('='.repeat(70));
  console.log('');

  // Get replies from vw_learning (where content_slot='reply')
  const { data: replies, error: repliesError } = await supabase
    .from('vw_learning')
    .select('decision_id, target_username, content, generator_name, followers_gained_weighted, primary_objective_score, engagement_rate')
    .eq('content_slot', 'reply')
    .not('target_username', 'is', null);

  if (repliesError) {
    console.error('❌ Error fetching replies:', repliesError.message);
    process.exit(1);
  }

  if (!replies || replies.length === 0) {
    console.log('⚠️  No reply data found');
    process.exit(0);
  }

  // Get priority scores from discovered_accounts
  const usernames = [...new Set(replies.map((r: any) => r.target_username).filter(Boolean))];
  const { data: accounts } = await supabase
    .from('discovered_accounts')
    .select('username, priority_score')
    .in('username', usernames.map((u: string) => u.toLowerCase()));

  const priorityMap = new Map<string, number>();
  accounts?.forEach((acc: any) => {
    priorityMap.set(acc.username.toLowerCase(), acc.priority_score || 0);
  });

  // Build reply stats
  const replyStats: ReplyStats[] = replies.map((r: any) => ({
    target_username: r.target_username,
    priority_score: priorityMap.get(r.target_username?.toLowerCase() || '') || null,
    followers_gained: r.followers_gained_weighted,
    engagement_rate: r.engagement_rate,
    primary_objective_score: r.primary_objective_score,
    reply_type: 'reply', // Could be enhanced with more specific types
    generator_used: r.generator_name,
    decision_id: r.decision_id,
    content: (r.content || '').substring(0, 280)
  }));

  // Sort by performance (primary_objective_score or followers_gained)
  const sortedByPerformance = [...replyStats].sort((a, b) => {
    const scoreA = a.primary_objective_score ?? a.followers_gained ?? 0;
    const scoreB = b.primary_objective_score ?? b.followers_gained ?? 0;
    return scoreB - scoreA;
  });

  const best5 = sortedByPerformance.slice(0, 5);
  const worst5 = sortedByPerformance.slice(-5).reverse();

  // Print summary
  console.log(`Total replies analyzed: ${replyStats.length}`);
  console.log('');

  // Aggregate stats
  const avgFollowers = replyStats
    .map(r => r.followers_gained)
    .filter((v): v is number => v !== null && v !== undefined)
    .reduce((sum, v, _, arr) => sum + v / arr.length, 0);
  
  const avgEngagement = replyStats
    .map(r => r.engagement_rate)
    .filter((v): v is number => v !== null && v !== undefined)
    .reduce((sum, v, _, arr) => sum + v / arr.length, 0);

  const avgPriority = replyStats
    .map(r => r.priority_score)
    .filter((v): v is number => v !== null && v !== undefined)
    .reduce((sum, v, _, arr) => sum + v / arr.length, 0);

  console.log('AGGREGATE STATS:');
  console.log(`  Avg followers_gained_weighted: ${avgFollowers.toFixed(3)}`);
  console.log(`  Avg engagement_rate: ${avgEngagement.toFixed(4)}`);
  console.log(`  Avg priority_score: ${avgPriority.toFixed(3)}`);
  console.log('');

  // Best 5 replies
  console.log('BEST 5 REPLIES:');
  console.log('-'.repeat(70));
  best5.forEach((reply, i) => {
    console.log(`\n${i + 1}. @${reply.target_username}`);
    console.log(`   Priority: ${reply.priority_score?.toFixed(3) || 'N/A'}`);
    console.log(`   Followers gained: ${reply.followers_gained?.toFixed(3) || 'N/A'}`);
    console.log(`   Engagement rate: ${reply.engagement_rate?.toFixed(4) || 'N/A'}`);
    console.log(`   Primary score: ${reply.primary_objective_score?.toFixed(4) || 'N/A'}`);
    console.log(`   Generator: ${reply.generator_used || 'N/A'}`);
    console.log(`   Content: "${reply.content}..."`);
  });

  console.log('\n' + '='.repeat(70));
  console.log('WORST 5 REPLIES:');
  console.log('-'.repeat(70));
  worst5.forEach((reply, i) => {
    console.log(`\n${i + 1}. @${reply.target_username}`);
    console.log(`   Priority: ${reply.priority_score?.toFixed(3) || 'N/A'}`);
    console.log(`   Followers gained: ${reply.followers_gained?.toFixed(3) || 'N/A'}`);
    console.log(`   Engagement rate: ${reply.engagement_rate?.toFixed(4) || 'N/A'}`);
    console.log(`   Primary score: ${reply.primary_objective_score?.toFixed(4) || 'N/A'}`);
    console.log(`   Generator: ${reply.generator_used || 'N/A'}`);
    console.log(`   Content: "${reply.content}..."`);
  });

  // JSON output
  console.log('\n' + '='.repeat(70));
  console.log('JSON OUTPUT:');
  console.log('-'.repeat(70));
  console.log(JSON.stringify({
    total_replies: replyStats.length,
    aggregate_stats: {
      avg_followers_gained_weighted: avgFollowers,
      avg_engagement_rate: avgEngagement,
      avg_priority_score: avgPriority
    },
    best_5: best5,
    worst_5: worst5
  }, null, 2));

  console.log('\n' + '='.repeat(70));
  console.log('REPORT COMPLETE');
  console.log('='.repeat(70));
}

generateReport().catch((error) => {
  console.error('❌ Report failed:', error.message);
  process.exit(1);
});

