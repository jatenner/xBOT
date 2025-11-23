/**
 * 🔧 SELF-HEALING JOB
 * Automatically detects and recovers from common system failures
 * Runs every 15 minutes to ensure system health
 */

import { getSupabaseClient } from '../db/index';
import { trackError } from '../utils/errorTracker';
import { BrowserSemaphore } from '../browser/BrowserSemaphore';

export interface HealingAction {
  type: string;
  description: string;
  severity: 'critical' | 'warning' | 'info';
  action: string;
  success: boolean;
  timestamp: string;
}

export interface HealingReport {
  timestamp: string;
  actions: HealingAction[];
  systemHealth: {
    stuckPosts: number;
    nullTweetIds: number;
    browserIssues: number;
    databaseIssues: number;
    circuitBreakerOpen: boolean;
  };
}

export async function runSelfHealing(): Promise<HealingReport> {
  console.log('[SELF_HEALING] 🔧 Starting self-healing cycle...');
  
  const actions: HealingAction[] = [];
  const supabase = getSupabaseClient();
  
  try {
    // 1. RECOVER STUCK POSTS (status='posting' >30min)
    const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000).toISOString();
    const { data: stuckPosts, error: stuckError } = await supabase
      .from('content_metadata')
      .select('decision_id, decision_type, created_at, status')
      .eq('status', 'posting')
      .lt('created_at', thirtyMinutesAgo);
    
    if (!stuckError && stuckPosts && stuckPosts.length > 0) {
      console.log(`[SELF_HEALING] 🔄 Found ${stuckPosts.length} stuck posts, recovering...`);
      
      for (const post of stuckPosts) {
        const { error: updateError } = await supabase
          .from('content_metadata')
          .update({ 
            status: 'queued',
            updated_at: new Date().toISOString()
          })
          .eq('decision_id', post.decision_id);
        
        if (!updateError) {
          actions.push({
            type: 'stuck_post_recovery',
            description: `Recovered stuck ${post.decision_type} post: ${post.decision_id}`,
            severity: 'warning',
            action: 'reset_status_to_queued',
            success: true,
            timestamp: new Date().toISOString()
          });
          console.log(`[SELF_HEALING] ✅ Recovered stuck post: ${post.decision_id}`);
        } else {
          actions.push({
            type: 'stuck_post_recovery',
            description: `Failed to recover stuck post: ${post.decision_id}`,
            severity: 'warning',
            action: 'reset_status_to_queued',
            success: false,
            timestamp: new Date().toISOString()
          });
        }
      }
    }
    
    // 2. RECOVER NULL TWEET IDs (posted but missing ID)
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { data: nullIds, error: nullError } = await supabase
      .from('content_metadata')
      .select('decision_id, decision_type, posted_at, tweet_id')
      .eq('status', 'posted')
      .is('tweet_id', null)
      .gte('posted_at', oneDayAgo);
    
    if (!nullError && nullIds && nullIds.length > 0) {
      console.log(`[SELF_HEALING] 🔍 Found ${nullIds.length} posts with NULL tweet_id`);
      
      // Mark for recovery (tweet ID recovery job will handle actual recovery)
      for (const post of nullIds) {
        const { error: markError } = await supabase
          .from('content_metadata')
          .update({
            status: 'queued', // Reset to queued so recovery job can process
            updated_at: new Date().toISOString()
          })
          .eq('decision_id', post.decision_id);
        
        if (!markError) {
          actions.push({
            type: 'null_tweet_id_recovery',
            description: `Marked ${post.decision_type} post for ID recovery: ${post.decision_id}`,
            severity: 'warning',
            action: 'mark_for_id_recovery',
            success: true,
            timestamp: new Date().toISOString()
          });
        }
      }
    }
    
    // 3. CHECK BROWSER SEMAPHORE HEALTH
    const browserSemaphore = BrowserSemaphore.getInstance();
    const browserStatus = browserSemaphore.getStatus();
    
    // Check if any jobs are stuck (would need job timestamps to detect, but we can check queue length)
    if (browserStatus.queued > 5) {
      console.warn(`[SELF_HEALING] ⚠️ Browser queue backed up: ${browserStatus.queued} jobs waiting`);
      actions.push({
        type: 'browser_queue_health',
        description: `Browser queue has ${browserStatus.queued} jobs waiting (active: ${browserStatus.active.join(', ') || 'none'})`,
        severity: 'warning',
        action: 'monitor_browser_queue',
        success: true,
        timestamp: new Date().toISOString()
      });
    }
    
    // If queue is extremely backed up, consider force release (but be careful)
    if (browserStatus.queued > 10 && browserStatus.active.length > 0) {
      console.warn(`[SELF_HEALING] ⚠️ Browser queue severely backed up, considering force release...`);
      // Don't auto-force release - log for manual intervention
      actions.push({
        type: 'browser_queue_critical',
        description: `Browser queue critically backed up: ${browserStatus.queued} jobs (manual intervention may be needed)`,
        severity: 'critical',
        action: 'monitor_browser_queue',
        success: false,
        timestamp: new Date().toISOString()
      });
    }
    
    // 4. CHECK DATABASE CONNECTION HEALTH
    try {
      const { error: healthError } = await supabase
        .from('content_metadata')
        .select('decision_id')
        .limit(1);
      
      if (healthError) {
        console.error(`[SELF_HEALING] ❌ Database health check failed: ${healthError.message}`);
        actions.push({
          type: 'database_health_check',
          description: `Database connection issue: ${healthError.message}`,
          severity: 'critical',
          action: 'health_check',
          success: false,
          timestamp: new Date().toISOString()
        });
      } else {
        actions.push({
          type: 'database_health_check',
          description: 'Database connection healthy',
          severity: 'info',
          action: 'health_check',
          success: true,
          timestamp: new Date().toISOString()
        });
      }
    } catch (dbError: any) {
      actions.push({
        type: 'database_health_check',
        description: `Database check exception: ${dbError.message}`,
        severity: 'critical',
        action: 'health_check',
        success: false,
        timestamp: new Date().toISOString()
      });
    }
    
    // 5. CHECK FOR CIRCUIT BREAKER STATE (would need to expose this from postingQueue)
    // This is informational - circuit breaker auto-resets, but we log it
    
    // 6. CLEAN UP OLD FAILED POSTS (>7 days old, status='failed')
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const { data: oldFailed, error: oldFailedError } = await supabase
      .from('content_metadata')
      .select('decision_id')
      .eq('status', 'failed')
      .lt('created_at', sevenDaysAgo)
      .limit(50); // Limit cleanup batch
    
    if (!oldFailedError && oldFailed && oldFailed.length > 0) {
      // Archive old failed posts (could move to archive table, or just update status)
      const { error: archiveError } = await supabase
        .from('content_metadata')
        .update({ 
          status: 'archived',
          updated_at: new Date().toISOString()
        })
        .in('decision_id', oldFailed.map(p => p.decision_id));
      
      if (!archiveError) {
        actions.push({
          type: 'cleanup_old_failed',
          description: `Archived ${oldFailed.length} old failed posts (>7 days)`,
          severity: 'info',
          action: 'archive_old_failed',
          success: true,
          timestamp: new Date().toISOString()
        });
        console.log(`[SELF_HEALING] ✅ Archived ${oldFailed.length} old failed posts`);
      }
    }
    
    // 7. GENERATE HEALTH REPORT
    const { data: stuckCount } = await supabase
      .from('content_metadata')
      .select('decision_id', { count: 'exact', head: true })
      .eq('status', 'posting')
      .lt('created_at', thirtyMinutesAgo);
    
    const { data: nullIdCount } = await supabase
      .from('content_metadata')
      .select('decision_id', { count: 'exact', head: true })
      .eq('status', 'posted')
      .is('tweet_id', null)
      .gte('posted_at', oneDayAgo);
    
    const report: HealingReport = {
      timestamp: new Date().toISOString(),
      actions,
      systemHealth: {
        stuckPosts: stuckCount?.length || 0,
        nullTweetIds: nullIdCount?.length || 0,
        browserIssues: browserStatus.queued > 5 ? 1 : 0,
        databaseIssues: actions.filter(a => a.type === 'database_health_check' && !a.success).length,
        circuitBreakerOpen: false // Would need to check from postingQueue
      }
    };
    
    // Store report in system_events
    await supabase.from('system_events').insert({
      event_type: 'self_healing_report',
      severity: actions.some(a => a.severity === 'critical') ? 'error' : 'info',
      event_data: report,
      created_at: new Date().toISOString()
    });
    
    const successCount = actions.filter(a => a.success).length;
    const criticalCount = actions.filter(a => a.severity === 'critical').length;
    
    console.log(`[SELF_HEALING] ✅ Healing cycle complete:`);
    console.log(`  Actions: ${successCount}/${actions.length} successful`);
    console.log(`  Critical issues: ${criticalCount}`);
    console.log(`  System health: ${JSON.stringify(report.systemHealth)}`);
    
    return report;
    
  } catch (error: any) {
    console.error('[SELF_HEALING] ❌ Self-healing cycle failed:', error.message);
    
    await trackError(
      'self_healing',
      'healing_cycle_failed',
      error.message,
      'error',
      { error_stack: error.stack?.substring(0, 300) }
    );
    
    return {
      timestamp: new Date().toISOString(),
      actions: [{
        type: 'healing_cycle_failure',
        description: `Self-healing cycle failed: ${error.message}`,
        severity: 'critical',
        action: 'healing_cycle',
        success: false,
        timestamp: new Date().toISOString()
      }],
      systemHealth: {
        stuckPosts: 0,
        nullTweetIds: 0,
        browserIssues: 0,
        databaseIssues: 1,
        circuitBreakerOpen: false
      }
    };
  }
}

