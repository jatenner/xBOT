/**
 * 🏥 CONTINUOUS HEALTH MONITORING
 * Runs every 10 minutes to check system health
 * Logs issues and alerts on problems
 */

import { getSupabaseClient } from '../db/index';

interface HealthMetric {
  component: string;
  status: 'healthy' | 'warning' | 'critical';
  value: any;
  threshold?: any;
  message: string;
}

export async function runHealthCheck(): Promise<void> {
  const metrics: HealthMetric[] = [];
  
  console.log('🏥 HEALTH_CHECK: Running system health check...');
  
  const supabase = getSupabaseClient();

  try {
    // ============================================================
    // 1. Content Pipeline Health
    // ============================================================
    
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

    // Check content generation (should have some in last 6 hours)
    const sixHoursAgo = new Date(Date.now() - 6 * 60 * 60 * 1000);
    const { count: recentGeneration } = await supabase
      .from('content_metadata')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', sixHoursAgo.toISOString());

    if ((recentGeneration || 0) > 0) {
      metrics.push({
        component: 'Content Generation',
        status: 'healthy',
        value: recentGeneration,
        threshold: '> 0 in 6h',
        message: `Generated ${recentGeneration} pieces in last 6h`
      });
    } else {
      metrics.push({
        component: 'Content Generation',
        status: 'critical',
        value: 0,
        threshold: '> 0 in 6h',
        message: 'No content generated in last 6 hours!'
      });
    }

    // Check posting (should have posted something today)
    const { count: postsToday } = await supabase
      .from('posted_decisions')
      .select('*', { count: 'exact', head: true })
      .in('decision_type', ['single', 'thread'])
      .gte('posted_at', oneDayAgo.toISOString());

    if ((postsToday || 0) > 5) {
      metrics.push({
        component: 'Content Posting',
        status: 'healthy',
        value: postsToday,
        threshold: '> 5/day',
        message: `Posted ${postsToday} tweets today`
      });
    } else if ((postsToday || 0) > 0) {
      metrics.push({
        component: 'Content Posting',
        status: 'warning',
        value: postsToday,
        threshold: '> 5/day',
        message: `Only ${postsToday} posts today (low volume)`
      });
    } else {
      metrics.push({
        component: 'Content Posting',
        status: 'critical',
        value: 0,
        threshold: '> 0/day',
        message: 'No posts today! Posting may be broken'
      });
    }

    // ============================================================
    // 2. Queue Health
    // ============================================================

    const { count: queuedContent } = await supabase
      .from('content_metadata')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'queued')
      .in('decision_type', ['single', 'thread']);

    if ((queuedContent || 0) > 0 && (queuedContent || 0) < 10) {
      metrics.push({
        component: 'Content Queue',
        status: 'healthy',
        value: queuedContent,
        threshold: '1-10',
        message: `${queuedContent} posts queued (healthy)`
      });
    } else if ((queuedContent || 0) === 0) {
      metrics.push({
        component: 'Content Queue',
        status: 'warning',
        value: 0,
        threshold: '> 0',
        message: 'Queue empty - generation may have stopped'
      });
    } else {
      metrics.push({
        component: 'Content Queue',
        status: 'warning',
        value: queuedContent,
        threshold: '< 10',
        message: `${queuedContent} posts queued (high - may indicate posting issues)`
      });
    }

    // Check for stuck items
    const { count: stuckItems } = await supabase
      .from('content_metadata')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'queued')
      .lt('created_at', oneDayAgo.toISOString());

    if ((stuckItems || 0) > 20) {
      metrics.push({
        component: 'Stuck Queue Items',
        status: 'critical',
        value: stuckItems,
        threshold: '< 20',
        message: `${stuckItems} items stuck in queue >24h - needs cleanup!`
      });
    } else if ((stuckItems || 0) > 5) {
      metrics.push({
        component: 'Stuck Queue Items',
        status: 'warning',
        value: stuckItems,
        threshold: '< 5',
        message: `${stuckItems} old queued items`
      });
    }

    // ============================================================
    // 3. Reply System Health
    // ============================================================

    const { count: repliesPosted } = await supabase
      .from('posted_decisions')
      .select('*', { count: 'exact', head: true })
      .eq('decision_type', 'reply')
      .gte('posted_at', oneDayAgo.toISOString());

    const replyEnabled = process.env.ENABLE_REPLIES === 'true';

    if (replyEnabled) {
      if ((repliesPosted || 0) > 10) {
        metrics.push({
          component: 'Reply Posting',
          status: 'healthy',
          value: repliesPosted,
          threshold: '> 10/day',
          message: `Posted ${repliesPosted} replies today`
        });
      } else if ((repliesPosted || 0) > 0) {
        metrics.push({
          component: 'Reply Posting',
          status: 'warning',
          value: repliesPosted,
          threshold: '> 10/day',
          message: `Only ${repliesPosted} replies today (low volume)`
        });
      } else {
        metrics.push({
          component: 'Reply Posting',
          status: 'critical',
          value: 0,
          threshold: '> 0/day',
          message: 'No replies posted despite being enabled!'
        });
      }
    } else {
      metrics.push({
        component: 'Reply Posting',
        status: 'warning',
        value: 'disabled',
        message: 'Reply system disabled via ENABLE_REPLIES=false'
      });
    }

    // Check reply opportunities pool
    const { count: opportunities } = await supabase
      .from('reply_opportunities')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'pending')
      .gte('tweet_posted_at', oneDayAgo.toISOString());

    if ((opportunities || 0) > 50) {
      metrics.push({
        component: 'Reply Opportunities',
        status: 'healthy',
        value: opportunities,
        threshold: '> 50',
        message: `${opportunities} fresh opportunities available`
      });
    } else if ((opportunities || 0) > 10) {
      metrics.push({
        component: 'Reply Opportunities',
        status: 'warning',
        value: opportunities,
        threshold: '> 50',
        message: `Only ${opportunities} opportunities (harvester may need boost)`
      });
    } else {
      metrics.push({
        component: 'Reply Opportunities',
        status: 'critical',
        value: opportunities || 0,
        threshold: '> 10',
        message: 'Very few reply opportunities! Harvester may be broken'
      });
    }

    // ============================================================
    // 4. Rate Limit Check
    // ============================================================

    const { count: postsThisHour } = await supabase
      .from('posted_decisions')
      .select('*', { count: 'exact', head: true })
      .in('decision_type', ['single', 'thread'])
      .gte('posted_at', oneHourAgo.toISOString());

    const maxPostsPerHour = parseInt(process.env.MAX_POSTS_PER_HOUR || '2');

    if ((postsThisHour || 0) >= maxPostsPerHour) {
      metrics.push({
        component: 'Posting Rate',
        status: 'warning',
        value: `${postsThisHour}/${maxPostsPerHour}`,
        message: 'At hourly limit (normal, not a problem)'
      });
    }

    const { count: repliesThisHour } = await supabase
      .from('posted_decisions')
      .select('*', { count: 'exact', head: true })
      .eq('decision_type', 'reply')
      .gte('posted_at', oneHourAgo.toISOString());

    const maxRepliesPerHour = parseInt(process.env.REPLIES_PER_HOUR || '8');

    if ((repliesThisHour || 0) >= maxRepliesPerHour) {
      metrics.push({
        component: 'Reply Rate',
        status: 'warning',
        value: `${repliesThisHour}/${maxRepliesPerHour}`,
        message: 'At hourly reply limit (normal)'
      });
    }

    // ============================================================
    // 5. Engagement Tracking
    // ============================================================

    const { data: recentWithMetrics } = await supabase
      .from('content_metadata')
      .select('actual_impressions')
      .not('actual_impressions', 'is', null)
      .gte('created_at', oneDayAgo.toISOString());

    if (recentWithMetrics && recentWithMetrics.length > 0) {
      const avgViews = recentWithMetrics.reduce((sum, p) => sum + (Number(p.actual_impressions) || 0), 0) / recentWithMetrics.length;
      
      metrics.push({
        component: 'Engagement Tracking',
        status: 'healthy',
        value: Math.round(avgViews),
        message: `Avg ${Math.round(avgViews)} views per post (${recentWithMetrics.length} posts tracked)`
      });
    } else {
      metrics.push({
        component: 'Engagement Tracking',
        status: 'warning',
        value: 'none',
        message: 'No engagement metrics collected today'
      });
    }

    // ============================================================
    // Log Results
    // ============================================================

    const healthy = metrics.filter(m => m.status === 'healthy').length;
    const warnings = metrics.filter(m => m.status === 'warning').length;
    const critical = metrics.filter(m => m.status === 'critical').length;

    console.log(`🏥 HEALTH_CHECK: ${healthy} healthy, ${warnings} warnings, ${critical} critical`);

    // Log critical issues prominently
    const criticalIssues = metrics.filter(m => m.status === 'critical');
    if (criticalIssues.length > 0) {
      console.log('🚨 HEALTH_CHECK: CRITICAL ISSUES DETECTED:');
      criticalIssues.forEach(issue => {
        console.log(`   ❌ ${issue.component}: ${issue.message}`);
      });
    }

    // Log warnings
    const warningIssues = metrics.filter(m => m.status === 'warning');
    if (warningIssues.length > 0) {
      console.log('⚠️  HEALTH_CHECK: Warnings:');
      warningIssues.forEach(warning => {
        console.log(`   ⚠️  ${warning.component}: ${warning.message}`);
      });
    }

    // Store health snapshot in database for trending
    try {
      await supabase.from('health_snapshots').insert([{
        timestamp: new Date().toISOString(),
        healthy_count: healthy,
        warning_count: warnings,
        critical_count: critical,
        metrics: metrics,
        overall_status: critical > 0 ? 'critical' : warnings > 2 ? 'warning' : 'healthy'
      }]);
    } catch (error: any) {
      // Table might not exist yet, that's okay
      console.log('📊 HEALTH_CHECK: Could not store snapshot (table may not exist)');
    }

    console.log('✅ HEALTH_CHECK: Completed successfully');

  } catch (error: any) {
    console.error('❌ HEALTH_CHECK: Error during health check:', error.message);
  }
}

