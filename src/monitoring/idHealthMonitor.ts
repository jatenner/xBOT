/**
 * 🔒 ID HEALTH MONITOR
 * 
 * Monitors the health of ID capture and validation across the system.
 * Alerts when issues are detected.
 */

import { getSupabaseClient } from '../db/index';
import { log } from '../lib/logger';

export interface IDHealthReport {
  timestamp: string;
  missingTweetIds: number;
  invalidTweetIds: number;
  stuckPosts: number;
  recoveryNeeded: number;
  healthScore: number; // 0-100
  alerts: string[];
}

export async function checkIDHealth(): Promise<IDHealthReport> {
  const supabase = getSupabaseClient();
  const alerts: string[] = [];
  
  // Check for missing tweet IDs (last 24 hours)
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { count: missingIds } = await supabase
    .from('content_metadata')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'posted')
    .is('tweet_id', null)
    .gte('posted_at', oneDayAgo);
  
  // Check for stuck posts (status: 'posting' for > 30 minutes)
  const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000).toISOString();
  const { count: stuckPosts } = await supabase
    .from('content_metadata')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'posting')
    .lt('updated_at', thirtyMinutesAgo);
  
  // Check for invalid tweet IDs (non-numeric)
  const { data: allRecent } = await supabase
    .from('content_metadata')
    .select('tweet_id, decision_id')
    .eq('status', 'posted')
    .not('tweet_id', 'is', null)
    .gte('posted_at', oneDayAgo)
    .limit(100);
  
  let invalidTweetIds = 0;
  if (allRecent) {
    for (const post of allRecent) {
      if (post.tweet_id && !/^\d+$/.test(post.tweet_id)) {
        invalidTweetIds++;
      }
    }
  }
  
  // Calculate health score
  const totalPosts = (missingIds || 0) + (allRecent?.length || 0);
  const issues = (missingIds || 0) + invalidTweetIds + (stuckPosts || 0);
  const healthScore = totalPosts > 0 
    ? Math.max(0, Math.round((1 - (issues / totalPosts)) * 100))
    : 100;
  
  // Generate alerts
  if ((missingIds || 0) > 0) {
    alerts.push(`🚨 ${missingIds} posts missing tweet IDs in last 24h`);
  }
  
  if (invalidTweetIds > 0) {
    alerts.push(`🚨 ${invalidTweetIds} posts with invalid tweet ID format`);
  }
  
  if ((stuckPosts || 0) > 0) {
    alerts.push(`🚨 ${stuckPosts} posts stuck in 'posting' status`);
  }
  
  if (healthScore < 80) {
    alerts.push(`⚠️ ID health score below threshold: ${healthScore}%`);
  }
  
  const report: IDHealthReport = {
    timestamp: new Date().toISOString(),
    missingTweetIds: missingIds || 0,
    invalidTweetIds,
    stuckPosts: stuckPosts || 0,
    recoveryNeeded: (missingIds || 0) + invalidTweetIds,
    healthScore,
    alerts
  };
  
  // Log health check
  log({
    op: 'id_health_check',
    health_score: healthScore,
    missing_ids: missingIds || 0,
    invalid_ids: invalidTweetIds,
    stuck_posts: stuckPosts || 0
  });
  
  // Alert if critical
  if (healthScore < 70 || alerts.length > 0) {
    console.error('[ID_HEALTH] 🚨 CRITICAL ID HEALTH ISSUES DETECTED:');
    alerts.forEach(alert => console.error(`[ID_HEALTH]   ${alert}`));
  } else {
    console.log(`[ID_HEALTH] ✅ ID health check passed (score: ${healthScore}%)`);
  }
  
  return report;
}

