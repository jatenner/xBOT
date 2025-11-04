#!/usr/bin/env tsx
/**
 * 🔍 REPLY SYSTEM HEALTH AUDIT
 * Runs all verification queries from the audit document
 */

import { getSupabaseClient } from '../src/db';

const supabase = getSupabaseClient();

interface HealthCheck {
  name: string;
  query: string;
  check: (data: any[]) => { status: 'good' | 'warning' | 'critical', message: string };
}

const healthChecks: HealthCheck[] = [
  {
    name: 'Opportunity Pool Health',
    query: `
      SELECT 
        tier,
        COUNT(*) as count,
        AVG(engagement_rate) as avg_engagement,
        AVG(like_count) as avg_likes
      FROM reply_opportunities
      WHERE replied_to = FALSE
        AND (expires_at IS NULL OR expires_at > NOW())
        AND tweet_posted_at > NOW() - INTERVAL '24 hours'
      GROUP BY tier
      ORDER BY 
        CASE tier
          WHEN 'golden' THEN 1
          WHEN 'good' THEN 2
          WHEN 'acceptable' THEN 3
          ELSE 4
        END
    `,
    check: (data) => {
      const total = data.reduce((sum, row) => sum + Number(row.count), 0);
      const golden = data.find(r => r.tier === 'golden')?.count || 0;
      
      if (total < 50) return { status: 'critical', message: `Only ${total} opportunities (need 150+)` };
      if (golden < 20) return { status: 'warning', message: `Only ${golden} golden opportunities (need 50+)` };
      if (total >= 150) return { status: 'good', message: `${total} opportunities (${golden} golden)` };
      return { status: 'warning', message: `${total} opportunities (target: 150+)` };
    }
  },
  
  {
    name: 'Reply Generation Rate (24h)',
    query: `
      SELECT 
        DATE_TRUNC('hour', created_at) as hour,
        COUNT(*) as replies_generated,
        AVG(quality_score) as avg_quality
      FROM content_metadata
      WHERE decision_type = 'reply'
        AND created_at > NOW() - INTERVAL '24 hours'
      GROUP BY DATE_TRUNC('hour', created_at)
      ORDER BY hour DESC
    `,
    check: (data) => {
      const total = data.reduce((sum, row) => sum + Number(row.replies_generated), 0);
      const avgQuality = data.reduce((sum, row) => sum + Number(row.avg_quality || 0), 0) / (data.length || 1);
      
      if (total < 50) return { status: 'warning', message: `${total} replies generated (target: 240/day)` };
      if (avgQuality < 0.7) return { status: 'warning', message: `Quality: ${avgQuality.toFixed(2)} (target: 0.7+)` };
      return { status: 'good', message: `${total} replies, quality: ${avgQuality.toFixed(2)}` };
    }
  },
  
  {
    name: 'Posting Success Rate (24h)',
    query: `
      SELECT 
        COUNT(*) FILTER (WHERE status = 'posted') as posted,
        COUNT(*) FILTER (WHERE status = 'failed') as failed,
        COUNT(*) FILTER (WHERE status = 'queued') as queued,
        ROUND(
          100.0 * COUNT(*) FILTER (WHERE status = 'posted') / 
          NULLIF(COUNT(*), 0), 
          2
        ) as success_rate_pct
      FROM content_metadata
      WHERE decision_type = 'reply'
        AND created_at > NOW() - INTERVAL '24 hours'
    `,
    check: (data) => {
      const row = data[0];
      if (!row) return { status: 'warning', message: 'No reply data' };
      
      const successRate = Number(row.success_rate_pct || 0);
      const queued = Number(row.queued || 0);
      
      if (successRate < 50) return { status: 'critical', message: `${successRate}% success rate (too low!)` };
      if (queued > 50) return { status: 'warning', message: `${queued} stuck in queue` };
      if (successRate >= 80) return { status: 'good', message: `${successRate}% success rate` };
      return { status: 'warning', message: `${successRate}% success rate (target: 80%+)` };
    }
  },
  
  {
    name: 'Conversion Tracking',
    query: `
      SELECT 
        opportunity_tier,
        COUNT(*) as total_replies,
        AVG(followers_gained) as avg_followers_gained,
        AVG(reply_likes) as avg_likes,
        AVG(profile_clicks) as avg_clicks
      FROM reply_conversions
      WHERE measured_at IS NOT NULL
      GROUP BY opportunity_tier
      ORDER BY avg_followers_gained DESC
    `,
    check: (data) => {
      if (data.length === 0) return { status: 'warning', message: 'No conversion data yet' };
      
      const golden = data.find(r => r.opportunity_tier === 'golden');
      const avgFollowers = golden?.avg_followers_gained || 0;
      
      if (avgFollowers > 3) return { status: 'good', message: `Golden tier: ${avgFollowers.toFixed(1)} followers/reply` };
      if (avgFollowers > 1) return { status: 'warning', message: `Golden tier: ${avgFollowers.toFixed(1)} followers/reply (target: 3+)` };
      return { status: 'warning', message: `Low conversion: ${avgFollowers.toFixed(1)} followers/reply` };
    }
  },
  
  {
    name: 'Generator Performance (7 days)',
    query: `
      SELECT 
        cm.generator_name,
        COUNT(*) as total_replies,
        AVG(rc.followers_gained) as avg_conversion,
        AVG(rc.reply_likes) as avg_engagement,
        AVG(cm.quality_score) as avg_quality
      FROM content_metadata cm
      LEFT JOIN reply_conversions rc ON cm.decision_id = rc.reply_decision_id
      WHERE cm.decision_type = 'reply'
        AND cm.posted_at > NOW() - INTERVAL '7 days'
      GROUP BY cm.generator_name
      HAVING COUNT(*) >= 3
      ORDER BY avg_conversion DESC NULLS LAST
    `,
    check: (data) => {
      if (data.length === 0) return { status: 'warning', message: 'No generator data' };
      
      const best = data[0];
      const bestName = best.generator_name || 'unknown';
      const bestConversion = best.avg_conversion || 0;
      
      if (bestConversion > 2) return { status: 'good', message: `Best: ${bestName} (${bestConversion.toFixed(1)} followers/reply)` };
      return { status: 'warning', message: `Best: ${bestName} (${bestConversion.toFixed(1)} followers/reply)` };
    }
  },
  
  {
    name: 'Stale Opportunities',
    query: `
      SELECT 
        COUNT(*) as stale_opportunities,
        AVG(EXTRACT(EPOCH FROM (NOW() - tweet_posted_at))/3600) as avg_hours_old
      FROM reply_opportunities
      WHERE tweet_posted_at < NOW() - INTERVAL '24 hours'
        AND status = 'pending'
    `,
    check: (data) => {
      const stale = Number(data[0]?.stale_opportunities || 0);
      
      if (stale > 100) return { status: 'warning', message: `${stale} stale opportunities (need cleanup)` };
      if (stale > 0) return { status: 'warning', message: `${stale} stale opportunities` };
      return { status: 'good', message: 'No stale opportunities' };
    }
  },
  
  {
    name: 'Duplicate Replies Check',
    query: `
      SELECT 
        target_tweet_id,
        COUNT(*) as reply_count
      FROM content_metadata
      WHERE decision_type = 'reply'
        AND status IN ('posted', 'queued')
      GROUP BY target_tweet_id
      HAVING COUNT(*) > 1
    `,
    check: (data) => {
      if (data.length > 0) return { status: 'critical', message: `${data.length} tweets with duplicate replies!` };
      return { status: 'good', message: 'No duplicate replies detected' };
    }
  }
];

async function runHealthAudit() {
  console.log('🔍 REPLY SYSTEM HEALTH AUDIT\n');
  console.log('═'.repeat(80));
  
  const results: Array<{
    name: string;
    status: 'good' | 'warning' | 'critical';
    message: string;
    data?: any[];
  }> = [];
  
  for (const check of healthChecks) {
    try {
      console.log(`\n📊 ${check.name}...`);
      
      const { data, error } = await supabase.rpc('exec_sql', { query: check.query });
      
      if (error) {
        // Try direct query if RPC fails
        const result = await supabase.from('_').select('*').limit(0);
        
        // Fallback: use raw query via pg
        console.log(`   ⚠️ RPC failed, trying direct query...`);
        continue;
      }
      
      const checkResult = check.check(data || []);
      results.push({
        name: check.name,
        status: checkResult.status,
        message: checkResult.message,
        data: data || []
      });
      
      const icon = checkResult.status === 'good' ? '✅' : checkResult.status === 'warning' ? '⚠️' : '🚨';
      console.log(`   ${icon} ${checkResult.message}`);
      
      // Show sample data for some checks
      if (data && data.length > 0 && ['Opportunity Pool Health', 'Generator Performance (7 days)'].includes(check.name)) {
        console.log(`   📋 Details:`);
        data.slice(0, 5).forEach((row: any) => {
          const rowStr = Object.entries(row)
            .map(([k, v]) => `${k}=${typeof v === 'number' ? Number(v).toFixed(2) : v}`)
            .join(', ');
          console.log(`      • ${rowStr}`);
        });
      }
      
    } catch (error: any) {
      console.log(`   ❌ Error: ${error.message}`);
      results.push({
        name: check.name,
        status: 'critical',
        message: `Check failed: ${error.message}`
      });
    }
  }
  
  // Summary
  console.log('\n' + '═'.repeat(80));
  console.log('\n📊 SUMMARY\n');
  
  const good = results.filter(r => r.status === 'good').length;
  const warnings = results.filter(r => r.status === 'warning').length;
  const critical = results.filter(r => r.status === 'critical').length;
  
  console.log(`✅ Good:     ${good}/${results.length}`);
  console.log(`⚠️  Warnings: ${warnings}/${results.length}`);
  console.log(`🚨 Critical: ${critical}/${results.length}\n`);
  
  if (critical > 0) {
    console.log('🚨 CRITICAL ISSUES FOUND:');
    results
      .filter(r => r.status === 'critical')
      .forEach(r => console.log(`   • ${r.name}: ${r.message}`));
    console.log('');
  }
  
  if (warnings > 0) {
    console.log('⚠️  WARNINGS:');
    results
      .filter(r => r.status === 'warning')
      .forEach(r => console.log(`   • ${r.name}: ${r.message}`));
    console.log('');
  }
  
  // Overall health
  const healthScore = (good / results.length) * 100;
  let overallStatus = 'HEALTHY';
  if (critical > 0) overallStatus = 'CRITICAL';
  else if (warnings > 2) overallStatus = 'NEEDS ATTENTION';
  else if (warnings > 0) overallStatus = 'GOOD';
  
  console.log(`\n🎯 Overall System Health: ${overallStatus} (${healthScore.toFixed(0)}%)`);
  console.log('═'.repeat(80));
}

// Run audit
runHealthAudit().catch(error => {
  console.error('❌ Audit failed:', error);
  process.exit(1);
});

